# Printable flyers (the actual "FlyerBoard" angle)

- **Status:** Seed
- **Created:** 2026-05-09
- **Last touched:** 2026-05-09

## Feasibility
- **Build effort:** 2/5 (HTML→PDF + QR code library; SVG templates)
- **Standalone value:** 5/5 (zero-buyer required; the flyer itself does distribution)
- **Differentiation:** 5/5 (no major marketplace does this; it matches the brand name)
- **Overall:** 5/5 — small build, strong narrative fit, on-brand. Very high ROI.

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

## Open questions
- [ ] PDF generation server-side (Puppeteer / Convex action) vs client-side?
- [ ] Do we track QR scan-throughs as a real growth metric?
- [ ] Print-friendly fonts / cropping for A4 vs Letter (US/AU)?

## Risks
- Low risk overall. Worst case: nobody prints them. But the *digital* variants (Story, group post) carry value alone.

## How we'd validate
Add it as a free unlock after first listing. Metric: % of sellers who download or share at least one variant; QR scans per listing.
