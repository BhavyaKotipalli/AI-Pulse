@AGENTS.md

# AI Pulse — working notes

- Docs live in `docs/` (architecture, schema, agents, pipeline, design system, plan). Update `docs/IMPLEMENTATION_PLAN.md` when a phase completes.
- Layering: `app → components/server → services → domain`. `domain/` is pure (no I/O). App code never imports `services/mock` directly — only `services/ai/registry.ts` picks providers.
- Local DB is embedded PGlite (single process): stop `npm run dev` before `npm run setup`, `npm run db:seed`, or `npm run build`.
- Schema change: edit `src/server/db/schema/*` → `npm run db:generate` → `npm run setup`.
- Quality gate before finishing work: `npm run check` (lint + typecheck + tests) and `npm run build`.
- Trust rules: never present seeded/demo content as real; facts need `sourceItemIds`; label analysis/speculation.
