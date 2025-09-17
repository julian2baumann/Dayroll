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

## Scripts

| Command                                 | Purpose                                                                 |
| --------------------------------------- | ----------------------------------------------------------------------- |
| `npm run lint`                          | ESLint (TypeScript + React + Testing Library) with zero-warning budget. |
| `npm run format` / `npm run format:fix` | Check or write Prettier formatting.                                     |
| `npm run typecheck`                     | Strict TypeScript validation without emitting JS.                       |
| `npm test` / `npm run test:watch`       | Vitest unit tests (coverage in CI).                                     |
| `npm run e2e` / `npm run e2e:ui`        | Playwright smoke tests across desktop/tablet/mobile viewports.          |
| `npm run ci`                            | Aggregated lint → format → typecheck → unit tests → Playwright run.     |
| `npm run db:generate`                   | Emit SQL migrations in `drizzle/` from the TypeScript schema.           |
| `npm run db:migrate`                    | Apply pending migrations to the configured Postgres database.           |
| `npm run db:seed`                       | Insert local development fixtures (requires a running database).        |
| `npm run db:studio`                     | Launch Drizzle Studio to inspect tables locally.                        |

## Testing & QA

- Unit tests live alongside components (e.g., `src/App.test.tsx`).
- Playwright end-to-end tests reside in `e2e/` and reuse the production preview build.
- Husky pre-commit hook enforces staged formatting, lint, and Vitest.

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
