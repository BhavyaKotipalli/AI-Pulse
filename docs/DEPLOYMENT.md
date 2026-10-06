# Deploying AI Pulse for free (Vercel + Supabase + Gemini)

Everything below runs on free tiers:

| Piece | Service | Free tier used |
|---|---|---|
| Hosting, serverless functions, daily crons | **Vercel** Hobby (personal, non-commercial use) | 1 project |
| Postgres + pgvector | **Supabase** | 1 project, 500 MB |
| Scheduler every 3 hours | **GitHub Actions** | scheduled workflow (`.github/workflows/pipeline.yml`) |
| LLM + embeddings | **Google Gemini API** (AI Studio key) | free tier; limits shown in AI Studio |
| Optional LLM fallback | **Groq** / **OpenRouter** | free tiers |

```
GitHub (main) ──push──▶ Vercel build: migrate → seed reference data → next build
GitHub Actions (every 3 h) ─┐
Vercel Cron (daily)        ─┴▶ /api/cron/ingest → enrich ×3 → insights → daily
                                        │
                                Supabase Postgres + pgvector
```

## 1. Database (Supabase)

A project named **ai-pulse** (region `us-east-1`) already exists in your Supabase organization.

1. Open it in the Supabase dashboard → **Project Settings → Database** → *Reset database password* (you choose it; it is not shown again).
2. Click **Connect** (top bar) and copy two URIs, replacing `[YOUR-PASSWORD]`:
   - **Transaction pooler** (port `6543`) → `DATABASE_URL`
   - **Session pooler** (port `5432`) → `DATABASE_URL_UNPOOLED` (used only for migrations during the build)

Row-level security is enabled on every table by migration `0003`, so Supabase's public REST API cannot read or write app data; the app itself connects as the table owner.

## 2. Free AI key (Gemini)

1. Go to https://aistudio.google.com/apikey → **Create API key**.
2. Keep it private: it goes into Vercel as `GEMINI_API_KEY` (and `.env.local` for local use). Never commit it or paste it into chats, issues or screenshots.

Optional fallbacks: `GROQ_API_KEY` (https://console.groq.com/keys) with `AI_PROVIDER=groq`, or `OPENROUTER_API_KEY` with `AI_PROVIDER=openrouter` and `AI_FAST_MODEL` / `AI_STRONG_MODEL` set to free models.

## 3. Vercel project

1. https://vercel.com/new → import `BhavyaKotipalli/AI-Pulse` (authorize the Vercel GitHub app for that repository if asked). Keep the default build settings — `package.json` defines `vercel-build`.
2. Add environment variables for **Production** (and Preview if you want preview deployments to work):

| Variable | Value |
|---|---|
| `DATABASE_URL` | Supabase *Transaction pooler* URI |
| `DATABASE_URL_UNPOOLED` | Supabase *Session pooler* URI |
| `DATABASE_POOL_MAX` | `3` |
| `SEED_MODE` | `reference` |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | `https://<your-project>.vercel.app` |
| `CRON_SECRET` | `openssl rand -hex 32` |
| `ADMIN_EMAILS` | your sign-up email |
| `AI_PROVIDER` | `gemini` |
| `GEMINI_API_KEY` | your AI Studio key |
| `GITHUB_TOKEN` | fine-grained GitHub token with no scopes (optional, recommended) |
| `DEMO_MODE` | `true` (guests can browse) or `false` |

3. Deploy. The build applies migrations and loads curated reference data into the empty database.

## 4. Scheduler (GitHub Actions)

In the GitHub repository → **Settings → Secrets and variables → Actions → New repository secret**:

- `APP_URL` = `https://<your-project>.vercel.app` (no trailing slash)
- `CRON_SECRET` = the same value you set in Vercel

The *Intelligence pipeline* workflow then runs every 3 hours; you can also start it from the **Actions** tab (*Run workflow*). Until the secrets exist it skips itself.

## 5. First run

1. Open the site, **sign up** with the email in `ADMIN_EMAILS`.
2. **Settings → System → Test AI connection** — every line should say `OK`.
3. **Settings → Sources & ingestion**, press in order: **1 · Fetch sources**, **2 · AI enrichment** (repeat while it reports items pending), **3 · Trends & insights**, **4 · Briefing & scores**.

`/api/health` should return `{"status":"ok","db":"pg","ai":{"provider":"gemini","mock":false}}`.

## Staying inside free limits

- `AI_REQUESTS_PER_MINUTE` (default 8) spaces background calls; `AI_DAILY_REQUEST_LIMIT` (default 300) is a hard daily cap, with 15 % reserved for interactive questions. Compare with your limits in AI Studio and raise or lower them.
- Enrichment is time-boxed and resumable: when a quota is hit it stops and continues on the next run. Nothing is lost.
- Only items scoring 65+ get deep analysis; classification runs in batches of 8.
- If Gemini's embedding quota is exhausted, search falls back to full-text automatically.

## Operations

| Task | How |
|---|---|
| Schema change | edit `src/server/db/schema/*` → `npm run db:generate` → commit; the next deploy migrates |
| Re-run a job | Settings (admins), the Actions tab, or `curl -H "Authorization: Bearer $CRON_SECRET" $APP_URL/api/cron/<ingest|enrich|insights|daily>` |
| Switch AI provider | change `AI_PROVIDER` (+ key) in Vercel and redeploy; items are re-embedded automatically if the embedding model changes |
| Rotate secrets | change in Vercel (and GitHub for `CRON_SECRET`) → redeploy |

## Troubleshooting

| Symptom | Fix |
|---|---|
| Build fails connecting to the database | wrong password in the URIs, or `DATABASE_URL_UNPOOLED` is the IPv6-only *direct* URI — use the **Session pooler** one |
| Every page returns 500, logs say `BETTER_AUTH_SECRET must be set` | add the secret (fail-closed by design) |
| Test AI connection shows `API key rejected` | key typo, or the Generative Language API is not enabled for that key |
| Test shows `HTTP 404` for a model | the model name changed — set `AI_FAST_MODEL` / `AI_STRONG_MODEL` to current IDs from the provider's model list |
| Enrichment "paused: rate limited" | normal on free tiers; lower `AI_REQUESTS_PER_MINUTE` or wait for the next run |
| Pipeline workflow fails with HTTP 401 | `CRON_SECRET` differs between GitHub and Vercel |
| Sign-in redirects to localhost | set `BETTER_AUTH_URL` to the production URL |
