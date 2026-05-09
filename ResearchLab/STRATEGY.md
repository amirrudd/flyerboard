# FlyerBoard — Strategy notes

A working doc, not a manifesto. Update freely.

## Core thesis

Don't fight Facebook Marketplace / Gumtree on traffic. We will lose. They have liquidity; we don't.

Fight them on **seller workflow**. Make FlyerBoard valuable to a seller *even if FlyerBoard has zero buyers*. The marketplace is the publishing layer; the AI seller copilot is the product.

> **"List once. FlyerBoard's AI helps price, write, improve, and distribute your ad."**

## Niche choice — moving / decluttering

Three options were on the table:
- **A. Moving / decluttering** — picked.
- B. Student marketplace — strong fit but distribution is hard (need campus access).
- C. Apartment / building — strong locality but B2B-ish go-to-market.

**Why moving wins:** high urgency, multi-item, pricing is hard, cross-posting matters, bundles matter, local pickup matters. Every AI feature compounds. And the user *already feels the pain* — they don't need to be convinced there's a problem.

## Cold-start loop

Goal isn't "get buyers." Goal is **get sellers to use FlyerBoard as a listing-generation tool**. Then every generated listing becomes distribution:

```
Seller uploads photos
    ↓
AI generates listing + cross-posting pack + printable flyer
    ↓
Seller publishes on FlyerBoard (canonical)
    ↓
Seller shares to FB Marketplace, FB groups, Gumtree, Instagram, building noticeboard
    ↓
Each share links back to the FlyerBoard public page
    ↓
Buyers land on a clean public page → discover other listings
    ↓
Eventually some buyers stay
```

The public listing page is the growth surface. It needs to look great when shared.

## What the "agentic" framing actually means

Not a chatbot in the corner. Workflow automation with verbs:

- "I improved your title."
- "Your price is probably too high."
- "I created 3 versions of this listing."
- "I found 4 missing details buyers will ask about."
- "I drafted replies to 6 buyer messages."
- "Drop price by A$20 after 5 days."
- "This buyer message looks scammy."
- "This item may sell better in a moving bundle."

The agent *does things*; the user approves.

## Monetization

Free:
- Basic listing.
- AI title / description / category.
- Publish to FlyerBoard.

Paid unlocks:
- **A$3** — price estimate + improved listing pack.
- **A$5** — cross-posting pack (FB / Gumtree / Insta / group versions).
- **A$9** — Moving Sale Pack: up to 20 listings, bundle suggestions, public sale page, copy pack, buyer reply templates, printable flyer.
- **A$15/mo** — seller assistant for multiple ongoing listings.
- **A$29/mo** — power sellers / small businesses.

**Lead offer = the A$9 Moving Sale Pack.** Concrete, urgent, justifies a charge in a way "pay to list" never does.

## 30-day build plan

### Week 1 — Photo-to-listing wedge
- Photo upload → vision LLM → generated listing fields.
- Price suggestion (v0, LLM-only, hedged).
- Public listing pages that look good when shared.

### Week 2 — Distribution surface
- Cross-posting pack generator.
- Printable A4 flyer + QR code.
- Instagram Story / FB group post variants.
- Saved seller dashboard.

### Week 3 — Moving sale mode
- Multi-item upload.
- Bundle suggestions.
- Public sale page.
- Buyer inquiry templates per listing.

### Week 4 — Trust + monetization
- Scam-message detector.
- Saved-search alerts (only if we have any listing volume — otherwise defer).
- Paywall for the Moving Sale Pack.

## Open strategic questions

- [ ] Do we name it "FlyerBoard AI" externally, or stay "FlyerBoard" with AI as the obvious feature?
- [ ] Geographic focus — one city / one suburb to start, or AU-wide from day one?
- [ ] How aggressively do we lean into the literal *flyer* angle in marketing? (It's the only thing that's truly differentiated.)
- [ ] Is the Moving Sale Pack better positioned as a B2C purchase, or B2B via removalist partnerships?

## What we're explicitly *not* doing

- Generic classifieds positioning ("Australia's new marketplace").
- Beating FB on traffic.
- Auto-posting to other platforms via unofficial APIs (ToS minefield).
- Building deal-finder / saved search before there's listing supply to find.
