import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

import { paginationOptsValidator } from "convex/server";
import {
  assembleFeedPage,
  bundleIsLive,
  compositeMatchesFilters,
  saleIsLive,
  sectionFields,
  type FeedSourceEntry,
} from "./lib/cards";
import { isFlagEnabled } from "./featureFlags";
import { locationMetaValidator } from "./lib/location";
import { resolveBuyer, isNearAd, isNearComposite, atWidestRadius, type BuyerLocation } from "./lib/nearby";

/**
 * How many rows each search pass reads. This is the whole POOL a paginated
 * search draws from, not a page size — `getAds` sorts it by `bumpedAt` desc and
 * cursors through it, so anything outside the pool is unreachable.
 *
 * 1024 is Convex's hard ceiling on search results, so this is as complete as
 * the platform allows. Record the ceiling honestly: a search index returns rows
 * in RELEVANCE order only, so past 1024 matches the pool is a relevance-selected
 * subset and a very old exact match can be absent from it. What that costs is a
 * missing row, never a mis-ordered page — everything that reaches the pool is
 * ordered by date. Trigger to do something about it: any single search term
 * matching more than ~1024 live rows. The fix then is a date-ordered lane (a
 * `bumpedAt` index pass unioned with the relevance pass), not a bigger cap.
 */
const SEARCH_POOL_LIMIT = 1024;

/**
 * Ceiling on composite rows read per table. `search_composite`'s filterFields
 * are `status` only (`isDeleted` is a post-search `.filter()`, not a filter
 * field) — and neither `categoryIds` (an array;
 * Convex can't index array-contains) nor `location` is indexed, so both
 * narrowings are JS predicates that must run BELOW the cap, or out-of-category
 * rows eat the budget and a qualifying card disappears.
 *
 * ponytail: over-fetch instead of a new index. Both composite tables are orders
 * of magnitude smaller than `ads` (tens of rows, not tens of thousands), so
 * reading up to 500 of them is cheap. If either table ever grows past this,
 * denormalise a single `categoryId`/`location` filter field onto the row and
 * push the narrowing into the index instead.
 */
const COMPOSITE_LIMIT = 500;

/**
 * Read both composite tables behind their feature flags and tag the live,
 * in-filter rows. `buildBundles`/`buildSales` supply the per-table query
 * (search index vs `by_status_and_bumped_at`); everything else — flags,
 * concurrency, liveness, category/location narrowing — is the same either way.
 */
async function compositeHits(
  ctx: QueryCtx,
  args: { categoryId?: Doc<"ads">["categoryId"]; buyer?: BuyerLocation },
  buildBundles: () => Promise<Doc<"saleBundles">[]>,
  buildSales: () => Promise<Doc<"saleEvents">[]>
): Promise<FeedSourceEntry[]> {
  const [bundlesEnabled, salesEnabled] = await Promise.all([
    isFlagEnabled(ctx, "bundleListing"),
    isFlagEnabled(ctx, "movingSaleMode"),
  ]);

  const [bundles, sales] = await Promise.all([
    bundlesEnabled ? buildBundles() : [],
    salesEnabled ? buildSales() : [],
  ]);

  const now = Date.now();
  // Rule 5: category narrows (a requirement); location only SECTIONS (a
  // preference). Composites need no second DB pass — the location narrowing
  // here was always a JS predicate below the `.take(cap)`, never a DB cut, so
  // the same predicate now stamps the section instead of dropping the row.
  const sectionOf = (doc: Doc<"saleBundles"> | Doc<"saleEvents">) =>
    sectionFields(args.buyer?.location, compositeMatchesFilters(doc, { buyer: args.buyer }));
  // A composite earns the same protection from the trim as an ad does, on the
  // same any-member test — rule 1: a card inherits from its members, and rule 4
  // has no carve-out for a card type. Judged at the widest selectable radius so
  // the buyer's own pick can't change who survives the cut.
  const widest = args.buyer && atWidestRadius(args.buyer);
  const pinnedOf = (doc: Doc<"saleBundles"> | Doc<"saleEvents">) =>
    widest ? isNearComposite(widest, doc) : false;
  return [
    ...bundles
      .filter((b) => bundleIsLive(b) && compositeMatchesFilters(b, { categoryId: args.categoryId }))
      .map((doc) => ({ kind: "bundle" as const, doc, pinned: pinnedOf(doc), ...sectionOf(doc) })),
    ...sales
      .filter((s) => saleIsLive(s, now) && compositeMatchesFilters(s, { categoryId: args.categoryId }))
      .map((doc) => ({ kind: "sale" as const, doc, pinned: pinnedOf(doc), ...sectionOf(doc) })),
  ];
}

