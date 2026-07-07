---
name: blog-writer
description: Write FlyerBoard blog posts with a consistent voice, plain-language readability guardrails, and topics chosen to grow SEO + GEO discoverability. Use whenever asked to write, draft, plan, or improve a blog post, pick blog topics, or add a post under src/content/blog/.
---

# Blog Writer (FlyerBoard)

This skill turns a topic idea into a publish-ready post in `src/content/blog/<slug>.md`.
It is the **process**; the **contract** (frontmatter schema, length, structure, JSON-LD)
lives in [`docs/guides/blog-content-guideline.md`](../../../docs/guides/blog-content-guideline.md).

> **Always read the guideline first** — the loader in `src/lib/blog.ts` parses the
> frontmatter it defines. If this skill and the guideline ever disagree, the
> guideline wins. This skill adds voice, readability, and topic-selection on top.

---

## The job in one line

Write the **shortest post that fully answers one real question**, in words a
14-year-old and a non-native English speaker both understand, structured so both
Google and AI assistants can lift the answer verbatim — and end with one clear
FlyerBoard action.

---

## Voice — the FlyerBoard house style

FlyerBoard is the *safer, local, community* marketplace for everyday Australians
buying and selling secondhand. Every post sounds like a knowledgeable neighbour,
not a brand.

**Do:**
- Warm, plain, practical. Second person ("you"), active voice.
- Lead with the takeaway, then explain. Answer the question before the backstory.
- Concrete and Australian: dollars, seasons, Scamwatch, local norms, real examples.
- Honest and useful. Earn the click; never bait it.
- Mention FlyerBoard **once or twice, naturally** — usually the answer block and
  the closing action. It's a helpful aside, not an ad.

**Don't:**
- Hype, superlatives, or fake urgency ("game-changing", "you won't believe").
- Jargon, buzzwords, or corporate voice ("leverage", "utilize", "seamless").
- Emojis in the body, ALL CAPS, or exclamation-mark spam.
- Three topics in one post. One post = one search intent.
- Padding to hit a word count. If 900 words answers it, stop at 900.

---

## Readability guardrails (fit for all ages & language levels)

The audience includes teenagers, retirees, and people whose first language isn't
English. Write so **anyone** gets the answer on the first read. Target a **Grade
6–8** reading level (Flesch Reading Ease ≥ 60).

Hard rules:
- **Short sentences.** Aim ~15 words; hard cap ~25. One idea per sentence.
- **Short paragraphs.** ≤ 4 lines. White space is free.
- **Simple words over clever ones.** Prefer the everyday word:

  | Instead of | Write |
  |---|---|
  | utilize / leverage | use |
  | purchase | buy |
  | commence / initiate | start |
  | approximately | about |
  | in order to | to |
  | facilitate | help |
  | numerous | many |
  | prior to | before |
  | additional | more / extra |
  | endeavour | try |

