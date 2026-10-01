# AI Pulse — Implementation Plan

Status legend: ✅ done · 🟡 in progress · ⬜ not started

## Releases

| Release | Scope |
|---|---|
| **MVP** | Phases 1–5 + 8 core: dashboard, Today briefing, research/open-source/trends/career/experiments views, item intelligence page, real ingestion (RSS, arXiv, HN, GitHub), enrichment + scoring, hybrid search, Ask AI with citations, bookmarks, usage dashboard. |
| **V1** | Voice assistant, personalization re-ranking v2, trend/knowledge-graph explorer, weekly report, analytics windows (24h/7d/30d/90d), timeline zoom, startup radar enrichment, GitHub OAuth. |
| **V2** | pg-boss queue + near-real-time ingestion, Reddit/Product Hunt/Semantic Scholar connectors, personal AI memory, email digest, light theme, premium voice providers. |
| **V3** | Teams/workspaces, mobile app, Crunchbase-grade startup data, public API. |

## Phase 1 — Foundation ✅ (2026-10-01)

Delivered:
- [x] Docs: PRD, architecture, schema, agent system, pipeline, design system, this plan
- [x] Next.js 16 (App Router, Turbopack, typed routes) + TypeScript strict + Tailwind v4 + Radix primitives + Recharts
- [x] Design tokens + UI primitives (button, card, badge, skeleton, tooltip, kbd) and domain components (score badge with breakdown, claim labels, momentum/difficulty/status badges, sparklines, story/trend/experiment/repo/startup/skill cards, timeline, filter chips)
- [x] App shell: sidebar, glass top bar, mobile nav sheet, demo banner, AI status pill, loading skeletons, error boundary, 404
- [x] Drizzle schema for **all** planned tables (content, knowledge graph, trends, career, experiments, startups, briefings, users, bookmarks, events, conversations, AI usage, job runs) + pgvector HNSW index; migrations
- [x] DB client switch: `DATABASE_URL` → node-postgres; otherwise embedded PGlite + pgvector (zero-install); `memory://` for tests
- [x] Demo dataset (41 items, 7 trends, 9 experiments, 8 startups, 64 entities, 14 skills, 8 role analyses, daily briefing) — real developments/papers/repos, simulated dates, `is_demo` everywhere
- [x] Deterministic Intelligence Score (8 weighted dimensions, clickbait penalty, corroboration bonus), skill-momentum classifier, citation validator, RRF fusion, personalization — all unit-tested
- [x] AI provider abstraction (`LLMProvider`, `EmbeddingProvider`, tiered registry) + offline mock providers (extractive cited answers; feature-hashed 768-d embeddings with a measured relevance floor)
- [x] Better Auth (email/password; GitHub OAuth when configured) with lazy init + demo-guest viewer; production refuses to start without `BETTER_AUTH_SECRET`
- [x] Every navigation destination functional: Overview, Today, For You, Trends (+detail), Research, Experiments (+detail, "Build this"), Tools, Open Source, Startups (+detail), Career Impact, Library, Ask AI, Settings (interests + AI usage dashboard), Search, Intelligence item page, Sign-in
- [x] ⌘K command palette (hybrid search, navigation, ask), `g`+key shortcuts, `/` to search
- [x] Hybrid search API (pgvector cosine + Postgres FTS, RRF, score-aware), rate limited
- [x] Ask AI: NDJSON streaming, retrieval grounding, temporal intent ("what happened today"), follow-up context, pinned "ask about this item", citation validation, conversation persistence, usage metering, stop button
- [x] Bookmarks (six collections, optimistic UI) + Library with semantic search; preferences; implicit view/save/ask events
- [x] Security headers; Zod validation on every action/route; structured logging (pino)
- [x] Quality: ESLint clean, `tsc` clean, 50 Vitest tests (unit + PGlite integration), production build clean, responsive QA at 375 px (no horizontal overflow)

Known gaps carried forward:
- Unknown `/intel/<id>` renders the 404 UI with HTTP 200 (streaming starts before `notFound()`); fix by moving the lookup above the Suspense boundary or dropping the group-level `loading.tsx` for detail routes (Phase 10).
- Rate limiter is in-memory (single instance) — move to Postgres/Upstash for serverless (Phase 10).
- `drizzle-kit` pulls an esbuild version with a moderate dev-server advisory (dev tooling only, not shipped).
- Trend "graph" is a propagation chain; the interactive knowledge-graph explorer is Phase 4 (`entityGraph()` repository is ready).

## Phase 2 — Ingestion ⬜ (next)
- `SourceConnector` interface + Zod-validated connectors: RSS/Atom (official blogs, publications), arXiv API (3 s spacing), HN Algolia, GitHub search + repo snapshots, HF Daily Papers
- Normalizer: canonical URL (strip tracking params), `url_hash`, `content_hash`, permitted snippet only
- Job runner with `job_runs` lock + stats; `npm run job ingest`; `/api/cron/ingest` behind `CRON_SECRET`
- Ingested items get heuristic sub-scores until Phase 3 (source credibility × recency × momentum), flagged `status = normalized`
- Sources admin view in Settings; `npm run db:purge-demo`

## Phase 3 — Intelligence engine ⬜
Real providers (Anthropic Messages API, OpenAI-compatible incl. Ollama, Gemini) with streaming + structured output repair loop; real embeddings (768-d); batched fast-tier classification/extraction; dedup clustering (URL → SimHash → cosine ≥ 0.88); scoring from extracted sub-scores; strong-tier deep analysis for score ≥ 65; `ai_cache`; cost table + daily budget guard; FTS GIN index.

## Phase 4 — Trend engine ⬜
Embedding clustering over 30-day windows, trend matching/creation, daily snapshots, 24h/7d/30d/90d analytics, interactive knowledge-graph explorer (entities ↔ trends ↔ items).

## Phase 5 — Ask AI ⬜
Real-model streaming, history sidebar on mobile, regenerate/edit, per-claim citation UI, retrieval evals.

## Phase 6 — Voice ⬜
`VoiceProvider` interface; Web Speech STT/TTS; animated visualizer; barge-in; streaming sentence-level TTS.

## Phase 7 — Career intelligence ⬜
Generate career impacts per trend; skill evidence counting from extracted entities; job-posting signals (optional source).

## Phase 8 — Experiment engine ⬜
Experiment generation from major items; LLM "Build this" extended plan (milestones, starter repo layout, eval criteria), cached per experiment.

## Phase 9 — Automation ⬜
`vercel.json` crons, daily briefing + weekly "State of AI" jobs, budget guard, job dashboard.

## Phase 10 — Hardening ⬜
Playwright e2e, Ask AI citation eval suite, OpenTelemetry/Sentry, CSP, distributed rate limiting, 404 status fix, a11y audit, performance pass, deployment guide.
