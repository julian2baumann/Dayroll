# Handoff Prompt for Next Codex Agent

When you open the project, use this prompt to continue Dayroll operations:

> Task 10.2 (Production Data Pipeline Enablement) now provisions Supabase users automatically. Redeploy the backend to Railway, flip Vercel to live API mode, and walk through onboarding to confirm `/api/subscriptions` returns `201`. Trigger `railway run npm run ingest:run` so the live feed repopulates, capture smoke test notes, and update the roadmap with the production verification details. If everything holds, plan the next activation steps (monitoring, analytics, or growth experiments) per the PRD.

This prompt assumes the agent has already reviewed `docs/KNOWN_ISSUES.md` and `docs/ROADMAP.md`. Adjust if additional blockers surface.