/**
 * Rule 5 two-pass ads fetch, shared by search and the rail. Both cut with a
 * `.take()` INSIDE the DB query (by relevance for search, by date for the
 * rail), so one unpinned pass can lose near rows before any JS runs — a
 * post-hoc partition cannot resurrect them. Hence a second pass pinned to the
 * buyer's suburb, unioned with the unpinned one and deduped on `_id`. With no
 * location: one unpinned pass, no section.
 *
 * The SECTION of every row is then stamped by `isNearAd` — the pinned pass only
 * decides what is fetched, never what is near.
 *
 * **"Pinned" means two different things here, at two levels. Keep them apart:**
 *
 * - The pinned PASS (this function, `.eq("location", …)`) decides what the DB
 *   hands us. Exact-string, so it only rescues same-suburb rows from the
 *   `.take()`.
 * - The `pinned` FIELD stamped below decides what survives the JS trim in
 *   `assembleFeedPage`. It is wider: near at the widest rung the buyer's control
 *   offers (`atWidestRadius`), plus everything the pass fetched.
 *
 * ponytail: the still-open ceiling is the first level only. A row near by
 * distance or SA4 alone is not matched by `.eq("location", …)`, so if it ranks
 * below the DB cut (SEARCH_POOL_LIMIT by relevance in search, `limit` by date on
 * the rail) it is never fetched, and no JS can resurrect it — leaving a far row
 * rendered above a near one that was never in the pool. Once a row IS in the
 * pool the `pinned` field protects it, so do not read this as "distance-near
 * rows lose the trim"; they don't, and Phase 5's tests fail if that changes.
 * Search no longer TRIMS at all (it paginates), so on that path this is the only
 * level left; the rail still trims at both. The main feed (`feed.getFeed`) is
 * unaffected at both levels — it paginates, it doesn't cut.
 * Fixing the first level means a server-side near lane (a pass pinned on
 * `sa4Code`, which needs an index and a search filterField); the plan lists that
 * as deliberately not built, triggered by page size. Same class as the composite
 * ceiling recorded on `latestComposites` below.
 */
async function sectionedAdHits(
  buyer: BuyerLocation | undefined,
  pass: (location?: string) => Promise<Doc<"ads">[]>
): Promise<FeedSourceEntry[]> {
  if (!buyer) {
    return (await pass()).map((doc) => ({ kind: "ad" as const, doc }));
  }
  const [sameSuburb, unpinned] = await Promise.all([pass(buyer.location), pass()]);
  const seen = new Set(sameSuburb.map((d) => d._id));
  // The `pinned` FIELD (not the pass above): what survives the JS trim in
  // assembleFeedPage. Everything that could be near at ANY rung of the buyer's
  // control — judged at the widest one — plus the rows the pass fetched. Judging
  // it at a CONSTANT radius is the point: it does not move when the buyer
  // narrows theirs, so the radius decides which group an ad sits in and never
  // which ads exist (rule 5: it never hides). See assembleFeedPage's contract.
  const widest = atWidestRadius(buyer);
  return [
    ...sameSuburb.map((doc) => ({ doc, sameSuburb: true })),
    ...unpinned.filter((d) => !seen.has(d._id)).map((doc) => ({ doc, sameSuburb: false })),
  ].map(({ doc, sameSuburb: fromPinnedPass }) => ({
    kind: "ad" as const,
    doc,
    pinned: fromPinnedPass || isNearAd(widest, doc),
    ...sectionFields(buyer.location, isNearAd(buyer, doc)),
  }));
}

/**
 * Run the three search indexes (ads + both composite tables) concurrently and
 * return the raw hits.
 *
 * A composite matches when any MEMBER ad matches — that's what `searchText`
 * holds. Category narrows all three tables (rules 1 and 4,
 * `.agent/PRODUCT-RULES.md`): on `ads` as an index filter field, on composites
 * as a post-search predicate over the derived `categoryIds`. `location` never
 * narrows — it stamps `section: "near" | "far"` on every hit instead (rule 5).
 *
 * `sinceTimestamp`, when given, is a `bumpedAt` lower bound pushed into every
 * query so the per-table cap keeps rows that are relevant AND fresh (a JS
 * filter after the cap loses a fresh row ranking below it).
 */
