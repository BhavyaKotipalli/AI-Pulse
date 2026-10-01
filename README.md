# AI Pulse

**Understand AI before everyone else.** A personal intelligence system that monitors the AI and technology ecosystem, ranks developments by signal (not popularity), explains why they matter, tracks trends over time, and turns news into things to learn and build.

> Status: **Phase 1 (Foundation) and Phase 2 (live ingestion) complete; scheduled automation and a deterministic daily briefing are in.** Pulls live intelligence from 16 public sources (official lab blogs, publications, arXiv, Hugging Face Papers, Hacker News, GitHub). AI analysis uses an offline mock until real LLM providers land (Phase 3). See [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## What's in it

| Area | Highlights |
|---|---|
| **Overview** | Hero, today's headline, top stories ranked by Intelligence Score, trend radar, research radar, skill radar, experiment of the day, trending repos, startups, timeline |
| **Today** | Five-minute daily briefing; every bullet labeled **FACT / ANALYSIS / SPECULATION** with linked sources |
| **Intelligence page** | TL;DR, why it matters, technical + beginner explanations, *Why should I care?* per audience, *What should I do?*, labeled claims with evidence, related stories/papers/tools by vector similarity, "Ask about this" |
| **Trends** | Trend thesis, propagation chain, 90-day mention chart, implications, actors, evidence, linked career impact and experiments |
| **Research / Tools / Open Source / Startups** | Filterable radars; star-growth sparklines; startup fields marked verified vs not verified |
| **Career Impact** | Evidence-derived skill momentum (🔥 exploding · 📈 growing · ➡ stable · 📉 declining) and role-by-role automation/augmentation analysis |
| **Experiments** | Buildable projects with architecture, data needs, step-by-step plan, portfolio value; "Build this" tracks it in your library |
| **Ask AI** | Retrieval-grounded, streamed answers with validated `[n]` citations, follow-up context, persisted conversations, "I don't know" when nothing relevant is retrieved |
| **Library** | Bookmarks into six collections, semantic search over saved items |
| **Everywhere** | ⌘K / Ctrl+K command palette with hybrid search, `g`+key navigation, `/` to search, keyboard-first, responsive to 375 px |

## Quick start

Requirements: **Node 20.12+** (tested on Node 24). No Docker or database install needed.

```bash
npm install
```

```bash
npm run setup
```

```bash
npm run dev
```

Open http://localhost:3000. `setup` applies migrations to an embedded Postgres (PGlite + pgvector in `.data/pglite`) and loads the demo dataset.

> PGlite is single-process: stop `npm run dev` before running `npm run setup`, `npm run db:seed` or `npm run build`. Use `DATABASE_URL` (see below) for multi-process setups.

### Using real Postgres

```bash
docker compose up -d
```

Then set `DATABASE_URL=postgres://ai_pulse:ai_pulse@localhost:5432/ai_pulse` in `.env.local` and run `npm run setup`. Neon and Supabase work the same way (enable the `vector` extension).

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Development server (Turbopack) |
| `npm run build` / `npm start` | Production build / server (`BETTER_AUTH_SECRET` required in production) |
| `npm run setup` | Migrate; seed demo data if the database is empty |
| `npm run db:seed` | Migrate; wipe content tables and reseed (dates re-anchor to now) |
| `npm run db:generate` | Generate a migration after editing `src/server/db/schema` |
| `npm run job ingest` | Fetch all live sources now (normalize → dedupe → link → score) |
| `npm run job daily` | Rescore for recency, recompute skill momentum, snapshot trends, rebuild today's briefing |
| `npm run db:purge-demo` | Remove the simulated starter items (keeps curated reference data) |
| `npm run lint` · `npm run typecheck` · `npm test` | Quality gates (`npm run check` runs all three) |

## About the demo data

Demo intelligence describes **real** developments, **real** arXiv papers and **real** GitHub repositories, but **publication times are simulated** relative to seed time, repository metrics are approximate, and article links point to the publisher's index page. Every demo row has `is_demo = true` and is badged **DEMO** in the UI; a banner says so on every page. Startup funding amounts are deliberately omitted until they can come from cited sources.

## Architecture

```
src/
  domain/        Pure logic: scoring, skill momentum, citation validation, RRF, personalization (unit-tested)
  services/ai/   LLMProvider / EmbeddingProvider interfaces + registry (tiers: fast, strong)
  services/mock/ Offline providers (extractive answers, feature-hashed embeddings) + seed dataset
  server/db/     Drizzle schema (Postgres + pgvector), client (pg | PGlite), migrations, seed
  server/        repositories (queries), actions (validated mutations), auth (Better Auth), qa (RAG)
  app/           Routes: (app) shell pages, /api/ask (NDJSON streaming), /api/search, /api/auth, /api/health
  components/    ui primitives · shell (sidebar, top bar, ⌘K) · intel (cards, badges, sparklines)
```

Read more: [Product requirements](docs/PRODUCT_REQUIREMENTS.md) · [Architecture](docs/ARCHITECTURE.md) · [Database schema](docs/DATABASE_SCHEMA.md) · [Agent system](docs/AGENT_SYSTEM.md) · [Data pipeline](docs/DATA_PIPELINE.md) · [Design system](docs/DESIGN_SYSTEM.md) · [Implementation plan](docs/IMPLEMENTATION_PLAN.md)

### Trust model

- The Intelligence Score is a deterministic weighted formula over bounded sub-scores, so every score is explainable (hover any score badge).
- Ask AI only answers from retrieved items; citation markers are validated against the sources actually supplied; off-topic questions retrieve nothing and the assistant says so.
- The mock provider refuses structured generation rather than inventing analysis; items without real analysis say so.

## Configuration

See [.env.example](.env.example). Nothing is required for local demo mode.

## Deployment

Vercel + Neon, with daily Vercel Cron jobs for ingestion and the briefing. Step-by-step guide: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Live sources

OpenAI, Google DeepMind, Google AI, Hugging Face, NVIDIA, AWS ML, Apple ML Research, GitHub Blog (AI), MIT Technology Review, TechCrunch AI, The Verge AI, Ars Technica AI (RSS/Atom) · Hugging Face Daily Papers · arXiv (cs.AI/CL/LG/CV/RO/MA) · Hacker News (AI stories ≥ 60 points) · GitHub (new repos in llm / ai-agents / mcp / rag / generative-ai). Only titles, metadata and short excerpts are stored; links always go to the original. Without an LLM, scores are rule-based estimates and are labeled **heuristic** in every score tooltip.
