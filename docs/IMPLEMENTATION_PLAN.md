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

## Phase 2 — Ingestion ✅ (2026-10-01)
- [x] `SourceConnector` interface; Zod-validated connectors: RSS/Atom (12 official/editorial feeds, verified live), arXiv (one query per run), Hacker News (Algolia, AI-filtered, ≥ 60 points), GitHub (5 topic searches, star-velocity momentum), Hugging Face Daily Papers (upvotes)
- [x] HTTP layer: HTTPS + host allow-list (SSRF guard), timeouts, size cap, retries with backoff + jitter, identifying User-Agent
- [x] Normalizer: canonical URLs (tracking params, www, fragments, trailing slashes), HTML stripping, ≤ 320-char permitted snippets, title cleanup
- [x] Dedup: URL hash; near-duplicate titles (Jaccard ≥ 0.6, 72 h) join the same story cluster; other sources linking a known URL count as corroboration exactly once (`metrics.seenIn`)
- [x] Deterministic enrichment: dictionary entity linking, rule-based category/launch detection, clickbait patterns, heuristic sub-scores (labeled "heuristic" in the UI), trend evidence linking (≥ 2 shared entities), skill evidence counting
- [x] Job runner with `job_runs` lock; `npm run job ingest|daily`; `/api/cron/[job]` (Bearer `CRON_SECRET`, fail-closed, timing-safe)
- [x] Settings: sources table (items, last fetch), job history, admin-only "Run now" (`ADMIN_EMAILS`)
- [x] Verified live: 16/16 sources, ~240 items in ~14 s; re-runs are idempotent

## Phase 3 — Intelligence engine ✅ (2026-10-06)
- [x] One OpenAI-compatible adapter (chat, streaming SSE, JSON mode, embeddings) with presets for Gemini, Groq, OpenRouter and custom endpoints; missing keys fall back to the offline mock with a visible note
- [x] Structured generation: JSON Schema in the prompt, Zod validation, one repair attempt, fail closed
- [x] AI gateway: pacing, daily request cap with an interactive reserve, usage metering; typed rate-limit / budget / provider errors
- [x] Enrichment job: batched fast-tier classification + sub-scores (`method: "llm"`), grounded TL;DRs (discarded when there is no excerpt), strong-tier deep analysis for score ≥ 65 with claims that cite the item; time-boxed and resumable
- [x] Embedding model tracked per item; automatic re-embedding when the provider changes; search degrades to full-text when embeddings are unavailable
- [x] Settings: provider/models/embeddings, requests today vs cap, admin "Test AI connection"

## Phase 4 — Trend engine ✅
- [x] LLM trend discovery with evidence gates (≥ 3 items from ≥ 2 sources, de-duplicated against existing trends, hallucinated references dropped, unsupported facts downgraded)
- [x] Deterministic trend momentum/status from live evidence (last 7 vs prior 7 days); daily snapshots
- [x] Interactive knowledge graph (`/graph` and per trend): server-side deterministic layout, type filters, search, keyboard accessible
- [x] Analytics windows 24 h / 7 d / 30 d / 90 d

## Phase 5 — Ask AI ✅
- [x] Real-model streaming through the gateway, citation validation, conversation history, pinned "ask about this item", actionable quota/provider error messages

## Phase 6 — Voice ✅
- [x] `VoiceProvider` interface + browser implementation (Web Speech recognition and synthesis)
- [x] Sentence-level spoken streaming, barge-in, mute toggle, animated visualizer

## Phase 7 — Career intelligence ✅
- [x] Generated role-impact analysis per trend with live evidence (labeled analysis, low confidence unless evidence discusses work effects); skill momentum from evidence counts

## Phase 8 — Experiment engine ✅
- [x] Experiments generated from top analyzed items; "Build this" detailed plan (milestones, repo layout, evaluation, risks) generated once and cached

## Phase 9 — Automation ✅
- [x] Vercel Cron (daily) + GitHub Actions scheduler (every 3 h); jobs `ingest → enrich → insights → daily`
- [x] Daily briefing and weekly "State of AI" report with optional model-written, citation-validated overview
- [x] `SEED_MODE=reference`, `vercel-build` migrations, CI

## Phase 10 — Hardening 🟡
- [x] Row-level security on all tables (hosts with a public data API), TLS policy for hosted Postgres, security headers, SSRF allow-list, fail-closed secrets
- [x] 98 unit/integration tests (in-memory Postgres, scripted model, fake connectors)
- [ ] Playwright end-to-end tests; Ask AI citation eval suite with a live model
- [ ] Distributed rate limiting (current limiter is per instance); Content-Security-Policy
- [ ] Unknown `/intel/<id>` returns the 404 UI with HTTP 200 (streaming starts before `notFound()`)
- [ ] Error monitoring (Sentry / OpenTelemetry)
- [ ] Live verification against real provider keys — adapters are tested against scripted HTTP responses; confirm with *Settings → Test AI connection* after adding a key

## Later (V2+)
Anthropic adapter via the official SDK (prompt caching, Batch API), premium voice providers, Reddit / Product Hunt / Semantic Scholar connectors, personal AI memory, email digest, light theme, teams.
