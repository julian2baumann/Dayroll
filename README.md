# Dayroll — Daily Feed Workspace

This repository hosts the Daily Feed web application described in `PRD.md`. The current milestone focuses on establishing a consistent toolchain for React, TypeScript, and automated testing.

## Getting Started

1. Ensure Node.js 20.12+ and npm 10.5+ are installed.
2. Install dependencies:

   ```bash
   npm ci
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

## Demo Mode

- Set `VITE_DEMO_MODE=true` (for example in `.env.local`) to auto-authenticate against a mock Supabase session and serve canned API responses while developing the UI.
- Remove the flag and supply real Supabase credentials before deploying to shared environments.

## Supabase Configuration

- For real email sign-in and onboarding, add your Supabase project settings to `.env` / `.env.local` using **both** the client and server keys:
  - `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are required so the Vite bundle can reach Supabase from the browser.
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are used by server-side code and background jobs.
- After setting the values, restart the dev server so Vite picks up the new environment variables.
- Add `${APP_URL}/auth/callback` (for each environment) to **Authentication → URL Configuration → Redirect URLs** in Supabase so magic links land on the callback handler.

## Scripts

| Command                                 | Purpose                                                                 |
| --------------------------------------- | ----------------------------------------------------------------------- |
| `npm run lint`                          | ESLint (TypeScript + React + Testing Library) with zero-warning budget. |
| `npm run format` / `npm run format:fix` | Check or write Prettier formatting.                                     |
| `npm run typecheck`                     | Strict TypeScript validation without emitting JS.                       |
| `npm test` / `npm run test:watch`       | Vitest unit tests (coverage in CI).                                     |
| `npm run e2e` / `npm run e2e:ui`        | Playwright smoke tests across desktop/tablet/mobile viewports.          |
| `npm run ci`                            | Aggregated lint → format → typecheck → unit tests → Playwright run.     |
| `npm run perf:feed`                     | Autocannon load test using demo data + telemetry budget enforcement.    |
| `npm run telemetry:aggregate`           | Summarise `perf/.telemetry.log` into timestamped reports.               |
| `npm run db:generate`                   | Emit SQL migrations in `drizzle/` from the TypeScript schema.           |
| `npm run db:migrate`                    | Apply pending migrations to the configured Postgres database.           |
| `npm run db:seed`                       | Insert local development fixtures (requires a running database).        |
| `npm run db:studio`                     | Launch Drizzle Studio to inspect tables locally.                        |

## Testing & QA

- Unit tests live alongside components (e.g., `src/App.test.tsx`).
- Playwright end-to-end tests reside in `e2e/` and reuse the production preview build.
- Husky pre-commit hook enforces staged formatting, lint, and Vitest.
- Run `npm run e2e -- --reporter=list` to execute the cross-device flows for New Today, For You, For Later, and the authenticated shell; the Playwright config bootstraps demo mode automatically.

## Telemetry & Performance Baselines

- Server routes emit `[telemetry]` console logs that include `http.server.duration` and content service timings; use them to validate the `/feed/today` ≤ 500 ms p95 budget from the PRD.
- The client registers Web Vitals collectors (`web_vital.lcp`, `web_vital.cls`, etc.) after boot; inspection in the browser console lets you confirm the ≤ 1.5 s initial render target on desktop, tablet, and mobile.
- See `docs/performance-baselines.md` for the metric catalog, collection workflow, and next steps for Task 9.2 load testing.
- `npm run perf:feed` runs an Autocannon scenario against demo-mode endpoints and fails the run if `http.server.duration` p95 exceeds 500 ms; metrics land in `perf/.telemetry.log` for trend analysis.
- Export metrics automatically by setting `TELEMETRY_EXPORT_URL` (and optional `TELEMETRY_EXPORT_API_KEY`); alerts for ingestion failures trigger via `ALERT_WEBHOOK_URL`.
- `npm run telemetry:aggregate` writes human-readable summaries under `perf/reports/` for quick audits.
- Manual QA flows: follow `docs/QA_CHECKLIST.md` before major releases to cover onboarding, responsive layouts, accessibility, and performance budgets.
- Release notes & readiness checklist: `docs/RELEASE_NOTES.md`.

## Deployment

