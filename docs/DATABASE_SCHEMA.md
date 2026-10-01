# AI Pulse — Database Schema

Source of truth: `src/server/db/schema/*.ts` (Drizzle). Migrations: `drizzle/`. This doc explains intent.

Conventions: `text` ids (`cuid`-style via `crypto.randomUUID()`), `timestamptz` everywhere, `jsonb` only for payloads validated by Zod in `src/domain`, `is_demo` on content tables so seeded data is always distinguishable from ingested data.

## Content & sources

| Table | Purpose | Key columns |
|---|---|---|
| `sources` | A feed / API we pull from | `slug`, `kind` (rss · arxiv · hn · github · hf_papers · blog), `url`, `credibility` (0–1), `active`, `last_fetched_at`, `etag` |
| `items` | **Unified content record** — article, paper, repo, tool, launch | `kind`, `title`, `url`, `url_hash` (unique), `source_id`, `author`, `published_at`, `snippet` (permitted excerpt only), `content_hash`, `category`, `tags[]`, `tldr`, `why_it_matters`, `analysis` jsonb (per-kind schema), `score` 0–100, `score_breakdown` jsonb, `confidence`, `cluster_id`, `embedding vector(768)`, `metrics` jsonb (stars, points…), `status` (raw → enriched), `is_demo` |
| `story_clusters` | Dedup: one row per real-world story; items attach to it | `title`, `lead_item_id`, `item_count`, `source_count`, `first_seen_at` |
| `item_metric_snapshots` | Time series (GitHub stars, HN points) for growth | `item_id`, `captured_at`, `metrics` |

`analysis` jsonb variants (Zod in `src/domain/analysis.ts`):
- **article**: technical explanation, beginner explanation, audiences ("why should I care" ×6), action ("what should I do"), claims[] each `{text, label: fact|analysis|speculation, sourceItemIds}`.
- **paper**: problem, novelty, delta vs prior work, why it matters, reproducibility, project potential, difficulty.
- **repo/tool**: why discussed, use cases, project ideas.

## Knowledge graph

| Table | Purpose |
|---|---|
| `entities` | companies, models, people, technologies, tools, skills, roles, startups — `type`, `slug` (unique per type), `name`, `description`, `aliases[]`, `metadata` |
| `item_entities` | item ↔ entity mentions with `salience` |
| `entity_relations` | directed typed edges: `develops`, `uses`, `affects`, `requires`, `competes_with`, `invests_in`, `part_of` — with `weight` and `evidence_item_ids[]` |

## Trends

| Table | Purpose |
|---|---|
| `trends` | Macro trend: `slug`, `title`, `thesis`, `summary`, `status` (emerging · accelerating · mainstream · cooling), `momentum` (−1…1), `why_happening`, `implications` jsonb (labeled claims), `affected_roles[]`, `skills[]`, `first_seen_at` |
| `trend_items` | Evidence links with `relevance` |
| `trend_entities` | Companies/technologies involved |
| `trend_snapshots` | Daily `mention_count`, `score` → sparkline & 24h/7d/30d/90d analytics |

## Career intelligence

| Table | Purpose |
|---|---|
| `skill_signals` | Daily evidence per skill entity: `date`, `mentions`, `job_mentions`, `repo_mentions` |
| `skill_status` (view-like table, recomputed) | `skill_id`, `status` (exploding · growing · stable · declining), `growth_30d`, `evidence_item_ids[]` |
| `career_impacts` | Per role per trend/item: `role`, `automated[]`, `augmented[]`, `new_skills[]`, `declining_skills[]`, `tools[]`, `student_advice`, `confidence`, `source_item_ids[]` |

Status rule (deterministic, `src/domain/skills.ts`): growth of evidence count last 30d vs previous 30d — > +60 % exploding, > +15 % growing, ≥ −15 % stable, else declining; requires ≥ 5 evidence items, otherwise "insufficient evidence".

## Experiments & startups

| Table | Purpose |
|---|---|
| `experiments` | `slug`, `title`, `summary`, `why_interesting`, `skills[]`, `technologies[]`, `difficulty`, `time_estimate`, `architecture`, `data_requirements`, `expected_result`, `github_potential`/`resume_value`/`startup_potential` (1–5), `steps` jsonb, `source_item_ids[]`, `plan` jsonb (cached "Build this" output) |
| `startup_profiles` | 1:1 with a `startup` entity: problem, product, ai_tech, funding_stage, investors[], founders[], market, competitors[], interesting, weaknesses, ideas[], `verified_fields[]`, `source_item_ids[]` |

## Briefings

`briefings`: `kind` (daily · weekly), `date`, `content` jsonb (typed sections, every bullet carries `sourceItemIds`), `model`, `generated_at`. Unique `(kind, date)`.

## Users & personalization

| Table | Purpose |
|---|---|
| `user`, `session`, `account`, `verification` | Better Auth core tables |
| `user_preferences` | `interests[]`, `roles[]`, `experience_level`, `briefing_hour` |
| `bookmarks` | `user_id`, `target_type` (item · experiment · trend · startup), `target_id`, `collection` (read_later · research · project_ideas · career · startups · tools), `note` — unique per (user, target, collection) |
| `user_events` | implicit signals: `view`, `save`, `ask`, `experiment_start` with `target`, `topics[]` |
| `conversations`, `messages` | Ask AI history; `messages.citations` jsonb |

## Operations

| Table | Purpose |
|---|---|
| `ai_usage` | every model call: `provider`, `model`, `tier`, `task`, `input_tokens`, `output_tokens`, `cost_usd`, `cached`, `latency_ms` |
| `job_runs` | `job`, `status`, `started_at`, `finished_at`, `stats` jsonb, `error` — also acts as a lock (one running per job) |

## Indexes

- `items(url_hash)` unique · `items(published_at desc)` · `items(score desc)` · `items(kind, published_at)`
- `items USING hnsw (embedding vector_cosine_ops)`
- `items` GIN on `to_tsvector('english', title || ' ' || coalesce(snippet,''))` (Phase 3 migration)
- `entities(type, slug)` unique · `bookmarks(user_id, target_type, target_id, collection)` unique
