@AGENTS.md

# AI Pulse — working notes

- Docs live in `docs/` (architecture, schema, agents, pipeline, design system, plan). Update `docs/IMPLEMENTATION_PLAN.md` when a phase completes.
- Layering: `app → components/server → services → domain`. `domain/` is pure (no I/O). App code never imports `services/mock` directly — only `services/ai/registry.ts` picks providers.
- Local DB is embedded PGlite (single process): stop `npm run dev` before `npm run setup`, `npm run db:seed`, or `npm run build`.
- Schema change: edit `src/server/db/schema/*` → `npm run db:generate` → `npm run setup`.
- Quality gate before finishing work: `npm run check` (lint + typecheck + tests) and `npm run build`.
- Trust rules: never present seeded/demo content as real; facts need `sourceItemIds`; label analysis/speculation.
- New tables must get `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` in their migration (see `drizzle/0003_enable_rls.sql`); the app connects as owner.
- All model calls go through `ai()` in `src/server/ai/gateway.ts` (pacing, daily cap, metering). Never call a provider directly from app code.
- Never put API keys in code, docs, commits or chat; they live in `.env.local` and host env vars.
