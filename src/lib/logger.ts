import pino from "pino";

/** Structured JSON logger. Use child loggers to attach context, e.g. `logger.child({ job: "ingest" })`. */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { app: "ai-pulse" },
  redact: { paths: ["*.apiKey", "*.authorization", "*.password", "*.token"], censor: "[redacted]" },
});
