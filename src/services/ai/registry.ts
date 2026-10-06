import { env, type Env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { mockEmbeddingProvider } from "@/services/mock/embeddings";
import { MockLLMProvider } from "@/services/mock/llm";
import { OpenAICompatibleEmbedder, OpenAICompatibleLLM } from "@/services/providers/openai-compatible";
import type { EmbeddingProvider, LLMProvider, ModelTier } from "./types";

/**
 * Single place that decides which AI providers back the app.
 * Application code depends on the interfaces only — never on mock/ or providers/ directly.
 *
 * Every hosted provider is reached through its OpenAI-compatible API, so adding one is a
 * preset here, not new adapter code. A missing key never crashes the app: it falls back
 * to the offline mock and says so in `aiStatus()`.
 */

interface Preset {
  baseUrl: string;
  key: (e: Env) => string | undefined;
  keyName: string;
  models?: Record<ModelTier, string>;
}

/** Default models verified against provider docs on 2026-10-06; override with AI_FAST_MODEL / AI_STRONG_MODEL. */
const PRESETS: Record<Exclude<Env["AI_PROVIDER"], "mock">, Preset> = {
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    key: (e) => e.GEMINI_API_KEY,
    keyName: "GEMINI_API_KEY",
    models: { fast: "gemini-3.5-flash-lite", strong: "gemini-3.8-flash" },
  },
  groq: {
    baseUrl: "https://api.groq.com/openai/v1",
    key: (e) => e.GROQ_API_KEY,
    keyName: "GROQ_API_KEY",
    models: { fast: "openai/gpt-oss-20b", strong: "openai/gpt-oss-120b" },
  },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    key: (e) => e.OPENROUTER_API_KEY,
    keyName: "OPENROUTER_API_KEY",
  },
  openai: {
    baseUrl: "",
    key: (e) => e.OPENAI_API_KEY ?? "not-needed", // local endpoints such as Ollama ignore the key
    keyName: "OPENAI_API_KEY",
  },
};

export interface AIStatus {
  configured: string;
  active: string;
  isMock: boolean;
  models: Record<ModelTier, string>;
  embeddings: string;
  embeddingsMock: boolean;
  notes: string[];
}

interface State {
  llm: LLMProvider;
  embedder: EmbeddingProvider;
  status: AIStatus;
}

let state: State | undefined;

function buildLLM(e: Env, notes: string[]): LLMProvider {
  if (e.AI_PROVIDER === "mock") return new MockLLMProvider();
  const preset = PRESETS[e.AI_PROVIDER];
  const baseUrl = e.AI_PROVIDER === "openai" ? e.OPENAI_BASE_URL : preset.baseUrl;
  const apiKey = preset.key(e);
  const fast = e.AI_FAST_MODEL ?? preset.models?.fast;
  const strong = e.AI_STRONG_MODEL ?? preset.models?.strong ?? fast;
  const missing = [!apiKey && preset.keyName, !baseUrl && "OPENAI_BASE_URL", !fast && "AI_FAST_MODEL"].filter(Boolean);
  if (missing.length > 0 || !apiKey || !baseUrl || !fast || !strong) {
    notes.push(`AI_PROVIDER=${e.AI_PROVIDER} needs ${missing.join(", ")}. Using the offline mock until it is set.`);
    return new MockLLMProvider();
  }
  return new OpenAICompatibleLLM({ id: e.AI_PROVIDER, baseUrl, apiKey, models: { fast, strong } });
}

function buildEmbedder(e: Env, notes: string[]): EmbeddingProvider {
  const choice = e.EMBEDDING_PROVIDER === "auto" ? (e.GEMINI_API_KEY ? "gemini" : "mock") : e.EMBEDDING_PROVIDER;
  if (choice === "gemini") {
    if (!e.GEMINI_API_KEY) {
      notes.push("EMBEDDING_PROVIDER=gemini needs GEMINI_API_KEY. Using offline embeddings.");
      return mockEmbeddingProvider;
    }
    return new OpenAICompatibleEmbedder({
      id: "gemini",
      baseUrl: PRESETS.gemini.baseUrl,
      apiKey: e.GEMINI_API_KEY,
      model: e.AI_EMBEDDING_MODEL ?? "gemini-embedding-001",
      // Neural embeddings score unrelated text far above zero; tune with AI_RELEVANCE_FLOOR.
      relevanceFloor: e.AI_RELEVANCE_FLOOR ?? 0.6,
    });
  }
  if (choice === "openai") {
    if (!e.OPENAI_BASE_URL || !e.AI_EMBEDDING_MODEL) {
      notes.push("EMBEDDING_PROVIDER=openai needs OPENAI_BASE_URL and AI_EMBEDDING_MODEL. Using offline embeddings.");
      return mockEmbeddingProvider;
    }
    return new OpenAICompatibleEmbedder({
      id: "openai",
      baseUrl: e.OPENAI_BASE_URL,
      apiKey: e.OPENAI_API_KEY ?? "not-needed",
      model: e.AI_EMBEDDING_MODEL,
      relevanceFloor: e.AI_RELEVANCE_FLOOR ?? 0.5,
    });
  }
  return mockEmbeddingProvider;
}

function init(): State {
  if (state) return state;
  const e = env();
  const notes: string[] = [];
  const llm = buildLLM(e, notes);
  const embedder = buildEmbedder(e, notes);
  for (const n of notes) logger.warn(n);
  state = {
    llm,
    embedder,
    status: {
      configured: e.AI_PROVIDER,
      active: llm.id,
      isMock: llm.isMock,
      models: llm.models,
      embeddings: embedder.id,
      embeddingsMock: embedder.isMock,
      notes,
    },
  };
  return state;
}

export const getLLM = (): LLMProvider => init().llm;
export const getEmbedder = (): EmbeddingProvider => init().embedder;
export const aiStatus = (): AIStatus => init().status;

/** Test seam: inject scripted providers (pass nothing to reset). */
export function setProvidersForTesting(overrides?: { llm?: LLMProvider; embedder?: EmbeddingProvider }) {
  if (!overrides) {
    state = undefined;
    return;
  }
  const current = init();
  const llm = overrides.llm ?? current.llm;
  const embedder = overrides.embedder ?? current.embedder;
  state = {
    llm,
    embedder,
    status: { ...current.status, active: llm.id, isMock: llm.isMock, models: llm.models, embeddings: embedder.id, embeddingsMock: embedder.isMock },
  };
}
