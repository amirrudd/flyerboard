# Cross-posting pack (Facebook / Gumtree / Instagram / local groups)

- **Status:** Exploring
- **Created:** 2026-05-09
- **Last touched:** 2026-05-09

## Feasibility
- **Build effort:** 3/5 (LLM transforms + image resizing; no API auto-posting)
- **Standalone value:** 3/5 (useful as a copy/image generator; the "FlyerBoard becomes the home base" framing relied on a back-link that Gumtree ToS prohibits)
- **Differentiation:** 2/5 (Vendoo / List Perfectly / Crosslist already do this via browser extensions; defensible only on the casual-AU-seller niche, not for resellers)
- **Overall:** 3/5 — useful seller-side utility, but no longer the strongest cold-start move once the back-link funnel is ruled out.

## Problem
Sellers don't list on FlyerBoard because "nobody is there." Original reframe was: we make selling on Facebook/Gumtree easier *too*, and FlyerBoard becomes the home base for the listing. The home-base half of that depends on a back-link from the cross-post — which (see Risks) is a Gumtree ToS violation and a spam-flag risk on FB.

## Sketch
After a listing is created, generate a "cross-posting pack":
- Copy-ready Facebook Marketplace title + description.
- Copy-ready Gumtree version (different tone, more detail).
- Instagram Story caption + 1080x1920 image.
- Local Facebook group post (community-friendly tone).
- Resized images per platform.
- ~~Tracking link back to the FlyerBoard public listing page.~~ Removed — see Risks. The hook back to FlyerBoard has to come from somewhere else (image watermark? mention in body copy?) — open question.

No auto-posting (platform ToS). One-click copy buttons + "share" sheet.

## Why now
Cold-start. Sellers feel the pain immediately; we don't need a buyer base to deliver value. Note: without the back-link, the framing is "free seller-side utility we offer to attract listings", not "funnel cross-posters back to FlyerBoard."

## Open questions
- [x] What's the line between "useful copy pack" and "ToS risk" for each platform? — Answered in Risks.
- [x] Do we need per-suburb local group templates, or is one generic version fine? — Moot until we confirm local groups even tolerate the post; admin-enforced rules vary.
- [x] How do we measure click-throughs on the back-link without violating privacy? — Moot; the back-link itself is a Gumtree ToS violation and a spam-flag risk on FB.
- [ ] Is the casual-AU-seller niche large enough to defend against Vendoo / List Perfectly / Crosslist if they ever target it?
- [ ] Without the back-link, what's the actual hook back to FlyerBoard? (Brand watermark on resized images? FlyerBoard mention in body copy? "Listed on FlyerBoard" tagline?)

## Risks
- **Gumtree back-link is a ToS violation.** Their help docs prohibit *"Links to other competitive auto, job, real estate, dating, or classifieds websites"* and *"Links that redirect users to external e-commerce or sales platforms"* in both ad body and replies. Ads removed; repeat offenders banned. Source: `help.gumtree.com.au` — *"Can I link to my website in my Ad?"*.
- **Facebook Marketplace back-link risk.** Clickable links unsupported in listings; plain-text URLs tolerated; tracking/shortened URLs flagged as spam. Jan 2026 enforcement tightened: instant 30-day ban for first spam violation, permanent ban on second within 90 days.
- **Facebook local Buy/Swap/Sell groups.** Most ban external links via mod-tools / auto-removal; case-by-case by group.
- **Crosslisting space is already crowded.** Vendoo, List Perfectly, and Crosslist support FB Marketplace + IG + eBay/Poshmark/Mercari/Etsy via browser extensions. They trademark-disclaim ("not endorsed by Facebook") and operate. A pure copy-pack is a thinner offering than what's on free trial elsewhere — defensible only on the casual-AU-seller niche, which those tools don't target today.
- Quality drift across platforms (one variant looks great, others mediocre).

## How we'd validate
Add it as a free unlock after first listing. Primary metric: % of sellers who copy at least one variant. Loyalty signal (in lieu of the back-link funnel): do those sellers come back to list a second item on FlyerBoard within 14 days?

## Log
- 2026-05-09 — first sketch.
- 2026-05-09 — feasibility pass: Gumtree back-link is a ToS violation; FB enforcement tightened Jan 2026; Vendoo / List Perfectly / Crosslist already cover resellers — defensible niche is casual AU sellers. Scores Value@0 5→3, Diff 4→2, Overall 4→3. Status Seed→Exploring.
