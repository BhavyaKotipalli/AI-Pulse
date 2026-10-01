import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { env } from "@/lib/env";
import { getDb } from "@/server/db/client";
import { account, session, user, verification } from "@/server/db/schema";

export function isGithubEnabled(): boolean {
  const e = env();
  return Boolean(e.GITHUB_CLIENT_ID && e.GITHUB_CLIENT_SECRET);
}

function createAuth() {
  const e = env();
  if (e.NODE_ENV === "production" && !e.BETTER_AUTH_SECRET) {
    throw new Error("BETTER_AUTH_SECRET must be set in production");
  }
  return betterAuth({
    appName: "AI Pulse",
    baseURL: e.BETTER_AUTH_URL,
    // Development-only fallback so `npm run dev` works without configuration.
    secret: e.BETTER_AUTH_SECRET ?? "ai-pulse-dev-secret-change-me-0000000000",
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: { user, session, account, verification },
    }),
    emailAndPassword: { enabled: true, minPasswordLength: 10 },
    socialProviders: isGithubEnabled() ? { github: { clientId: e.GITHUB_CLIENT_ID!, clientSecret: e.GITHUB_CLIENT_SECRET! } } : undefined,
    plugins: [nextCookies()],
  });
}

type Auth = ReturnType<typeof createAuth>;
let instance: Auth | undefined;

/**
 * Lazily constructed so importing this module (e.g. during `next build`) never opens a
 * database connection.
 */
export function getAuth(): Auth {
  instance ??= createAuth();
  return instance;
}
