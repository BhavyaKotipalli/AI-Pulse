# AI Pulse — Agent System

## Philosophy

"Agent" here means **a module with one responsibility, typed input, and a Zod-validated output**. Most are deterministic code; only five call an LLM. They communicate through the database and typed DTOs — never through free-form chat between models. This keeps the system cheap, debuggable, reproducible and testable.

| Agent | LLM? | Tier | Input → Output | Runs |
|---|---|---|---|---|
| **Discovery** | no | — | `Source` → `RawItem[]` (via `SourceConnector`) | cron, every 3h |
| **Normalizer** | no | — | `RawItem` → `NewItem` (canonical URL, hash, clean text, permitted snippet) | inline |
| **Deduplication** | no (+ fast, rarely) | fast | `NewItem` → existing `cluster_id` or new cluster. URL hash → title SimHash → embedding cosine ≥ 0.88 within 72h. LLM tie-break only for 0.82–0.88. | inline |
| **Credibility** | no | — | source credibility prior × corroboration (sources in cluster) × penalties (clickbait patterns, missing author/date) | inline |
| **Classifier / Extractor** | yes | fast | item → `{category, tags, entities[], subScores{impact,novelty,technical,industry,career}, clickbait}` | batched 10 items/call |
| **Ranking** | no | — | sub-scores + credibility + momentum + recency → `score` (`src/domain/scoring.ts`) | inline |
| **Research Analyst** | yes | strong | items with score ≥ 65 → `ArticleAnalysis` / `PaperAnalysis` (labeled claims, audiences, action) | after ranking |
| **Trend** | partly | strong | clusters of last 30d embeddings (agglomerative, cosine) → match to existing trends or propose new; LLM writes thesis/evidence/implications only for clusters with ≥ 4 items from ≥ 3 sources | daily |
| **Career Impact** | yes | strong | trend / major item → `CareerImpact[]` per role; skill evidence counts computed deterministically | daily |
| **Experiment** | yes | strong | major model/tool/paper/repo → `Experiment[]` (≤ 2 per item); "Build this" plan on demand, cached | daily + on demand |
| **Startup** | yes | fast | items mentioning startup entities → field updates with `sourceItemIds`; only cited fields marked verified | daily |
| **Briefing** | yes | strong | top-ranked clusters + trends + experiments → `Briefing` (sections, each bullet cited) | 06:00 daily, weekly on Mondays |
| **Personalization** | no | — | viewer prefs + `user_events` → re-ranked feed with explanation | request time |
| **QA (Ask AI)** | yes | strong | question + history → hybrid retrieval → streamed answer with `[n]` citations → validator | request time |

## Structured-output contract

```ts
const result = await llm.generateObject({ tier: 'fast', task: 'classify', system, prompt }, ClassificationSchema)
```

1. Prompt includes the JSON schema description and numbered sources.
2. Output parsed with Zod. On failure: one repair attempt with the validation error; then the item is marked `enrich_failed` (never silently dropped; visible in job stats).
3. Every claim object has `label` and `sourceItemIds`. The **citation validator** removes any id not in the provided context and downgrades a `fact` with no remaining sources to `analysis` + `confidence: low`.

## Anti-hallucination measures

| Measure | Where |
|---|---|
| Retrieval-grounded generation only (no "world knowledge" facts) | QA, Briefing, Trend prompts |
| Citation id validation | `src/domain/citations.ts` |
| Multi-source check for items scoring ≥ 70 | Credibility agent → "single source" badge |
| URL validation (HEAD/GET 2xx, canonical) at ingestion | Normalizer |
| Structured extraction + schema validation | every LLM stage |
| Explicit FACT / ANALYSIS / SPECULATION labels | analysis schemas + UI `ClaimLabel` |
| "I couldn't find this in the collected intelligence" refusal path | QA when top retrieval score < threshold |

## Cost control

- Dedup **before** any LLM call; only cluster leads are enriched.
- Fast tier for classification, batched; strong tier gated by score ≥ 65 (≈ 10–15 % of items).
- Content-hash cache of every LLM result (`ai_cache` keyed by `task + model + hash(input)`), embeddings reused per `content_hash`.
- Token caps per task; snippets truncated to 1,500 tokens.
- All calls metered in `ai_usage`; daily budget (`AI_DAILY_BUDGET_USD`) — when exceeded, strong-tier stages are skipped and the UI says analysis is pending.
