# Deploying AI Pulse (Vercel + Neon)

Production runs on **Vercel** (Next.js, serverless Node functions, Vercel Cron) with a **Neon** Postgres database (pgvector). Both have free tiers that are enough for a personal deployment. The embedded PGlite database is only for local development — serverless file systems are ephemeral.

```
GitHub (main) ──push──▶ Vercel build: migrate + seed reference data + next build
                                 │
Vercel Cron 05:00 UTC ──▶ /api/cron/ingest  (16 live sources → normalize → dedupe → score)
Vercel Cron 06:00 UTC ──▶ /api/cron/daily   (rescore, skill momentum, trend snapshots, briefing)
                                 │
                           Neon Postgres + pgvector
```

## 1. Push the code to GitHub

```bash
git remote add origin https://github.com/<you>/ai-pulse.git
```

```bash
git push -u origin main
```

GitHub Actions (`.github/workflows/ci.yml`) runs lint, typecheck, tests and a production build on every push.

## 2. Create the database (Neon)

1. Sign in at https://neon.tech and create a project (region close to your Vercel region, e.g. `us-east-1`).
2. In the SQL editor run: `CREATE EXTENSION IF NOT EXISTS vector;` (the first migration also does this; running it once manually confirms the extension is available).
3. Copy two connection strings from **Connection details**:
   - **Pooled** (host contains `-pooler`) → `DATABASE_URL`
   - **Direct** → `DATABASE_URL_UNPOOLED` (used only for migrations at build time)

> Alternatively, add Neon from the Vercel Marketplace (Storage → Neon); it injects `DATABASE_URL` and `DATABASE_URL_UNPOOLED` automatically.

## 3. Import the project in Vercel

1. https://vercel.com/new → import the GitHub repository. Framework preset: Next.js (auto-detected). Leave build settings at defaults — `package.json` defines `vercel-build`, which runs migrations, loads reference data on an empty database, then `next build`.
2. Add environment variables (Production and Preview):

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon pooled connection string |
| `DATABASE_URL_UNPOOLED` | Neon direct connection string |
| `DATABASE_POOL_MAX` | `5` |
| `SEED_MODE` | `reference` — never load simulated demo news in production |
| `BETTER_AUTH_SECRET` | output of `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | `https://<your-project>.vercel.app` (update if you add a custom domain) |
| `CRON_SECRET` | output of `openssl rand -hex 32` — Vercel sends it to cron routes automatically |
| `GITHUB_TOKEN` | a fine-grained GitHub token with **no scopes** (public data only) — lifts the search limit |
| `ADMIN_EMAILS` | your email — enables "Run ingestion now" in Settings after you sign up |
| `DEMO_MODE` | `true` to let visitors browse as a guest without signing up, `false` to require accounts for personal features |
| `AI_PROVIDER` | `mock` (default) until real providers are enabled |

3. Deploy.

## 4. First data load

The build seeds curated reference data (entities, trend theses, experiments, startup profiles, role analyses), but no news. Load live intelligence immediately instead of waiting for the 05:00 cron:

- **From the app:** sign up with an email listed in `ADMIN_EMAILS` → Settings → **Run ingestion now**, then **Rebuild briefing & scores**.
- **Or from a terminal:**

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<your-project>.vercel.app/api/cron/ingest
```

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<your-project>.vercel.app/api/cron/daily
```

## 5. Verify

- `https://<your-project>.vercel.app/api/health` → `{"status":"ok","db":"pg",...}`
- Settings → *Sources & ingestion* shows per-source item counts and the job history.
- Vercel → Project → **Cron Jobs** lists both schedules; **Logs** show structured JSON per job run.

## Operations

| Task | How |
|---|---|
| Schema change | edit `src/server/db/schema/*` → `npm run db:generate` → commit the migration; the next deploy applies it |
| Re-run a job | Settings (admins) or `curl` with `CRON_SECRET` |
| Jobs overlapping | prevented by the `job_runs` lock (30-minute stale timeout) |
| Rotate secrets | change in Vercel → redeploy; rotating `BETTER_AUTH_SECRET` signs everyone out |
| Costs | free tiers: Vercel Hobby (daily crons), Neon free (0.5 GB). Hobby crons run once per day; Pro allows the 3-hourly schedule in `docs/DATA_PIPELINE.md` |

## Troubleshooting

| Symptom | Fix |
|---|---|
| Build fails with `relation ... does not exist` / connection errors | `DATABASE_URL_UNPOOLED` missing or wrong; the build migrates before compiling |
| 500 on every page with `BETTER_AUTH_SECRET must be set` | add the secret (fail-closed by design) |
| Cron returns 401 | `CRON_SECRET` missing or shorter than 16 characters |
| GitHub source shows a 403 error | add `GITHUB_TOKEN` |
| Sign-in redirects to localhost | set `BETTER_AUTH_URL` to the production URL |
