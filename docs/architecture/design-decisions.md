# Design Decisions

## Feed Ordering — Always Newest-First, No Sort (Jun 2026)

**Decision**: The listings feed is permanently ordered newest-first. The
filter bar (`AdsFilterBar`) offers a **price range (min/max) only** — there
is intentionally **no sort control**.

**Why**: The core product loop and monetization is "pin your flyer to the
top." If users could re-sort the feed (especially by price), they'd bypass
the pinned/newest ordering and the value of pinning collapses. Filters are
allowed because they *narrow* the result set without reordering it; sorting
is not.

**Implementation rule**: `useAdFilters` exposes only `minPrice` / `maxPrice`.
`HomePage` applies them as `.filter(...)` and must never call `.sort(...)` on
the feed. An earlier pass shipped a Newest / Price↑ / Price↓ dropdown; it was
removed.

## Blog — File-Based Content, SEO + GEO (Jun 2026)

**Decision**: The blog is **markdown files in the repo** (`src/content/blog/*.md`
with YAML frontmatter), bundled at build time via `import.meta.glob` — **not** a
Convex table or CMS. Posts render through the existing `MarkdownContent`
component. Pages are `/blog` and `/blog/:slug`.

**Why**:
- It reuses the established `src/content/*.md` + `?raw` pattern (About/Terms),
  so there's zero new infrastructure, no backend reads, and posts ship in the
  static bundle (fast, cacheable, no query cost).
- Authoring is a pull request, which fits a founder-run, low-volume blog and
  keeps content versioned alongside code.

**Optimised for AI discoverability (GEO), not just SEO**:
- Per-post `BlogPosting` JSON-LD + canonical/OG tags, rendered via **React 19's
  native document metadata** (render `<title>`/`<meta>`/`<link>` in JSX; React
  hoists them) — no react-helmet dependency.
- A build-time Vite plugin emits `llms.txt` (an AI-crawler index of every post)
  and `sitemap.xml` from the same markdown, so they can never drift.
- Authoring rules (length 800–1,500 words, answer-block-first structure,
  frontmatter schema) live in `docs/guides/blog-content-guideline.md`, derived
  from 2025–26 SEO/GEO research.

**Rejected**: gray-matter (drags Node Buffer into the browser bundle — replaced
with a tiny pure parser, `src/lib/frontmatter.ts`); a Convex-backed CMS
(unnecessary for low-volume, founder-authored content). **Known limitation**:
client-rendered SPA means meta populates post-JS; acceptable because modern
search/AI crawlers render JS. SSR/pre-render is the future upgrade path if
needed. Implementation notes: `.agent/gatheredContext/features/blog.md`.

## Cost Optimization (Jan 2026)

### Combined Queries
**Decision**: Merge related queries into single calls.
- `getCurrentUserWithStats` = user + stats (2→1 calls)
- `getAdWithContext` = ad + seller + saved + chat (4→2 calls)

**Why**: Reduces Convex function invocations.

### Lazy Tab Loading
**Decision**: Use `"skip"` for inactive dashboard tabs.

**Why**: Dashboard made 6+ queries on mount. Now 2-3 per active tab.

### View Batching
**Decision**: Dedupe views per session, flush every 30s.

**File**: `src/lib/viewTracker.ts`

**Why**: One mutation per 30s vs per page view.

### On-Demand Refresh
**Decision**: Replace continuous `getLatestAds` subscription with on-demand query + 60s throttle.

**Why**: Subscription triggered on every DB change. Now manual control.

---

## Authentication (Dec 2025)

### Descope + Convex
**Decision**: Use Descope for auth, sync to Convex users table.

**Why**: Phone-first auth with SMS OTP. Convex doesn't have native Descope support.

### Token Pattern
**Decision**: Store `tokenIdentifier` (Descope user ID) on users table.

**Why**: Links Descope identity to Convex user record.

---

## Storage (Dec 2025)

### R2 for Images
**Decision**: Cloudflare R2 for image storage via presigned URLs.

