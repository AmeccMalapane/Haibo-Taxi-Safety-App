# Haibo! Pre-Launch Audit — Full Report

**Date:** 2026-04-16
**Scope:** Mobile app + Command Center + Backend
**Target audience:** youth SA commuters (ages 16–34)

## Executive summary

Of 10 concerns surfaced: 2 are fully implemented (hand signs, driver
rating — though media upload is captured-but-not-submitted), 3 are
built-but-not-wired (comments, MapHero, hashtags), and 5 are missing
entirely (AdMob, admin ads/analytics, rank detail mosaic+iframe+routes,
watermark on media, nicknames/handles). The command-center marketing
site has zero imagery — all text + gradients. Architecture is
single-tenant with no i18n / feature-flags, which hurts partnership
readiness.

Biggest single win: fixing the MapHero (a 3-line workflow change),
because it's the first screen corporates land on and it's currently
silently failing.

---

## Item-by-item findings

### 1. Mapbox interactive hero on command-center — BUILT, SILENT-FAILING

- Component exists: `command-center/src/components/MapHero.tsx` — 6 SA
  hub pins with pulse animation, bearing drift
- Home page lazy-loads it at `HomePage.tsx:32-34`
- **Root cause**: Live verification found 0 canvases, 0 Mapbox network
  requests, empty right-side hero column.
  `.github/workflows/deploy-command-center.yml` never passes
  `VITE_MAPBOX_PUBLIC_TOKEN` to `npm run build`, so Vite bakes an empty
  string into the bundle and MapHero returns null per its guard at
  `MapHero.tsx:78`
- **Action**: Add a GitHub Actions secret `VITE_MAPBOX_PUBLIC_TOKEN`
  and pass it as an `env:` to the Build step.
  **Effort: 10 min. Priority: P0.**

### 1.1 Taxi rank info bubbles — MISSING

- Markers created at `MapHero.tsx:54-58` with no click handlers, no popups
- Data is 6 hardcoded coordinates; no pull from `/api/locations`
- **Action**: (a) Replace hardcoded hubs with a fetch of verified ranks.
  (b) Add a `mapboxgl.Popup` bound to each marker with rank name, type,
  associations, photo thumbnail, and a "View rank →" link to the mobile
  deep-link. **Effort: 4–6 h. Priority: P1.**

### 2. Header banners across public pages — ZERO IMAGERY

- Inventory of 10 public routes in `App.tsx:74-85`: all heroes are
  gradients + SVG icons, no photography anywhere
- No `<Hero>` component with an image slot exists; each page rolls
  its own
- **Action**:
  1. Add a reusable `<PageHero image="..." eyebrow kicker title
     subtitle />` component under `command-center/src/components/`
  2. Source SA minibus taxi photography (licensed — Unsplash has a
     `minibus taxi south africa` collection; or commission for
     authenticity)
  3. Banner per page: Home=rank overview, About=rank at golden hour,
     Community=phone + taxi interior, Events=street scene, Jobs=driver
     portrait, Privacy/Terms=abstract shape (not photography — keeps
     legal pages sober)
- **Effort: 1–2 days including asset licensing. Priority: P1.**

### 3. AdMob + admin ad posting/moderation/analytics — ALL MISSING

- Zero ad SDK in `package.json`, zero ad plugins in `app.json`, no
  `isSponsored`/`adTag` on `reels` schema
- No `advertisements`/`campaigns` table in `shared/schema.ts`, no admin
  route for ad CRUD
- Admin DashboardPage shows operational KPIs only (active SOS, total
  users, compliance) — no engagement charts, no time-series
