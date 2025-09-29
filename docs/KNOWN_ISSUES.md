# Known Issues — Dayroll Production Data Enablement

_Last updated: 2025-09-27_

## 1. Subscription creation fails in production — resolved

**Symptom**

- `/api/subscriptions` returns `500` during onboarding. Network panel shows the request hitting `https://dayroll-production.up.railway.app/api/subscriptions` with response body:
  ```json
  {
    "statusCode": 500,
    "error": "Internal Server Error",
    "message": "Cannot read properties of undefined (reading '_zod')"
  }
  ```
- After allowing `metadata: null`, the response still returns `500` while the UI shows "Request failed".
- Railway logs do not emit the underlying Postgres error because the service only logs startup events by default.

**Status**

- Fixed by automatically upserting the authenticated Supabase user into the `users` table during request authentication (Fastify pre-handler). Additional diagnostics now capture `code` and `message` fields for subscription insert errors so Railway logs surface FK or dedupe failures.

**Root cause**

- Supabase enforces `subscriptions.user_id` ⇢ `users.id`. In production we never inserted a row into `users` when a Supabase auth session was established, so the foreign-key check failed (`23503: insert or update on table "subscriptions" violates foreign key constraint`). This manifested as an unhandled error inside the subscription POST handler.

**Evidence**

- Local DB seed includes `users` rows; onboarding works locally.
- Supabase Auth signs in successfully (the `Authorization: Bearer ...` header is valid) but the custom `users` table remains empty in production.
- The repository code (`createSubscriptionRepository`) blindly inserts into `subscriptions` and bubbles any error, producing the generic 500.

**Validation checklist (post-fix)**

1. Deploy the updated backend to Railway and confirm logs show `[auth]` upsert activity (or explicit errors) when authenticating.
2. Run through onboarding in production; `POST /api/subscriptions` should now return `201` and the UI should advance without errors.
3. Trigger `railway run npm run ingest:run` to seed fresh content, then verify the Vercel frontend surfaces real items (no demo mocks).
4. Monitor Railway logs for `[subscriptions:create]` entries; dedupe (`23505`) is now handled with `409`, and FK violations (`23503`) should no longer appear.

**Additional observations**

- Railway CLI `logs` command currently only shows startup lines. The new console diagnostics in `src/server/createApp.ts` help, but enabling Fastify's logger would provide structured output if we need more signal.
- The frontend now respects `VITE_API_BASE_URL`, so once the backend accepts subscriptions the UI flow should succeed end-to-end.

## 2. Instrumentation gaps

- Playwright tests use demo mode; no automated coverage exists for real Supabase interactions. Manual QA is required after the subscription fix.
- Consider adding smoke tests that stub the server and ensure `POST /api/subscriptions` returns 201.

Refer to `docs/ROADMAP.md` Task 10.2 for the broader activation plan.