- **Active voice.** "The buyer pays a deposit," not "A deposit is paid by the buyer."
- **Explain any unavoidable term** in the same sentence ("escrow — money held safely
  until both sides are happy").
- **No idioms or slang that don't translate** ("ballpark figure", "piece of cake").
  A non-native reader shouldn't have to guess.
- **Numbers as digits** (7, not seven) — faster to scan and to extract.

Run the readability audit before finishing (see Scripts). It flags long sentences,
complex words, and passive voice so you can plain-language the draft.

---

## Structure for extraction (SEO + GEO)

Both Google's AI Overviews and assistants like ChatGPT/Perplexity lift a *self-
contained passage*, not the whole page. Structure so the answer is liftable:

1. **H1** = the title (once).
2. **Answer block** — 2–4 sentences directly under the H1 that fully answer the
   core question. This is what AI quotes; write it to stand alone.
3. **Descriptive `##` headings phrased as the question a reader would type**
   ("How much does a moving sale make?"). Each section leads with its takeaway.
4. **At least one list** (steps/checklist) and, where it compares things, **one table**.
5. **A short FAQ** at the end — real questions, 1–3 sentence answers. These become
   quotable Q&A pairs.
6. **One closing call to action** — post an ad, browse, run a Moving Sale, list a Bundle.

Length: **800–1,500 words**, ~1,200 ideal. Front-load everything.

---

## Finding the right topic (discoverability)

A good topic sits where three circles overlap: **people search for it**,
**FlyerBoard can answer it credibly**, and **it points to a FlyerBoard action**.

Pick topics that are:
- **A real question in the user's words.** "How do I avoid scams on Marketplace?"
  beats "Marketplace safety considerations." Match how people *and* AI phrase queries.
- **How-to / checklist / decision-guide shaped.** These formats win for practical
  intent and are easy for AI to extract. Titles like "How to…", "X tips for…",
  "What to know before…".
- **Australian-specific** where possible — local detail is a differentiator AI rewards.
- **Tied to a FlyerBoard strength or feature** so the closing action is honest:
  safety, reuse/sustainability, local connection, Moving Sale Mode, Bundle Listings,
  writing better ads, pricing secondhand.
- **Evergreen**, not news. It should still be true and searched next year (then bump
  `updated` when you refresh it — freshness lifts AI citations).

Topic buckets that map to the `category` field: **Safety** (scams, safe meetups,
payment red flags), **Selling** (pricing, photos, moving/garage sales, bundles,
writing ads), **Buying** (spotting good deals, inspecting secondhand, negotiating),
**Guides** (how features work, secondhand know-how), **Community** (local reuse,
sustainability, stories).

Avoid: topics already covered (check existing files in `src/content/blog/` first —
don't cannibalise), anything you can't answer with first-hand detail, and anything
that can't end in a natural FlyerBoard action.

---

## Workflow

1. **Read the guideline** — `docs/guides/blog-content-guideline.md`.
2. **List existing posts** — `ls src/content/blog/` — so you don't repeat a topic
   or split ranking signals across two posts on one intent.
3. **Lock one search intent** and the primary question. Draft the answer block first;
   if you can't answer it in 2–4 sentences, the topic is too broad.
4. **Outline the `##` headings** as questions. One idea each.
5. **Draft** in the house voice, obeying the readability guardrails as you go.
6. **Add** ≥1 list, an optional table, and a 2–4 item FAQ. Add 1–2 authoritative
   outbound links (e.g. [Scamwatch](https://www.scamwatch.gov.au/)) where they add trust.
7. **Write the frontmatter** per the schema. `slug` **must equal** the filename;
   title ≤ 60 chars; description a real 120–160 char summary.
8. **Audit readability** — run the script; simplify anything it flags.
9. **Run the pre-publish checklist** (below), then `npm run lint` (posts are bundled
   at build time — a broken post fails the build).

---

## Pre-publish checklist

- [ ] One search intent, fully answered; not a duplicate of an existing post.
- [ ] Answer block directly under the H1, quotable on its own.
- [ ] 800–1,500 words, nothing padded.
- [ ] Grade 6–8 reading level; readability audit clean (short sentences, simple words, active voice).
- [ ] Descriptive `##` headings; short sections; ≥1 list; FAQ present.
- [ ] Complete, valid frontmatter; `slug` matches filename; title ≤ 60 / desc 120–160.
- [ ] 1–2 authoritative outbound links where useful.
- [ ] Exactly one clear FlyerBoard call to action at the end.
- [ ] `npm run lint` passes.

---

## Scripts

### `audit-readability.mjs`
Scores a draft for reading ease and flags the sentences and words that hurt
comprehension for younger or non-native readers.

**Command:**
```bash
node ./.agent/skills/blog-writer/scripts/audit-readability.mjs src/content/blog/<slug>.md
```

It reports: Flesch Reading Ease + approximate grade level, sentences over ~25 words,
likely passive-voice constructions, and complex/jargon words with plainer swaps.
Treat every flag as "can I say this more simply?" — not every flag must be silenced,
but the overall score should land at Grade 6–8 (Reading Ease ≥ 60).

## Tips

- Write the answer block and the FAQ first — they force clarity and give you the spine.
- Read the draft aloud. If you run out of breath, the sentence is too long.
- One table max, and only when comparing things; the renderer styles it as a card.
- Bump `updated` whenever you meaningfully revise an evergreen post.