- **Action** (monetization epic — suggest post-launch, weeks 2–6):
  1. Install `react-native-google-mobile-ads` with AdMob plugin in
     `app.json`
  2. AdMob policy: use native `BannerAd` between every 4 reels and a
     skippable `RewardedAd` for "unlock the full SOS sound pack"-type
     rewards
  3. Create direct-sold infra parallel to AdMob: new `campaigns` table
     (`id, brand, creativeUrl, headline, ctaUrl, startAt, endAt,
     targetSegments, impressions, clicks, status`), admin CRUD under
     `/admin/campaigns`, a native sponsored reel card with a
     "Sponsored" pill that renders between organic reels at every 5th
     position
  4. Analytics dashboard: log `adImpression`, `adClick`, `reelView`,
     `reelShare` events to a new `engagementEvents` table with BRIN
     index on `createdAt`; aggregate 24h/7d/30d counts for the admin
- **Effort: 3–4 weeks (Play Store ad policy review adds 1 week).
  Priority: P2 (post-launch).**

### 4. Comment section — COMPONENT BUILT, NOT WIRED, MISSING FEATURES

- `CommentTray` component exists at `client/components/CommentTray.tsx`
  (412 lines) but is not imported by any screen — biggest single find
  of this audit
- Like button handler is empty at lines 162–171; reply handler missing;
  comments persist in local state only, no server sync
- No image attachment, no emoji picker, no GIF picker, no @mention, no
  report/flag action
- Backend supports nested replies via `reelComments.parentId` at
  `schema.ts:379` but no `imageUrl`/`mediaUrl`/`reportReason` fields
- **Action**:
  1. Wire CommentTray into PushaScreen + CommunityPostDetail +
     LocationDetails + RatingsList + LostFound
  2. Add `attachmentUrl` column to `reelComments` + migration; extend
     CommentTray with image picker (reuse existing upload helper)
  3. Emoji: `react-native-emoji-selector` (2h); GIF: Giphy or Tenor API
     (4h, Tenor is free from Google)
  4. @mention autocomplete once users have handles (see item 9)
  5. "Report" action → writes to existing moderation queue
- **Effort: 1 week. Priority: P0 for wiring + likes (silent feature
  inspection will make launch feel broken), P1 for emoji/GIF/mention.**

### 5. Taxi rank info page — PARTIALLY BUILT

- `client/screens/LocationDetailsScreen.tsx` has: hero image (200px,
  single not mosaic), horizontal scrollable photo gallery, "Add photo"
  upload flow, connected routes (up to 5), rating CTA
- Missing: mosaic grid (currently single-row horizontal scroll), iframe
  hero (currently a single `<Image>`), rating summary, incident
  history, photo uploader credits
- **Action**:
  1. Replace hero image with a Mapbox embed showing the rank pinned +
     nearby ranks — that's your "iframe of the rank"
  2. Replace horizontal photo scroll with a `<MasonryList>`
     (`@react-native-seoul/masonry-list`) for the stylish mosaic grid
  3. Add a rating summary block above the CTA (avg stars, n reviews,
     top 2 reviews)
  4. Add attribution: "Photo by @handle" under each image
  5. Routes list: already has ≤5, bump to 10 with "view all"
- **Effort: 2–3 days. Priority: P1.**

### 6. Taxi hand signs — FULLY IMPLEMENTED

- 8 signs defined at `client/data/communityRoutes.ts:93-102`, mapped
  to emoji
- Wired into RouteSubmissionScreen + CommunityRouteDetailScreen, schema
  has `routeContributions.handSignal`
- Reference table `handSignals` in schema with `imageUrl` + `region`
- **Gap**: Currently uses emoji; would benefit from actual illustrated
  hand-sign graphics (the `imageUrl` field exists — just needs content)
- **Action**: Commission or sketch 8 hand-sign illustrations, upload to
  blob, update `handSignals.imageUrl` seed data.
  **Effort: 2 days illustration + 30 min seed. Priority: P2 (polish).**

### 7. Driver rating subpage with plate + media + review — BUILT, MEDIA UPLOAD BROKEN

- `client/screens/RatingScreen.tsx` captures: plate
  (uppercase-normalized), 5-star driver rating, 5-star rank rating,
  optional driver name, optional location, free-text review, image
  picker via `expo-image-picker`
