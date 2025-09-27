# Deployment Guide

This document captures the deployment automation for the Daily Feed MVP across the frontend (Vercel) and backend/job services (Railway or Render).

## Pipeline Overview

| Workflow                                                        | Trigger                                                           | Purpose                                                                                                | Output                                                              |
| --------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `Deploy Preview` (`.github/workflows/deploy-preview.yml`)       | Every pull request targeting `main`                               | Build + test + smoke perf, deploys a preview build of the web app and backend to sandbox infra.        | Ephemeral Vercel preview URL + selected Railway/Render environment. |
| `Deploy Production` (`.github/workflows/deploy-production.yml`) | Manual dispatch or push to `main` (requires environment approval) | Runs the full verification gauntlet, deploys to the production Vercel project and backend environment. | Production Vercel deployment + Railway/Render deploy trigger.       |

Both workflows share the same validation steps:

1. `npm ci`
2. `npm run lint`
3. `npm run typecheck`
4. `npm run test`
5. `npm run e2e -- --reporter=list`
6. `npm run perf:feed`
7. Deployment (`tsx scripts/deploy/frontendDeploy.ts` for Vercel, `tsx scripts/deploy/backendDeploy.ts` for backend)

> The preview workflow omits `--prod`, so Vercel creates an ephemeral deployment; the production workflow invokes `npm run deploy:frontend` which forces a `--prod` deployment.

## Environment Variables & Secrets

Populate the following secrets in GitHub Actions. The same keys are also exposed in `.env.example` for local runs.

| Secret                        | Used By        | Description                                               |
| ----------------------------- | -------------- | --------------------------------------------------------- |
| `VERCEL_TOKEN`                | both workflows | Personal or team token with deploy rights.                |
| `VERCEL_PROJECT_ID`           | both           | Vercel project identifier.                                |
| `VERCEL_ORG_ID`               | both           | Vercel team/org scope.                                    |
| `RAILWAY_TOKEN`               | optional       | Railway CLI token for non-interactive deployments.        |
| `RAILWAY_PROJECT_ID`          | optional       | Railway project containing the Node service + jobs.       |
| `RAILWAY_PREVIEW_ENVIRONMENT` | preview        | Environment slug for PR deploys (e.g. `staging`).         |
| `RAILWAY_PROD_ENVIRONMENT`    | production     | Environment slug for live deploys.                        |
| `BACKEND_PREVIEW_TARGET`      | preview        | Optional override (`railway` or `render`).                |
| `BACKEND_PROD_TARGET`         | production     | Optional override when using Render in prod.              |
| `RENDER_API_KEY`              | optional       | API token used when targeting Render.                     |
| `RENDER_PREVIEW_SERVICE_ID`   | preview        | Render service identifier (if using Render).              |
| `RENDER_PROD_SERVICE_ID`      | production     | Render service identifier.                                |
| `RENDER_BRANCH`               | both           | Branch to deploy (defaults to workflow branch or `main`). |
| `TELEMETRY_EXPORT_URL`        | both           | Optional metrics collector endpoint (HTTP POST).          |
| `TELEMETRY_EXPORT_API_KEY`    | both           | Optional bearer token for the metrics endpoint.           |
| `ALERT_WEBHOOK_URL`           | both           | Optional webhook for ingestion failure alerts.            |

> If a backend secret is omitted, the script defaults to Railway with the corresponding IDs. Render support kicks in when `BACKEND_*_TARGET=render`.

## Deployment Scripts

`scripts/deploy/frontendDeploy.ts`

- Builds the Vite bundle (`npm run build`).
- Runs `npx vercel deploy` with the provided token/org/project.
- Accepts `--prod` to promote the deployment to production.

`scripts/deploy/backendDeploy.ts`

- When targeting Railway: runs `railway login`, selects the project/environment, and calls `railway up --service backend --detach`.
- When targeting Render: issues a REST API call to `POST /v1/services/:id/deploys` with the configured branch.

## Current Staging Environment — 2025‑09‑26

