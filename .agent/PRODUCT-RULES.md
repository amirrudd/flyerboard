# FlyerBoard — Product Rules

**Last ratified:** 2026-08-15 by Amir (founder, sole decision-maker)

The whole product in five rules. Read this before planning any user-facing change.

**If a change contradicts one of these, stop and raise it. Do not design around it.**
These rules change only when Amir changes them. No agent may reinterpret, soften, or
resolve a conflict on its own — report it and wait.

---

## 1. It's a marketplace. Ads are the unit.

Everything a user posts is an ad. Normal ads, Bundles, and Moving Sales are all just
ads, or aggregations of normal ads, with a different card shape.

**An aggregation inherits from its members.** A Bundle or Moving Sale has whatever its
member ads have — if any member is in a category, the card is in that category; if a
member matches a search, the card matches; its location is its members' location. So a
bundle containing a desk shows up under Furniture, and searching "desk" finds it.
Anything true of a member is true of the card that contains it.

This is why composites need no separate category, location, or search data of their
own. When one seems to, the answer is to derive it from the members — not to give the
card its own copy that can drift.

**Violated by:** any code path that treats a Bundle or Moving Sale card as a separate
kind of object with its own rules, rather than as an ad-shaped thing that happens to
render differently.

## 2. Newest on top, within whatever is being shown.

New ads push older ones down. That is the core mechanic of the product.

`bumpedAt` descending is the only thing that ever **orders** ads. Never add a sort
control. Never order by relevance, price, popularity, or any score.

**Ordering vs grouping.** Location may split the feed into groups (rule 5). That is
grouping, not ordering — inside every group, newest is still on top. Distance decides
which group an ad is in; it never decides the order within one.

**Violated by:** a "sort by" dropdown; ranking search results by relevance; sorting ads
by how far away they are; any ML/scoring re-rank.

**Not violated by:** the in-area / out-of-area split in rule 5.

## 3. Visibility is the product we sell.

Because newest wins, being seen fades over time. Paying to make an ad **new again**
("Boost") is the monetisation. **Not yet built.**

**Boost is a refresh, not a pin.** It re-stamps the ad's `bumpedAt` to now, so rule 2
carries it to the top on its own. It then sinks again as other ads arrive — ten new
posts and it is ten places down. Nothing is stuck anywhere, and there is no pinned
state to render, expire, or special-case. That decay is the product: it is what makes
Boost worth buying more than once.

Never build anything that hands out paid-equivalent visibility for free, and never make
Boost's promise conditional or hard to say in one sentence. The sentence is: **"your ad
becomes new again."**

**Violated by:** any free mechanism that lifts an ad back up; sticky placement that
survives newer ads; a "pinned" or "featured" slot outside the `bumpedAt` ordering;
user-facing copy that promises an ad will *stay* at the top.

**Not violated by:** a boosted ad appearing at the top of each group in rule 5 — that
is just rule 2 applied per group, and the promise holds unchanged in every one.

## 4. Filters make a subset. They never change the rule.

Search and location narrow **which** ads are shown. Within whatever is left: newest on
top, regardless of ad type.

All three ad types — normal, Bundle, Moving Sale — are always eligible for every
filter. There is no filter that some ad types are exempt from, and none they are
excluded from.

**Violated by:** excluding composites from search; skipping the location filter for
composites; any "this card type doesn't participate in that filter" carve-out.

## 5. Location groups. It doesn't hide.

Location is a **preference**, not a requirement.

**No location set — the default when someone opens the app:**
One list. Newest ads, nothing else.

**Location set — chosen by the user, or detected from their device:**
Two groups, in this order:

1. Ads in the area — newest on top
2. Ads outside the area — newest on top

Out-of-area ads go **below**. They never disappear. A user who picks a suburb with
nothing in it must never see an empty screen.

**Why:** a location filter that hides everything else leaves the user with nothing,
which makes choosing a location pointless. Showing their area first and then widening
is what keeps them scrolling — the same thing Facebook Marketplace does.

**Search and category are different: they are requirements.** If you search "sofa" you
get sofas, not hammers. Location groups within that result; it never widens the result
back out to things the user didn't ask for.

**Violated by:** a hard location filter that returns an empty feed; hiding out-of-area
ads entirely; putting an out-of-area ad above an in-area one; showing non-matching
items to pad a search.

---

## How to read these

**Read for intent, and use sensible judgement.** These rules describe what the product
is for a person using it. They are not a legal text to be parsed for loopholes or
collisions.

- A contradiction is a **real conflict of intent** — something that would make the
  product worse for a user, or harder to explain. Two rules whose *wording* brushes
  against each other is not a contradiction; work out what both are protecting and say
  whether the change protects it.
- Ask "would a user be worse off?" before reporting. If the answer is no, and no rule's
  purpose is defeated, there is no finding.
- Genuine ambiguity is still worth raising — but raise the *decision*, not the wording
  clash. "Should X be allowed?" beats "rule 2 says never and rule 5 says sometimes."

## Accepted exceptions

Rule violations Amir has knowingly accepted, with the condition that ends them. The
guardian should note these as accepted rather than reporting them as findings.

**Keep this list near-empty.** An exception with no removal condition is just a rule
being repealed quietly.

*None currently.* (The rule 5 hard-location-filter exception, accepted 2026-08-15 and
widened 2026-08-22, ended when grouping shipped: every surface now tiers out-of-area
results below a divider instead of hiding them.)

## Notes

- Rules 1–5 describe what the app already is.
- "Documented decision" in a code comment is not automatically a product decision.
  Several existing comments describe behaviour that was inherited from a data
  limitation and later labelled as a choice. Check against these rules, not against
  comments.
- When a rule and an implementation disagree, the rule wins and the implementation is
  the bug — unless Amir says otherwise, in that session, explicitly.
