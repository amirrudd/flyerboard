# Printable flyers (the actual "FlyerBoard" angle)

- **Status:** Exploring
- **Created:** 2026-05-09
- **Last touched:** 2026-05-09

## Feasibility
- **Build effort:** 3/5 (was 2/5 — Cloudflare Browser Run for HTML→PDF is the clean path, but it's paid, has font-loading and page-size gotchas, and needs to be wired through a Convex action)
- **Standalone value:** 5/5 (zero-buyer required; the flyer itself does distribution — unchanged)
- **Differentiation:** 5/5 (no major marketplace does this; matches the brand name; Meta absolutely will not print — unchanged)
- **Overall:** 5/5 — small build, strong narrative fit, on-brand. Highest ROI per unit of build effort, especially after Meta erased the supply-side wedges.

## Problem
Online listings live in a feed and disappear. Apartment buildings, cafes, uni campuses, community noticeboards still drive *real* local traffic — but printing a decent flyer is annoying. Nobody wants to open Word at 9pm before a moving sale.

## Sketch
For any listing or moving sale, generate (one click):
- **A4 flyer (PDF)** — clean layout, photo, price, suburb, QR code to the FlyerBoard public listing.
- **Tear-off slips version** — classic phone-number tear-tabs, modernised to QR codes.
- **Apartment noticeboard poster** — vertical, big QR.
- **Instagram Story (1080×1920)** — ready to share.
- **Facebook group post image** — square.

Each variant: same content, different layout. Dynamic templating, not a static PDF.

> "Moving sale this Saturday in Brunswick — scan to view items."

## Why now
- Nothing in this idea requires marketplace volume. The flyer is the product.
- It's the *only* idea that earns the FlyerBoard name literally.
- Cheap: HTML/SVG templates + a QR lib + a print stylesheet. No ML required.
- **New:** With Meta erasing most of the supply-side AI differentiation, the *physical* surface (paper, noticeboards) is the only place we can never be replicated by a platform we can't see inside.

## Open questions
- [x] PDF generation server-side (Puppeteer / Convex action) vs client-side? — **Server-side, via Cloudflare Browser Run** (HTML/CSS → PDF using Puppeteer at the edge). Called from a Convex action; the PDF is stored in R2 and the seller gets a download link. Browser Run is paid, but per-document cost is small. Fonts and AU/US paper-size differences are the gotchas.
- [ ] Do we track QR scan-throughs as a real growth metric?
- [ ] Print-friendly fonts / cropping for A4 vs Letter (US/AU)?
- [ ] **New:** What % of our target sellers (moving-sale audience) actually have a working printer at home? If it's <30%, the *digital* variants (Story, group post, noticeboard image for someone *else* to print) carry the feature; if it's >50%, the printable PDF is the headline.
- [ ] **New:** QR scan tracking through a redirect link is fine privacy-wise *if* we keep it to aggregate counts only, not individual identifiers. Worth deciding before we ship.

## Risks
- Low risk overall. Worst case: nobody prints them. But the *digital* variants (Story, group post) carry value alone.
- **New:** Cloudflare Browser Run is a load-bearing dependency we don't currently use; outage or pricing change could bite. Mitigation: cache rendered PDFs aggressively (a flyer's content is stable per listing).

## How we'd validate
Add it as a free unlock after first listing. Metric: % of sellers who download or share at least one variant; QR scans per listing. Secondary metric: do moving-sale users print? (Self-report at end-of-sale survey.)

## Log
- 2026-05-09 — first sketch.
- 2026-05-09 — feasibility pass: confirmed Cloudflare Browser Run (HTML→PDF via Puppeteer at the edge) is the clean approach, called from Convex actions, output stored in R2. Build effort raised 2→3 to reflect Browser Run wiring + AU/US paper-size handling + font loading. Strengthened by elimination after Meta's March 2026 supply-side launches: physical/print is the only surface we can't be eclipsed on. Scores Build 2→3, Overall stays 5.