| Layer           | Provider                                              | Location/URL                                                   | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------- | ----------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database + Auth | Supabase (`ppjyiwxuulghlcohmpxc`)                     | https://supabase.com/dashboard/project/ppjyiwxuulghlcohmpxc    | Site URL set to `https://dayroll-kvnp9q49o-julians-projects-21f90e2b.vercel.app`. Redirect allow list includes that domain, the `/auth/callback` path, and `http://localhost:5173/auth/callback`. Connection string: `postgresql://postgres:<password>@aws-1-us-east-2.pooler.supabase.com:5432/postgres` (rotate password via **Project Settings → Database**). Run migrations with `DATABASE_URL` pointing at the pooler; remember to URL-encode reserved characters. |
| API / jobs      | Railway project `soothing-victory`, service `Dayroll` | https://dayroll-production.up.railway.app                      | Build command overridden to `npm install --no-audit --progress=false`; start command `npm run server`. Required env vars: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `NODE_ENV=production`. Additional provider keys may be added later (`YT_API_KEY`, etc.). Health check available at `/health`.                                                                                                                               |
| Frontend        | Vercel project `dayroll`                              | https://dayroll-kvnp9q49o-julians-projects-21f90e2b.vercel.app | Build command set to `npx vite build` (temporary workaround until `npm run build` TypeScript issues are resolved). Env vars scoped to Vercel: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL=https://dayroll-production.up.railway.app`, `VITE_DEMO_MODE=false`.                                                                                                                                                                                     |

**Operational notes**

- Supabase migrations and seed were applied on 2025‑09‑26 via `npm run db:migrate` and `npm run db:seed` using the pooler connection.
- Magic-link authentication depends on both the Site URL and Redirect entries; update both if the Vercel domain changes.
- Railway’s generated domain doubles as the API health endpoint. Add `https://dayroll-production.up.railway.app/health` to monitoring.
- Vercel preview deployments will inherit the same env vars; override `VITE_API_BASE_URL` if you spin up a separate backend instance.
- The backend TypeScript build currently fails under `npm run build`; staging uses runtime compilation via `tsx`. Track the cleanup effort so the long-term plan returns to `npm run build` parity.

Local dry-run example:

```bash
VERCEL_TOKEN=... VERCEL_PROJECT_ID=... VERCEL_ORG_ID=... tsx scripts/deploy/frontendDeploy.ts --prod
RAILWAY_TOKEN=... RAILWAY_PROJECT_ID=... RAILWAY_ENVIRONMENT=staging tsx scripts/deploy/backendDeploy.ts
```

## Launch Checklist

Use this checklist before flipping production traffic:

1. ✅ Preview workflow green on the final PR (lint/type/test/e2e/perf all passing).
2. ✅ Database migrations applied (`npm run db:migrate`) against production DB.
3. ✅ Secrets rotated and stored in GitHub Actions + platform dashboards (Vercel, Railway/Render).
4. ✅ `perf/.telemetry.log` reviewed from `npm run perf:feed` (≤ 500 ms p95) and Lighthouse snapshot captured for LCP/CLS/INP.
5. ✅ Backups confirmed (Supabase daily backup + Railway snapshot) and rollback command documented.
6. ✅ Vercel/Render health checks returning 200 and Playwright smoke test run against production deployment.
7. ✅ Incident response + on-call rotation updated with server logs/metrics destinations.

Store a copy of the filled checklist (date + initials) in your release notes.

## Manual Approvals

The production workflow targets the `production` environment in GitHub. Configure that environment with required reviewers to enforce human approval before deployment.

## Rollback

- Vercel: `npx vercel rollback <deployment-url>`
- Railway: `npx railway up --service backend --rollback`
- Render: `curl -X POST https://api.render.com/v1/services/$RENDER_SERVICE_ID/deploys \`<br> ` -H "Authorization: Bearer $RENDER_API_KEY" \`<br> ` -H "Content-Type: application/json" \`<br> ` -d '{"clearCache":true,"branch":"<last_good_branch>"}'`

Document the exact rollback command + service IDs in your runbook after each release.
