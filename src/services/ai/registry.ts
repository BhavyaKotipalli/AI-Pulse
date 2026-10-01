import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { mockEmbeddingProvider } from "@/services/mock/embeddings";
import { MockLLMProvider } from "@/services/mock/llm";
import type { EmbeddingProvider, LLMProvider } from "./types";

/**
 * Single place that decides which AI providers back the app.
 * Application code depends on the interfaces only — never on mock/ or providers/ directly.
 *
 * Real adapters (Anthropic, OpenAI-compatible, Gemini) land in Phase 3 under
 * src/services/providers. Until then a configured provider falls back to the mock
 * and the UI reports it via `aiStatus()`.
 */

export interface AIStatus {
  configured: string;
  active: string;
  isMock: boolean;
  note?: string;
}

let llm: LLMProvider | undefined;
let embedder: EmbeddingProvider | undefined;
let status: AIStatus | undefined;

function init() {
  if (llm && embedder && status) return;
  const configured = env().AI_PROVIDER;
  llm = new MockLLMProvider();
  embedder = mockEmbeddingProvider;
  status = { configured, active: llm.id, isMock: true };
  if (configured !== "mock") {
    status.note = `AI_PROVIDER=${configured} is configured, but real provider adapters ship in Phase 3. Using the offline mock.`;
    logger.warn({ configured }, status.note);
  }
}

export function getLLM(): LLMProvider {
  init();
  return llm!;
}

export function getEmbedder(): EmbeddingProvider {
  init();
  return embedder!;
}

export function aiStatus(): AIStatus {
  init();
  return status!;
}
