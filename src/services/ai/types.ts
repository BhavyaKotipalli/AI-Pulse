import type { ZodType } from "zod";

export type ModelTier = "fast" | "strong";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface GenerateRequest {
  tier: ModelTier;
  /** Short task name for usage metering, e.g. "classify", "ask". */
  task: string;
  system?: string;
  messages: ChatMessage[];
  maxOutputTokens?: number;
  temperature?: number;
  /** Ask the provider for a JSON response (used by structured generation). */
  json?: boolean;
  signal?: AbortSignal;
}

export interface GenerateResult {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface LLMProvider {
  readonly id: string;
  /** True when the provider is an offline stand-in (demo mode). Surfaced in the UI. */
  readonly isMock: boolean;
  /** Model used per tier, for status display and usage records. */
  readonly models: Record<ModelTier, string>;
  generate(req: GenerateRequest): Promise<GenerateResult>;
  generateObject<T>(req: GenerateRequest, schema: ZodType<T>): Promise<T>;
  stream(req: GenerateRequest): AsyncIterable<string>;
}

export type EmbeddingKind = "document" | "query";

export interface EmbeddingProvider {
  /** Stable identifier of the vector space. Stored per item; vectors from different ids are never compared. */
  readonly id: string;
  readonly isMock: boolean;
  readonly dimensions: number;
  /** Cosine similarity below which a vector-only match is treated as noise (distribution differs per model). */
  readonly relevanceFloor: number;
  embed(texts: string[], kind?: EmbeddingKind): Promise<number[][]>;
}

/** Retrieved context passed to grounded generation. Index is 1-based and matches `[n]` markers. */
export interface GroundingSource {
  index: number;
  itemId: string;
  title: string;
  url: string;
  source: string | null;
  publishedAt: Date;
  text: string;
}

/** The provider rejected the call because a rate or quota limit was hit. Callers should stop and resume later. */
export class RateLimitError extends Error {
  constructor(
    message: string,
    readonly retryAfterSec?: number,
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}

/** Non-retryable provider failure (bad key, bad request, safety block, malformed output). */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

/** The app's own daily request budget is exhausted (protects free-tier quotas). */
export class BudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BudgetExceededError";
  }
}
