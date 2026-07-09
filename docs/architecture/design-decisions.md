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