- See `docs/deployment.md` for the CI/CD workflow, required secrets, and the launch checklist.
- `npm run deploy:frontend` pushes the Vercel production build (must be authenticated via `VERCEL_*` env vars).
- `npm run deploy:backend` promotes the API/job service on Railway (default) or Render depending on `BACKEND_DEPLOY_TARGET`.

### Staging Environment (2025-09-26)

- **Supabase** — project `ppjyiwxuulghlcohmpxc` (Julian Baumann). Dashboard: `https://supabase.com/dashboard/project/ppjyiwxuulghlcohmpxc`. Site URL set to the staging Vercel domain; redirect allow list contains both that domain and `http://localhost:5173`.
- **Railway API** — project `soothing-victory`, service `Dayroll`, region `us-east4-eqdc4a`. Public URL `https://dayroll-production.up.railway.app` with `/health` exposing a 200 status. Build command `npm install --no-audit --progress=false`; start command `npm run server`.
- **Vercel Frontend** — project `dayroll`. Current deployment `https://dayroll-kvnp9q49o-julians-projects-21f90e2b.vercel.app` built via `npx vite build` with env vars `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL`, and `VITE_DEMO_MODE=false`.
- **Environment variables** — Railway holds server-side keys (`SUPABASE_*`, `DATABASE_URL`, optional provider tokens). Vercel only receives the browser-safe values. Keep secrets in platform dashboards; do not commit `.env.local`.
- **Database** — migrations and seed executed against the Supabase pooler on 2025‑09‑26. Rotate the password via Supabase if `DATABASE_URL` changes and update both Railway and local `.env` files accordingly.

## Ingestion Jobs

- Orchestration lives in `src/ingest/orchestrator.ts`. `runIngestionCycle` pulls active subscriptions and dispatches to RSS, YouTube, and Spotify workers using the shared DAL, while `createIngestionScheduler` wraps the cycle in a safe interval runner.
- Implement `SubscriptionRepository` (`src/db/dal/subscriptionRepository.ts`) to expose active subscriptions from your database.
- Provide provider-specific options when wiring the job (YouTube API key, Spotify client credentials, RSS fetch config).
- Example wiring:

  ```ts
  import { runIngestionCycle, createIngestionScheduler } from './src/ingest/orchestrator'
  import { createContentRepository } from './src/db/dal/contentRepository'

  const subscriptionRepo = /* your implementation */
  const contentRepo = createContentRepository(/* drizzle db */)

  const runCycle = () =>
    runIngestionCycle(subscriptionRepo, contentRepo, {
      youtube: { apiKey: process.env.YT_API_KEY },
      spotify: {
        credentials: {
          clientId: process.env.SPOTIFY_CLIENT_ID!,
          clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
        },
      },
    })

  createIngestionScheduler(runCycle, { intervalMs: 15 * 60 * 1000 }).start()
  ```

## Listen Service

- The Fastify server (`npm run server`) exposes `POST /api/listen/:contentItemId`, which extracts article text with Mozilla Readability and synthesises audio using the configured TTS provider.
- Without provider credentials, a deterministic stub generates preview audio URLs. Set `TTS_PROVIDER`/`TTS_API_KEY` (and related CDN config) to talk to a real service.
- Each user is limited to **10 listen requests per hour**. Exceeding the quota yields `429` with a `Retry-After` header.
- Existing, unexpired assets are reused; responses include serialized expiry metadata for the UI layer.
- Schedule `npm run listen:cleanup` (wraps `purgeExpiredTtsAssets`) to purge expired rows from `tts_assets`.

## Database & Migrations

Dayroll uses Postgres with Drizzle ORM migrations.

1. Copy environment variables and adjust as needed:

   ```bash
   cp .env.example .env
   ```

2. (Optional) Boot the local Postgres container:

   ```bash
   docker compose up -d
   ```

3. Apply migrations and seed sample data:

   ```bash
   npm run db:migrate
   npm run db:seed
   ```

4. Inspect the schema or data at any time:

   ```bash
   npm run db:studio
   ```

## Tooling Summary

- **Framework:** Vite + React 19 + TypeScript.
- **Styling:** Tailwind CSS 3 with PostCSS + Autoprefixer.
- **Quality:** ESLint (flat config), Prettier, Vitest + Testing Library, Playwright.
- **Automation:** Husky + lint-staged for local guardrails.

See `docs/ROADMAP.md` for milestone tracking and next steps.
