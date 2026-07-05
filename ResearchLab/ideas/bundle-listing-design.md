# Bundle Listing — Design Session

> **Status: shipped, merged to `main` (2026-07-05).** Behind the `bundleListing` feature flag. Retained as the design record.
> Split out from `moving-sale-mode-design.md` on 2026-07-02 once Moving Sale Mode shipped (merged) and Bundle Listing grew into its own standalone feature with real scope. See that file for Moving Sale Mode's own design (also shipped) — the two features are related (Bundle's schema is reused by Moving Sale's bundle suggestions) but scoped and built separately.

## What it is

Bundle Listing is a lightweight feature for sellers who want to group a small number of related items with a discount incentive — without any of the Moving Sale infrastructure (no sale page, no QR code, no pickup window, no AI bulk listing).

**Primary persona:** Someone upgrading a set of furniture, clearing one room, or selling a matching pair. "I want $350 for the sofa and $280 for the dining table, but if you take both I'll do $530."

## How it relates to Moving Sale

Bundle Listing is standalone but reused inside Moving Sale. The bundle suggestions in Moving Sale step 5 ("desk + chair + monitor — $X as a package") create Bundles using the same `saleBundles` table. A Bundle can exist with or without a `saleEventId`. No separate implementation is needed for Sale bundle suggestions — Bundle Listing's schema and mutations cover both.

| | Bundle Listing | Moving Sale |
|--|--|--|
| Use case | Upgrading a set, clearing a room | Moving house, clearing everything |
| Items | Exactly `N` (small, fixed count) | 10–30 |
| Sale page | No | Yes |
| QR / PDF | No | Yes (paid) |
| Pickup window | No | Yes |
| AI listing | No | Yes (paid) |
| Messaging | Bundle-level thread (v2; was per-item in v1) | Sale-level thread |
| Bundles | The feature itself | Suggested within the Sale flow |

## Feed placement — same grid, no separate section

Bundle cards live in the same grid as single listings and Moving Sale cards. Date-sorted, same rules — no separate "Bundles" section.

**Visual differentiation is in the thumbnail only.** The card shell (`aspect-[4/3]`, title, location, price, footer) is identical to single listings.

**Bundle card thumbnail — vertical strip layout:**
- `N` vertical strips filling the full `aspect-[4/3]` slot (2 strips for a 2-item bundle, etc.)
- Each strip shows one item image, `object-cover`
- Bottom-right overlay: "Save $100" pill (blue) — replaces image count badge
- Top-left badge: "Bundle" (blue) — distinguishes from Moving Sale's red badge

**Individual bundled items** (item A, item B) appear in category search exactly like regular listings — see "No feed strip on individual items" below.

## No feed strip on individual bundled items

Earlier design considered a blue "📦 Also in bundle with dining table · save $100 ›" strip on each individually-bundled item's feed card. **Dropped**, for the same reason the Moving Sale strip was dropped: it creates a nested-tap-target problem — the `›` chevron reads as the primary CTA, so buyers tap it expecting to see the item and land on the bundle page instead.

Individual bundled items look like plain listings in the feed. Bundle context is discovered on the ad detail page (see below) — the buyer is already interested in the item at that point and receptive to "there's more."

## Ad detail page — bundle banner

When a buyer views an item that's part of a bundle, a banner appears below price, above description (same placement pattern as the Moving Sale banner):

```
📦  Available as a bundle
    With dining table — save $100 if you take both      ›
[ 🛋️ ] + [ 🪑 ]              $530 together
 dimmed                       vs $630 separately
```

- Current item shown first, dimmed/outlined ("you're here")
- All bundled items shown — no "+N" truncation, since `N` is small enough to show in full
- `+` connector between thumbs makes the set relationship explicit
- Bundle price + "vs $X separately" math shown inline — buyer can evaluate the deal without navigating away
- Tapping anywhere on the banner navigates to the bundle detail / management view

**Implementation note:** this banner is a distinct tappable element separate from the main ad content, so there's no nested-tap-target ambiguity here (unlike a feed card strip). The `›` chevron is appropriate and clear at this placement.

## Sold states

- **Both/all items available** — bundle deal active, every item still searchable and purchasable individually.
- **One item sold individually** — bundle transitions to `status: "partial"`. Bundle card shows the sold item greyed + remaining item(s) at individual price. Bundle banner is removed from the sold item's own page. Buyer is shown "Bundle no longer available — buy [remaining item] for $280 →".
- **Bundle sold as-is** — all items marked `isSold: true` atomically in one mutation. Bundle card removed from feed. If there's a race (one item already sold), the mutation throws and the partial state is shown instead.
- **Seller cancels bundle** — `status: "cancelled"`. All items revert to fully standalone listings, banners and tags removed.