**Why**: Cheaper than S3, CDN-ready, no Convex storage limits.

### CORS Fix
**Decision**: Disable checksums in presigned URLs.
```typescript
ChecksumAlgorithm: undefined,
unhoistableHeaders: new Set(["x-amz-checksum-crc32"])
```

**Why**: R2 CORS rejects requests with checksum headers.

---

## UI/UX Patterns

### Soft Delete
**Decision**: Never hard delete ads. Use `isDeleted` flag.

**Why**: Preserves chat history, allows restoration.

### 90% WebP Quality
**Decision**: Always compress to 90% WebP regardless of connection.

**Why**: Consistent image quality. Only `maxSizeMB` varies by network.

### Navigation State
**Decision**: Use `location.state.forceRefresh` for immediate updates.

**Why**: Throttled refresh needed bypass after user actions.

### DRY Principle (Don't Repeat Yourself)
**Decision**: Extract duplicated logic into reusable components, functions, or utilities.

**Why**: Reduces maintenance burden, ensures consistency, and improves code quality. When the same code appears in multiple places, create a shared abstraction.

---

## Dark Mode & Semantic Theming (Jan 2026)

### Semantic HSL Tokens
**Decision**: Use HSL CSS variables for all theme-aware colors instead of hardcoded tailwind colors.

**Why**: Enables instant theme switching via a single class (`.dark`) on the document root while supporting Tailwind's opacity modifiers.

### System Preference Sync
**Decision**: Default to `system` theme and sync with `prefers-color-scheme`.

**Why**: Respects user's OS settings automatically while allowing manual override.

### FOUC Prevention
**Decision**: Execute an inline blocking script in `<head>` to apply the theme class before the first paint.

**Why**: Eliminates the "Flash of Unstyled Content" where a dark-mode user sees a white screen during initial load.

---

## Moving Sale Mode (2026-06-30)

**Decision**: Model a moving sale as a first-class `saleEvents` entity (with
`saleBundles` and new `ads` fields), and ship the flow **core-first with AI
photo-to-listing and the $9 paywall stubbed behind explicit seams**.

**Why**: The feature wraps three not-yet-built dependencies (AI photo-to-listing,
cross-posting pack, printable flyers) and needs an LLM vision key + a Stripe
account that don't exist yet. Building the full data model, seller flow, public
buyer page, dashboard surface, QR and a print-to-PDF flyer end-to-end — with a
manual fallback where AI plugs in and an owner-callable `publishSaleEvent` where
the Stripe webhook plugs in — delivers a working product now and de-risks the two
integrations independently.

**Rejected**: (a) waiting on Stripe/LLM before building anything; (b) a flag on
`ads` instead of a `saleEvents` table — can't model the draft→active→ended
lifecycle or bundle pricing cleanly.

**Key invariants**: sold items use `isSold` (stay visible/greyed), never
`isDeleted`; the slug is minted once at publish and never changes (printed flyers
encode it); `isPaid` gates the public page. Full implementation notes:
`.agent/gatheredContext/features/moving-sale.md`.

---

## Moving Sale Mode v2 — free model + sale-level messaging + feed integration (2026-06-30)

**Decision**: Revised Moving Sale Mode per the v2 design: (a) the mode is **fully free**
including the public page — the $9 publish paywall is removed; monetisation moves to
optional **à-la-carte add-ons** (AI bulk listing, QR+PDF flyer, 7-day search pin) offered
on the share screen; (b) **sale-level messaging** — one thread per buyer per Sale with item
chips, replacing the route-to-`/ad/:id` shortcut; (c) **feed integration** — sale-item
badge/strip, a distinct Sale event card, an ad-detail sale banner, and a max-3-items-per-Sale
de-dup rule; (d) the **PostAd mode selector** as the primary entry point.

**Why**: "Pay to publish" has no obvious justification and depresses supply; "the mode is
free, speed/visibility are paid" is transparent ("AI costs API money") and grows inventory,
which feeds the marketplace flywheel. Sale-level threads match how movers actually negotiate
("can I get the chair and the bookshelf for $70?"). Feed integration makes sale items
discoverable by category while the Sale event card sells the whole haul by location.

