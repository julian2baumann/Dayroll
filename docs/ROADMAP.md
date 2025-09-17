# ROADMAP.md — Daily Feed Project

_Last updated: 2025-09-17 15:00 UTC_

> Owned by Codex per **AGENTS.md**. Execute sequentially; after each task fast-forward `main`, check items off with commit notes, then continue.

## Milestone 0 — Tooling & Baseline

- [x] **Task 0.1 — Repository Toolchain Bootstrap** (PR [#1](https://github.com/julian2baumann/Dayroll/pull/1) — 2025-09-17)  
       **Rationale:** Establish consistent Node/React/TS workspace, CI scripts, and Playwright/Jest scaffolding to support all subsequent work.  
       **Acceptance Criteria:**
  - `package.json` defines scripts for `ci`, `lint`, `format`, `typecheck`, `test`, `e2e`.
  - ESLint + Prettier + TypeScript + Husky (or npm-equivalent) enforced; base configs checked in.
  - Playwright + Vitest/Jest installed with hello-world specs that pass.
  - Git hooks or CI script ensures no unchecked lint/test failures.  
    **Definition of Done:** Tooling commands run cleanly on fresh checkout (`npm ci`). Generated configs documented in README.  
    **Test Plan:** Run `npm ci`, `npm run lint`, `npm run typecheck`, `npm test -- --runInBand`, `npx playwright test --reporter=list`.  
    **Artifacts:** Updated `package.json`, config files (`tsconfig`, `.eslintrc`, `.prettierrc`), initial tests, README notes, CI workflow file.

## Milestone 1 — Data Model & Environment

- [x] **Task 1.1 — Database Schema & Migration Setup** (commit `95826d8` — 2025-09-17)  
       **Rationale:** Define tables per PRD (users, sources, content_items, user_subscriptions, saved_items, tts_assets, etc.) to unblock ingestion and API work.  
       **Acceptance Criteria:**
  - Migration system (Prisma, Drizzle, or Knex) configured with forward/back commands.
  - Schema aligns with PRD entities, including necessary indexes and constraints (dedupe hashes, foreign keys, timestamps).
  - Seed script inserts sample sources/items for local dev.
  - `.env.example` lists required env vars (DB, API keys).  
    **Definition of Done:** Running migrations on empty DB succeeds; rollback tested; documentation added to README.  
    **Test Plan:** Execute migration apply/rollback, run schema lint (if available), run seed script, unit tests for schema helpers (if applicable).  
    **Artifacts:** Migration files, schema model definitions, seed script, `.env.example` updates, README instructions.
- [x] **Task 1.2 — Data Access Layer & Validation Utilities** (commit `e4db88d` — 2025-09-17)  
       **Rationale:** Provide typed repos/services for creating/upserting content, enforcing dedupe, and handling date windows to be shared by jobs and API.  
       **Acceptance Criteria:**
  - DAL abstracts CRUD with TypeScript types; includes dedupe hashing helper and date range queries (today/3d/7d).
  - Input validation (Zod/Valibot) for external payloads (ingestors, API).
  - Unit tests cover dedupe, range filters, validation edge cases.  
    **Definition of Done:** DAL consumed by mock service demonstrating item upsert + fetch; tests ≥80% coverage for new code.  
    **Test Plan:** `npm test` focused on DAL modules, run coverage report, static analysis via `npm run lint`.  
    **Artifacts:** DAL modules, validation schemas, associated unit tests, coverage report snippet.

## Milestone 2 — Ingestion Services

- [x] **Task 2.1 — RSS Ingestor Service** (commit `16c8ed6` — 2025-09-17)  
       **Rationale:** Provide baseline ingest pipeline for news/podcast RSS feeds with retry/backoff and dedupe.  
       **Acceptance Criteria:**
  - Worker/service polls configured feeds, parses XML (with media attachments), dedupes via hash/external ID, stores content_items.
  - Supports retries with jitter and rate limiting; logs/metrics emitted.
  - Handles error cases (invalid feed, missing fields) gracefully.  
    **Definition of Done:** Automated job script runnable locally and via cron entry; unit tests for parser + integration test using mock RSS feed.  
    **Test Plan:** Unit tests for parser, integration test hitting local mock server, run job end-to-end against sample feeds.  
    **Artifacts:** RSS service module, job scheduler config, tests, documentation of cron cadence/ENV.
- [x] **Task 2.2 — YouTube Ingestor Service** (commit `795ec17` — 2025-09-17)  
       **Rationale:** Populate daily feed with latest channel uploads per PRD using YouTube Data API.  
       **Acceptance Criteria:**
  - Fetches uploads playlist items per subscribed channel with quota-aware pagination.
  - Normalizes data into content_items; dedupe by video ID; handles `private/deleted` gracefully.
  - Implements exponential backoff for quota errors (403/429).  
    **Definition of Done:** Local run ingests fixtures into DB; unit tests for API mapper; integration test using recorded responses; monitoring hooks for quota usage.  
    **Test Plan:** Mock YouTube API in tests, run job locally, verify DB entries, run lint/typecheck.  
    **Artifacts:** YouTube job module, API client wrapper, fixtures, tests, doc on API key setup.
- [x] **Task 2.3 — Spotify Podcast Ingestor Service** (commit `d804123` — 2025-09-17)  
       **Rationale:** Fetch new podcast episodes via client credentials to satisfy PRD's podcast requirements.  
       **Acceptance Criteria:**
  - Auth flow obtains/refreshes access token, caches until expiry.
  - Job pulls shows/episodes, normalizes metadata (title, description, release, duration, imagery).
  - Rate limiting + retry/backoff implemented; unsupported shows handled.  
    **Definition of Done:** Job runs locally against mock data; integration test using nock/recorded fixtures; metrics for failures.  
    **Test Plan:** Unit tests for auth/token refresh and mappers, integration job test, run coverage.  
    **Artifacts:** Spotify client module, ingestion worker, tests, env docs for client id/secret.
- [ ] **Task 2.4 — Ingestion Orchestration & Scheduling**  
       **Rationale:** Coordinate RSS/YouTube/Spotify jobs with cron, dedupe, and monitoring for production readiness.  
       **Acceptance Criteria:**
  - Shared scheduler script registers jobs with cadence per source type.
  - Central logging/metrics (structured logs) and alert hooks on failure.
  - Manual trigger endpoint/CLI for re-run.  
    **Definition of Done:** Scheduler configured for Railway/Render cron, docs include deployment steps.  
    **Test Plan:** Unit test scheduler config, run smoke tests invoking all jobs sequentially, verify logs/alerts stubs.  
    **Artifacts:** Scheduler module, infrastructure docs, runbooks, tests.

## Milestone 3 — Backend API & Auth

- [ ] **Task 3.1 — Supabase Auth Integration & User Session Handling**  
       **Rationale:** Provide email-based auth with secure session handling to gate personalized feeds.  
       **Acceptance Criteria:**
  - Supabase client/server wiring with magic link flow; protected routes require auth.
  - User provisioning persists profile + onboarding status.
  - Unit/integration tests for auth middleware; mock Supabase in tests.  
    **Definition of Done:** Auth endpoints documented; local env instructions; end-to-end sign-in covered by Playwright smoke.  
    **Test Plan:** Unit tests for auth guard, integration test with Supabase emulator or mocks, Playwright sign-in flow.  
    **Artifacts:** Auth modules, route guards, tests, README auth section.
- [ ] **Task 3.2 — Subscription Management API**  
       **Rationale:** Enable follow/unfollow workflows for YouTube, Spotify, RSS per FR1.  
       **Acceptance Criteria:**
  - `GET /subscriptions`, `POST /subscriptions`, `DELETE /subscriptions/:id` implemented with validation.
  - Duplicate prevention, invalid source errors surfaced with actionable messages.
  - Triggers ingestion for new follows.  
    **Definition of Done:** API documented via OpenAPI/README; unit + integration tests hitting in-memory DB; coverage ≥80%.  
    **Test Plan:** API contract tests, DAL mocked tests, Playwright scenario for follow/unfollow.  
    **Artifacts:** Route handlers, request schemas, tests, API docs.
- [ ] **Task 3.3 — Feed & Save APIs**  
       **Rationale:** Serve New Today + range-filtered feeds and Save/Unsave flows aligning with PRD performance budgets.  
       **Acceptance Criteria:**
  - `GET /feed/today` groups rows by type with ≤500ms p95 simulated load (profiling).
  - `GET /feed/:type` supports `range=today|3d|7d` and sections (Today/Yesterday/2 days ago).
  - `POST/DELETE /save/:contentItemId` manage saved_items with dedupe.
  - Response payloads include necessary metadata (thumbnails, source, time ago).  
    **Definition of Done:** Load test or benchmark script demonstrates budget compliance; unit/integration tests cover grouping logic; API documented.  
    **Test Plan:** Unit tests for grouping, contract tests with supertest, benchmark script in CI, Playwright smoke verifying saved items.  
    **Artifacts:** Feed controllers, serializers, benchmark script/results, API docs, tests.

## Milestone 4 — Web App Shell & Onboarding

- [ ] **Task 4.1 — React/Tailwind App Scaffold**  
       **Rationale:** Establish responsive shell, routing, layout primitives, theming, and bottom navigation tabs (New Today, Podcasts, YouTube, News, For You, For Later).  
       **Acceptance Criteria:**
  - App bootstrapped with Vite/Next (choose per stack), Tailwind configured with design tokens.
  - Bottom nav + page routes stubbed with skeleton loaders; accessibility (keyboard focus) verified.
  - Global state/query client (React Query) configured for API data.  
    **Definition of Done:** Lint/type/test pass; Storybook or UI docs for layout (optional but recommended); responsive snapshots for shell.  
    **Test Plan:** Component unit tests, visual regression via Storybook/Playwright, lint/typecheck.  
    **Artifacts:** App shell components, routing config, Tailwind setup, basic tests, Storybook entries if used.
- [ ] **Task 4.2 — Onboarding & Source Catalog UI**  
       **Rationale:** Allow new users to add initial sources and topics, preventing empty feeds per PRD.  
       **Acceptance Criteria:**
  - Multi-step onboarding modal/flow to add YouTube channels, Spotify shows, RSS sources, and topics.
  - Integrates with subscription API; handles validation errors gracefully.
  - Includes curated catalog suggestions and search/paste flows.  
    **Definition of Done:** Playwright E2E covering onboarding end-to-end; unit tests for forms; analytics event placeholders.  
    **Test Plan:** Form validation unit tests, Playwright onboarding scenario (desktop/tablet/mobile), a11y audit (axe).  
    **Artifacts:** Onboarding components, service hooks, tests, catalog JSON/config.

## Milestone 5 — New Today Experience

- [ ] **Task 5.1 — New Today Carousels UI**  
       **Rationale:** Deliver primary daily glance experience with horizontal carousels per content type.  
       **Acceptance Criteria:**
  - Four responsive rows (Podcasts, YouTube, News, For You) with arrow controls/swipe (mobile).
  - Cards show thumbnail, overline, title (clamped), time ago, actions (Open, Save, Listen when available).
  - Empty states with CTAs to add sources/topics.
  - Keyboard navigation and focus states implemented.  
    **Definition of Done:** Visual QA across breakpoints; integration with API data; performance audit shows initial render ≤1.5s p95 using mocked data.  
    **Test Plan:** Component tests (React Testing Library), accessibility checks, Playwright responsive snapshots (mobile/tablet/desktop).  
    **Artifacts:** Carousel components, hooks, CSS, tests, performance notes.
- [ ] **Task 5.2 — Save for Later Interaction Hooks**  
       **Rationale:** Support in-context save actions from New Today cards and propagate state.  
       **Acceptance Criteria:**
  - Save/Unsave buttons call API with optimistic updates; handles offline/error fallback.
  - Saved state reflected in For Later tab badge count.  
    **Definition of Done:** QA across breakpoints; tests ensure optimistic updates revert on error.  
    **Test Plan:** Unit tests for hooks, Playwright scenario saving from carousel, API mock tests.  
    **Artifacts:** Hooks/services, tests, documentation.

## Milestone 6 — Source Tabs & For Later

- [ ] **Task 6.1 — Source Tab List Views**  
       **Rationale:** Provide detailed lists with Today/Yesterday/2-days-ago sections and date filter toggles per PRD.  
       **Acceptance Criteria:**
  - Podcasts/YouTube/News tabs share reusable list component; toggle between last 3 days/last week updates query params.
  - Section headers collapse on tablet/mobile; skeleton loaders for perceived speed.
  - Performance instrumentation ensures p95 render ≤1.5s with cached queries.  
    **Definition of Done:** Integration tests verifying filter behavior; accessibility audit; metrics logging.  
    **Test Plan:** Component tests for list grouping, Playwright flows across breakpoints, performance measurement script.  
    **Artifacts:** List components, hooks, tests, perf report.
- [ ] **Task 6.2 — For Later Tab Implementation**  
       **Rationale:** Allow users to review saved items with consistent card spec.  
       **Acceptance Criteria:**
  - For Later tab lists saved items newest-first; supports remove/open actions.
  - Empty-state messaging guiding users.
  - Syncs with Save API and handles pagination if needed.  
    **Definition of Done:** Tests verifying data sync; accessible focus order; responsive design validated.  
    **Test Plan:** Unit tests for data hooks, Playwright scenario adding/removing saved items, visual check across breakpoints.  
    **Artifacts:** Tab components, tests, screenshots for doc.

## Milestone 7 — For You Agent

- [ ] **Task 7.1 — Recommendation Agent Service**  
       **Rationale:** Implement daily topic-based search/selection to deliver ≤5 curated items per user.  
       **Acceptance Criteria:**
  - Agent integrates with chosen web search API; respects per-user topics; generates short summaries for news only.
  - Applies dedupe against existing content_items; stores attribution and summary metadata.
  - Rate limiting and retries with jitter; skip paywalled content detection.  
    **Definition of Done:** Job runs on schedule; unit tests for scoring/selection; integration tests using mocked search responses.  
    **Test Plan:** Unit tests for summarizer and scoring, integration test hitting mock API, runbook for failures.  
    **Artifacts:** Agent service code, prompt/config files, tests, docs on API usage and pricing.
- [ ] **Task 7.2 — For You Tab UI & Daily Refresh**  
       **Rationale:** Surface agent results with explanation and ensure only five items/day per PRD.  
       **Acceptance Criteria:**
  - UI lists up to five items with summary text (news only) and topic badges; indicates refresh timestamp and upcoming refresh schedule.
  - Displays reason when agent has no picks; allows feedback placeholder (hide/unused).
  - Respects daily quota (no duplicates, no overflow) in UI logic.  
    **Definition of Done:** E2E test verifying daily refresh boundary; a11y validated; performance within render budget.  
    **Test Plan:** Component tests for quota logic, Playwright scenario verifying summary display, lint/typecheck.  
    **Artifacts:** For You UI components, tests, screenshots, perf notes.

## Milestone 8 — Listen Feature (News TTS)

- [ ] **Task 8.1 — Readability Extraction & TTS Backend**  
       **Rationale:** Provide on-demand text extraction + TTS asset generation with secure signed URLs.  
       **Acceptance Criteria:**
  - Endpoint `POST /listen/:contentItemId` triggers extraction via Readability + TTS provider (Polly/ElevenLabs).
  - Handles error states (paywall, extraction failure) and stores assets with expiry + nightly purge job.
  - Includes rate limiting, retries, and monitoring.  
    **Definition of Done:** Integration tests using mocked extractor/TTS; jobs for cleanup scheduled; coverage ≥80%.  
    **Test Plan:** Unit tests for extractor pipeline, integration test with mocked services, load test for concurrency limits.  
    **Artifacts:** Listen controller, worker, cleanup job, tests, docs on provider setup.
- [ ] **Task 8.2 — Listen UI & Accessibility**  
       **Rationale:** Enable users to trigger and access Listen assets from cards while meeting accessibility requirements.  
       **Acceptance Criteria:**
  - Cards show Listen button when available; disabled states when unsupported.
  - Trigger displays progress/toast; plays via external link; alt text and focus management implemented.
  - Mobile/tablet/desktop interactions tested; analytics event stubbed.  
    **Definition of Done:** Playwright scenario covers Listen happy/error paths; manual QA verifies focus states and screen reader labels.  
    **Test Plan:** Component tests for Listen CTA, Playwright flows, axe accessibility scan, lint/typecheck.  
    **Artifacts:** UI components, tests, screenshots, accessibility notes.

## Milestone 9 — Quality, Performance & Deployment

- [ ] **Task 9.1 — E2E Coverage & Visual Regression Suite**  
       **Rationale:** Ensure critical flows (onboarding, feeds, save, listen) are covered across breakpoints with automated tests.  
       **Acceptance Criteria:**
  - Playwright suite covers desktop/tablet/mobile for key journeys; integrates with CI.
  - Snapshot testing for major pages; failing diffs output in CI artifacts.
  - Test data management documented.  
    **Definition of Done:** CI run passes reliably; flakes triaged; coverage report shared.  
    **Test Plan:** `npx playwright test --reporter=list`, cross-browser configs (Chromium/WebKit).  
    **Artifacts:** Playwright specs, config, CI integration docs.
- [ ] **Task 9.2 — Performance Budgets & Monitoring**  
       **Rationale:** Validate server and client performance budgets and add observability hooks.  
       **Acceptance Criteria:**
  - Performance tests demonstrate `/feed/today` ≤500ms p95 (load test env).
  - Web vitals monitored (LCP, TTI) with budget ≤1.5s p95; metrics dashboard documented.
  - Logging/tracing centralized; alerts configured for ingestion failures.  
    **Definition of Done:** Performance report committed; monitoring scripts/configs deployed.  
    **Test Plan:** Run load tests (k6/Artillery), Lighthouse/Next telemetry, verify alert triggers via smoke test.  
    **Artifacts:** Performance scripts/results, monitoring config, runbooks.
- [ ] **Task 9.3 — Deployment Automation & Launch Checklist**  
       **Rationale:** Prepare repeatable deployment pipelines for frontend (Vercel) and backend/jobs (Railway/Render) per PRD.  
       **Acceptance Criteria:**
  - IaC or deployment scripts set up; environment variables managed via `.env.example` + docs.
  - Preview environments per PR; production pipeline with manual approval.
  - Launch checklist covers security, backups, runbooks, rollback plan.  
    **Definition of Done:** Dry-run deployment executed; documentation in `/docs`.  
    **Test Plan:** Execute deployment scripts in staging, verify health checks, run smoke tests post-deploy.  
    **Artifacts:** Deployment scripts/configs, docs (`docs/deployment.md`), checklist.

> After completing each task: create branch `feat/<short-task-name>`, deliver PR, wait for approval, then mark the checkbox with PR link and date.