## Creation flow — dashboard multi-select

**Primary entry point:** a **"Bundle ads"** button in the dashboard Ads tab (next to "Post ad"). Three steps:

1. **Picker grid** — shows the seller's own standalone ads (small square thumbnails + price). Ineligible ads are greyed with a reason label: "In another bundle" or implicitly excluded if part of a Moving Sale. Seller selects up to `N` items (see cap below).
2. **Price step** — shows the selected items with their individual prices summed ("separately: $630"), an input for the bundle price, and a live savings hint ("✓ Buyers save $100 (16%) if bundled").
3. **Confirm** — creates the bundle. Selected ads remain fully standalone (still searchable, still individually purchasable) but now render the "available as a bundle" banner on their detail pages and a bundle tag in dashboard management.

**Secondary entry point:** a "Bundle this →" action on an individual ad's management card in the dashboard. Pre-selects that ad and opens the same picker for the remaining slots. Useful for reactive bundling ("this sofa isn't selling, let me pair it with something").

**No new `ads` row is created for the bundle itself.** The bundle card rendered in the feed is a view derived from the `saleBundles` row + its linked ads' images — avoids duplicate/competing content in search.

## Item cap and bundle membership

- **Item cap: 2–4 ads per bundle, free.** Enforced in the `createBundle` mutation. Decided 2026-07-05: 4 (not 2) because the real "set" mental model — bedroom set, living room set — is 3–4 items, and capping at 2 would exclude the scenario that makes bundling feel valuable. This is consistent with the free-first philosophy set for Moving Sale Mode: monetisation sits on distribution/visibility, not core usage.
- **Item-count monetisation — considered and deferred.** Gating bundle size (e.g. "2 free, pay for more") was considered as a monetisation lever and rejected for launch: sellers won't pay to add a 3rd item — they'll skip the feature, so the friction lands on adoption, not revenue. If a paid tier is ever wanted, ">4 items / unlimited bundle size" is the cleaner upsell — but let real usage data decide whether that's worth building.
- **Single membership:** an ad can belong to **at most one** bundle at a time. `bundleId` on `ads` stays a singular optional field, not an array.
- **Overlapping bundles — considered and deferred.** A seller might want "A+B for $Y, or A+B+C for $X" simultaneously. Not built for v1: it requires `bundleId` to become an array, cascading invalidation logic multiplies (one item selling solo can kill multiple bundles at once), and the buyer-facing banner would need to show multiple bundle options per item — worse UX than the single clean banner already designed. **v1 answer:** the seller publishes one bundle grouping. To change it, cancel the existing bundle (`status: "cancelled"`, items revert to standalone) and create a new one. Revisit only if usage data shows real demand for overlapping groupings.

## Mutual exclusivity with Moving Sale — enforced both directions

A standalone Bundle ad and a Moving Sale item are different scopes and never overlap:

```ts
// Eligibility rule for the bundle picker
eligible =
  ad.sellerId === currentUser &&
  ad.isDeleted !== true &&
  ad.isSold !== true &&
  ad.bundleId === undefined &&     // not already in a bundle
  ad.saleEventId === undefined     // not part of a Moving Sale
```

- An ad already in a Moving Sale is excluded from the Bundle picker.
- An ad already in a standalone Bundle is excluded from the Sale item-add flow (enforce there too).
- `bundleId` and `saleEventId` are mutually exclusive on the `ads` row — a mutation setting one must assert the other is unset.

## "Part of a bundle" representation in dashboard

Every listing in the dashboard Ads tab gets a small tag under its title if it belongs to something:

- `📦 In bundle: Living room set` (blue) — tapping opens bundle management (edit price, remove item, cancel bundle)
- `🏠 In Amir's Moving Sale` (red) — tapping opens Sale management

No tag = plain standalone ad, unchanged from today.

## Schema — reconciliation with what Moving Sale actually shipped

**This section was wrong in earlier drafts and caused a real implementation snag.** The design assumed `saleBundles` didn't exist yet and could be authored from scratch with `saleEventId` optional. In fact Moving Sale Mode shipped its own `saleBundles` table (Sale-scoped bundle suggestions, step 5 of the seller flow) with a different, incompatible shape:

**Shipped today** (`convex/schema.ts` on `main`, as of the Moving Sale merge):
```ts
saleBundles: defineTable({
  saleEventId: v.id("saleEvents"),   // REQUIRED — every bundle must belong to a Sale
  label: v.string(),                 // field is called "label", not "title", and is required
  bundlePrice: v.number(),
  adIds: v.array(v.id("ads")),
})
  .index("by_sale_event", ["saleEventId"])
```

**What Bundle Listing needs that doesn't exist yet:**
- `saleEventId` must become **optional** — the entire "null = standalone bundle" model depends on this. As shipped, a bundle cannot exist without a Sale.
- `sellerId` — shipped version finds the seller by following `saleEventId → saleEvent.sellerId`. With no Sale, there's no derivation path; `sellerId` needs to live directly on `saleBundles`.
- `status` (`active` / `partial` / `sold` / `cancelled`) — doesn't exist in the shipped table at all. The sold-state machine this doc specifies has nowhere to live without adding it.
- `isDeleted` — soft-delete flag, standard project pattern (see `CLAUDE.md`), missing from the shipped table.
- `label` vs `title` — naming mismatch only; pick one and update whichever side is wrong. Recommend keeping `label` (already shipped, already has call sites) rather than renaming to `title`.

**Migration approach — as actually implemented (2026-07-02):**

Live deployment already has `saleBundles` rows (Moving Sale seed data + real usage). A Convex schema push that adds `sellerId` or `status` as **required** fails validation against those existing rows immediately — Convex won't let you push a schema that existing documents don't satisfy. The original "add as required, default old rows to active" plan doesn't work as a single step.