**Notable invariants/gotchas**: `getSaleBySlug` now gates on `status`, not payment;
`chats.adId` became optional (6 call sites guarded; sale-thread notifications deferred);
add-ons are stubbed (`purchaseAddon`) pending Stripe; `isPaid`/`itemCap` kept as optional
legacy fields. Full notes: `.agent/gatheredContext/features/moving-sale.md` (v2 section).

---

## Moving Sale Mode v3 — Sale card in the unified feed (2026-06-30)

**Decision**: Drop the separate "Sale event card" section pinned above the marketplace feed
(v2) and instead render each active Sale as ONE card **inside the regular date-sorted grid**,
identical card shell to a single listing, differentiated only by a 2×2 image thumbnail with a
graceful degradation ladder. The feed sort rule is unchanged — Sale cards interleave by
`createdAt` within the existing newest-first order.

**Why**: A separate pinned section creates two parallel feeds competing for attention. One
feed, one card per Sale, sorted by date, keeps the buyer experience coherent and preserves the
"pin your flyer to the top" model (a fresh Sale appears at top and sinks as newer listings
arrive). The thumbnail is the only differentiator, so a Sale reads as "a listing that happens
to be a whole sale," not a foreign UI element.

**Implementation**: `AdsGrid` gained an optional `saleCards` prop and merges ads + sale cards by
timestamp; `SaleThumbnail` owns the 4+/3/2/1/0-photo ladder; `getActiveSales` returns the card
payload (pinned-first dropped). Built via the design skill in redesign-preserve mode. The
standalone **Bundle Listing** feature from the same v3 doc was scoped out for a later session.
Full notes: `.agent/gatheredContext/features/moving-sale.md` (v3 section).

---

## Moving Sale Mode v3.1 — feed items un-differentiated; banner is the discovery surface (2026-06-30)

**Decision**: Stop differentiating individual sale items in the feed entirely (no badge,
strip, or footer — they render identically to single listings), and move all sale-context
discovery to a richer banner on the ad detail page. The whole-Sale 2×2 card remains the only
feed-level signal.

**Why**: The "In a moving sale ›" feed-card footer created a nested-tap-target problem — the
chevron read as the primary CTA, so buyers tapped expecting the item and landed on the Sale
page. Removing it eliminates the confusion. The ad detail page is the right moment to surface
"there's more" (the buyer is already interested in the item), and it has room for a proper
banner: title-cased seller name, suburb/items/pickup/price sub-line, and a thumbnail strip
(current item dimmed + 3 others + "+N").

**Implementation**: `getSaleSummaries` (which powered the feed badges) replaced by
`getSaleBannerForAd(adId)`. `AdsGrid` lost the `saleSummaries` prop; `AdDetail` renders the new
banner. The max-3-items-per-Sale feed de-dup and the whole-Sale card are unchanged. Built via
the design skill (height-neutral cards, title-case, no em-dashes in new copy). Full notes:
`.agent/gatheredContext/features/moving-sale.md` (v3.1 section).

---

## Image Delivery via Public CDN (Jul 2026)

### Stable public URLs instead of presigned URLs for image reads
**Decision**: Serve listing/profile images from a public R2 custom domain
(`img.flyerboard.com.au`, Cloudflare-proxied with a zone Cache Rule: Edge TTL 1 month,
Browser TTL 1 year) with URLs derived client-side from the stored key
(`src/lib/imageUrl.ts`, gated on `VITE_R2_PUBLIC_URL`). Presigned URLs remain only for
uploads and as the read fallback for legacy `_storage` IDs.

