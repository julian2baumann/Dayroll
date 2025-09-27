# QA Checklist — Daily Feed MVP

Use this checklist for pre-release validation after automated suites complete. Run through each section on **desktop (≥1024px)**, **tablet (~768px)**, and **mobile (≤414px)** viewports unless noted.

## 0. Environment

- [ ] `.env` populated (Supabase, API keys, Listen provider or demo mode).
- [ ] Telemetry exporter configured (`TELEMETRY_EXPORT_URL`) or exporter disabled for manual run.
- [ ] Demo mode flag reviewed (`VITE_DEMO_MODE`) — disable for staging/prod validation.

## 1. Authentication & Onboarding

- [ ] Magic link login succeeds; account stored in Supabase.
- [ ] `/auth/callback` screen confirms the link, removes tokens from the URL, and routes into onboarding when no sources exist.
- [ ] Onboarding modal appears for first-time users; can add at least one YouTube channel, Spotify show, RSS feed, and two topics.
- [ ] Invalid channel/feed surfaces helpful error and does not progress.
- [ ] Skipping onboarding flows hides modal on subsequent visits.

## 2. New Today

- [ ] Four carousels render with provider-specific labelling and thumbnails.
- [ ] Swiping/arrow navigation works across breakpoints; keyboard arrows and focus rings present.
- [ ] Empty state copy shown when a content type lacks items.
- [ ] Performance budget verified: initial load ≤ **1.5 s p95** (Lighthouse or Web Vitals panel).

## 3. Source Tabs (YouTube, Podcasts, News)

- [ ] Date sections group items into Today / Yesterday / 2 days ago.
- [ ] Range filter toggles between 3d and 7d windows.
- [ ] Cards expose Open + Save + Listen (news only) where applicable and respect keyboard navigation.
- [ ] API responses stream ≤ **500 ms p95** (inspect telemetry or APM dashboard).

## 4. For You

- [ ] Displays up to five recommendations with summary text (news only) and topic badges.
- [ ] “Last refreshed” timestamp updates after daily agent run or forced refresh.
- [ ] Empty state shown when agent cannot retrieve items; error state appears on failure.

## 5. Save for Later

- [ ] Save/Unsave toggles propagate across New Today, Source tabs, and For You.
- [ ] For Later tab lists items newest first; removing an item updates immediately.
- [ ] Saved badge count updates in navigation.

## 6. Listen (News TTS)

- [ ] Listen button enabled for extractable articles; disabled with tooltip for unsupported sources.
- [ ] Trigger surfaces progress state, reuses cached asset when available, and opens audio URL.
- [ ] Rate limit enforcement: >10 requests/hour returns 429 with clear messaging.

## 7. Accessibility

- [ ] Tab order follows visual layout; focus rings visible on interactive elements.
- [ ] `aria-label` / `aria-live` attributes present on navigation, Listen, Save, and carousel controls.
- [ ] Screen reader announces toast/alert feedback (Save, Listen).

## 8. Error Handling & Alerts

- [ ] Simulated network failure (Supabase offline) shows inline error states without console crashes.
- [ ] Ingestion job failure surfaces alert via `ALERT_WEBHOOK_URL`; telemetry records `ingest.*` errors.
- [ ] Telemetry exporter reachable; failed batch retries without dropping metrics.

## 9. Performance & Telemetry

- [ ] `npm run perf:feed` passes with p95 ≤ **500 ms** for `/api/feed/today` and `/api/feed/:type`.
- [ ] `npm run telemetry:aggregate` summary stored under `perf/reports/` and archived.
- [ ] Dashboard or logs show Web Vitals p95 <= budgets (LCP ≤1.5 s, INP ≤200 ms, CLS <0.1).

## 10. Regression Smoke

- [ ] Playwright suite (`npm run e2e -- --reporter=list`) green across Chromium, tablet, and mobile configs.
- [ ] Vitest suite (`npm run test`) green with coverage ≥ 50% overall, ≥80% on new code.
- [ ] ESLint + TypeScript clean (`npm run lint`, `npm run typecheck`).

## 11. Deployment & Rollback

- [ ] `npm run deploy:frontend` completes (Vercel) with correct environment.
- [ ] `npm run deploy:backend` completes (Railway/Render) and health checks pass.
- [ ] Rollback commands verified on staging.

> Record completion date, operator initials, and links to telemetry dashboards when filing this checklist for release sign-off.
