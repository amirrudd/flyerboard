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
