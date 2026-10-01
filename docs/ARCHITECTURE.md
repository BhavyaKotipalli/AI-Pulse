# AI Pulse — Architecture

## 1. Shape of the system

One TypeScript codebase, two runtime roles:

```
┌──────────────────────────── Next.js 16 app (Vercel / Node) ────────────────────────────┐
│  App Router (RSC)          Route handlers (/api/*)          Server actions              │
│  ─ dashboard pages         ─ /api/ask (streaming RAG)       ─ bookmarks, preferences    │
│  ─ detail pages            ─ /api/search (hybrid)           ─ "Build this" plans        │
│  ─ command palette         ─ /api/auth/* (Better Auth)                                  │
│                            ─ /api/cron/* (CRON_SECRET)  ──┐                             │
└───────────────┬───────────────────────────────────────────┼─────────────────────────────┘
                │ repositories (Drizzle)                    │ invokes
                ▼                                           ▼
        ┌──────────────────┐                   ┌─────────────────────────────┐
        │ PostgreSQL       │◄──────────────────│ Jobs (src/server/jobs)       │
        │  + pgvector      │   writes          │ ingest → enrich → trends →   │
        │  (PGlite locally)│                   │ briefing; also runnable via  │
        └──────────────────┘                   │ `npm run job <name>` (tsx)   │
                                               └──────────┬──────────────────┘
                                                          │ through interfaces
                       ┌──────────────────────────────────┼─────────────────────────┐
                       ▼                                  ▼                         ▼
              SourceConnector                      LLMProvider / Embedder     VoiceProvider
        (rss, arxiv, hn, github, hf)        (anthropic, openai-compat, gemini,   (browser, openai,
                                              mock)                               elevenlabs)
```

**Why a modular monolith:** one deploy, shared types end-to-end, and the job layer is plain functions — it can move to a separate worker (Railway/Fly/a container) without code changes when ingestion volume demands it.

## 2. Technology choices

| Concern | Choice | Rationale |
|---|---|---|
| Framework | **Next.js 16 App Router**, React 19, TypeScript strict | RSC for data-heavy dashboards, route handlers for streaming. |
| Styling | **Tailwind CSS v4** + in-repo shadcn-style primitives on **Radix** | Full ownership of components; accessible primitives. |
| Motion | **motion** (Framer Motion) | Micro-interactions, list transitions. |
| DB | **PostgreSQL + pgvector** via **Drizzle ORM** | SQL-first, typed, migrations via drizzle-kit. |
| Local DB | **PGlite** (embedded WASM Postgres with pgvector) | `npm run dev` works with zero infra; same SQL as prod. Set `DATABASE_URL` to use Neon/Supabase/Docker Postgres. |
| Auth | **Better Auth** (email+password, optional GitHub OAuth) with Drizzle adapter | Self-hosted, typed, stable; no vendor lock-in. Demo mode falls back to a guest user. |
| Validation | **Zod** | All external API responses + all LLM structured outputs. |
| Charts | **Recharts** + hand-rolled SVG sparklines | |
| Search | **pgvector HNSW + Postgres FTS**, fused with Reciprocal Rank Fusion | Hybrid beats either alone on short queries. |
| Scheduler | **Vercel Cron → /api/cron/\*** (prod), `npm run job` (local) | Idempotency via `job_runs` table lock. |
| Queue | None in V1; **pg-boss** in V2 (Postgres-backed) | Avoid Redis until needed. |
| Logging | **pino** structured JSON | |
| Tests | **Vitest** (unit/integration on PGlite), Playwright (Phase 10) | |

## 3. Layering (clean architecture)

```
src/
  domain/        Pure types, Zod schemas, scoring & ranking math. No I/O. 100% unit-testable.
  services/
    ai/          Interfaces: LLMProvider, EmbeddingProvider, provider registry, usage metering.
    providers/   Real adapters (Anthropic, OpenAI-compatible, Gemini, connectors).
    mock/        Demo-mode adapters + seed dataset. Nothing in app code imports mock/ directly —
                 only the registry decides.
    connectors/  SourceConnector interface + implementations (Phase 2).
  server/
    db/          Drizzle client (pg | PGlite), schema, migrations runner.
    repositories/ Query functions returning domain types. Pages never write SQL.
    actions/     Server actions (mutations), each validates input with Zod and checks the viewer.
    jobs/        Pipeline stages and orchestrations.
    auth/        Better Auth instance + getViewer().
  app/           Routes only: compose repositories + components.
  components/    ui/ (primitives) · shell/ · intel/ (domain components) · charts/
  lib/           env, logger, formatting, utils.
```

