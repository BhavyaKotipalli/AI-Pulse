# AI Pulse — Data Pipeline

```
Sources ─► Discovery ─► Normalize ─► Dedupe/Cluster ─► Embed ─► Classify+Extract (fast, batched)
                                                                      │
                     ┌────────────────────────────────────────────────┘
                     ▼
              Credibility ─► Score/Rank ─► [score ≥ 65] Deep analysis (strong)
                                                    │
     ┌──────────────────────────────────────────────┘
     ▼
 Knowledge graph upsert (entities, relations) ─► Trend detection (daily) ─► Career impact ─► Experiments
                                                                                               │
                                                                     Daily briefing (06:00) ◄──┘
                                                                     Weekly report (Mon)
```

## Connectors (`src/services/connectors`)

```ts
interface SourceConnector {
  kind: SourceKind
  fetch(source: Source, since: Date | null): Promise<RawItem[]>   // validated with Zod
}
```

| Connector | Endpoint | Auth | Limits / etiquette |
|---|---|---|---|
| RSS/Atom | official feeds (OpenAI, Anthropic, Google DeepMind, Meta AI, Microsoft, NVIDIA, Mistral, Hugging Face, AWS ML, Apple ML, The Verge AI, Ars Technica, MIT Tech Review, TechCrunch AI…) | none | ETag/If-Modified-Since, 1 req/feed/run, robots.txt respected |
| arXiv | `export.arxiv.org/api/query` (cs.AI, cs.CL, cs.LG, cs.CV, cs.RO, cs.MA) | none | ≤ 1 req / 3 s per arXiv terms |
| Hacker News | Algolia `hn.algolia.com/api/v1/search` (AI keywords, points ≥ 50) | none | generous |
| GitHub | REST `search/repositories` (created/pushed recently, topics: llm, agents, rag…) + repo GET for snapshots | `GITHUB_TOKEN` optional | 10 search req/min unauth, 30 auth |
| HF Papers | `huggingface.co/api/daily_papers` | none | |

Only titles, metadata and short permitted snippets/abstracts are stored; full article bodies are not republished. Links always go to the original.

## Stage contracts

| Stage | Idempotency key | Failure behaviour |
|---|---|---|
| Discovery | `(source_id, external_id)` | per-source try/catch; failure recorded in `job_runs.stats.errors`, other sources continue |
| Normalize | `url_hash` (sha256 of canonical URL, tracking params stripped) | invalid items rejected with reason |
| Dedupe | `cluster_id` assignment is stable | — |
| Embed | `content_hash` | retried next run (`status = 'normalized'`) |
| Classify | `content_hash + model` cache | after repair retry: `status = 'enrich_failed'` |
| Score | pure function | — |
| Deep analysis | `content_hash + model` | budget-aware skip |

## Scheduling

| Job | Schedule | Route / command |
|---|---|---|
| `ingest` (discovery → score) | every 3 h | `/api/cron/ingest`, `npm run job ingest` |
| `analyze` (deep analysis queue) | every 3 h, after ingest | `/api/cron/analyze` |
| `trends` (+ career, experiments, skill status, snapshots) | daily 05:00 UTC | `/api/cron/trends` |
| `briefing` | daily 06:00 UTC | `/api/cron/briefing` |
| `weekly` | Mon 06:30 UTC | `/api/cron/weekly` |

Each job: acquire `job_runs` lock (skip if one is `running` < 30 min old) → run → record stats. Structured logs per stage with `jobRunId`.

## Scoring formula (`src/domain/scoring.ts`)

```
base = 0.22·impact + 0.14·novelty + 0.14·technical + 0.12·industry
     + 0.10·career + 0.10·momentum + 0.10·credibility + 0.08·recency      (all 0–100)
score = base × (1 − 0.35·clickbait) × corroborationBonus(1.00–1.06)
```
`recency` decays with a 36 h half-life; `momentum` = normalized HN points / star growth / cluster size. Weights are versioned (`SCORING_VERSION`) and stored with `score_breakdown`, so every score is explainable in the UI.

## Demo mode

`npm run setup` migrates and loads `src/services/mock/seed-data` (clearly labeled `is_demo = true`). Dates in the demo set are **relative to seed time** so the dashboard looks current; the UI states this. Once Phase 2 connectors run, real items appear alongside, and `npm run db:purge-demo` removes demo rows.
