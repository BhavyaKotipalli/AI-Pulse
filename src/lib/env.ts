import { z } from "zod";

const bool = z
  .enum(["true", "false", "1", "0"])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === "true" || v === "1"));

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url().optional(),
  PGLITE_DIR: z.string().optional(),
  DEMO_MODE: bool,
  /**
   * mock: offline, no key. gemini / groq / openrouter: hosted APIs with free tiers.
   * openai: any OpenAI-compatible endpoint (OPENAI_BASE_URL), e.g. local Ollama.
   */
  AI_PROVIDER: z.enum(["mock", "gemini", "groq", "openrouter", "openai"]).default("mock"),
  GEMINI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().url().optional(),
  /** Override the per-provider default model for each tier. */
  AI_FAST_MODEL: z.string().optional(),
  AI_STRONG_MODEL: z.string().optional(),
  /** auto: Gemini embeddings when GEMINI_API_KEY is set, otherwise offline hashing. */
  EMBEDDING_PROVIDER: z.enum(["auto", "mock", "gemini", "openai"]).default("auto"),
  AI_EMBEDDING_MODEL: z.string().optional(),
  AI_RELEVANCE_FLOOR: z.coerce.number().min(0).max(1).optional(),
  /** Free-tier guards: spacing between model calls and a hard cap on calls per UTC day. */
  AI_REQUESTS_PER_MINUTE: z.coerce.number().int().positive().default(8),
  AI_DAILY_REQUEST_LIMIT: z.coerce.number().int().positive().default(300),
  BETTER_AUTH_SECRET: z.string().min(16).optional(),
  BETTER_AUTH_URL: z.string().url().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_TOKEN: z.string().optional(),
  CRON_SECRET: z.string().min(16).optional(),
  /** Comma-separated emails allowed to trigger jobs from the UI in production. */
  ADMIN_EMAILS: z
    .string()
    .optional()
    .transform((v) => (v ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)),
  SEED_MODE: z.enum(["demo", "reference"]).optional(),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"]).default("info"),
});

export type Env = z.infer<typeof EnvSchema> & { DEMO_MODE: boolean };

let cached: Env | undefined;

/** Validated server environment. Throws with a readable message on misconfiguration. */
export function env(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = { ...parsed.data, DEMO_MODE: parsed.data.DEMO_MODE ?? true };
  return cached;
}
