# AI Pulse — Product Requirements

> **Core question, answered daily:** *What changed in AI and technology today, why does it matter, and what should I learn, experiment with, or pay attention to?*

AI Pulse is a personal intelligence system — not a news aggregator. It discovers, filters, analyzes, ranks, connects and explains developments across AI and technology, and translates them into action (learning, experiments, career moves). A user should understand the day in 5–10 minutes.

## 1. Users

| Persona | Primary job-to-be-done |
|---|---|
| **AI / software engineer** (primary) | Stay current without doom-scrolling; know which tools, models and techniques are worth trying. |
| **Student / career switcher** | Understand which skills are gaining value and what to build for a portfolio. |
| **Researcher** | Track papers in their areas, with technical deltas vs prior work. |
| **Founder / PM** | Track startups, funding, market shifts and opportunities. |

## 2. Product principles

1. **Signal over noise.** Every item is scored; clickbait is penalized; duplicates are collapsed into one story.
2. **Traceable trust.** Every claim links to sources. Content is labeled **FACT**, **ANALYSIS**, or **SPECULATION**. Unverifiable statements say so.
3. **Information → action.** Each significant development answers *Why should I care?* (per audience) and *What should I do?* (action, time, relevance).
4. **Patterns, not articles.** Trends are detected across stories and tracked over time.
5. **Calm, expensive UI.** Dark-first, typographic, fast, keyboard-driven.
6. **Cost-aware AI.** Cheap models classify, strong models analyze only what scores high; everything cached.

## 3. Feature inventory & priority

Legend: **MVP** = must ship in V1 public demo · **V1** · **V2** · **V3**

| # | Feature | Release | Notes / simplification |
|---|---|---|---|
| 1 | Overview dashboard (hero + sections) | MVP | |
| 2 | Daily briefing ("Today") | MVP | Generated once per morning, cached as a row. |
| 3 | Intelligence score (0–100, 8 dimensions) | MVP | Deterministic weighted formula over LLM-extracted sub-scores — explainable and testable. |
| 4 | Item detail ("Ask about any article") | MVP | TL;DR, why it matters, technical/beginner explanation, audiences, career impact, related. |
| 5 | Research radar | MVP | arXiv + HF Papers. Paper analysis generated only for papers scoring ≥ threshold. |
| 6 | Open-source radar | MVP | GitHub search API + star snapshots for growth. |
| 7 | Experiment lab + "Build this" plan | MVP | Plans generated on demand and cached. |
| 8 | Trends (cluster-based) + trend detail | MVP | Graph view in V1. |
| 9 | Career impact + skill radar | MVP | Skill momentum derived from evidence counts over windows — never invented. |
| 10 | Startup radar | V1 | Profiles store only cited facts; unknown fields shown as "Not verified". |
| 11 | Ask AI (RAG, citations, streaming) | MVP | Hybrid retrieval (pgvector + full text). |
| 12 | Command palette (⌘K) + global search | MVP | |
| 13 | Knowledge library + bookmarks + collections | MVP | Semantic search over saved items. |
| 14 | Personalization ("For You") | V1 | Interest weights + implicit signals (reads, saves, asks). No ML model initially — a transparent scoring boost. |
| 15 | Voice assistant | V1 | Browser Web Speech API first (free); provider interface for OpenAI / ElevenLabs later. |
| 16 | Trend graph / knowledge graph explorer | V1 | Postgres adjacency tables; no graph DB. |
| 17 | Weekly "State of AI" report | V1 | |
| 18 | Analytics (24h/7d/30d/90d) | V1 | Computed from daily aggregate snapshots. |
| 19 | Knowledge timeline | V1 | |
| 20 | AI usage & cost dashboard | MVP | Every model call writes a usage row. |
| 21 | Personal AI memory | V2 | Builds on user events + saved items. |
| 22 | Near-real-time updates | V2 | Queue-based ingestion (Redis/BullMQ or pg-boss). |
| 23 | Team/workspace features, email digests, mobile | V3 | |

## 4. Deliberate simplifications (spec → production-quality alternative)

| Spec asks for | Why it's over-complex now | What we do instead |
|---|---|---|
| ~12 autonomous agents | Free-form agent chatter is slow, costly and non-deterministic. | A **deterministic pipeline** of typed stages; only 5 stages call an LLM, each with a Zod-validated structured output. "Agents" = stage modules with a single responsibility. |
| Separate vector DB + graph DB + Redis | Three extra systems to operate. | **Postgres does all three**: pgvector (HNSW), adjacency tables for the graph, a `job_runs` table for locking/idempotency. Redis only when we add real-time queues (V2). |
| Reddit / Product Hunt / Semantic Scholar scraping | ToS/API-key friction, brittle. | V1 connectors: RSS/Atom (official blogs + publications), arXiv API, Hacker News API, GitHub REST, HF Papers. Others are V2 behind the same `SourceConnector` interface. |
| Voice with streaming STT/TTS + interruption | Expensive, vendor-specific. | Browser speech APIs (free, decent) behind a `VoiceProvider` interface; barge-in via `speechSynthesis.cancel()` on mic press. |
| ML-driven personalization | Cold start, opaque. | Explainable re-ranking: `score × (1 + interestBoost + behaviorBoost)`, with "why you're seeing this". |
| Multiple-source verification for every claim | Expensive. | Only for items scoring ≥ 70 ("major"): requires ≥ 2 independent sources in the story cluster, otherwise flagged "Single source". |
| Startup funding/investor tracking | No free reliable API; high fabrication risk. | Facts only from cited articles; anything not extracted from a source is shown as **Not verified**. |

## 5. Trust requirements (non-negotiable)

- Never fabricate news, papers, links or numbers. Seeded demo data is labeled **DEMO** everywhere in the UI.
- Every generated claim stores `sourceItemIds`; the citation validator rejects answers citing ids not present in the retrieved context.
- Content labels: `fact` (directly supported by source), `analysis` (reasoned from sources), `speculation` (forward-looking).
- Confidence shown when < high.

## 6. Success metrics

- Time-to-understand-the-day: ≤ 10 min (briefing ≈ 1,000–1,300 words).
- ≥ 90 % of Ask AI factual answers carry ≥ 1 valid citation (eval suite, Phase 10).
- Duplicate rate on the Top Stories list < 5 %.
- LLM cost per day (single user, ~400 items/day) < $0.50 with the default model mix.
