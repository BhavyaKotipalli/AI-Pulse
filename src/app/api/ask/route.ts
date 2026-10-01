import { z } from "zod";
import { validateCitationMarkers } from "@/domain/citations";
import { logger } from "@/lib/logger";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { getViewer } from "@/server/auth/viewer";
import type { MessageCitation } from "@/server/db/schema";
import { QA_SYSTEM_PROMPT, buildGroundedPrompt, retrieveSources } from "@/server/qa/answer";
import { appendExchange } from "@/server/repositories/conversations";
import { recordEvent, recordUsage } from "@/server/repositories/user-data";
import { getLLM } from "@/services/ai/registry";

export const runtime = "nodejs";

const Body = z.object({
  question: z.string().trim().min(2).max(1000),
  conversationId: z.string().max(100).optional(),
  aboutItemId: z.string().max(100).optional(),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .max(12)
    .default([]),
});

export type AskEvent =
  | { type: "sources"; sources: MessageCitation[] }
  | { type: "delta"; text: string }
  | { type: "done"; conversationId: string | null; cited: number[]; removedCitations: number; provider: string; isMock: boolean }
  | { type: "error"; message: string };

/**
 * Streams newline-delimited JSON events:
 * sources → delta* → done. Answers are grounded in retrieved items and citations are validated.
 */
export async function POST(req: Request) {
  const limit = rateLimit(`ask:${clientKey(req)}`, { capacity: 10, refillPerMinute: 10 });
  if (!limit.ok) {
    return Response.json({ error: "Too many questions — try again shortly." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const viewer = await getViewer();
  const llm = getLLM();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: AskEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
      const started = Date.now();
      try {
        const sources = await retrieveSources(body.question, body.history, body.aboutItemId);
        const citations: MessageCitation[] = sources.map((s) => ({
          index: s.index,
          itemId: s.itemId,
          title: s.title,
          url: s.url,
          source: s.source,
          publishedAt: s.publishedAt.toISOString(),
        }));
        send({ type: "sources", sources: citations });

        const request = {
          tier: "strong" as const,
          task: "ask",
          system: QA_SYSTEM_PROMPT,
          messages: [...body.history.slice(-6), { role: "user" as const, content: buildGroundedPrompt(body.question, sources) }],
          maxOutputTokens: 900,
        };
        let answer = "";
        for await (const chunk of llm.stream(request)) {
          answer += chunk;
          send({ type: "delta", text: chunk });
        }

        const validated = validateCitationMarkers(answer, sources.length);
        if (validated.removed > 0) logger.warn({ removed: validated.removed }, "ask: removed invalid citation markers");

        let conversationId: string | null = null;
        if (viewer) {
          const citedSources = citations.filter((c) => validated.cited.includes(c.index));
          conversationId = await appendExchange({
            userId: viewer.id,
            conversationId: body.conversationId,
            question: body.question,
            answer: validated.text,
            citations: citedSources,
          });
          await recordEvent(viewer.id, "ask", undefined, body.question.toLowerCase().split(/\W+/).filter((w) => w.length > 3).slice(0, 10));
        }
        await recordUsage({
          provider: llm.id,
          model: llm.isMock ? "mock-extractive" : llm.id,
          tier: "strong",
          task: "ask",
          inputTokens: Math.ceil(request.messages.reduce((n, m) => n + m.content.length, 0) / 4),
          outputTokens: Math.ceil(answer.length / 4),
          costUsd: 0,
          latencyMs: Date.now() - started,
        });
        send({ type: "done", conversationId, cited: validated.cited, removedCitations: validated.removed, provider: llm.id, isMock: llm.isMock });
      } catch (err) {
        logger.error({ err }, "ask failed");
        send({ type: "error", message: "Something went wrong while answering. Please try again." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