The safe form actually shipped:
1. Add `sellerId`, `status`, `isDeleted` as **optional**, not required, in the schema push. `saleEventId` becomes optional too (unblocks standalone bundles immediately).
2. Every **new write path** (both the Sale bundle-suggestion flow and the new standalone Bundle Listing flow) always populates `sellerId` and `status` — so from this point forward every row is fully populated in practice, even though the validator allows them to be absent.
3. Every **read path** treats a missing `status` as `"active"` and derives `sellerId` from `saleEvent.sellerId` when absent (i.e. old rows) — this is the same fallback logic a backfill migration would produce, just computed at read time instead of written once.
4. A backfill migration (`npx convex run migrations:<name>`, per `CLAUDE.md`'s convention) can still run afterward to physically populate the old rows and let a future schema tightening make the fields required — not blocking, can land separately.
5. Audit every existing call site that constructs or reads `saleBundles` (Moving Sale's step-5 bundle-suggestion mutation/query, the buyer sale page bundle renderer) for the now-optional `saleEventId`.
6. Keep the `by_sale_event` index; add `by_seller` alongside it.

```ts
// Actual shipped shape — all new fields optional to satisfy existing rows
saleBundles: defineTable({
  sellerId: v.optional(v.id("users")),          // optional for schema-push safety; always set on new writes; derive from saleEvent.sellerId when absent on read
  adIds: v.array(v.id("ads")),                  // unchanged
  bundlePrice: v.number(),                      // unchanged
  label: v.string(),                            // unchanged name — corrected from "title" in earlier drafts
  saleEventId: v.optional(v.id("saleEvents")),  // CHANGED — was required, now optional; null = standalone bundle
  status: v.optional(v.union(                   // optional for schema-push safety; always set on new writes; treat absent as "active" on read
    v.literal("active"),
    v.literal("partial"),   // some items sold individually; bundle price gone
    v.literal("sold"),      // bought as bundle
    v.literal("cancelled"), // seller broke up the bundle
  )),
  isDeleted: v.optional(v.boolean()),
})
  .index("by_seller", ["sellerId"])
  .index("by_sale_event", ["saleEventId"])
```

`ads` table additions (shared with Moving Sale — see that doc's Data Model section):

```ts
ads: defineTable({
  // ... existing fields ...
  bundleId: v.optional(v.id("saleBundles")),   // set when item is in a bundle
  saleEventId: v.optional(v.id("saleEvents")), // set when item is in a Sale
  isSold: v.optional(v.boolean()),
})
```

---

## v2 — Bundle becomes a first-class destination (designed & implemented 2026-07-05)

**Flaw found in founder review:** the v1 feed card navigates to `adIds[0]`'s detail page (`HomePage.tsx` `handleBundleClick`). The bundle is therefore not an addressable entity — no URL to share, no way to message *about the bundle* (intent lands in item A's per-ad thread with no bundle context), and clicking the bundle card vs. the first item's own card is indistinguishable. The v1 "out of scope" line for a bundle page is now considered a design flaw, not a scope cut.

**Why this doesn't conflict with "no duplicate ads":** Moving Sale proved the pattern — no `ads` row for the grouping (avoids search/feed duplication) *and* a dedicated route (`/sale/:slug`) backed by the grouping's own table. The duplication concern only ever applied to creating a competing `ads` row, not to giving the grouping a page. v1 copied the derived-card half of the pattern but skipped the destination half.

### Scope

1. **Public bundle page — `/bundle/:id`, "Deal Ticket" direction.** Three directions were mocked (Storefront / Deal Ticket / Editorial Set); founder chose **Deal Ticket**: the page leads with the *offer*, not the products, and deliberately looks nothing like an ad page (kills the "is this just an ad?" confusion at the root).
   - Teal (`--bundle`) header band: "Bundle deal · {location}" kicker, bundle label, "{N} items · sold together or separately".
   - Receipt-style ticket card overlapping the band: line items with dotted leaders + individual prices, dashed rule, struck-through "Separately $X", bundle price at display size (Fraunces), rotated "Save $Y (Z%)" stamp.
   - Horizontal image strip below (member thumbnails, each links to its member ad) + trust line: "Every item stays individually listed."
   - Sticky bottom CTA: "Take the deal — message {seller}".
   - Backed by a new public query `getPublicBundle` (reuses `hydrateBundleItems`). No auth required to view (mirrors the public sale page).
   - **Partial/sold state lives here**: notice "This bundle is no longer available — {item} has sold", sold member greyed with SOLD pill + struck price, remaining items keep "Buy {item} for $X ›" links. Page stays reachable from old links/messages even after the card leaves the feed.
2. **Repoint tap-throughs.** Feed card click → `/bundle/:id` (was `adIds[0]`). `BundleBanner` body tap on member ad pages → `/bundle/:id` (member thumbnails inside the banner keep linking to their own ads).
3. **Bundle-scoped messaging.** New thread kind following the sale-thread pattern shipped in the unified inbox (PR #276) — extend the shared chat library in `src/features/messages/`, never hand-roll. CTA on the bundle page opens/continues the bundle thread.
4. **Savable bundles.** `savedBundles` table mirroring `savedSaleEvents` exactly (`userId` + `bundleId`, `by_user` + `by_user_and_bundle` indexes), toggle + `isBundleSaved` + `getSavedBundles` mirroring `saveSaleEvent`/`isSaleEventSaved`/`getSavedSaleEvents`, heart button in the bundle page app bar, and a bundles section in the dashboard Saved tab alongside saved ads and saved sales. (Standard ads and whole Sales are already savable; individual sale/bundle members are plain `ads` rows so they already save via `savedAds` — bundles were the only gap, and previously had no page to host a save button.)
5. **Feed de-dup cap.** A 4-item bundle currently yields 5 cards from one seller on the uncategorised feed (4 members + bundle card). Apply Moving Sale's cap pattern, gentler: max 2 member items per bundle on the uncategorised feed; category/search results stay uncapped (the "members look like plain listings in search" decision stands).
6. **Eligibility guard — sale-type ads only.** `getEligibleAdsForBundle` + `createBundle` must reject `listingType: "exchange"` ads: they have no `price`, which flows through `sumPrices` as `?? 0` and silently corrupts the savings math. (Conceptual rule: bundles and Moving Sales are sale-only; only standard ads can be trade/exchange. Moving Sale is safe by construction — its wizard hardcodes `listingType: "sale"` — bundles need the explicit check.)

## Log

- 2026-06-30 — Bundle Listing defined as a standalone feature. Reused by Moving Sale step 5. Sold states: active / partial (one item sold individually, bundle deal gone) / sold (atomic) / cancelled. Schema: saleEventId optional on saleBundles — null = standalone.
- 2026-06-30 — Feed strip on individually-bundled items dropped, same rationale as the Moving Sale strip removal (nested-tap-target confusion). Bundle context now discovered exclusively via the ad detail page banner.
- 2026-06-30 — Ad detail bundle banner designed: current item dimmed first, all bundled items shown (no "+N" — N is small), "+" connector, bundle math inline ($530 together / vs $630 separately shown without navigating away).
- 2026-06-30 — Creation flow and constraints finalised. Dashboard "Bundle ads" button (primary) → picker grid (ineligible ads greyed with reason) → price step with live savings math → confirm. Secondary entry point: "Bundle this →" on an individual ad's management card. Item cap changed from a 2–3 range to exactly `N` (configurable constant). Single bundle membership per ad enforced (bundleId stays singular); overlapping bundles (same ad in two simultaneous groupings) considered and explicitly deferred — cascading invalidation and multi-bundle banners are worse UX than requiring the seller to pick one grouping and recreate if they change their mind. Mutual exclusivity with Moving Sale confirmed both directions via eligibility rule. Dashboard "part of a bundle/sale" tag representation designed.
- 2026-07-02 — Split into its own file from `moving-sale-mode-design.md` — Moving Sale Mode shipped/merged, Bundle Listing is next up as a separate implementation effort.
- 2026-07-02 — **Schema mismatch found and reconciled.** The design assumed `saleBundles` didn't exist yet; in fact Moving Sale Mode shipped its own version with `saleEventId` required (not optional), field named `label` (not `title`), no `sellerId`, no `status`, no `isDeleted`. This blocked the implementing agent mid-task. Documented the actual shipped shape, the delta, and a 4-step migration approach (schema change → backfill `sellerId`/`status` on existing rows → audit existing Sale-bundle call sites for the now-optional `saleEventId` → add `by_seller` index). See "Schema — reconciliation" section.
- 2026-07-05 — **Merged to `main`.** Item cap confirmed at 2–4, free: 4 covers the real "room set" mental model (bed + nightstand + dresser + mirror) that makes bundling attractive; capping at 2 would gut the value proposition. Item-count monetisation explicitly deferred — friction from a size gate lands on adoption, not revenue; if ever wanted, ">4 / unlimited" is the cleaner future upsell. See "Item cap and bundle membership".
- 2026-07-02 — **Implemented** on `main` (separate session). Backend `convex/bundles.ts` (createBundle/updateBundlePrice/removeBundleItem/cancelBundle/markBundleSold/markBundleItemSold + banner/feed/my-bundles/eligible queries), `saleBundles` extended per the reconciliation (sellerId/status/isDeleted optional-and-backfilled, `by_seller` index), `migrations:backfillSaleBundles`, `bundleListing` flag, `posts.deleteAd` detach hook, `setBundles` call-site fix. Frontend: `src/features/bundles/` (BundleThumbnail feed card, BundleBanner ad-detail, BundleFlow 3-step wizard, BundleManageModal), route `/sell/bundle`, dashboard "Bundle ads" button + "In bundle" tag + "Bundle this →". Blue accent + Phosphor `Package`; motion via `useMotionPrefs`. Caps 2–4 (the configurable "N"). 29 backend + full frontend tests pass; `npm run lint` clean. Deviation from doc: sellerId/status kept OPTIONAL (not required) because existing live rows block a required-field push — always populated on new writes + backfill migration provided. Details: `.agent/gatheredContext/features/bundles.md`.
- 2026-07-05 — **v2 designed (founder review).** Flaw confirmed: feed card taps through to `adIds[0]`, making the bundle a non-entity (no page, no shareable URL, no bundle-scoped messaging). Decision: mirror Moving Sale's pattern — grouping table + derived feed card + dedicated public route. Three page directions mocked (Storefront / Deal Ticket / Editorial Set); **Deal Ticket chosen** — the page leads with the offer math styled as a stamped receipt. Scope pinned: `/bundle/:id` page, repointed tap-throughs, bundle thread kind in the unified inbox, `savedBundles` (mirrors `savedSaleEvents`; sales + ads were already savable, bundles were the only gap), feed cap of 2 member items per bundle, and an eligibility guard rejecting `listingType: "exchange"` ads (no price → corrupts savings math). See "v2 — Bundle becomes a first-class destination".
- 2026-07-05 — **v2 implemented** (same day, same session lineage). All six scope items landed: `/bundle/:id` Deal Ticket page (`PublicBundlePage`/`PublicBundleView`, public `bundles.getPublicBundle` incl. partial/sold states + `isOwner` manage CTA), repointed feed-card + banner-body tap-throughs, bundle threads (`convex/bundleChats.ts`, `chats.bundleId` + `by_bundle_buyer`, unified-inbox rendering, notification chain extended with `bundleId` end-to-end), `savedBundles` (+ heart on the page, Saved-tab section), feed cap of 2 members per bundle on the uncategorised feed, and the `listingType: "exchange"` guard in `createBundle` + the picker. 558 tests + `npm run lint` clean. Implementation notes: `.agent/gatheredContext/features/bundles.md` § "Bundle v2".