async function searchAllTypes(
  ctx: QueryCtx,
  args: {
    search: string;
    categoryId?: Doc<"ads">["categoryId"];
    buyer?: BuyerLocation;
    sinceTimestamp?: number;
    limit: number;
  }
): Promise<FeedSourceEntry[]> {
  const since = args.sinceTimestamp;
  const cap = COMPOSITE_LIMIT;
  const searchAdsPass = (location?: string) =>
    ctx.db
      .query("ads")
      .withSearchIndex("search_ads", (q) => {
        let searchQuery = q.search("title", args.search);

        if (args.categoryId) {
          searchQuery = searchQuery.eq("categoryId", args.categoryId);
        }
        if (location) {
          searchQuery = searchQuery.eq("location", location);
        }

        return searchQuery.eq("isActive", true);
      })
      .filter((q) =>
        q.and(
          q.neq(q.field("isDeleted"), true),
          q.neq(q.field("isSold"), true),
          since === undefined ? true : q.gt(q.field("bumpedAt"), since)
        )
      )
      .take(args.limit);
  const [ads, composites] = await Promise.all([
    sectionedAdHits(args.buyer, searchAdsPass),
    compositeHits(
      ctx,
      args,
      () =>
        ctx.db
          .query("saleBundles")
          .withSearchIndex("search_composite", (q) =>
            q.search("searchText", args.search).eq("status", "active")
          )
          .filter((q) =>
            q.and(
              q.neq(q.field("isDeleted"), true),
              since === undefined ? true : q.gt(q.field("bumpedAt"), since)
            )
          )
          .take(cap),
      () =>
        ctx.db
          .query("saleEvents")
          .withSearchIndex("search_composite", (q) =>
            q.search("searchText", args.search).eq("status", "active")
          )
          .filter((q) => (since === undefined ? true : q.gt(q.field("bumpedAt"), since)))
          .take(cap),
    ),
  ]);

  return [...ads, ...composites];
}

/**
 * The browse counterpart of `searchAllTypes`: every composite bumped since the
 * watermark, ordered by `bumpedAt` desc via `by_status_and_bumped_at`;
 * `assembleFeedPage` interleaves them with the ads (rule 2).
 *
 * Rule 5 caveat (recorded so it isn't re-derived): this `.take(cap)` IS a
 * DB-level date cut, and no location-pinned pass is possible — neither
 * composite table has a location index. A near composite below `cap` fresher
 * far ones is lost. Out of scope: it needs >COMPOSITE_LIMIT composites bumped
 * inside one 60s window; the fix would be raising the cap when a location is
 * set.
 */
async function latestComposites(
  ctx: QueryCtx,
  args: {
    categoryId?: Doc<"ads">["categoryId"];
    buyer?: BuyerLocation;
    sinceTimestamp: number;
    limit: number;
  }
): Promise<FeedSourceEntry[]> {
  const cap = COMPOSITE_LIMIT;
  const since = args.sinceTimestamp;

  return compositeHits(
    ctx,
    args,
    () =>
      ctx.db
        .query("saleBundles")
        .withIndex("by_status_and_bumped_at", (q) =>
          q.eq("status", "active").gt("bumpedAt", since)
        )
        .order("desc")
        .take(cap),
    () =>
      ctx.db
        .query("saleEvents")
        .withIndex("by_status_and_bumped_at", (q) =>
          q.eq("status", "active").gt("bumpedAt", since)
        )
        .order("desc")
        .take(cap)
  );
}

/**
 * The total order a paginated search walks: `bumpedAt` desc, then the same two
 * system tie-breakers `feed.getFeed`'s mergedStream uses. Every entry in the
 * pool has all three, whichever table it came from, so ads and composites share
 * one sequence and no ad type gets its own lane (rules 1, 2 and 4).
 *
 * Descending on every field: a negative result means `a` comes first.
 *
 * All three terms are load-bearing, and they fail differently:
 *
 * - `bumpedAt` alone is not enough. A cursor that carried only it would compare
 *   EQUAL to every entry sharing that millisecond, so none of them would sort
 *   after it and all would be filtered out of every later page — ads silently
 *   skipped at a page boundary by the mechanism added to stop ads disappearing.
 *   `ads.test.ts` "entries sharing a bumpedAt are each returned exactly once"
 *   covers this; bulk-seeded and migrated rows are the realistic way to get a
 *   tie.
 * - `_id` is the last resort. `_creationTime` is unique WITHIN a table, so no
 *   convex-test fixture can force two rows to share one — but this pool merges
 *   THREE tables, and an ad and a bundle CAN share both `bumpedAt` and
 *   `_creationTime`. That is why `feed.getFeed`'s mergedStream orders on the
 *   same three fields; the convex-helpers authors reached the same conclusion
 *   independently. Covered by the unit test over `pageOfPool` (exported for
 *   exactly that — it is pure, and an integration fixture cannot reach this
 *   case).
 */
