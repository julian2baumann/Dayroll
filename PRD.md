# Daily Feed — MVP PRD (rev 3)
_Last updated: 2025-09-17 14:44 UTC — Author: PM_

## Table of Contents
- [App Overview](#app-overview)  
- [Goals & Non-Goals](#goals--non-goals)  
- [Personas & JTBD](#personas--jtbd)  
- [Platforms & Responsiveness](#platforms--responsiveness)  
- [Information Architecture](#information-architecture)  
- [Functional Requirements & Acceptance Criteria](#functional-requirements--acceptance-criteria)  
- [Feed Assembly & Time Windows](#feed-assembly--time-windows)  
- [Data Model](#data-model)  
- [Technical Requirements](#technical-requirements)  
- [Architecture & APIs](#architecture--apis)  
- [UI/UX Notes](#uiux-notes)  
- [Testing](#testing)  
- [Deployment & Operations](#deployment--operations)  
- [Metrics](#metrics)  
- [Risks & Mitigations](#risks--mitigations)

---

## App Overview
A **daily feed** that consolidates:
- **YouTube**: newest videos from followed channels (via uploads playlist → `playlistItems`).
- **Podcasts (Spotify)**: newest episodes from followed shows (metadata only; links out to Spotify). Uses **Client Credentials** (catalog-only; no user OAuth).
- **News (RSS)**: newest articles from followed sources.
- **For You**: up to **5 items/day total** from topics the user sets (web-search-powered; short summaries for **news only**).

No in-app media playback; each item **opens externally** in the native app/site. “Save for Later” queues links.

Design inspiration: **Feedly** (clarity, list density) + **Spotify** (clean card/carousel).

---

## Goals & Non-Goals

### Goals
- Morning glance of “what’s **new today**” across videos, podcasts, and articles.
- Manual follow of sources (no third‑party sign-in).
- AI‑assisted **For You** picks (5/day).

### Non-Goals (MVP)
- No YouTube/Spotify account linking or OAuth.
- No in-app playback, no full article reader UI beyond **Listen** for extractable news pages.
- No notifications, offline mode, collaboration, or comments.
- No AI summaries for YouTube/Podcasts (use provider descriptions).

---

## Personas & JTBD
- **Curator** — follows specific creators/sources; wants a fast daily snapshot.
- **Topic Grazer** — wants a few high‑quality picks per topic/day.

**JTBD:** “In the morning, show me today’s relevant videos, podcasts, and articles in one place, and let me save a few for later.”

---

## Platforms & Responsiveness
**Platform:** Web app (desktop-first) with fully responsive layouts for **desktop, tablet, and mobile**.

**Breakpoints (guidance):**
- Mobile: `< 640px`
- Tablet: `640–1024px`
- Desktop: `> 1024px`

**Responsive behaviors:**
- **New Today:** 4 carousels (Podcasts, YouTube, News, For You).
  - Desktop: horizontal card rows with arrow controls; 4–6 cards visible depending on width.
  - Tablet: 3–4 visible cards.
  - Mobile: 1–2 cards per viewport (swipe), or fallback to stacked rows with horizontal scroll per row.
- **Source tabs (Podcasts/YouTube/News/For You):**
  - Desktop: two‑column layout (list + right rail optional for filters).
  - Tablet/Mobile: single column; date sections (“Today / Yesterday / 2 days ago”) collapse/expand.
- **Save for Later:** responsive list; consistent card spec.
- All interactive targets meet minimum touch sizes; keyboard navigable; focus states visible.

---

## Information Architecture
**Bottom Nav (6 tabs)**
1. **New Today** — 4 horizontal carousels: **Podcasts**, **YouTube**, **News**, **For You**.  
2. **Podcasts** — list view; sections **Today / Yesterday / 2 days ago**; quick filter: **Last 3 days / Last week**.  
3. **YouTube** — same sectioning & filter.  
4. **News** — same sectioning & filter.  
5. **For You** — 5 items/day; news cards may show short AI summary.  
6. **For Later** — saved items, newest first.

**Onboarding:** pick YouTube channels, Spotify shows, news sources (RSS), and 2–3 topics for the For‑You agent.

---

## Functional Requirements & Acceptance Criteria

### FR1 — Follow/Unfollow Sources
- **YouTube:** Search by channel name or paste channel URL; store channel ID.
  - **AC:** Valid channel produces items next ingest; duplicates blocked; invalid → helpful error.
- **Podcasts (Spotify):** Search shows; store **show ID**.
  - **AC:** New episodes appear with title/image/release date/short description.
- **News (RSS):** Choose from a curated catalog or paste RSS URL.
  - **AC:** Valid RSS ingested; invalid → error with guidance.

### FR2 — New Today (Carousels)
- **Req:** 4 rows (Podcasts, YouTube, News, For You). Each card shows thumbnail, title, source/creator, “time ago,” **Open**, **Save**.
- **AC:** Empty-state per row; items sorted by `published_at` desc; responsive behavior as defined above.

### FR3 — Source Tabs (List Views)
- **Req:** Sectioned **Today / Yesterday / 2 days ago**; filter: **Last 3 days / Last week**.
- **AC:** Range changes adjust API query; p95 page render < **1.5s**.

### FR4 — For You (Agent)
- **Req:** User sets 2–3 topics. Agent fetches **5 items total/day** (links; brief summary for **news only**). No paywalled extraction.
- **AC:** Always show source + link; if a result is paywalled, show link/title only (no summary/extract).

### FR5 — News “Listen”
- **Req:** Article cards include **Listen** (when the page is extractable). Backend extracts main text (e.g., Readability) and generates a short audio via TTS.
- **AC:** If extraction fails or paywalled → **Listen** disabled with tooltip messaging. Audio URLs are signed and expire (≈24h).

### FR6 — Save for Later
- **Req:** Toggle save/unsave on any card; view in **For Later** tab.
- **AC:** Saved list is reverse‑chronological; unsave removes immediately.

### FR7 — Open Externally
- **Req:** Deep link to YouTube app/site, Spotify app/site, or article URL.
- **AC:** Correct URL scheme per platform; fallback to https links on desktop.

### FR8 — Ingestion & Dedupe
- **Req:** Cron jobs poll sources; dedupe by external ID + URL hash.
- **AC:** No duplicates; transient failures retry with backoff.

---

## Feed Assembly & Time Windows
- **“Today” = last 24h** (server clock).
- Source tabs also expose **Yesterday** and **2 days ago** groupings.
- Quick filters expand window to **Last 3 days** or **Last week**.
- Sort: `published_at` desc; New Today groups by type (4 rows).

---

## Data Model (MVP)
```sql
users(
  id uuid primary key,
  email text unique not null,
  auth_provider text default 'supabase',
  created_at timestamptz default now()
);

subscriptions(
  id uuid primary key,
  user_id uuid references users(id),
  source_type text check (source_type in ('youtube','podcast','news','topic')),
  source_id text,      -- YT channel ID, Spotify show ID, RSS URL, or topic key
  source_name text,
  metadata jsonb,      -- thumbnails, favicon, etc.
  created_at timestamptz default now(),
  unique(user_id, source_type, source_id)
);

content_items(
  id uuid primary key,
  source_type text check (source_type in ('youtube','podcast','news','recommendation')),
  external_id text,    -- YT video ID / RSS guid / URL hash
  source_id text,      -- join back to subscription.source_id
  title text,
  creator text,        -- channel/show/site
  url text,
  thumbnail_url text,
  description text,
  published_at timestamptz,
  dedupe_hash text unique,
  created_at timestamptz default now()
);

saved_items(
  user_id uuid references users(id),
  content_item_id uuid references content_items(id),
  saved_at timestamptz default now(),
  primary key (user_id, content_item_id)
);

user_interactions(
  user_id uuid,
  content_item_id uuid,
  clicked_at timestamptz default now()
);

tts_assets(
  id uuid primary key,
  content_item_id uuid references content_items(id),
  audio_url text,
  expires_at timestamptz
);
```

---

## Technical Requirements
- **Frontend:** React + Tailwind (light theme). CSS variables for spacing/typography; prefers system font stack.
- **Backend:** Node.js + Fastify/Express.
- **DB:** Postgres (Supabase) + daily backups.
- **Jobs:** Hosted cron (Railway/Render/Cloudflare Workers) to poll YT/Spotify/RSS; daily For‑You agent run.
- **APIs:**
  - **YouTube Data API v3:** channel uploads (uploads playlist → `playlistItems`).
  - **Spotify Web API:** `/shows/{id}` and `/shows/{id}/episodes` via **Client Credentials** (catalog metadata only).
  - **RSS:** podcast & news ingestion (XML parse); honor `<media:content>`.
  - **Web search:** for For‑You (e.g., Tavily) behind Claude/GPT.
  - **Article extraction:** Mozilla Readability (server‑side) + JSDOM.
  - **TTS:** Amazon Polly (cost‑efficient) or ElevenLabs (higher quality); signed asset URLs; nightly purge.
- **Images:** Use provider thumbnails; **proxy/cache** (e.g., simple image resizer/CDN) to normalize sizes and avoid hotlinking.
- **Auth:** Supabase Auth (email/magic link).
- **Perf budgets:** `/feed/today` server compute ≤ **500ms** p95; initial render ≤ **1.5s** p95 with cached queries.
- **Accessibility:** keyboard navigation, visible focus, alt text, color‑contrast AA.

---

## Architecture & APIs

**Services**
- `yt-ingestor`: per followed channel → fetch latest uploads → upsert `content_items`.
- `sp-pod-ingestor`: per followed show → fetch latest episodes → upsert.
- `rss-ingestor`: parse news/podcast RSS → upsert.
- `rec-agent`: daily per user → search topics → pick **≤5** items → (news only) short summary.
- `tts-worker`: on demand → extract article → synthesize TTS → store signed URL + expiry.

**Core endpoints**
- `GET /feed/today` → grouped rows for **New Today**.
- `GET /feed/:type?range=today|3d|7d` → lists with sectioning.
- `GET /subscriptions`
- `POST /subscriptions` / `DELETE /subscriptions/:id`
- `POST /save/:contentItemId` / `DELETE /save/:contentItemId`
- `POST /listen/:contentItemId` → returns signed audio URL if extractable.

---

## UI/UX Notes
- **Light theme** similar to Feedly; generous whitespace; strong typographic hierarchy.
- **Card spec:** thumbnail → overline (source/creator) → 2‑line title → time ago → actions (Open, Save, Listen*).  
  *Listen appears only on extractable news articles.
- **Empty states:** friendly copy + CTA to add sources/topics.
- **List density:** clamp text lines; consistent spacing; skeleton loaders for perceived speed.

---

## Testing
**Principle: everything implemented is tested.**

**Unit**
- Parsers/mappers: YouTube, Spotify, RSS (null/missing fields).
- Readability extraction (success/fail) and TTS request shaper.
- Dedupe hashing; date‑range filters; image proxy URL generator.

**Integration**
- Follow source → ingest → appears in correct tab and on New Today.
- For‑You agent returns ≤5/day and skips paywalled extraction.
- Listen flow: extraction success → Polly URL created; failure → UI disabled.

**E2E (Playwright/Cypress)**
- Onboarding (add sources + topics) → New Today shows items.
- Save/unsave; open externally; range filters by tab.
- Responsive snapshots at **mobile/tablet/desktop** breakpoints.

**Non‑functional**
- p95 latency budgets; job retry/backoff; authZ scoping per user; basic rate limiting.

---

## Deployment & Operations
- **Frontend:** Vercel (preview per PR).  
- **Backend:** Railway/Render (web + cron workers).  
- **DB:** Supabase (daily backups).  
- **Secrets:** env vars (YT_API_KEY, SPOTIFY_CLIENT_ID/SECRET, SEARCH_API_KEY, TTS keys).  
- **Monitoring:** uptime check, logs; alert on job failures.  
- **Data retention:** purge old TTS assets nightly; consider 30–60 day content retention for DB size.

---

## Metrics
- **Activation:** % who follow ≥3 sources and set topics.  
- **Engagement:** daily opens, CTR by row, saves/session.  
- **Quality:** For‑You CTR, hide/remove (when added).  
- **Reliability:** ingest success %, time‑to‑ingest, TTS failures.

---

## Risks & Mitigations
- **API quotas/policy changes (YouTube/Spotify):** staggered polling, caching, solid fallbacks (e.g., RSS for podcasts later if needed).  
- **Paywalls:** list link/title only; disable Listen; avoid scraping behind auth.  
- **TTS cost creep:** cap chars per item; sign URLs with short expiry; purge nightly.  
- **Empty feeds for new users:** curated catalog in onboarding (still manual opt‑in).

---

## Out of Scope (MVP)
- Notifications, offline, collaborative features, comments, OAuth linking to user accounts, full article reader, in‑app playback, Apple/ iTunes podcasts.
