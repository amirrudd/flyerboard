# Buyer-message copilot (auto-reply + scam detection)

- **Status:** Exploring
- **Created:** 2026-05-09
- **Last touched:** 2026-05-09

## Feasibility
- **Build effort:** 3/5 (LLM with the listing as context; we already have a chat table — unchanged)
- **Standalone value:** 3/5 (only useful when we have inbound buyer messages — partly liquidity-dependent — unchanged)
- **Differentiation:** 3/5 (was 4/5 — Meta launched AI auto-replies on FB Marketplace 2026-03-12, killing the "suggested replies" half of the wedge. **Scam shield is still genuinely missing on Marketplace and Gumtree — that's the surviving differentiator.**)
- **Overall:** 3/5 — narrowed: scam-shield-led, with auto-replies as a commodity bolt-on. Still a credible feature, but the framing should lead with safety, not productivity.

## Problem
Sellers waste time on the same five questions ("is this available?", "$50?", "where are you?", "can you deliver?", "PayID?"). A non-trivial slice of inbound is scams. ACCC National Anti-Scam Centre: buying/selling scams were the most-reported scam type involving financial loss in 2025 — **9,628 reports, A$8.6M lost in the first nine months of 2025 alone.** PayID is the dominant pattern (fake "PayID limit increase" emails); typical loss is around A$216. Both drain trust.

## Sketch
Inside a chat thread, alongside the seller's reply box:
- ~~**Suggested replies** (3 options): polite-and-firm, friendly, "no, available for pickup only."~~ Meta now does this on Marketplace; keep on FlyerBoard for parity but de-prioritise as the wedge.
- **Scam shield**: highlights inbound messages with risk signals — PayID-limit-increase scam, courier-pickup scam, overpayment scam, "still available?" → external link. Specific to known AU patterns, not generic.
- **Auto-FAQ**: buyer asks something the listing already answers → suggest one-tap reply that quotes the listing.

LLM gets: listing fields + thread history + a small scam-pattern prompt. Seller stays in control; we never auto-send. **Critical wording:** flag as "looks suspicious" not "this is a scam" — false-negative liability is real.

## Why now
- Existing `chats` / `messages` tables already model the conversation.
- Scam patterns are well-documented; the AU-specific PayID variant is now widespread enough that ACCC has its own page.
- Meta shipping auto-replies (March 2026) means the productivity angle is commoditised — but Meta has *not* shipped a scam-shield, and given they themselves are the platform where most of these scams happen, they have a structural disincentive to call them out aggressively.

## Open questions
- [x] How aggressive should scam warnings be before they feel patronising? — Flag obvious patterns (PayID-limit-increase emails, courier scams) loudly; soft-flag ambiguous cases. Manual-label test set first.
- [x] Do we ever auto-send (e.g., "this item is no longer available") on stale threads, or always seller-confirmed? — Always seller-confirmed for now. False-negative liability in the scam case is too high to risk for a tiny convenience win.
- [x] Per-message LLM cost vs caching the listing context — do we run it on every inbound or on demand? — Cache listing context per-thread; run on every inbound (cheap with cached prefix). Skip if the message is < 5 words and clearly not a scam pattern.
- [ ] **New:** What's our liability exposure if scam shield says nothing and the seller gets defrauded? Cap with "informational only, not professional fraud advice" disclaimer + clear flagging language. Run past a lawyer before launch.

## Risks
- **False-negative scam liability.** If we miss a scam and the seller loses money, "the AI didn't warn me" is a cleaner narrative for the user than "the platform should've caught it." Disclosure language matters.
- False-positive scam flags damage trust we're trying to build (legitimate buyers feel accused).
- LLM cost scales with messages, not listings — needs rate-limiting.
- **Meta parity on auto-replies** means the productivity story isn't a wedge by itself.

## How we'd validate
Roll out in shadow mode (suggestions visible to seller, never sent). Track:
- % of suggestions accepted as-is.
- Scam-flag accuracy on a manually-labelled sample of 200 real inbound messages (target: >90% recall on PayID-pattern + courier-pattern, <5% false-positive on benign messages).
- Self-reported scam attempts in a quarterly seller survey.

## Log
- 2026-05-09 — first sketch.
- 2026-05-09 — feasibility pass: Meta launched AI auto-replies on FB Marketplace 2026-03-12 — productivity half of the wedge is now commodity. Scam-shield half survives: ACCC reports A$8.6M lost on buying/selling scams in 9 months of 2025; PayID-limit-increase is the dominant AU pattern. Diff 4→3, Overall stays 3 but reframed scam-shield-first. Added false-negative liability as a real risk.
