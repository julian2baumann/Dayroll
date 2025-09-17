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

## Testing & QA

- Unit tests live alongside components (e.g., `src/App.test.tsx`).
- Playwright end-to-end tests reside in `e2e/` and reuse the production preview build.
- Husky pre-commit hook enforces staged formatting, lint, and Vitest.

## Tooling Summary

- **Framework:** Vite + React 19 + TypeScript.
- **Styling:** Tailwind CSS 3 with PostCSS + Autoprefixer.
- **Quality:** ESLint (flat config), Prettier, Vitest + Testing Library, Playwright.
- **Automation:** Husky + lint-staged for local guardrails.

See `docs/ROADMAP.md` for milestone tracking and next steps.
