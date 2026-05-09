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

## 2026-05-09 reality check

Two cross-cutting findings from a feasibility pass on every idea in `ideas/` invalidate parts of this doc. Captured here so the next iteration of strategy starts from current ground, not the original sketch.

**1. Meta shipped the AI seller copilot inside Marketplace on 2026-03-12.**
Photo-to-listing, AI auto-replies, AI-suggested prices using local comps, tone variants (Recommended/Friendly/Professional/Concise), AI seller-profile summaries — all native, all wired to their full liquidity. Hands-on review (Value Added Resource by Liz Morton) reports it "performed better than many of the various AI listing tools competing marketplaces have launched."

What this breaks in the doc above:
- The "AI seller copilot is the product" thesis (top of page) needs sharpening — *Meta is now an AI seller copilot too*. We can't claim the abstraction. We have to claim a specific surface Meta won't / can't cover.
- The 30-day plan: Week 1 (photo-to-listing, price suggestion) and Week 4 (auto-reply templates) are now mostly rebuilding what Meta just shipped. Either drop those weeks or scope them down to "engine for the cross-platform pack and moving-sale flow", not a standalone front door.
- Differentiation scores in the index dropped: ai-photo-to-listing 4→2, price-estimation 2→1, buyer-message-copilot 3→3 (auto-reply gone, scam-shield survives).

What survives, by elimination, is the stuff Meta can't or won't do:
- **Multi-item moving sales** (per-listing AI doesn't model a bundled sale event).
- **Print / physical flyers / noticeboards** (a platform can't ship paper).
- **Demand-side / wanted ads** (Meta didn't touch buyer-intent structuring).
- **Scam shield** (Meta has structural incentive *not* to highlight that scams happen on their platform).
- **Multi-platform output** (Meta won't help a seller post to Gumtree or Instagram).

**2. The cold-start loop's "back-link to FlyerBoard public page" assumption doesn't hold on Gumtree.**
The diagram in *Cold-start loop* assumes "Each share links back to the FlyerBoard public page." Gumtree's posting policy explicitly prohibits *"Links to other competitive auto, job, real estate, dating, or classifieds websites"* and *"Links that redirect users to external e-commerce or sales platforms"* in both ad body and replies. FlyerBoard is by definition a competitive classifieds site. So the Gumtree leg of the loop is a ToS violation; on Facebook Marketplace tracking links flag as spam (Jan 2026 enforcement = instant 30-day ban first violation, permanent ban second within 90 days); on local FB Buy/Swap/Sell groups external links are usually mod-removed.

The back-link only reliably works on **Instagram Story** (and email, word-of-mouth, and the printable flyer's QR code). Not from Gumtree, not from FB, not from FB groups. The "public listing page is the growth surface" claim is still right — but the way traffic *reaches* that surface is print, IG, and direct sharing, not classifieds back-links.

**Implication for the build order in *30-day build plan*:**
Original Week 1 (photo-to-listing wedge) is no longer a wedge. Suggested re-prioritisation given the above:

1. **Printable flyers + public listing page** (Week 1) — the only growth surface that survives both findings, and the literal namesake. Cheap to build.
2. **Moving sale mode shell** (Week 2) — the wrapper everything else stacks into; clearest wedge after Meta's launch.
3. **Cross-posting pack** without back-links to Gumtree (Week 3) — useful seller-side utility, just don't pretend it's a funnel.
4. **Photo-to-listing + price** (Week 4) — engine for #2 and #3, not a standalone front door. Scope it down.
5. **Wanted ads** (later) — unclaimed demand surface; needs a scam-shield in place first.
6. **Scam shield** (later) — the surviving piece of the buyer-message copilot wedge.

Auto-replies, deal-finder, and standalone price-estimation drop out of the near-term plan.

This is a **proposal**, not a decision. The original 30-day plan above stays in place until you re-write it.