**Why**: The original "presigned URLs for security" choice (Dec 2025) was correct for
uploads but wrong for reads. Every read minted a fresh SigV4 URL through a per-image
Convex query, which (a) defeated the browser HTTP cache — the URL changed on every
mount, so every Home ↔ AdDetail navigation re-downloaded every image; (b) bypassed the
Cloudflare CDN entirely — presigned URLs only work on `*.r2.cloudflarestorage.com`,
which Cloudflare does not edge-cache, and cannot be used with custom domains (the two
access paths are mutually exclusive); and (c) added an N+1 query round trip before any
image could even start downloading. Marketplace images are public content displayed on
public pages — signing reads bought no security and cost the entire caching stack.
1-year browser TTL is safe because keys are write-once UUIDs; a changed image is always
a new URL.

**Rejected**: a second image host per site domain (`img.flyerboard.au`) — it would split
the browser/CDN cache with zero benefit since `<img>` loads are not origin-restricted.

### Deleted-ad image retention policy
**Decision**: A daily cron (`convex/imageCleanup.ts`) purges R2 images of ads soft-deleted
more than `IMAGE_CLEANUP_RETENTION_DAYS` (default 30) days ago, stamping `imagesPurgedAt`
and emptying `images` — the ad row itself is never hard-deleted. `deletedAt` is stamped
at every soft-delete site; pre-existing deleted ads are backfilled so their retention
clock starts at rollout.

**Why**: Images were accumulating in R2 forever ("Future: Automated Cleanup" TODO since
Dec 2025). 30 days preserves the restore window users actually use while bounding storage
cost. The policy is an env var so it can change without a deploy. Edge/browser caches may
serve a purged image until TTL lapses — accepted trade-off, not worth shortening TTLs.

## Bundle Listing — reusing `saleBundles`, optional-then-backfill schema (Jul 2026)
**Decision**: Bundle Listing (group 2–4 standalone ads at a discount) reuses the
`saleBundles` table that Moving Sale Mode had already shipped, rather than a new table.
A standalone bundle simply leaves `saleEventId` undefined (null = standalone). The three
new fields Bundle Listing needs — `sellerId`, `status`, `isDeleted` — were added as
**optional** validators even though `sellerId`/`status` are conceptually required.

**Why optional, not required**: the live deployment already held `saleBundles` rows
(seed + Moving Sale). Convex rejects a schema push that adds a *required* field while
existing rows lack it. So the fields are declared optional, every new write populates
them, reads default a missing `status` to `"active"` (`bundleStatus()` helper), and an
idempotent backfill (`migrations:backfillSaleBundles`) fills legacy rows (`sellerId`
from `saleEvent.userId`). This is the single-deploy-safe form of "add required field" and
can be tightened to required after the backfill runs in prod.

**Rejected**: (a) a separate `bundles` table — duplicates the identical shape and forces
Moving Sale's step-5 suggestions to pick a table at write time; (b) renaming `label` →
`title` (early drafts) — `label` already has call sites, renaming buys nothing; (c) a
public bundle detail page — feed/banner taps route to member ads' `/ad/:id` where the
banner shows the full deal, avoiding a new route and duplicate search content.

**Mutual exclusivity**: `ads.bundleId` and `ads.saleEventId` are mutually exclusive
(a bundle item is never also a Sale item). Enforced in `createBundle` and by the picker's
eligibility query. `ads.bundleId` stays singular — overlapping bundles deferred.

## Bundle Listing — item cap 2–4, free; item-count monetisation deferred (2026-07-05)

**Decision**: bundles hold 2–4 items and the feature is entirely free. Confirmed by
Amir on 2026-07-05 after weighing "cap at 2 now, monetise larger bundles later" against
launching at 4.

**Why 4**: the mental model that makes bundling attractive is the *room set* — bed +
nightstand + dresser + mirror, or sofa + coffee table + chairs. That's 3–4 items.
Capping at 2 covers only the pair case and guts the value proposition.

**Why not monetise item count**: a size gate lands its friction on adoption, not
revenue — sellers won't pay to add a 3rd item; they'll skip the feature. This also keeps
Bundle Listing consistent with the Moving Sale Mode monetisation philosophy: core usage
is free, paid add-ons sit on distribution/visibility (AI, QR/PDF, search pin).

