import { existsSync } from "node:fs";

// Mirror Next.js precedence for CLI scripts: .env.local overrides .env.
for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}
