# Buyer-message copilot (auto-reply + scam detection)

- **Status:** Seed
- **Created:** 2026-05-09
- **Last touched:** 2026-05-09

## Feasibility
- **Build effort:** 3/5 (LLM with the listing as context; we already have a chat table)
- **Standalone value:** 3/5 (only useful when we have inbound buyer messages — partly liquidity-dependent)
- **Differentiation:** 4/5 (scam flagging is genuinely missing on Marketplace/Gumtree)
- **Overall:** 3/5 — solid bolt-on once we have any volume; not a wedge by itself.

## Problem
Sellers waste time on the same five questions ("is this available?", "$50?", "where are you?", "can you deliver?", "PayID?"). A non-trivial slice of inbound is scams (overpayment, courier pickup, fake escrow). Both drain trust.

## Sketch
Inside a chat thread, alongside the seller's reply box:
- **Suggested replies** (3 options): polite-and-firm, friendly, "no, available for pickup only."
- **Scam shield**: highlights inbound messages with risk signals ("sounds like an overpayment scam — don't proceed").
- **Auto-FAQ**: buyer asks something the listing already answers → suggest one-tap reply that quotes the listing.

LLM gets: listing fields + thread history + a small scam-pattern prompt. Seller stays in control; we never auto-send.

## Why now
- Existing `chats` / `messages` tables already model the conversation.
- Scam patterns are well-documented; a prompted classifier handles 80% with minimal training data.

## Open questions
- [ ] How aggressive should scam warnings be before they feel patronising?
- [ ] Do we ever auto-send (e.g., "this item is no longer available") on stale threads, or always seller-confirmed?
- [ ] Per-message LLM cost vs caching the listing context — do we run it on every inbound or on demand?

## Risks
- False-positive scam flags damage the trust we're trying to build.
- LLM cost scales with messages, not listings — needs rate-limiting.

## How we'd validate
Roll out in shadow mode (suggestions visible to seller, never sent). Track: % of suggestions accepted as-is, scam-flag accuracy on a manually-labelled sample.