Dependency rule: `app → components/server → services → domain`. `domain` imports nothing internal.

## 4. Provider abstraction

```ts
interface LLMProvider {
  id: string
  generate(req: GenerateRequest): Promise<GenerateResult>          // text
  generateObject<T>(req: GenerateRequest, schema: ZodType<T>): Promise<T>  // structured, validated, 1 repair retry
  stream(req: GenerateRequest): AsyncIterable<string>
}
interface EmbeddingProvider { id: string; dimensions: 768; embed(texts: string[]): Promise<number[][]> }
```

The registry maps **task tiers** to models so cost policy lives in one place:

| Tier | Used for | Default (Anthropic) | Default (OpenAI-compatible) |
|---|---|---|---|
| `fast` | classification, entity extraction, sub-scores, dedup tie-breaks | Claude Haiku 4.5 | small/mini model |
| `strong` | paper analysis, trend synthesis, briefing, Ask AI | Claude Sonnet 5.5 | flagship model |

`AI_PROVIDER=mock` (default when no keys) uses the deterministic mock: extractive summaries and feature-hashed embeddings, so search and Ask AI genuinely work offline.

## 5. Request flows

**Dashboard render:** RSC page → repositories (parallel `Promise.all`) → components. Pages are dynamic (per-viewer bookmarks/personalization); expensive aggregates come from precomputed tables (briefings, trend snapshots), so pages stay cheap.

**Ask AI:** `POST /api/ask` → rate limit → embed query → hybrid retrieve top-k (k=8) items → build context with numbered sources → `strong.stream()` → stream tokens → on completion, citation validator checks every `[n]` maps to a retrieved source; invalid ones are stripped and the answer flagged. Conversation + citations persisted.

**Ingestion (cron):** see DATA_PIPELINE.md.

## 6. Security

- Secrets only in env (`src/lib/env.ts` validates with Zod at boot; server-only module).
- Cron routes require `Authorization: Bearer $CRON_SECRET`.
- Server actions check viewer + validate input; per-user rows scoped by `userId` in every query.
- Rate limiting on `/api/ask` and `/api/search` (token bucket in Postgres in V1; Upstash in V2).
- Outbound fetches: allow-listed hosts per connector, timeouts, retries with jitter, `User-Agent` identifying the bot, robots.txt respected for RSS hosts.
- Rendered source content is plain text (never `dangerouslySetInnerHTML` of fetched HTML).

## 7. Deployment

- **Web:** Vercel (Node runtime for DB routes). `vercel.json` crons → `/api/cron/ingest` (every 3h), `/api/cron/briefing` (06:00 user TZ, default UTC).
- **DB:** Neon or Supabase Postgres with `CREATE EXTENSION vector`.
- **Local:** PGlite in `.data/pglite` — no Docker required. A `docker-compose.yml` with `pgvector/pgvector:pg17` is provided for parity testing.

## 8. External APIs

| Need | Free option (V1 default) | Paid / upgrade |
|---|---|---|
| LLM | Mock (offline); Gemini free tier; local Ollama via OpenAI-compatible | Anthropic, OpenAI |
| Embeddings | Mock hashing (offline); Gemini `text-embedding-004`; Ollama `nomic-embed-text` (768-d) | OpenAI `text-embedding-3-small` (dimensions=768), Voyage |
| News | Official RSS/Atom feeds | NewsAPI / GDELT (V2) |
| Research | arXiv API, HF Daily Papers API | Semantic Scholar API key (higher limits) |
| Community | Hacker News Firebase/Algolia API | Reddit API (V2, OAuth) |
| Open source | GitHub REST (token = 5k req/h, free) | — |
| Startups | Facts extracted from news/blogs | Crunchbase API (paid, V3) |
| Voice | Web Speech API (STT + TTS) | OpenAI Realtime / Whisper + TTS, ElevenLabs, Deepgram |
| Auth | Better Auth (self-hosted) | — |
| Hosting | Vercel Hobby + Neon free | Vercel Pro (more crons), Neon Launch |