type SortKey = { bumpedAt: number; creationTime: number; id: string };

const sortKeyOf = (e: FeedSourceEntry): SortKey => ({
  bumpedAt: e.doc.bumpedAt,
  creationTime: e.doc._creationTime,
  id: e.doc._id,
});

const compareSortKeys = (a: SortKey, b: SortKey): number =>
  b.bumpedAt - a.bumpedAt ||
  b.creationTime - a.creationTime ||
  (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);

/**
 * Take one page out of the ordered pool — one cursor PER GROUP, near group
 * first.
 *
 * Two properties, and the second is why there are two cursors rather than one
 * date-ordered cursor over the whole pool:
 *
 * - **Newest first, honestly.** Every entry on a page sorts before every entry
 *   on the next one, so scrolling further only ever shows older things. Keyset,
 *   not offset: the cursor names the last entry handed out, so a row inserted
 *   between two fetches shifts no page.
 * - **The buyer's area comes first, and it is finished before the rest starts.**
 *   A page takes as much of the near group as it can hold, and only what is left
 *   over goes to the far group. That is rule 5 in the order rule 5 states it:
 *   ads in the area, then ads outside it — a buyer with nothing inside their
 *   distance is TOLD so (the boundary's banner form) and the feed continues
 *   outward from there.
 *
 * Selecting purely by date breaks that: an in-area match older than a page of
 * out-of-area ones would not be on page 1 at all, so the buyer's first screen
 * would be the far group.
 *
 * **Reserving a fixed share of every page for the far group is worse, and it is
 * not what Boost needs.** It would make later pages insert near cards ABOVE
 * content the buyer has already scrolled past — the page shifting under them
 * mid-scroll — where a long near group is just a long list. Rule 3 says in terms
 * that a boosted ad at the top of EACH group is the compliant outcome, so a
 * boosted far ad sitting below a long near group is exactly right; it is not
 * "unreachable", and the near group is bounded by the pool in any case.
 *
 * With no location set everything is in the first group, so a page is just the
 * next `numItems` newest — exactly as before.
 *
 * This is grouping, not ordering (rule 2): inside each group the sequence is
 * `bumpedAt` desc and nothing else. `assembleFeedPage` then orders the page
 * section-first, and `AdsGrid` regroups the accumulated pages into one near run
 * and one far run — each still newest-first, because this selection is.
 */
type GroupCursors = { near: SortKey | null; far: SortKey | null };

function parseCursor(raw: string | null): GroupCursors {
  const empty: GroupCursors = { near: null, far: null };
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return { near: asSortKey(parsed?.near), far: asSortKey(parsed?.far) };
  } catch {
    return empty;
  }
}

const asSortKey = (value: unknown): SortKey | null => {
  const k = value as Partial<SortKey> | undefined;
  return typeof k?.bumpedAt === "number" &&
    typeof k.creationTime === "number" &&
    typeof k.id === "string"
    ? (k as SortKey)
    : null;
};

