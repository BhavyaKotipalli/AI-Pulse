import { z, type ZodType } from "zod";
import { EMBEDDING_DIMENSIONS } from "@/domain/constants";
import { generateStructured } from "@/services/ai/structured";
import {
  ProviderError,
  type EmbeddingKind,
  type EmbeddingProvider,
  type GenerateRequest,
  type GenerateResult,
  type LLMProvider,
  type ModelTier,
} from "@/services/ai/types";
import { approxTokens, postJson, sseData } from "./http";

/**
 * Adapter for any OpenAI-compatible Chat Completions API. One implementation serves
 * Google Gemini (its OpenAI-compatible endpoint), Groq, OpenRouter, and local Ollama —
 * only base URL, key and model names differ.
 */
export interface OpenAICompatibleConfig {
  id: string;
  baseUrl: string;
  apiKey: string;
  models: Record<ModelTier, string>;
  /** Some endpoints reject `response_format`; set false to rely on prompt-only JSON. */
  supportsJsonMode?: boolean;
}

const ChatResponse = z.object({
  model: z.string().optional(),
  choices: z
    .array(z.object({ message: z.object({ content: z.string().nullish() }), finish_reason: z.string().nullish() }))
    .min(1),
  usage: z.object({ prompt_tokens: z.number().optional(), completion_tokens: z.number().optional() }).nullish(),
});

const StreamChunk = z.object({
  choices: z.array(z.object({ delta: z.object({ content: z.string().nullish() }).nullish() })).optional(),
});

export class OpenAICompatibleLLM implements LLMProvider {
  readonly id: string;
  readonly isMock = false;
  readonly models: Record<ModelTier, string>;

  constructor(private readonly config: OpenAICompatibleConfig) {
    this.id = config.id;
    this.models = config.models;
  }

  private url(path: string) {
    return `${this.config.baseUrl.replace(/\/+$/, "")}${path}`;
  }

  private body(req: GenerateRequest, stream: boolean) {
    const messages = [...(req.system ? [{ role: "system", content: req.system }] : []), ...req.messages];
    return {
      model: this.models[req.tier],
      messages,
      stream,
      // Generous default: reasoning models spend part of this budget before the visible answer.
      max_tokens: req.maxOutputTokens ?? 4096,
      ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
      ...(req.json && this.config.supportsJsonMode !== false ? { response_format: { type: "json_object" } } : {}),
    };
  }

  private headers() {
    return { Authorization: `Bearer ${this.config.apiKey}` };
  }

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const res = await postJson(this.url("/chat/completions"), this.body(req, false), {
      headers: this.headers(),
      provider: this.id,
      signal: req.signal,
      timeoutMs: 90_000,
    });
    const parsed = ChatResponse.safeParse(await res.json());
    if (!parsed.success) throw new ProviderError(`${this.id}: unexpected response shape`);
    const text = parsed.data.choices[0]!.message.content ?? "";
    if (!text.trim()) {
      throw new ProviderError(`${this.id}: empty response (finish_reason=${parsed.data.choices[0]!.finish_reason ?? "unknown"})`);
    }
    const prompt = req.messages.map((m) => m.content).join("\n") + (req.system ?? "");
    return {
      text,
      model: parsed.data.model ?? this.models[req.tier],
      inputTokens: parsed.data.usage?.prompt_tokens ?? approxTokens(prompt),
      outputTokens: parsed.data.usage?.completion_tokens ?? approxTokens(text),
    };
  }

  generateObject<T>(req: GenerateRequest, schema: ZodType<T>): Promise<T> {
    return generateStructured((r) => this.generate(r), req, schema);
  }

  async *stream(req: GenerateRequest): AsyncIterable<string> {
    const res = await postJson(this.url("/chat/completions"), this.body(req, true), {
      headers: this.headers(),
      provider: this.id,
      signal: req.signal,
      timeoutMs: 120_000,
    });
    for await (const data of sseData(res)) {
      let json: unknown;
      try {
        json = JSON.parse(data);
      } catch {
        continue; // keep-alive or partial frame
      }
      const chunk = StreamChunk.safeParse(json);
      const delta = chunk.success ? chunk.data.choices?.[0]?.delta?.content : null;
      if (delta) yield delta;
    }
  }
}

const EmbeddingResponse = z.object({
  data: z.array(z.object({ index: z.number().optional(), embedding: z.array(z.number()) })),
});

/** Truncates to the stored width and L2-normalizes (valid for Matryoshka-trained embedding models). */
export function fitVector(values: number[], dims: number = EMBEDDING_DIMENSIONS): number[] {
  if (values.length < dims) throw new ProviderError(`Embedding has ${values.length} dimensions; at least ${dims} required`);
  const cut = values.length === dims ? values : values.slice(0, dims);
  const norm = Math.hypot(...cut);
  return norm === 0 ? cut : cut.map((v) => v / norm);
}

export interface OpenAICompatibleEmbeddingConfig {
  id: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  relevanceFloor: number;
  /** Texts per request; providers cap batch sizes differently. */
  batchSize?: number;
}

export class OpenAICompatibleEmbedder implements EmbeddingProvider {
  readonly id: string;
  readonly isMock = false;
  readonly dimensions = EMBEDDING_DIMENSIONS;
  readonly relevanceFloor: number;

  constructor(private readonly config: OpenAICompatibleEmbeddingConfig) {
    this.id = `${config.id}:${config.model}:${EMBEDDING_DIMENSIONS}`;
    this.relevanceFloor = config.relevanceFloor;
  }

  // `kind` is accepted for interface parity; the OpenAI-compatible API has no task-type field.
  async embed(texts: string[], _kind?: EmbeddingKind): Promise<number[][]> {
    const out: number[][] = [];
    const size = this.config.batchSize ?? 64;
    for (let i = 0; i < texts.length; i += size) {
      const batch = texts.slice(i, i + size).map((t) => t.slice(0, 8000) || " ");
      const res = await postJson(
        `${this.config.baseUrl.replace(/\/+$/, "")}/embeddings`,
        { model: this.config.model, input: batch, dimensions: EMBEDDING_DIMENSIONS },
        { headers: { Authorization: `Bearer ${this.config.apiKey}` }, provider: this.config.id, timeoutMs: 60_000 },
      );
      const parsed = EmbeddingResponse.safeParse(await res.json());
      if (!parsed.success || parsed.data.data.length !== batch.length) {
        throw new ProviderError(`${this.config.id}: unexpected embeddings response`);
      }
      const ordered = [...parsed.data.data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
      for (const row of ordered) out.push(fitVector(row.embedding));
    }
    return out;
  }
}