**Deferred, not rejected**: if a paid tier is ever wanted, ">4 items / unlimited bundle
size" is the cleaner upsell than "more than 2" — but only if real usage data shows
demand for larger bundles. `BUNDLE_MAX_ITEMS` in `convex/bundles.ts` is the single
constant to change.

## Location map — Leaflet + CARTO Positron over Google Maps (2026-07-09)

**Decision**: the ad LOCATION preview renders with `react-leaflet` + free CARTO
Positron raster tiles (`src/components/ui/LocationMap.tsx`), not Google Maps.
Geocoding stays on Nominatim (OpenStreetMap), unchanged.

**Why**: Google Maps Platform requires a linked billing account even for the free
tier — without one it renders a greyed-out "For development purposes only" watermark,
which is exactly what shipped. CARTO basemaps need no API key and no billing, are
free for our volume with attribution, and Positron's minimal styling suits an
*approximate* 1km-radius privacy preview better than Google's fully-detailed map.

**Rejected**:
- *Add Google billing + a spend cap* — reintroduces a card on file and per-load cost
  ($7/1k maploads beyond the free tier) for a feature that only draws a circle.
- *Stadia "Alidade Smooth" / Jawg.Light* — better-looking, but both are non-commercial
  on their free tiers, so production (a commercial marketplace) needs a paid plan +
  key. CARTO Positron/Voyager get ~95% of that designed-minimal look for $0.

**Consequences**: `VITE_GOOGLE_MAPS_API_KEY` is no longer read anywhere — delete it
from Vercel and `.env.local`, and revoke the key in Google Cloud (it was previously
committed in a migration doc). The active basemap is a one-line swap via the
`TILE_STYLES` map in `LocationMap.tsx` (positron / voyager / positronNoLabels /
darkMatter / osm) — all free and commercial-OK.

## Boost to Top (Jul 2026)

**Decision**: owners can push an existing ad back to the top of the feed ("Boost"),
gated by a cooldown and a per-user daily cap, shipped dark behind the `boostToTop`
feature flag.

**Name — "Boost"** (founder, 2026-07-09): the Terms and Privacy Policy already reserve
the word ("boost" / "pin to top" as a paid feature), so the name inherits legal cover
with zero copy changes. "Repin" was considered — nicely on-brand for a flyer board —
and passed on in favour of the name users already see in the legal docs.

