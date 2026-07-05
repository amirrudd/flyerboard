# Moving Sale Mode — Design Session

> **Status: shipped, merged (2026-07-02).** This doc is retained as the design record. Bundle Listing was split out into its own file — [`bundle-listing-design.md`](./bundle-listing-design.md) — once it grew into a standalone feature with its own creation flow and constraints.

- **Status:** Shipped, merged
- **Session date:** 2026-06-28
- **Method:** Deep research (103 agents, 21 sources, 25 adversarially-verified claims) + iterative UX design across 4 mockup rounds
- **Parent doc:** [`moving-sale-mode.md`](./moving-sale-mode.md)

---

## Research findings

### What the deep research confirmed

**AI photo-to-listing is proven — but no one does it for general household bulk items.**
eBay's AI bulk listing tool (launched September 2024) cut total listing steps by 50% in UK testing. The flow: upload photo + optional title → AI suggests title, category, item specifics → seller reviews draft → publish. The seller-review step is non-negotiable for trust. Critical limitation at launch: restricted to US Seller Hub and Sports Trading Cards category only. General-purpose bulk listing for mixed household items remains unsolved on every major platform.

**No competitor has a self-serve Moving Sale Mode.**
Research confirmed no platform combines: AI bulk listing (all household categories) + a public sale event page + bundle pricing + pickup window + self-serve flow. Specific gaps per competitor:

| Platform | AI bulk listing | Sale event page | Bundle pricing | Pickup window | Self-serve |
|---|---|---|---|---|---|
| Facebook Marketplace | Per-listing only, US | No | No | No | Yes |
| Gumtree AU | No | No | No | No | Yes |
| eBay AU | Cards only, US | No | Volume pricing only | No | Yes |
| MaxSold / EBTH | No | Yes (auction) | No | Yes | No — pro-curated |
| **FlyerBoard target** | **All categories** | **Yes** | **AI-suggested** | **Yes** | **Yes** |

**AU marketplace monetisation benchmark:**
Gumtree AU operates Starter / Plus / Featured / Premium tiers. Free listing is the norm; revenue comes from visibility upgrades. eBay AU eliminated transaction fees for casual sellers (under AU$25K/year). A $9 one-time "Moving Sale Pack" fits squarely in the fixed-fee model and aligns with AU market expectations.

**Stacking dependency confirmed:**
This feature wraps `ai-photo-to-listing` + `cross-posting-pack` + `printable-flyers`. If any underperforms, the wrapper underperforms. De-risk: ship each component standalone first and validate independently.

### Refuted claims (do not rely on these)
- eBay's "99% of draft work done by AI" — marketing language, unverified metric, killed 3-0
- Snap2List bulk speed claims — killed 1-2, self-reported only
- Gumtree AU exact pricing figures — killed, source unreliable; Gumtree AU price points are unconfirmed by research
- MaxSold 98% sell-through rate — killed 0-3, source is third-party blog
- EBTH 7-day bidding window — killed 1-2, conflicting sources

### Open questions still unanswered
- Does eBay AU's bulk listing AI now cover general household categories? If yes, the competitive window narrows faster than expected.
- What is the actual AU seller time-to-list on Gumtree / Marketplace for a 15-item sale today? This baseline is needed to validate the "halve listing steps" target.
- Is $9 the right price point? Gumtree numeric prices were refuted as unreliable — test with 5 actual movers before locking price.
- Removalist B2B distribution: affiliate link vs one-by-one sales partnership — needs one real test with a local removalist.
- Does the slug expire? Permanent vs time-expiring URL after pickup window closes.

---

## User journey

**Target: under 10 minutes from intent to live sale page.**

### Step 1 — Entry point
Triggered from the seller dashboard or a "Moving soon?" nudge shown on the post-listing screen after a seller has created 3+ ads in a short window. One tap launches a dedicated Moving Sale Mode flow — not buried in settings, not a toggle on the regular listing form.

Design note: the entry must feel like a mode shift, not a feature. The seller needs to feel like FlyerBoard has understood their situation.

### Step 2 — Sale event setup (1 screen)
Fields: sale name (pre-filled as "{First name}'s Moving Sale"), suburb, pickup window, optional note for buyers.

**Key friction point:** date/time picker is fiddly on mobile. Use presets ("this Saturday 9am–2pm", "next Sunday 10am–1pm") with a manual override. Sellers think in "this Saturday", not timestamps.

### Step 3 — Add items (two paths)

**Free path — manual listing:**
A simple per-item form: title, category, condition, price. The seller types each one. No AI, no cost. This is a fully functional moving sale — slower, but free. Item count is unlimited on the free path.

**Paid add-on — AI bulk listing:**
Camera roll multi-select or take-new. Each photo = one item draft. AI generates title, category, condition, and suggested price per photo in seconds. The seller is shown the cost upfront ("AI listing — $X, covers up to 25 items") before photos are uploaded.

The AI path is paid because it incurs real API cost per item. The pricing is honest about that reason — sellers understand "AI costs money to run" more readily than abstract upgrade tiers.

