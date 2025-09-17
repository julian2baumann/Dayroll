# AGENTS.md — Project rules for Codex
_Last updated: 2025-09-17 14:00 UTC_

## Source of truth
- **PRD:** `./PRD.md`. If a pivot is proposed and approved, **update `PRD.md` first**, then update `docs/ROADMAP.md` and proceed.

## Operating mode
- **Mode:** Sequential, task-by-task.
- **Autonomy:** Proceed automatically through the **next** task **only after** the previous PR is **approved/merged**.
- **Concurrency:** Do **not** start a new task while a PR is awaiting review (unless I explicitly say so).

## Planning & roadmap
1) Read `./PRD.md` and draft `./docs/ROADMAP.md`:
   - Break into **Milestones → Tasks** with **acceptance criteria**.
   - Each task must include: rationale, DoD (Definition of Done), test plan, and artifacts to produce.
2) After completing a task:
   - **Check it off** in `docs/ROADMAP.md` (link the PR).
   - Select the **next** unchecked task and continue (sequential loop).

## Workflow per task
1) Create branch: `feat/<short-task-name>`
2) Implement with **small, reviewable commits**.
3) Run local checks (replace with your package manager as needed):
   - **Install:** `npm ci` (or `pnpm install` / `yarn install`)
   - **Typecheck:** `npm run typecheck` (if applicable)
   - **Lint/Format:** `npm run lint` and `npm run format` (or fix)
   - **Unit/Integration tests:** `npm test -- --watch=false`
   - **E2E tests (Playwright):** `npx playwright test`
4) Open a PR titled `feat: <task>` and include in the description:
   - Summary of changes (bullets)
   - Risk/limitations
   - How to test (commands + URLs)
   - Screenshots for UI changes (desktop, tablet, mobile)
   - Performance notes vs budgets (see below)
5) **WAIT** for approval before merging. After merge, update ROADMAP and start the next task.

## Quality gates
- **Tests are mandatory** for everything implemented (unit, integration, and E2E where UI is affected).
- **Coverage target:** ≥ 80% lines on new/changed code (if coverage tooling present).
- **Performance budgets:**
  - Server: `/feed/today` compute ≤ **500ms p95** for ~30 sources.
  - Web: initial render ≤ **1.5s p95** on a mid-tier laptop; interaction responsive.
- **Accessibility:** keyboard navigation, visible focus outlines, alt text; color-contrast AA.
- **Security:** never commit secrets. Use `.env.example` with placeholder keys.
- **Rate limiting & retries:** on outbound calls (YouTube/Spotify/RSS), implement backoff with jitter and 429 handling.
- **Dedupe:** strictly enforce hash/external-id dedupe per PRD.

## Allowed actions & environment
- Allowed: read/modify files in repo, run local commands/tests, manage branches/PRs.
- Assume Node.js LTS and Playwright available. If tooling is missing, propose a setup PR first.
- **Do not** exfiltrate code or credentials. Internet access only for allowed package installs and documented steps.

## PR conventions
- Keep PRs focused and small (ideally < 600 LOC diff). Split if larger.
- Link issues/tasks in `docs/ROADMAP.md`.
- Use conventional commits in messages when possible.

## Pivot protocol
- If you discover a constraint requiring scope change:
  1) Open a **proposal PR** updating `PRD.md` (redlines) and `docs/ROADMAP.md`.
  2) WAIT for approval.
  3) Proceed with implementation PRs only after approval.

## Test commands (examples)
- Unit/Integration: `npm test -- --runInBand`
- E2E (Playwright): `npx playwright test --reporter=list`
- Lint: `npm run lint`  •  Format: `npm run format`

## Definition of Done (DoD) for each task
- Code compiles and passes lint, types, and tests.
- E2E snapshots at **mobile (<640px)**, **tablet (640–1024px)**, **desktop (>1024px)**.
- Docs updated (README/ENV/PRD if needed).
- ROADMAP item checked with link to PR.