**`bumpedAt` over re-insert**: boosting re-stamps a mutable `ads.bumpedAt` field (the
feed's actual sort key) rather than deleting/re-inserting the ad. Re-insert would break
`_id` stability (saved ads, chats, reports all reference the ad), reset views, and
forge the "Posted X ago" date. `_creationTime` stays honest and display-only. Cost:
`bumpedAt` is a required field on a hot table, and rollout needed a two-deploy
optional-field → backfill → required-field sequence (see gatheredContext
infrastructure/database.md).

**Cooldown + cap via admin-editable `appSettings`** (supersedes the earlier "shared
code constant, no env override" decision): `boostCooldownDays` (default 7, clamp 1–30)
and `boostDailyCap` (default 3, clamp 1–20) live in a numeric `appSettings` table
(mirror of `featureFlags`) editable from Admin > Settings. A DB-backed reactive value
solves the client/server drift problem *better* than a constant — the client countdown
subscribes to the same row the server enforces, so an admin change recomputes open
countdowns live. Code defaults in `convex/lib/boost.ts` remain the fallback when a key
is unseeded; clamping happens on both write and read.

**No "New" badge on boosted ads, and no rotation in the pin-drop animation**: a "New"
badge would contradict the detail page's honest "Posted 1 month ago" (trust issue); the
one-time primary ring pulse is the arrival cue instead. The pin-drop settle deliberately
has **no rotate** — on a rectangular grid card it reads as misalignment, not playfulness.

**Ship dark**: `boostToTop` flag gates the dashboard CTA, the AdDetail CTA, *and* the
`boostAd` mutation server-side (fail closed). Flip in Admin > Feature Flags when ready.

**Abuse register (accepted for v1)**: (1) delete→repost bypasses the cooldown — it costs
the seller their views/chats today and only becomes a real leak when boost is paid;
revisit with pricing. (2) Launch-day thundering herd — every aged ad is instantly
eligible on flag flip; a one-time scramble is accepted (the fresh-rail `take(50)` cap
may briefly truncate the rail). The daily cap, not the cooldown, is the real
anti-flooding control.

**Pricing seam**: v1 is free ("It's free" is load-bearing modal copy — the Terms mention
paid boost, so users hesitate). `boostCount` is written on every boost so "first free,
then paid" is a follow-up, not a migration.

## Messages — dedicated `/messages` route over a dashboard overlay (2026-07-11, PR #289)

**Decision**: replace the dashboard-embedded chats tab with a dedicated responsive
`/messages` route — full-screen inbox and full-screen thread on mobile, two-pane
master–detail on desktop — retarget the BottomNav Messages item to it, and turn
`/dashboard?tab=chats[&chat=][&flyer=]` into a permanent redirect shim.

**Why this option** (over "full-screen overlay inside dashboard" or "bottom-nav only"):
1. It is the universal marketplace IA (FB Marketplace, Gumtree, Depop, Vinted,
   Carousell, eBay): Messages is a destination, never a dashboard sub-tab.
2. The expensive parts already existed: BottomNav with `UnreadBadge` +
   `useTotalUnreadCount`, a complete shared chat library in `src/features/messages/`,
   and URL-encoded chat state. The build was mostly assembly + extraction, not new UI.
3. The overlay option leaves the inbox squeezed under dashboard chrome (the founder's
   exact complaint) and deepens the 1,729-line `UserDashboard.tsx` god-component —
   the extraction instead took it to ~1,354 lines.
4. `/messages/:chatId` is a real URL — better for push/email deep links, browser
   back, and PWA cold starts than `?tab=chats&chat=` query state.

**Consequences**: notification link builders emit `/messages/<chatId>`
(`convex/notifications/queries.ts`); legacy `?tab=chats` links resolve forever via
the `DashboardPage` shim (`src/lib/legacyChatsRedirect.ts`); `AdMessages` survives
only for legacy `?messages=<adId>` deep links pending retirement. e2e coverage is
signed-out-only (Descope SMS OTP can't be automated) — authed chat flows are covered
by unit tests until an auth harness is feasible.

## Open Graph Share Cards — Edge Rendering + Build-Time Generation, Split by Data Source (Jul 2026, PRs #305/#310/#311/#313/#314)

**Decision**: shared FlyerBoard links (`/ad`, `/bundle`, `/sale`, `/blog`) get a real
1200×630 preview image and correct title/description in chat apps and social platforms.
The mechanism differs by where the data lives:
- **Convex-backed types** (ad/bundle/sale) render **at request time**: a Vercel Edge
  Middleware (`middleware.ts`) intercepts the route, fetches the listing, injects real
  `<meta>` tags into the SPA shell; a companion edge function (`api/og/*`, `@vercel/og`)
  renders the actual card image from the same data.
- **Blog** (static markdown, bundled into the SPA at build time — not reachable from
  either the edge functions or middleware, both compiled independently from Vite) renders
  **at build time** instead: `scripts/generate-og-assets.ts` renders every post's card
  ahead of time and writes a small `blog-meta.json` alongside it; middleware self-fetches
  that JSON at request time rather than querying anything live.
- Every card image is re-encoded to JPEG via **Cloudflare Image Transformations**
  (`/cdn-cgi/image/format=jpeg,quality=82/...`) before it reaches a crawler — `@vercel/og`
  only outputs PNG (~700KB–1MB per card), which is slow on mobile and over WhatsApp's
  ~300KB link-preview cap; the transform cuts that by ~10×.

**Why not full server-side rendering / a framework migration**: the site is a client-
rendered Vite SPA on purpose (see the Blog and Feed decisions above) and doesn't need
full SSR — only the crawler-facing preview does. Middleware-injected meta on top of the
existing SPA shell gets 100% of the SEO/social benefit for a fraction of the migration
cost and risk.

**Why not prerendered static HTML at the blog's clean URL** (`dist/blog/<slug>/index.html`
served at `/blog/<slug>`): considered, but Vercel's own documentation does not clearly
confirm that a static file at a directory's `index.html` is served for the clean,
no-trailing-slash path — and an earlier, unrelated but structurally similar assumption
about Vercel's routing order (`vercel.json` rewrites vs. serverless/edge function
matching — see below) had *already* shipped broken once in this exact feature. Rather
than gamble on a second unverified routing behavior, blog reuses the identical,
already-proven mechanism the ad/bundle/sale middleware branches use: self-fetching a
static JSON file at request time (the same pattern already used to fetch `/index.html`).

**Load-bearing gotcha that shipped broken once and was fixed as a follow-up (#310)**:
Vercel applies `vercel.json` `rewrites` **before** matching serverless/edge functions —
an unqualified SPA catch-all (`/(.*) → /index.html`) silently rewrites `/api/og/ad/:id`
to the SPA shell itself, so the image endpoint returns HTML instead of a PNG and every
crawler sees a broken image. Fixed with a negative-lookahead exclusion
(`/((?!api/).*)`). A second follow-up (#311) fixed a font-loading crash: fonts must be
base64-embedded at module scope, not `fetch()`ed from the edge bundle at runtime (the
deployed bundle doesn't include the raw TTF asset files, so the fetch reliably rejects).

**Consequences**: four separate PRs were needed to reach a fully working state (#305
shipped the ad card + the two routing/font bugs above; #313 added the Cloudflare JPEG
transform; #314 added bundle/sale/blog + the default brand card) — a reminder that a
feature spanning "Vercel edge runtime behavior" + "a CDN's own dashboard config" carries
real integration risk beyond the application code itself, worth budgeting for. Full
implementation detail and every gotcha: `.agent/gatheredContext/infrastructure/og-social-meta.md`.
The one manual, non-code setup step (enabling Cloudflare Image Transformations on the
zone) is documented for reproducibility in `docs/guides/cloudflare-image-transformations-setup.md`.

## Unified feed via `mergedStream` instead of a denormalized `feedCards` table (Jul 2026)

**Decision**: the home feed is one paginated Convex query, `convex/feed.ts` `getFeed`,
that interleaves standard ads, standalone Bundle cards, and Moving Sale cards
server-side using convex-helpers `mergedStream` over three indexes that all end in
`bumpedAt`. It replaced the client-side three-query merge (ads paginated; bundles and
sales fetched whole and spliced in on the client), which caused composite cards to pop
into the feed after first paint and made pagination boundaries meaningless for
composites. Feature flags are evaluated server-side (a disabled flag omits its stream),
and the page is a discriminated union (`ad | bundle | sale`) so existing card
components render it unchanged.

**Why not a denormalized `feedCards` table** (one row per feed entry, single index,
trivially paginated): it requires dual-writes from every mutation that creates,
deletes, sells, expires, boosts, or edits an ad/bundle/sale — a large, easy-to-miss
write surface — plus a backfill table to maintain and keep consistent. `mergedStream`
reads the three source tables directly, so there is no second copy of the truth to
drift, no new write sites, and the soft-delete/liveness rules stay in one place (the
stream filters, which mirror the source queries' predicates exactly).

**Cost accepted**: each page merges three index streams at read time, and composites
are hydrated per page (~0–2 per page in practice). **Documented upgrade trigger**: if
composite volume (or stream cost) ever makes the per-page merge measurably slow, that
is the point to introduce the denormalized `feedCards` table — not before.

**Spec**: `docs/superpowers/specs/2026-07-16-unified-feed-pagination-design.md`.
Implementation patterns and the mergedStream order-fields gotcha:
`.agent/gatheredContext/infrastructure/database.md` ("Unified home feed").