export function pageOfPool(
  pool: FeedSourceEntry[],
  paginationOpts: { numItems: number; cursor: string | null }
): { entries: FeedSourceEntry[]; isDone: boolean; continueCursor: string } {
  // Unsectioned entries (no location set) all belong to the first group, the
  // same fallback `sectionRank` and `AdsGrid` use.
  const after = (section: "near" | "far", from: SortKey | null) =>
    pool
      .filter((e) => (e.section ?? "near") === section)
      .sort((a, b) => compareSortKeys(sortKeyOf(a), sortKeyOf(b)))
      .filter((e) => from === null || compareSortKeys(sortKeyOf(e), from) > 0);

  const cursor = parseCursor(paginationOpts.cursor);
  const nearLeft = after("near", cursor.near);
  const farLeft = after("far", cursor.far);

  // Floor of 1: a page that selects nothing while the pool still holds rows
  // never advances the cursor, and a client asking for more loops forever.
  const size = Math.max(1, paginationOpts.numItems);
  // Near takes the whole page if it can fill it; far gets only what is left.
  const nearPage = nearLeft.slice(0, size);
  const farPage = farLeft.slice(0, size - nearPage.length);

  const lastOf = (page: FeedSourceEntry[], fallback: SortKey | null) =>
    page.length > 0 ? sortKeyOf(page[page.length - 1]) : fallback;

  return {
    entries: [...nearPage, ...farPage],
    isDone: nearPage.length === nearLeft.length && farPage.length === farLeft.length,
    continueCursor: JSON.stringify({
      near: lastOf(nearPage, cursor.near),
      far: lastOf(farPage, cursor.far),
    } satisfies GroupCursors),
  };
}

/**
 * Full-text search across every ad type, newest first.
 *
 * Search-only since the unified feed (Phase 3): browsing lives in
 * `feed.getFeed`; this survives for the home-feed search box and the
 * CommandPalette.
 *
 * **It paginates for real.** A Convex search index answers in relevance order
 * and nothing else, so the index itself cannot be cursored newest-first (rule
 * 2). Instead the matches are pooled once (SEARCH_POOL_LIMIT), sorted by
 * `bumpedAt` desc, and walked with a keyset cursor per group (`pageOfPool`).
 * Nothing is trimmed away, which is the point: before this the
 * query returned a single page of 50 ranked near-first, so 50 nearby matches
 * removed every out-of-area one and left no page to scroll to — location was
 * shrinking the result set, which rule 5 forbids.
 *
 * @param args.search - Search term (ad titles; composites' member titles)
 * @param args.categoryId - Filter by specific category (optional)
 * @param args.location - Location preference (optional): groups results into
 *   the near/far sections instead of filtering (rule 5)
 * @param args.locationMeta - The record behind that suburb, captured where the
 *   buyer picked it — what makes "near" a distance (convex/lib/nearby.ts)
 * @param args.radiusKm - How far from that suburb still counts as "in the
 *   area", chosen by the buyer in the header. Absent = the admin-tuned
 *   `appSettings` default. It only ever decides which SECTION an entry lands
 *   in — narrowing it regroups ads, it never removes one (rule 5).
 * @param args.paginationOpts - Page size and keyset cursor over the ordered pool
 *
 * Excludes `isSold` ads (same as `isDeleted`) — a sold item, standalone or bundled,
 * shouldn't browse as available. Direct links (e.g. a seller's own dashboard) still
 * resolve via `getAdById`, which is unfiltered.
 */