- Backend `server/routes/misc.ts:208-313` persists with plate→driver
  resolution, fallback logging for unknown plates
- **Bug**: Image URI is captured at `RatingScreen.tsx:74, 211-237` but
  not included in the POST payload. Media never reaches the server.
- Schema `driverRatings` has no `mediaUrls` column to receive them
- **Action**: (a) Add `mediaUrls jsonb` column to `driverRatings` +
  migration; (b) wire image upload to Azure blob before submit;
  (c) add media URLs to POST body; (d) render media thumbnails in
  admin driver detail.
  **Effort: 4–6 h. Priority: P1 — your "shame bad actors" value prop
  needs visual evidence.**

### 8. Watermark on shared content — TEXT-ONLY, NO IMAGE OVERLAY

- `ShareTray` at `client/components/ShareTray.tsx:94-104` appends text
  watermark "Via Haibo App" to share messages
- No image/video watermarking: `package.json` has zero canvas/ffmpeg/
  image-editor libraries. Images and videos ship un-branded.
- **Action**:
  1. Server-side: when a reel video is uploaded to Azure Blob, run an
     Azure Function with `ffmpeg` to overlay a semi-transparent Haibo
     logo (bottom-right, 20% opacity, 8% of video width). Store
     watermarked version as the `mediaUrl`, keep original as
     `rawMediaUrl`.
  2. Client-side images: before `Share.share`, render the image + logo
     overlay to a temp file via `react-native-view-shot` + a hidden
     `<ViewShot><Image/><Image source={logo}/></ViewShot>`. ~80 lines.
  3. Text posts: extend current watermark from plain text to
     `"— Haibo! (haibo.africa)"` with emoji-free styling
- **Effort: 3–4 days (mostly Azure Function setup).
  Priority: P1 — brand leakage with every share.**

### 9. User nicknames / handles — DRIVER-ONLY, MISSING FOR GENERAL USERS

- `users` table at `schema.ts:6-39` has only `displayName` — no
  `username`, no `handle`, no `alias`
- `driverProfiles.username` exists (drivers have public handles) but
  general users don't
- Reels fallback to `userName: req.user!.phone` at
  `community.ts:93` — phone numbers are being shown as attribution,
  which is a privacy leak
- `CommentTray` hardcodes `"You"` at line 121
- No user-search feature anywhere
- **Action**:
  1. Add `handle` (unique, lowercase, 3–20 chars, `[a-z0-9_]+`) +
     `avatarUrl` to `users` table
  2. Profile setup step: force-set handle on first launch (suggest
     variants if taken)
  3. Replace `userName: req.user.phone` with
     `userName: req.user.handle` everywhere
  4. Add `GET /api/users/search?q=handle` endpoint; wire to a global
     search bar
  5. Enables @mention (item 4), hashtag profile links (item 10), and
     the whole social graph
- **Effort: 3–4 days.
  Priority: P0 — phone numbers currently leak as display names. That's
  a POPIA issue, not just a nice-to-have.**

### 10. Hashtags — PARSED + STORED, NOT INTERACTIVE

- Regex extraction at `CreateReelScreen.tsx:163-166`
- Stored as `hashtags text[]` at `schema.ts:346`, max 30 per post /
  50 chars each
- Rendering at `PushaScreen.tsx:233-241` is static text (first 3 only),
  no `Pressable` wrapper, no tap-to-filter
- No hashtag discovery page, no trending widget, no autocomplete
- **Action**:
  1. Wrap hashtags in `<Pressable>` → navigate to
     `HashtagFeedScreen?tag=XYZ`
  2. Add `GET /api/community/hashtags/:tag/posts` endpoint (uses GIN
     index on `hashtags` array)
  3. Add a trending hashtags row on the PushaScreen top (last 24h,
     top 10, 1h cached aggregation)
  4. Autocomplete during compose: `GET /api/community/hashtags?prefix=saf`
  5. Admin analytics: hashtag usage over time