eBay benchmark for the AI path to beat: 50% reduction in listing steps vs manual.

### Step 4 — Batch review (card-by-card)
One card at a time. Each card shows: item photo, AI-generated title, category, condition, price stepper. Primary action: "Looks good" (approve). Secondary: "Later" (skip to end of queue). Escape hatch: "Edit" (opens a bottom sheet — never navigate away from the card flow).

Full design detail: see [Batch Review UI](#batch-review-ui) section below.

### Step 5 — Bundle suggestions
Seller can create bundles manually for free: group items, set a bundle price, give the bundle a name. AI bundle suggestions (auto-grouping based on category and price logic) are part of the paid AI add-on — only shown if the seller took the AI path in step 3.

Manual bundles go live on the sale page immediately. No gate.

### Step 6 — Sale page goes live (always free)
Once items are added and reviewed the sale page publishes immediately — no payment required. The seller gets a permanent public URL they can share anywhere. This is the core product; it's free.

### Step 7 — Share screen + optional paid upgrades
Seller lands on the share screen with a copy-link button and basic share options. Paid upgrades are offered here as clear, optional line items — not as a blocker:

- **AI listing** (if not already purchased in step 3) — add AI-drafted items to the sale
- **QR code + PDF flyer** — download a printable A4 flyer with QR
- **7-day pin** — featured placement at the top of relevant search results for 7 days

Each upgrade can be purchased individually or as a bundle. The share screen is re-enterable from the seller dashboard throughout the sale's lifetime — upgrades can be added at any point while the sale is active.

Full design detail: see [QR Code Integration](#qr-code-integration) section below.

---

## Buyer-facing sale page

### The core question this page answers

Individual listing answers: "what is this thing and how much?"
Sale event page must answer: "should I bother driving to this person's place on Saturday?"

That shift changes everything about the layout priority.

### Layout (top to bottom)

**1. Named hero**
```
[Moving sale eyebrow label]
Amir's Moving Sale — Richmond
Richmond, VIC · 18 items · 4 bundles
```
Personal name + suburb = trust. Buyers are visiting a person's home, not a store. Compare to Gumtree's anonymous listing where seller context is buried. Individual listings are faceless; the sale page is human from first glance.

**2. Live countdown to pickup window**
```
Pickup window opens in
[ 2 days ] : [ 14 hrs ] : [ 32 min ] : [ 08 sec ]
Pickup: Saturday 12 Jul, 9:00am – 2:00pm · Cash or bank transfer
```
Time-boxing is the single strongest urgency lever in marketplace UX. A ticking clock converts passive interest ("I'll check this later") into action ("I need to decide before Saturday"). Individual listings have no pickup window concept — buyers message, wait, and often find the item gone.

The countdown is to the start of the pickup window, not the end. "Opens in 2 days" is more exciting than "closes in 2 days 6 hours."

**3. Stats strip**
```
14 available · 4 sold · $1,240 total value · Sat only
```
- Available + sold count = social proof. "4 sold" signals others have already trusted this seller and turned up.
- Total value anchors the browse — $1,240 signals a real haul, not a few odds and ends.
- This strip does the trust-building work that seller ratings would do on eBay, which FlyerBoard doesn't have yet.
- "Sat only" — the time constraint is worth surfacing here as a plain-language label.

**4. Category filter bar**
```
[All] [Furniture] [Electronics] [Kitchen] [Books] [Clothing]
```
Auto-generated from the items in the sale. Lets buyers with a specific need (hunting for a desk) filter without scrolling 18 items. Only show categories that have items — no empty pills.

**5. Bundles section (above the item grid)**
```
Bundles — save when you take more  [4 bundles]
──────────────────────────────────────────────
[🖥️][🪑][📦]  Home office setup          $320 → $250  save $70
              Desk + office chair + monitor stand
[🍳][☕][🥄]  Kitchen essentials          $180 → $140  save $40
              Pan set + coffee maker + utensils
```
Bundle placement above the item grid nudges buyers toward higher-value purchases before they've mentally committed to just one item. Showing the saving makes the maths obvious. No competitor surfaces this for personal moving sales.

Showing bundles first also benefits the seller: faster clearance, higher revenue per buyer visit.

**6. Items grid (3 columns)**
Each cell: photo, price, title, condition. Sold items stay in the grid, greyed with a "sold" badge — never removed.

**The sold-items rule is critical:** removing sold items makes a 12-item sale look like a 3-item sale by Saturday afternoon. Greyed-out items preserve the sense of a full, active sale and reinforce social proof ("look how much has already moved"). This is the main UX error to avoid — the "dead sale" trap.

**7. Suburb-level map**
Static map pin at suburb level only — no street address. "Richmond VIC 3121 · Exact address shared after message." Lets buyers confirm the sale is within reach before enquiring. Address is sent in the first reply message.

Full street address publicly visible = safety risk (strangers knowing your home address). This pattern is the AU classifieds norm.

**8. Single primary CTA (sticky footer)**
```
[Message Amir]  [share icon]  [bookmark icon]
```
One "Message Amir" button — not per-item message buttons on the main page. Per-item buttons would give the seller 18 separate chat threads. A single sale-level CTA opens one conversation where the buyer can say "I want the sofa and I'm interested in the office bundle." The seller manages everything in one thread per buyer.

Per-item contact lives in the item detail modal (tap a grid cell) — not as the primary page action.

---

## Batch review UI

The highest-friction moment in the seller flow. The seller is standing in their half-packed flat, probably one-handed on their phone. They need to move fast through obvious items but can't blindly rubber-stamp — bad AI titles will end up on the public page.

### The three-tier effort model

| AI confidence | What it means | Seller time |
|---|---|---|
| High (green badge) | Clear photo, obvious item, confident title + price | ~10 seconds — one tap "Looks good" |
| Medium (amber badge) | Item identified, price missing or suspicious | ~20 seconds — price stepper adjustment |
| Low (red badge) | Blurry photo, ambiguous item, AI uncertain | ~60–90 seconds — full edit sheet |

The AI confidence badge is what makes the card-by-card flow efficient. Without it, every card looks the same and the seller either rushes everything or reads everything carefully. The badge tells them where to slow down.

### Time budget reality check
```
14 items × 10s (high confidence, one tap)    =  ~2.5 min
 4 items × 20s (medium, price adjustment)    =  ~1.5 min
 2 items × 75s (low confidence, edit sheet)  =  ~2.5 min
                                               ──────────
Total realistic review time                  =  ~6.5 min
```
Under 10-minute target with comfortable headroom, assuming AI gets ~70%+ of items to high confidence. Worth tracking that metric once live.

### Design decisions

**1. One card, full attention — not a scrollable list.**
Showing all 18 items as a list creates decision paralysis and tempts bulk-ignore. One card forces a binary: "good enough" or "change something." Same principle as onboarding flows — one question per screen reduces drop-off.

**2. AI confidence badge (high / medium / low).**
AI knows when it's guessing. A clear IKEA chair photo gets "high". A blurry pile of cables gets "low — review this." Sellers skim highs, slow down on lows. Average time isn't 30s × 18 items — it's weighted by confidence distribution.

**3. Price is the only inline stepper — everything else goes through "Edit".**
Price is the field sellers most want to touch. Surface it directly with −/+ buttons ($5 increments). Title and condition go through the full edit sheet. Don't put everything inline — the card becomes a form.

**4. Bottom sheet for full edits — never navigate away.**
If "Edit" pushes to a new screen, half of sellers won't navigate back to finish the queue. A bottom sheet slides up over the card; the card is still visible behind it. Context is preserved, flow is maintained.

**5. "Later" skip — not "back" or "delete".**
The seller hits an item they can't price (weird cable bundle, broken lamp). "Later" pushes it to the end of the queue. After all clear items are approved, skipped items surface for a second pass. Without a skip option, the seller gets stuck and abandons the entire flow.

**6. Progress chips — not just a percentage bar.**
One square chip per item. Done = green, skipped = amber, active = red/highlighted, remaining = grey. The seller sees their work spatially ("just 4 grey ones left") rather than as an abstract percentage. The end feels reachable.

**7. Approve-all shortcut — context-triggered, not upfront.**
Don't show "approve all" at the start — the seller hasn't seen AI output yet and would click it blindly. Trigger it after 3+ consecutive high-confidence items of the same category: "3 similar books detected — approve remaining books at once?" The AI earns the shortcut; the seller opts in with eyes open.

**8. Thumb-zone layout.**
"Looks good" (approve) = bottom-right, natural right-thumb position for one-handed mobile. "Later" (skip) = bottom-left. "Edit" = centre. A seller can flow through 10 high-confidence items in under 90 seconds, one thumb tap each.

---

## QR code integration

### Where it fits in the flow

The QR code is generated and surfaced at the **share screen**, immediately after payment and sale page go-live. Not earlier, because:

- During setup: the slug doesn't exist yet. No URL to encode.
- During batch review: seller is in creation mode, not distribution mode.
- On the sale page itself: that's the buyer view.
- **Share screen after payment:** the slug is minted and permanent. The seller is in "now share this" mode. QR + PDF + copy link all live here — the natural distribution moment.

The share screen is re-enterable from the seller dashboard ("share my sale") so sellers can re-download the flyer or reshare days later.

### Why QR matters beyond the obvious

The QR flyer on a letterbox, community noticeboard, or handed to neighbours reaches people who aren't scrolling Marketplace at that moment. Physical → digital distribution is genuinely unreachable by Facebook or Gumtree. This is the distribution wedge FlyerBoard owns.

The Gumtree back-link restriction (Gumtree forbids external URLs in listings) actually strengthens the QR/print case: the physical flyer brings people directly to the FlyerBoard sale page, bypassing the restriction entirely.

### Share screen layout
```
✓  Amir's Moving Sale is live
   18 items · Richmond · Sat 12 Jul

[QR code — 100×100px, scannable]
flyerboard.com.au/sale/amirs-sale-richmond-k7p2

[Save QR]  [Copy link]  [Share]
[Post to Facebook]  [Send via WhatsApp]

Print & display physically
[🖨️ Printable A4 flyer — with QR code · Download PDF →]
```

### Implementation

**QR generation: client-side.**
`qrcode.js` (~15KB, CDN). Runs entirely in the browser — no Convex action, no server cost. Encodes the permanent sale page URL. Triggered on share screen mount after `saleEvent.slug` is confirmed.

**PDF flyer: server-side via Convex action.**
The flyer is a marketing asset — it needs to look right. Option A (jsPDF client-side) gives fiddly layout control and won't match brand fonts. Option B (Convex action → Puppeteer rendering an HTML template → R2 PDF) gives perfect fidelity, brand fonts, easy template updates. Small per-generation cost, but cacheable: generate once, store `flyerPdfUrl` on `saleEvents`, serve from R2 on every subsequent download.

**Schema additions:**
```
saleEvents {
  flyerPdfUrl?: string   // R2 key, null until first download requested
  slug: string           // permanent, generated at payment time
}
```

**Slug design: permanent, human-readable, collision-safe.**
Format: `{first-name}-sale-{suburb}-{4-char-uid}`
Example: `amirs-sale-richmond-k7p2`

The 4-char UID suffix prevents collisions without uglifying the URL. The slug is minted at payment time and never regenerated — every printed flyer breaks if it changes.

### Printable A4 flyer layout

Auto-generated from sale event data — no seller input needed beyond what they already provided.

```
MOVING SALE
─────────────────────────────────────────
Amir's Moving Sale                [QR code]
Richmond, VIC                     [90×90px]
                                   Scan to see
Pickup                              all items
Saturday 12 July
9:00am – 2:00pm

Location
Richmond 3121
Address on request

Items include                      
2-seat sofa ................. $180
Standing desk ............... $90
Fiddle leaf fig ............. $30
Books (box of 20+) .......... $25
+ 14 more items online
─────────────────────────────────────────
flyerboard.com.au/sale/amirs-sale-richmond-k7p2
Powered by FlyerBoard
```

Top 4 items by price are auto-selected for the "items include" list. FlyerBoard branding is included — physical distribution is also brand distribution.

### Share targets per channel

| Channel | Format | Back-link allowed? |
|---|---|---|
| Letterbox / noticeboard | A4 PDF with QR | n/a — physical |
| Neighbours (in-person) | A4 PDF / QR PNG | n/a |
| Facebook / Instagram | Pre-written copy + URL | Yes |
| WhatsApp suburb groups | Pre-written message + URL | Yes |
| Gumtree | Standalone text only — no URL | No — Gumtree policy |

For Gumtree: standalone text copy without a FlyerBoard URL is the only legal option. Physical flyers (print + QR) are the workaround for Gumtree-discovered buyers — they see the ad, find the QR on a local board, scan through.

---

## Free vs paid tier design

### The principle

**The mode is free. Speed and visibility are paid.**

Moving Sale Mode — creating a sale, adding items manually, publishing a public sale page with a shareable URL — costs nothing. Sellers who can't or won't pay still run a real, functional moving sale on FlyerBoard. Paid features are honest accelerators: AI saves time but costs API money; QR/PDF cost generation; the 7-day pin costs feed placement. The pricing rationale is transparent and defensible.

This is meaningfully different from the previous model (gate on distribution). The old model said "pay to publish." This model says "publish free, pay to go faster and reach more people."

### Free tier — always

| Feature | Notes |
|---|---|
| Moving Sale Mode flow | Full setup experience |
| Manual item listing | Unlimited items, type title/category/condition/price |
| Manual bundle creation | Group items, set bundle price, goes live immediately |
| Public sale page (permanent URL) | Shareable, live immediately on publish |
| Buyer countdown, stats strip, suburb map | All sale page features included |
| Basic share options | Copy link, native share sheet |
| Sale active until pickup window closes | Auto-closes after |

### Paid add-ons (à la carte or bundled)

| Add-on | What it does | Why it costs |
|---|---|---|
| **AI bulk listing** | Photo → AI drafts all fields, batch review UI, AI bundle suggestions | Incurs LLM API cost per item |
| **QR code + PDF flyer** | Downloadable QR PNG + printable A4 flyer with QR, items list, pickup details | Server-side PDF generation cost |
| **7-day search pin** | Sale featured at top of relevant category searches for 7 days | Costs feed placement inventory |

**Bundled as the Moving Sale Pack** (suggested price TBD — validate with real movers before setting): all three add-ons together at a discount vs buying separately. Sellers who want the full experience buy the pack; sellers who just want AI listing can buy that alone.

### The conversion model

Publishing is the hook, not the gate. The seller completes a free sale and sees it live. The upgrade pitch happens at the share screen — not as a blocker, but as "here's how to reach more people faster":

```
Step 1 — Entry                         free
Step 2 — Sale setup                    free
Step 3a — Manual listing               free, unlimited items
Step 3b — AI listing (optional)        paid add-on
Step 4 — Batch review (if AI taken)    included with AI add-on
Step 5 — Bundle setup                  free (manual) / AI-suggested (with AI add-on)
Step 6 — Sale page goes live           free, always
Step 7 — Share screen                  free + upgrade prompts
          └─ AI listing (if not taken) paid
          └─ QR + PDF flyer            paid
          └─ 7-day search pin          paid
```

The seller sees a fully live sale before any payment prompt. The upgrade pitch is "your sale is live — here's how to get more eyes on it", not "pay to finish."

### Why this is better for conversion

**Trust first.** A seller who publishes for free has seen the product work. They're not evaluating FlyerBoard — they're already using it. Upgrade prompts land on a satisfied user, not a skeptical prospect.

**Transparent pricing rationale.** "AI costs API money" is a reason sellers understand and accept. "Pay to publish" has no obvious justification and creates resentment. Sellers who skip AI don't feel punished; sellers who buy it feel like they paid for something real.

**Lower entry barrier = more supply.** More sellers on the platform (even free ones) creates more inventory for buyers, which makes the platform more valuable for everyone, which brings more buyers, which makes the 7-day pin more valuable to sellers. Free supply feeds the flywheel.

**Upgrades can be purchased any time.** A seller who publishes free on Thursday and then decides Friday morning to print flyers for the letterbox can buy the QR/PDF add-on then. The purchase moment matches the purchase intent.

### What not to do

**Do not add an item cap on the free tier.**
The mode is free and the value is in having a complete sale. Capping at 10 items undermines that — a 6-item "moving sale" isn't really a moving sale. Manual listing is the natural limiter (it's slower); no artificial cap needed.

**Do not show upgrade prompts during listing or review.**
The seller is in creation mode. Interrupting with "upgrade to AI" while they're typing is annoying. The share screen is the right moment — the sale is done, they're in distribution mode, the prompts feel like options not obstacles.

**Do not require payment before the sale page URL is generated.**
The URL is the core product. It must be free. Gating the URL creates a hard barrier that free-tier users can never share or test — that defeats the purpose of the free tier entirely.

**Do not make the AI add-on feel like a nag.**
On the share screen, AI listing (if not taken) should appear as one option among several — not as the first and biggest prompt. Sellers who typed their items manually made a choice; respect it.

---

## Data model

### New tables

**`saleEvents`**
```
_id             Convex doc ID
userId          FK → users (owner)
slug            URL-safe string, e.g. "amirs-sale-richmond-k7p2"
title           "Amir's Moving Sale"
suburb          Display-only, e.g. "Richmond, VIC"
pickupWindowStart  timestamp
pickupWindowEnd    timestamp
status          "draft" | "active" | "ended"
itemCap         20–25 for $9 tier, 10 for free
isPaid          boolean — gates public page
flyerPdfUrl     string | null — R2 key, null until first download
expiresAt       timestamp — auto-close after pickup window
```

**`saleBundles`**
```
_id             Convex doc ID
saleEventId     FK → saleEvents
label           "Home office setup"
bundlePrice     number — seller-set or AI-suggested override
adIds           array of ad IDs in this bundle
```

### Changes to existing tables

**`ads`**
```
saleEventId?    optional FK → saleEvents
isSold          boolean — marks item as sold (NOT isDeleted)
bundleId?       optional FK → saleBundles
```

### Messaging model

Messaging for Sales is **keyed on the Sale event, not individual items.**

One chat thread per buyer per Sale (`chats` indexed by `(saleEventId, buyerId)`). When a buyer taps "Message seller" on any sale item — from the feed card, detail page, or Sale page — they open the same unified thread for that Sale.

**Items are referenced inside messages as optional chips** (array of `adId`s on the message doc). Auto-filled from the entry point item but removable. Buyer can add more items from the same Sale in the same message. This is how "can I get the chair and the bookshelf for $70?" becomes natural conversation rather than fragmented per-item threads.

**Schema changes:**

```ts
// chats table
chats: defineTable({
  buyerId: v.id("users"),
  sellerId: v.id("users"),
  adId: v.optional(v.id("ads")),           // null for Sale threads
  saleEventId: v.optional(v.id("saleEvents")), // new
  lastMessageTime: v.number(),
  isDeleted: v.optional(v.boolean()),
})
  .index("by_sale_event_buyer", ["saleEventId", "buyerId"]) // new — 1 thread per buyer per Sale

// messages table — add item reference chips
messages: defineTable({
  chatId: v.id("chats"),
  senderId: v.id("users"),
  body: v.string(),
  referencedAdIds: v.optional(v.array(v.id("ads"))), // new
})
```

Exactly one of `adId` / `saleEventId` must be set — enforce in the `createChat` mutation, not the schema validator. No migration for existing chats — both new fields are `optional()`.

**Seller inbox:** Sale threads appear with a Sale badge ("🏠 Amir's Moving Sale · 2 items mentioned") in the dashboard Chats tab. Single listing threads continue to appear as before, below or in a separate section.

### Key schema decisions

**`saleEvents` is a first-class entity, not a flag on `ads`.**
The sale page and bundle logic need their own lifecycle (draft → active → ended → expired). A tag or flag on ads cannot model this cleanly.

**Sold items use `isSold`, not `isDeleted`.**
Sold items stay visible on the sale page (greyed) so the page doesn't look empty mid-sale. Soft delete (`isDeleted`) would hide them. They need to stay visible.

**Slug is generated at payment time and never changes.**
Every printed flyer encodes the slug URL. If the slug changes, every physical flyer ever printed becomes a broken link. Generate once, store permanently.

**`flyerPdfUrl` is nullable and cached.**
Generate on first download request, store the R2 key, serve from cache thereafter. Don't regenerate on every download — the template is deterministic and the inputs don't change after the sale goes live.

---


## Terminology

| Term | Meaning | Code |
|------|---------|------|
| **Sale** | The top-level moving sale event — the public page at `/sale/{slug}` | `saleEvent` table |
| **Sale item** | An individual ad that belongs to a Sale | `ads` row with `saleEventId` set |
| **Single listing** | A regular ad with no `saleEventId` — the current default flow | `ads` row, no `saleEventId` |
| **Sale card** | The feed card representing the whole Sale — renders in the same grid as any listing, thumbnail is a 2×2 image grid | rendered from a `saleEvent`, no separate `listingType` needed |

Use "Sale" (capital S) in conversation to mean the event/page. Use "sale item" for individual ads within it. Use "single listing" to contrast with sale items in the feed. This matches the Convex schema naming.

---

## Sale items in the feed

### The gap

When a seller creates a Sale with 18 items, those items appear in the main feed as anonymous individual ads — no visual indication they belong to a Sale, no way for a buyer to navigate to the Sale page. Two things must be fixed.

### Fix 1: Individual sale items — no strip, no badge, look like regular listings

Individual ads that belong to a Sale (`saleEventId` set) appear in the feed as **normal listing cards** — same as any single listing. No "In a moving sale" strip, no badge, no visual differentiation.

**Why:** the strip created a nested tap-target UX problem — the `›` chevron read as the primary CTA so buyers tapped it expecting to see the item, and landed on the Sale page instead. Removing the strip eliminates the confusion entirely.

**How sale context is discovered:** buyers find items via normal search/category browsing. When they tap into the ad detail page, a prominent banner there surfaces the sale context. This is the right moment — the buyer is already interested in the item and receptive to "there's more."

The Moving Sale card (2×2 thumbnail grid, see Fix 2) is the explicit feed entry point for buyers who want to browse the full sale upfront.

### Fix 2: Sale card in the regular feed (replaces the "Sale event card" concept)

The Sale appears in the main feed as a single card — same grid as single listings, date-sorted. The card's thumbnail slot renders as a 2×2 image grid showing the first 3 item images + "+N more" overlay on the 4th cell. Badge: "Moving Sale" (red, top-left). Price: "from $5". Footer stat: "18 items".

**No separate Sale event card section.** Earlier concept had a pinned Sale event card in the suburb feed. Dropped — it creates two parallel feed experiences. The Sale card appearing in the regular feed is the only entry point for that Sale in the feed. Sort is purely by creation date; a newly published Sale appears at the top and sinks as newer listings are added.

### Fix 3: Ad detail page — sale context banner with thumbnail strip

When a buyer taps a sale item and lands on the ad detail page, a banner appears **below price, above description**. This is the primary (and only) moment of discovery for buyers who entered via a sale item in the feed.

**Moving Sale banner:**
```
🏠  Part of Amir's Moving Sale
    Richmond, VIC · 8 items · Sat 12 Jul · from $5     ›
[ 📚 ] [ 🛋️ ] [ 🪑 ] [ 📺 ] [ +4 ]
 dimmed
```

- Banner row: house icon (red circle) + "Part of [First name]'s Moving Sale" + sub-line with suburb, item count, pickup date, lowest price + `›` chevron
- Thumbnail strip: 4 small square thumbs (52×52px, 6px rounded, 4px gap) inside the banner below the text row. First thumb = current item, dimmed/outlined to show "you're here." Remaining thumbs = first 3 other sale items. Last cell = "+N" dark overlay for remaining count.
- Tapping anywhere on the banner (including thumbs) navigates to the Sale page.
- Capitalisation: seller's first name must be title-cased ("Amir's", not "amir's") wherever it appears.

**Bundle banner** (if item also belongs to a bundle):
```
📦  Available as a bundle
    With dining table — save $100 if you take both      ›
[ 🛋️ ] + [ 🪑 ]              $530 together
 dimmed                       vs $630 separately
```

- All bundled items shown (no "+N" — bundles are 2–3 items, show all)
- `+` connector between thumbs makes the set relationship explicit
- Bundle price + "vs X separately" math shown inline — buyer can evaluate without navigating
- Tapping navigates to bundle detail / Sale page

**Sold-item state:** "This item has sold · 12 items still available →" — keeps the buyer pipeline alive.

**Implementation note:** the banner is a distinct tappable element separate from the main ad content, so there is no nested-tap-target ambiguity here (unlike the feed card strip). The `›` chevron is appropriate and clear.

### Feed de-duplication rule

A 20-item Sale should not flood the category feed. Rule: show **max 3 individual sale items from the same Sale** per category page. If more match, show the top 3 by relevance, then an inline link: "…and 17 more in this moving sale →". The Sale card itself (same date-sorted feed, not a separate location-only feed) is the buyer's route to see the rest.

### Decision rationale

**Individual sale items appear in the category feed** (not hidden behind the Sale page wall) because buyers search by category — the chair needs to be findable under "furniture." Each item earns its own impression, and (per the later feed-strip removal decision) looks exactly like a regular listing.

**The Sale card also appears in the main feed** — not a separate location-only feed, the same grid everything else lives in — because buyers who browse broadly (not by category) see the whole sale as a compelling single entry. "18 items from $5, Saturday only" is a much stronger click than a single chair. See "Feed placement" in [`bundle-listing-design.md`](./bundle-listing-design.md) for how this generalises to Bundle cards too.

---

## Entry point analysis — feature visibility

**Current state:** Moving Sale Mode has one entry point — a dismissible banner in the seller's dashboard. This is discovery-after-login only. Sellers who go straight to "Pin Your Flyer" never see it.

### Ranked entry points

| Priority | Surface | Intent level | Device | Status |
|----------|---------|-------------|--------|--------|
| 1 | PostAd page — mode selector at top of form | Highest (seller is in create mode) | Both | New component |
| 2 | "Pin Your Flyer" header button → split/dropdown | High (seller intent confirmed by button click) | Desktop | Modify existing |
| 3 | Bottom nav PIN FAB → long-press sheet | High (same intent, mobile) | Mobile | Modify existing |
| 4 | Dashboard Ads tab — persistent Moving Sale card | Medium (seller is managing, may be planning) | Both | Modify existing |
| 5 | Desktop sidebar — promo block below categories | Low (passive discovery for all visitors) | Desktop | New component |
| 6 | Feed — contextual card every N listings | Lowest (buyer-mode audience) | Both | New component |

### Design for each surface

**1. PostAd mode selector (must-ship with Moving Sale Mode)**

At the very top of `PostAdPage`, before any form fields: a two-tile mode picker — "Single item" (default, current flow) and "Moving Sale" (new). Single item stays exactly as-is. Moving Sale redirects to the Moving Sale setup flow. Labels show "free" on the Moving Sale tile so the price is unambiguous.

Why this is the #1 priority: seller is already in "I want to list something" mode. No additional navigation. Zero regression — default is unchanged.

**2. Header "Pin Your Flyer" split button (desktop)**

Convert to a button group: the left portion keeps `navigate('/post')`, the right portion (chevron) opens a 2-item dropdown: "Single listing" and "Moving Sale". This surfaces the choice to every desktop user who goes to list, without crowding the header.

Implementation: modify `HeaderRightActions.tsx` (or wherever the header CTA lives). The dropdown only needs 2 items — no secondary pages needed.

**3. Bottom nav FAB long-press sheet (mobile)**

Single tap = existing behaviour (navigate to `/post`). Long-press (400ms) = bottom sheet with two 2-up tiles: "Single flyer" and "Moving Sale". The sheet uses the same `framer-motion` bottom sheet pattern as the batch review edit sheet. Zero regression — existing users tap, don't press-hold.

Implementation: add `onLongPress` handler in `BottomNav.tsx`. No new route needed.

**4. Dashboard Ads tab — persistent card**

In `UserDashboard.tsx` (Ads tab), a compact card above the listings grid:

```
🏠 Moving Sale  |  List everything in one page  |  [Start →]
```

This is always visible in the Ads tab. Consider hiding it once the user has an active sale event (no point showing it if they already have one running).

**5. Desktop sidebar promo block**

In `DesktopSidebar.tsx`, below the category list: a small card with a coloured header ("Moving soon?"), a one-sentence pitch, and a CTA button. Static component, no query. Hide for logged-in users who already have an active `saleEvent`.

**6. Feed contextual card (lowest priority, ship later)**

Between every ~8 listings in the feed grid, an amber card: "Moving soon? List everything in one sale — one page, one Saturday." Non-interactive beyond a single CTA. Can be added to `AdsGrid.tsx` as a positional inject after every Nth card.

### Smart behavioural triggers

These show the entry point contextually when signals suggest the user may be moving — reduces noise for non-movers:

| Signal | Trigger | Where shown |
|--------|---------|-------------|
| 3+ listings posted in 7 days | Count query on user's recent ads | Dashboard nudge card |
| 3+ different categories listed in same session | Track categories in PostAd local state | In-form "sounds like you're moving?" suggestion |
| Listing title contains "moving / relocating / must sell / leaving / downsizing" | Client-side regex on title field | Inline suggestion in PostAd |
| Visits dashboard then navigates to /post within 2 min | sessionStorage nav tracking | Very soft in-form hint |

The 3-in-7-days signal is the strongest. All triggers show a dismissible card that writes "dismissed" to localStorage (never show again after explicit dismiss).

### Implementation sequence

1. **Ship Moving Sale Mode core** with the PostAd mode selector (entry point #1) — highest coverage, zero regression, ships same PR.
2. **Add header split button** (desktop, entry point #2) in a follow-up PR.
3. **Add FAB long-press** (mobile, entry point #3) in the same follow-up PR.
4. **Dashboard card** (entry point #4) — trivial, can be the dashboard banner replacement.
5. **Sidebar + feed cards** — defer until user data shows where movers are entering.

---

## Log

- 2026-06-28 — Deep research session (103 agents, 21 sources, 25 claims verified). Confirmed product gap. Competitive gap table finalised.
- 2026-06-28 — User journey designed (7 steps, time budget model).
- 2026-06-28 — Buyer sale page designed: named hero, live countdown, stats strip, bundles-first layout, sold-items-stay rule, suburb-level map, single CTA.
- 2026-06-28 — Batch review mobile UI designed: 3-tier confidence model, time budget (6.5 min for 18 items), 8 design decisions documented.
- 2026-06-28 — QR code integration designed: share screen placement, client-side QR generation, server-side PDF via Convex action, slug permanence rule.
- 2026-06-28 — Free vs $9 tier designed (v1): gate-on-distribution principle, 10-item cap rationale, conversion funnel, 5 anti-patterns documented.
- 2026-06-30 — Tier model revised (v2): Moving Sale Mode is now fully free including public URL. Paid add-ons are AI bulk listing (API cost), QR + PDF flyer, and 7-day search pin. Item cap removed. Rationale: transparent pricing ("AI costs API money"), lower entry barrier grows supply, upgrade prompts land on satisfied users not prospects. See "Free vs paid tier design" section for full reasoning.
- 2026-06-30 — Ad detail banner redesigned: add thumbnail strip inside banner (current item dimmed first, 3 other item thumbs, "+N" last cell); fix banner copy to include pickup date and "from $X" lowest price; title-case seller name ("Amir's" not "amir's").
- 2026-06-30 — Individual sale items in feed: strip and badge removed entirely. Sale items look identical to regular listings in the feed. Rationale: "In a moving sale ›" strip created nested-tap-target confusion — chevron read as primary CTA. Discovery of sale context now happens exclusively on the ad detail page banner, where the buyer is already interested and receptive.
- 2026-06-30 — Sale card thumbnail degradation ladder: 4+ photos → 2×2 grid (+N overlay on cell 4); 3 photos → 2×2 grid with muted placeholder on cell 4 (keeps grid consistent); 2 photos → 2 vertical strips; 1 photo → single image; 0 photos → house icon placeholder. Single photoCount switch in AdsGrid.tsx image slot — card shell unchanged.
- 2026-06-30 — Feed model finalised: no separate section. Sale cards live in the same date-sorted grid as single listings. Thumbnail is the only visual differentiator — 2×2 image grid with "+N" overlay. Dropped the "Sale event card pinned in suburb feed" concept — one feed, one card per Sale. Card shell (aspect-[4/3], title, location, price, footer) identical to existing ad cards in AdsGrid.tsx.
- 2026-06-30 — Sale-level messaging model designed: one thread per buyer per Sale (keyed on saleEventId+buyerId), items referenced as chips inside messages. Schema: add saleEventId (optional) to chats, add referencedAdIds (optional) to messages, new index by_sale_event_buyer. No migration for existing chats.
- 2026-06-30 — Terminology settled: Sale (event), sale item (individual ad), single listing (non-sale ad), Sale card (feed variant).
- 2026-06-30 — Entry point analysis: mapped all 6 FlyerBoard UI surfaces, ranked by seller intent. Priority 1–3 are must-ship (PostAd mode selector, header split button, FAB long-press). Priority 4 replaces the dashboard banner. Priority 5–6 deferred. 4 smart behavioural triggers documented (3-in-7-days signal is strongest). Implementation sequence added.
- 2026-06-30 — Bundle Listing scoped as a related-but-separate feature (2–3 items, no sale page/QR/AI, reused by Moving Sale step 5 for in-sale bundle suggestions). Full design — creation flow, item cap, mutual exclusivity, sold states — moved to [`bundle-listing-design.md`](./bundle-listing-design.md) on 2026-07-02 once it grew into its own implementation effort.
- 2026-07-02 — **Shipped, merged.** Feature is live. Doc retained as the design record; Bundle Listing split into its own file (see above).
