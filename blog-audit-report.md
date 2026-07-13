# Blog Audit Report

**Audit Date:** 2026-07-13 (refreshed after the same-day fix pass)
**Directory:** `src/content/blog/`
**Total Posts:** 6
**Average Score:** 82/100 (Strong) — up from 79 at first audit

This is a refreshed snapshot. Since the initial audit, three fixes landed **this session**: FAQPage schema + author E-E-A-T (site-wide, in `BlogPostPage.tsx`), an internal-linking pass (every post now cross-linked), and the scams title trim. The hero covers were also redesigned. What remains is external citations, the per-post OG image, and a `Person`/author-bio schema node.

---

## What changed since the first audit

| Item | Status | Where |
|---|---|---|
| `FAQPage` JSON-LD (was missing on all 6) | ✅ Done | `src/pages/BlogPostPage.tsx` + `extractFaqs()` in `src/lib/blog.ts` |
| Author E-E-A-T: `author.url`, `publisher.logo` ImageObject, on-page "By …" byline | ✅ Done | `src/pages/BlogPostPage.tsx` |
| Internal contextual links (was 3 orphans + 4 dead-ends) | ✅ Done | 4 posts edited; **0 orphans, 0 dead-ends** now |
| Scams title 63 → 49 chars | ✅ Done | `avoid-marketplace-scams-australia.md` |
| `updated` bumped (freshness) on 4 revised posts | ✅ Done | frontmatter |
| Hero cover illustrations redesigned | ✅ Done | `public/blog-covers/*.svg` |
| Per-post OG image (still generic `/og-preview.png`) | ⏳ Deferred | next session (#2) |
| External Tier 1-3 citations on product posts | ⏳ Open | needs research (no fabrication) |
| `Person`/author-bio schema node (3rd schema type) | ⏳ Open | E-E-A-T lever |

---

## Health Overview

| Metric | Count |
|--------|-------|
| Posts scoring 90+ (Exceptional) | 0 |
| Posts scoring 80–89 (Strong) | 4 |
| Posts scoring 70–79 (Acceptable) | 2 |
| Posts scoring <70 | 0 |
| Contextual-link orphans (0 in-body inbound) | **0** (was 3) |
| Dead-end posts (0 in-body outbound) | **0** (was 4) |
| Cannibalization issues | 0 |
| Stale content (90+ days) | 0 |
| Missing `FAQPage` schema | **0 / 6** (was 6/6) |
| Generic (non-hero) OG image | 6 / 6 (unchanged — deferred) |

---

## Per-Post Scores

| Post | Score | Δ | Content /30 | SEO /25 | EEAT /15 | Tech /15 | AI Cite /15 |
|------|-------|----|-------------|---------|----------|----------|-------------|
| avoid-marketplace-scams-australia | 85 | +4 | 28 | 20 | 10 | 13 | 14 |
| how-to-run-a-moving-sale | 85 | +4 | 28 | 21 | 10 | 13 | 13 |
| write-a-classified-ad-that-sells | 85 | +5 | 28 | 21 | 10 | 13 | 13 |
| moving-sale-mode-list-everything-at-once | 82 | +1 | 26 | 21 | 9 | 13 | 13 |
| bundle-listing-sell-items-together | 79 | +2 | 26 | 20 | 8 | 13 | 12 |
| trade-and-swap-items-flyerboard | 78 | +4 | 26 | 19 | 8 | 13 | 12 |

Gains came from: Technical +1 across the board (2 schema types now: BlogPosting + FAQPage), E-E-A-T (byline + publisher.logo + author.url), and SEO on the formerly-unlinked posts.

---

## Internal Link Graph (in-body links) — RESOLVED

| Post | In-body outbound | In-body inbound | Flag |
|------|------------------|-----------------|------|
| write-a-classified-ad (**hub**) | → scams, → trade | ← scams, ← trade | ok |
| moving-sale-mode | → how-to, → bundle | ← bundle, ← how-to | ok |
| avoid-marketplace-scams | → write-a-classified-ad | ← how-to, ← write | ok |
| how-to-run-a-moving-sale | → moving-sale-mode, → scams | ← moving-sale-mode | ok |
| bundle-listing | → moving-sale-mode | ← moving-sale-mode | ok |
| trade-and-swap | → write-a-classified-ad | ← write-a-classified-ad | ok |

Every post now has ≥1 in-body inbound **and** outbound link. Link counts are still modest (1–2 per post vs. the 3–10 ideal), so there's remaining upside, but the orphan/dead-end problem — the flagged issue — is gone.

---

## Prioritized Action Queue (remaining)

| # | Scope | Issue | Recommended action | Effort |
|---|-------|-------|--------------------|--------|
| 1 | Site-wide (6/6) | Per-post OG image still generic `/og-preview.png` | Point `og:image`/`twitter:image` at `post.heroImage` (now that the hero SVGs are redesigned, they're good OG source art). | ~30m |
| 2 | Product posts (bundle, moving-sale-mode, trade) | No external Tier 1-3 citations | Add 1–3 authoritative external links each — needs real sources, no fabricated stats. | ~1–2h research |
| 3 | Site-wide (6/6) | Only 2 schema types; author has no bio | Add a `Person`/`Organization` author node + short on-page author bio → 3+ schema types, higher E-E-A-T. | ~1h |
| 4 | trade, bundle | Lowest scorers; still only 1 in-body link each | Add 1–2 more contextual links (e.g. trade → moving-sale-mode; bundle → how-to) to reach the 3-link floor. | 20m |
| 5 | moving-sale-mode | 23 em-dashes (AI-detector signal) | Swap ~⅓ for commas/full-stops. Cosmetic. | 15m |

---

## AI Content Risk — all posts LOW (unchanged)

Zero of the 17 AI trigger phrases in any post; sentence-length variance healthy (SD 6.9–15.9); vocabulary diversity in the human 0.4–0.6 band; readability in the Consumer band (grade 6–8, Flesch 72–77). Only elevated signal is em-dash density (`moving-sale-mode` highest at 23).

---

## Topic Cannibalization — none

"moving sale" is shared by the how-to guide and the Moving Sale Mode feature page, but they target distinct intents and are cross-linked. No merges/redirects needed.

---

## Stale Content — none

All 6 updated within the last ~6–13 days. Four were bumped to 2026-07-13 during this session's edits.

---

## Recommended Next Steps

1. **#2 per-post OG image** — the one remaining site-wide mechanical fix; the redesigned hero SVGs are ready to serve as OG art.
2. **External citations** on the three product posts — the main E-E-A-T lever left; point me at sources or say "research it".
3. Optionally top up internal links on `trade` and `bundle` to hit the 3-link floor.

Lowest scorer: **`trade-and-swap` (78)** — `/blog rewrite src/content/blog/trade-and-swap-items-flyerboard.md` would add links + an external source in one pass.