- **Effort: 2–3 days. Priority: P1.**

---

## Cross-cutting: scalability + partnership-readiness

| Dimension | State | Action |
| --- | --- | --- |
| Multi-tenancy | None | Post-launch. Add `organizations` table + `userOrgs` junction once first enterprise deal closes. Don't over-engineer now. |
| Feature flags | None | Install `@openfeature/core` or GrowthBook (free tier) before 10k users — cheap insurance. **P1.** |
| Public API / SDK | None | Add `/developer` page once there's an SDK plan. **P3.** |
| i18n | None (English only) | SA has 11 official languages. Target isiZulu + Sesotho + English minimum. Add `react-i18next`. **P1.** |
| `/partners`, `/press` | None | Add once first partnership case study lands. **P2.** |
| Brand analytics | None | Same `engagementEvents` table from item 3 powers both internal + partner-facing dashboards (flag-gated). |
| Data export for partners | None | CSV export of aggregated engagement by region/demographic — POPIA compliant (no PII). **P2.** |

---

## Design direction for youth audience

Brand tokens at `command-center/src/lib/brand.ts` are on-target:
`#E72369` haiboPink, `#E49E22` haiboGold, Space Grotesk headings. Youth
energetic, not corporate. Push further on youth-SA vibe with
**typeui-energetic / typeui-bold**:

- Thicker borders (1px → 2–3px on cards)
- Geometric shapes (angled hero sections, diagonal dividers)
- Bigger type (`typography.pageTitle: 28px` → 36–42px on marketing)
- Motion (subtle parallax on hero images, hashtag pills with a spring
  pop on tap)
- Authentic photography (not stock generic — rank culture, morning
  commute light, gqom vibe). This is the biggest aesthetic lever.

Avoid `typeui-clean` / `typeui-refined` — those read "corporate
software", not "Mzansi taxi culture."

---

## Prioritized action plan

| # | Action | Priority | Effort | Unblocks |
| --- | --- | --- | --- | --- |
| 1 | Pass `VITE_MAPBOX_PUBLIC_TOKEN` to the deploy workflow | P0 | 10 min | MapHero visible; site no longer looks broken |
| 2 | Add `users.handle` + stop leaking `phone` as display name | P0 | 3–4 d | Items 4 (mentions), 9, 10; closes POPIA gap |
| 3 | Wire CommentTray into 5+ screens + implement like/reply | P0 | 1 wk | Item 4 core |
| 4 | Fix driver-rating media upload pipeline | P1 | 4–6 h | Item 7 evidence-based reviews |
| 5 | Watermark pipeline (Azure Function + view-shot) | P1 | 3–4 d | Brand leakage on share |
| 6 | Rank info popups + hook MapHero to `/api/locations` | P1 | 4–6 h | Item 1.1 |
| 7 | Hashtag interactivity + HashtagFeedScreen + trending | P1 | 2–3 d | Item 10 |
| 8 | Rank detail mosaic + mini-map hero + rating summary | P1 | 2–3 d | Item 5 |
| 9 | Page hero imagery across 7 public pages (licensed/shot) | P1 | 1–2 d | Item 2 |
| 10 | i18n scaffolding (English → isiZulu, Sesotho) | P1 | 1 wk | Scalability, reviews |
| 11 | AdMob + direct-sold campaigns + engagement analytics | P2 | 3–4 wk | Item 3; post-launch |
| 12 | Hand-sign illustrations (replace emoji) | P2 | 2 d art | Item 6 polish |
| 13 | `/partners` + `/press` + `/developer` | P3 | 2–3 d | Corporate/gov outreach |
| 14 | Multi-tenancy (orgs) | P3 | 2 wk | Post first enterprise deal |

**Go-to-market blocker set** (must fix before Play Store internal
testing invites go out): items **1, 2, 3** (all P0). Two of three are
backend+schema changes under a day each. Item 3 is one focused week.
