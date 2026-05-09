# Cross-posting pack (Facebook / Gumtree / Instagram / local groups)

- **Status:** Seed
- **Created:** 2026-05-09
- **Last touched:** 2026-05-09

## Feasibility
- **Build effort:** 3/5 (LLM transforms + image resizing; no API auto-posting)
- **Standalone value:** 5/5 (useful even if FlyerBoard has zero buyers — that's the point)
- **Differentiation:** 4/5 (Meta won't help you post elsewhere)
- **Overall:** 4/5 — counterintuitive but probably the strongest cold-start move.

## Problem
Sellers don't list on FlyerBoard because "nobody is there." Reframe: we make selling on Facebook/Gumtree easier *too*, and FlyerBoard becomes the home base for the listing.

## Sketch
After a listing is created, generate a "cross-posting pack":
- Copy-ready Facebook Marketplace title + description.
- Copy-ready Gumtree version (different tone, more detail).
- Instagram Story caption + 1080x1920 image.
- Local Facebook group post (community-friendly tone).
- Resized images per platform.
- Tracking link back to the FlyerBoard public listing page.

No auto-posting (platform ToS). One-click copy buttons + "share" sheet.

## Why now
Cold-start. Sellers feel the pain immediately; we don't need a buyer base to deliver value.

## Open questions
- [ ] What's the line between "useful copy pack" and "ToS risk" for each platform?
- [ ] Do we need per-suburb local group templates, or is one generic version fine?
- [ ] How do we measure click-throughs on the back-link without violating privacy?

## Risks
- Platforms could block tracking links / discourage cross-posts. Mitigation: keep links optional.
- Quality drift across platforms (one looks great, others mediocre).

## How we'd validate
Add it as a free unlock after first listing. Metric: % of sellers who copy at least one variant; downstream views on the FlyerBoard public page.
