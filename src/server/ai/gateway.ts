import { and, gte, ne, sql } from "drizzle-orm";
import type { ZodType } from "zod";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getDb } from "@/server/db/client";
import { aiUsage } from "@/server/db/schema";
import { getEmbedder, getLLM } from "@/services/ai/registry";
import { generateStructured } from "@/services/ai/structured";
import {
  BudgetExceededError,
  type EmbeddingKind,
  type GenerateRequest,
  type GenerateResult,
  type LLMProvider,
} from "@/services/ai/types";

/**
 * The only way server code should call a model. Adds, around the configured provider:
 *  - pacing (AI_REQUESTS_PER_MINUTE) so free-tier per-minute limits are not tripped,
 *  - a daily request cap (AI_DAILY_REQUEST_LIMIT) checked against recorded usage,
 *  - usage metering into `ai_usage` for the dashboard.
 * Background jobs keep a reserve of the daily cap free for interactive questions.
 */

const JOB_SHARE_OF_DAILY_LIMIT = 0.85;

let nextSlot = 0;
/** Serializes calls with a minimum gap. Module state is per process, which is what a single job run needs. */
async function pace() {
  const gapMs = 60_000 / env().AI_REQUESTS_PER_MINUTE;
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + gapMs;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

let cachedCount: { at: number; n: number } | undefined;

export async function requestsToday(): Promise<number> {
  if (cachedCount && Date.now() - cachedCount.at < 20_000) return cachedCount.n;
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(aiUsage)
    .where(and(gte(aiUsage.createdAt, start), ne(aiUsage.provider, "mock")));
  cachedCount = { at: Date.now(), n: row?.n ?? 0 };
  return cachedCount.n;
}

async function checkBudget(interactive: boolean) {
  const limit = env().AI_DAILY_REQUEST_LIMIT;
  const used = await requestsToday();
  const cap = interactive ? limit : Math.floor(limit * JOB_SHARE_OF_DAILY_LIMIT);
  if (used >= cap) {
    throw new BudgetExceededError(
      interactive
        ? `Daily AI request limit reached (${used}/${limit}). It resets at 00:00 UTC.`
        : `Background AI budget reached (${used}/${cap} of ${limit} daily requests); resuming tomorrow.`,
    );
  }
}

async function record(row: typeof aiUsage.$inferInsert) {
  try {
    await getDb().insert(aiUsage).values(row);
    if (cachedCount && row.provider !== "mock") cachedCount.n += 1;
  } catch (err) {
    logger.warn({ err }, "failed to record AI usage"); // metering must never break the request
  }
}

const tokens = (s: string) => Math.ceil(s.length / 4);

export interface Gateway {
  readonly llm: LLMProvider;
  embed(texts: string[], kind?: EmbeddingKind): Promise<number[][]>;
  readonly embeddingModel: string;
}

export function ai(opts: { interactive?: boolean } = {}): Gateway {
  const interactive = opts.interactive ?? false;
  const inner = getLLM();
  const embedder = getEmbedder();

  const guarded = async <T>(fn: () => Promise<T>): Promise<T> => {
    if (inner.isMock) return fn();
    await checkBudget(interactive);
    if (!interactive) await pace();
    return fn();
  };

  const generate = async (req: GenerateRequest): Promise<GenerateResult> => {
    const started = Date.now();
    const result = await guarded(() => inner.generate(req));
    await record({
      provider: inner.id,
      model: result.model,
      tier: req.tier,
      task: req.task,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      latencyMs: Date.now() - started,
    });
    return result;
  };

  const llm: LLMProvider = {
    id: inner.id,
    isMock: inner.isMock,
    models: inner.models,
    generate,
    generateObject<T>(req: GenerateRequest, schema: ZodType<T>): Promise<T> {
      // The mock refuses structured generation itself; real providers go through the metered path.
      return inner.isMock ? inner.generateObject(req, schema) : generateStructured(generate, req, schema);
    },
    async *stream(req: GenerateRequest): AsyncIterable<string> {
      const started = Date.now();
      if (!inner.isMock) await checkBudget(interactive);
      let output = "";
      try {
        for await (const chunk of inner.stream(req)) {
          output += chunk;
          yield chunk;
        }
      } finally {
        await record({
          provider: inner.id,
          model: inner.models[req.tier],
          tier: req.tier,
          task: req.task,
          inputTokens: tokens(req.messages.map((m) => m.content).join("") + (req.system ?? "")),
          outputTokens: tokens(output),
          latencyMs: Date.now() - started,
        });
      }
    },
  };

  return {
    llm,
    embeddingModel: embedder.id,
    async embed(texts, kind = "document") {
      if (texts.length === 0) return [];
      if (embedder.isMock) return embedder.embed(texts, kind);
      const started = Date.now();
      const vectors = await guarded(() => embedder.embed(texts, kind));
      await record({
        provider: embedder.id.split(":")[0] ?? embedder.id,
        model: embedder.id,
        tier: "embedding",
        task: kind === "query" ? "embed-query" : "embed-documents",
        inputTokens: texts.reduce((n, t) => n + tokens(t), 0),
        outputTokens: 0,
        latencyMs: Date.now() - started,
      });
      return vectors;
    },
  };
}
