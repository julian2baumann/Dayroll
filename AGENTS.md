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
   - **Check it off** in `docs/ROADMAP.md` (note the commit hash or summary).
   - Select the **next** unchecked task and continue (sequential loop).

## Workflow per task
1) Work on a topical branch (e.g., `feat/<short-task-name>`) locally to keep commits focused.
2) Run required checks before presenting work:
   - **Install:** `npm ci` (or `pnpm install` / `yarn install`)
   - **Typecheck:** `npm run typecheck`
   - **Lint/Format:** `npm run lint` and `npm run format`
   - **Unit/Integration tests:** `npm test`
   - **E2E tests (Playwright):** `npm run e2e`
3) Once the task passes the rubric and tests, fast-forward `main` locally and push directly to the remote `main` branch. No PR or manual review step.
4) Publish a succinct task note in the chat summarising changes, tests, and verification guidance for stakeholders.
5) Update `docs/ROADMAP.md` to mark the task complete (with commit hash or summary) and proceed immediately to the next item.

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

## Commit conventions
- Keep commits focused and small (ideally < 600 LOC diff). Split if larger.
- Reference roadmap tasks in commit messages when helpful.
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