export const getAds = query({
  args: {
    categoryId: v.optional(v.id("categories")),
    search: v.string(),
    location: v.optional(v.string()),
    locationMeta: v.optional(locationMetaValidator),
    radiusKm: v.optional(v.number()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const buyer = await resolveBuyer(ctx, args.location, args.locationMeta, args.radiusKm);
    const pool = await searchAllTypes(ctx, { ...args, buyer, limit: SEARCH_POOL_LIMIT });
    const { entries, isDone, continueCursor } = pageOfPool(pool, args.paginationOpts);

    // No `limit`: this path no longer cuts, so `assembleFeedPage` only orders
    // and hydrates. Its `pinned`-first trim is dead here and still load-bearing
    // on `getLatestAds`, which does cut — don't delete it.
    return { page: await assembleFeedPage(ctx, entries), isDone, continueCursor };
  },
});

/**
 * Get a single ad by its ID
 * 
 * Returns null if the ad doesn't exist or has been soft-deleted.
 * This is a public query that doesn't require authentication.
 * 
 * @param args.adId - The ID of the ad to retrieve
 * @returns The ad document or null if not found/deleted
 * 
 * @example
 * ```typescript
 * const ad = await ctx.runQuery(api.ads.getAdById, {
 *   adId: adId
 * });
 * 
 * if (!ad) {
 *   console.log("Flyer not found or deleted");
 * }
 * ```
 */
export const getAdById = query({
  args: { adId: v.id("ads") },
  handler: async (ctx, args) => {
    const ad = await ctx.db.get(args.adId);

    // Return null if ad is deleted or doesn't exist
    if (!ad || ad.isDeleted) {
      return null;
    }

    return ad;
  },
});

/**
 * Increment the view count for an ad
 * 
 * This mutation is called when a user views an ad detail page.
 * It increments the views counter by 1. Requires the ad to exist
 * and not be deleted.
 * 
 * @param args.adId - The ID of the ad to increment views for
 * @returns Success object with success: true
 * @throws Error if ad not found or deleted
 * 
 * @example
 * ```typescript
 * await ctx.runMutation(api.ads.incrementViews, {
 *   adId: adId
 * });
 * ```
 */
export const incrementViews = mutation({
  args: { adId: v.id("ads") },
  handler: async (ctx, args) => {
    const ad = await ctx.db.get(args.adId);
    if (!ad || ad.isDeleted) {
      throw new Error("Flyer not found");
    }

    await ctx.db.patch(args.adId, {
      views: ad.views + 1,
    });

    return { success: true };
  },
});

/**
 * Fetch ads created after a specific timestamp (for smart refresh)
 * 
 * Used to fetch new ads that were created since the last page load,
 * enabling a "smart refresh" feature that shows only new content.
 * Supports the same filtering options as getAds but returns an array
 * instead of paginated results.
 * 
 * @param args.categoryId - Filter by specific category (optional)
 * @param args.search - Search term for title search (optional)
 * @param args.location - Location preference (optional): sections results
 *   near/far instead of filtering (rule 5)
 * @param args.sinceTimestamp - Fetch ads created after this timestamp
 * @param args.limit - Maximum number of ads to return (default: 50)
 * @returns The same entries `getAds` returns, newest first — both branches
 *   cover all three ad types.
 *
 * @example
 * ```typescript
 * // Get ads created in the last 5 minutes
 * const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
 * const newAds = await ctx.runQuery(api.ads.getLatestAds, {
 *   sinceTimestamp: fiveMinutesAgo,
 *   limit: 20
 * });
 * 
 * // Get new ads in a specific category
 * const newCategoryAds = await ctx.runQuery(api.ads.getLatestAds, {
 *   categoryId: categoryId,
 *   sinceTimestamp: lastCheckTimestamp
 * });
 * ```
 */
export const getLatestAds = query({
  args: {
    categoryId: v.optional(v.id("categories")),
    search: v.optional(v.string()),
    location: v.optional(v.string()),
    locationMeta: v.optional(locationMetaValidator),
    radiusKm: v.optional(v.number()),
    sinceTimestamp: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    const buyer = await resolveBuyer(ctx, args.location, args.locationMeta, args.radiusKm);

    if (args.search) {
      const hits = await searchAllTypes(ctx, {
        search: args.search,
        categoryId: args.categoryId,
        buyer,
        sinceTimestamp: args.sinceTimestamp,
        limit,
      });

      return await assembleFeedPage(ctx, hits, limit);
    } else {
      // `sinceTimestamp` is a `bumpedAt` watermark, not a creation time: the
      // rail surfaces brand-new AND boosted rows. The `.take(limit)` is a
      // DB-level DATE cut — hence `sectionedAdHits`' pinned near pass (rule 5).
      const latestAdsPass = (location?: string) => {
        const q = args.categoryId
          ? ctx.db
              .query("ads")
              // [categoryId, bumpedAt] supports .eq on the leading field AND a
              // range on the trailing one, so the watermark stays an index bound.
              .withIndex("by_category_and_bumped_at", (q) =>
                q.eq("categoryId", args.categoryId!).gt("bumpedAt", args.sinceTimestamp)
              )
          : ctx.db
              .query("ads")
              .withIndex("by_bumped_at", (q) => q.gt("bumpedAt", args.sinceTimestamp));
        return q
          .order("desc")
          .filter((q) =>
            q.and(
              q.eq(q.field("isActive"), true),
              q.neq(q.field("isDeleted"), true),
              q.neq(q.field("isSold"), true),
              location === undefined ? true : q.eq(q.field("location"), location)
            )
          )
          .take(limit);
      };

      // The rail is the ONLY path that re-injects new arrivals into the feed,
      // which is frozen at `maxSortTime` from mount — so composites ride it too.
      const [ads, composites] = await Promise.all([
        sectionedAdHits(buyer, latestAdsPass),
        latestComposites(ctx, {
          categoryId: args.categoryId,
          buyer,
          sinceTimestamp: args.sinceTimestamp,
          limit,
        }),
      ]);

      return await assembleFeedPage(ctx, [...ads, ...composites], limit);
    }
  },
});
