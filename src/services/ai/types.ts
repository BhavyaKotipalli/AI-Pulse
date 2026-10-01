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
  generate(req: GenerateRequest): Promise<GenerateResult>;
  generateObject<T>(req: GenerateRequest, schema: ZodType<T>): Promise<T>;
  stream(req: GenerateRequest): AsyncIterable<string>;
}

export interface EmbeddingProvider {
  readonly id: string;
  readonly isMock: boolean;
  readonly dimensions: number;
  /** Cosine similarity below which a vector-only match is treated as noise (distribution differs per model). */
  readonly relevanceFloor: number;
  embed(texts: string[]): Promise<number[][]>;
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
