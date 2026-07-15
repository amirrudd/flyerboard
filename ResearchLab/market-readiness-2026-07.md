# Market-readiness findings — July 2026

- **Method:** deep-research run (22 sources, every claim adversarially verified by 3 independent agents; 23/25 claims survived, 2 refuted and excluded) + codebase audit.
- **Question:** is FlyerBoard ready to launch against Facebook Marketplace / Gumtree via a community-first push in Melbourne's Persian community, and what single move most helps early adoption?

## Verdict

Product readiness is fine — the gaps are trust-feature *design* and liquidity, not engineering. Realistic odds are low in absolute terms, but the community-first plan matches the one playbook the evidence supports. **The highest-leverage move is not a new feature — it's making the existing ratings system trustworthy** (transaction-verified, one-sided). See [ideas/seller-reputation.md](ideas/seller-reputation.md), now **Shipped**.

## The wedge is real (verified)

- Marketplace/shopping scams are Australia's **#1 most-reported loss-involving scam type** — 9,628 loss reports, $8.6M, Jan–Sep 2025, up 19% YoY ([ACCC](https://www.accc.gov.au/media-release/australians-report-nearly-260m-in-losses-as-shopping-scams-surge)). But median loss is only ~$216 → the pain is **frequency/hassle, not catastrophe** → lightweight trust features win, **escrow is overkill** (validates *not* building payments yet).
- **Facebook's own trust model is being weaponised:** ACCC says scammers increasingly hijack FB/Instagram accounts to run fake sales *at the victim's own network*. "I know this seller on Facebook" no longer means the account is really them. This is the sharpest positioning line — it turns FB's social graph into a liability.
- **The target community is disproportionately harmed:** scam losses among ESL speakers rose **35% vs ~16%** population-wide. The Persian-first launch solves a real, citable problem, not just distribution convenience.

## Structural reality (verified)

- **NFX red flags apply:** classifieds are low-frequency *and* low-AOV → paid acquisition math is dead → near-zero-CAC community word-of-mouth is the *only* viable path (which is exactly the plan). Multi-tenanting (users keep FB/Gumtree open) is the default and that's fine early.
- **Liquidity has a number:** ~**25 active sellers + 200+ buyers** before the Melbourne Persian community feels liquid (Reforge 1:10 math). Size the friend-seeding effort against that, not "a bunch of ads."
- **In our favour:** C2C supply/demand is maximally fragmented, which NFX data says predicts marketplace traction.
- **Precedent:** Yeeyi (Chinese-Australian classifieds) reached millions by bundling classifieds with community content/news — a hint that Farsi-language content may be part of the moat, not just listings.

## Why seller reputation is the pick (verified)

- First negative rating flips an eBay seller's weekly sales growth from **+5% → −8%**; established reputation earns an **~8% price premium** ([Tadelis, Annual Review of Economics](https://faculty.haas.berkeley.edu/stadelis/Annual_Review_Tadelis.pdf)).
- Most important for the *expansion* phase: a high reputation score **substitutes for in-group familiarity** — it raises trust between dissimilar strangers ([PNAS/Stanford Airbnb field experiment, n=8,906](https://sociology.stanford.edu/publications/trust-extensible-field-experiment-airbnbs-user-population)). In-group trust bootstraps the Persian launch for free; reputation is what carries that trust outward when FlyerBoard grows beyond the community.
- Design spec is free from the literature: **one-sided (buyers rate sellers)** — eBay removed seller-rates-buyer in 2008 because negatives were retaliatory; and **transaction-verified**, because un-gated ratings inflate until meaningless (eBay median seller score: 100%).

## Codebase reality check (audit)

- **Ratings already existed** (`convex/ratings.ts`, live in AdDetail) but were un-gated: any logged-in user could rate any user, no chat/transaction required, symmetric. → fixed, see idea file.
- **Verification** (`identityVerification` flag) is an **unfinished, flag-gated feature**, not a permanent cosmetic badge. Intended design (per founder): hooks into a 3rd-party service where users **pay to verify via driver's licence / passport** to earn buyer trust. Until that's wired up, the `isVerified` self-attestation path must stay behind the flag / off — a "Verified" badge that means nothing is worse than none.

## Refuted (excluded)

- "Marketplace listings account for 72% of Australian scam reports / 67% of losses" — refuted 0-3.
- "The dominant scam pattern is underpriced fake listings, pay-and-never-deliver" — refuted 0-3.

## Open questions (founder legwork, not code)

- What does the Melbourne Persian community use *today* — Telegram/WhatsApp groups, Persian FB groups, Divar habits from Iran? If commerce lives in Telegram, the real competitor isn't FB Marketplace.
- Does a **Farsi UI / Farsi listing support** matter more than any trust feature for the first 200 users? (Yeeyi suggests: maybe.)
- Is the atomic network big enough — does the Melbourne Persian community clear the ~25-seller / 200-buyer bar? What's the adjacent expansion pool (other migrant communities vs. suburbs)?
- No claims survived on C2C-challenger *survival base rates* or Persian-diaspora marketplace case studies — genuinely unknown, treat as risk.
