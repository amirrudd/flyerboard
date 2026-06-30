# FlyerBoard Blog — Content Guideline

> **Audience:** anyone (human or AI agent) writing a FlyerBoard blog post.
> **Goal:** every post should rank in classic search **and** be easy for AI
> assistants (ChatGPT, Google AI Overviews, Perplexity, Copilot) to extract and
> cite. We optimise for **SEO + GEO** (Generative Engine Optimization) at once.
>
> This guideline is the contract the blog tooling depends on. The frontmatter
> schema below is parsed by [`src/lib/blog.ts`](../../src/lib/blog.ts) — keep
> them in sync.

---

## TL;DR (the rules in 30 seconds)

- **Length: 800–1,500 words.** Aim for ~1,200. Never pad. "Not too long" is a
  feature, not a compromise — see the research below.
- **Open with a 2–4 sentence answer block** (a TL;DR / direct answer) right under
  the H1. AI engines lift this verbatim; humans skim it.
- **Structure for extraction:** short sections, descriptive `##` headings phrased
  as questions or clear statements, bullet lists, one table where it helps, and a
  short **FAQ** at the end.
- **One post = one search intent.** Pick a primary keyword/question and answer it
  completely. Don't blend three topics.
- **Be the source.** Concrete numbers, steps, local (Australian) specifics, and
  first-hand FlyerBoard knowledge. Original facts get cited; generic filler does not.
- **Every post needs complete frontmatter** (see schema). Title ≤ 60 chars,
  description 120–160 chars.

---

## Why this length (the research)

The 2025–2026 consensus across SEO sources:

- General SEO "sweet spot" is **1,000–2,500 words**, but length is a *proxy* for
  completeness, not a ranking factor on its own. Google rewards content that
  satisfies intent clearly — not word count.
  ([Yoast](https://yoast.com/blog-post-word-count-seo/),
  [Writesonic](https://writesonic.com/blog/how-long-should-a-blog-post-be))
- **List/how-to posts perform best at ~1,000–1,800 words.** Most FlyerBoard posts
  are practical how-tos and lists, so we sit at the lower-mid of that band.
- **AI Overviews changed the maths.** AI answers now lift a *concise passage* and
  show it at the top of results — users often get what they need from one block,
  not the full article. This *reduces* the payoff of long-form padding and
  *increases* the payoff of a tight, well-structured answer near the top.
- The user constraint for this blog is explicit: **keep posts short.** So our
  house target is **800–1,500 words**, front-loaded, with the answer up top.

**Translation:** write the shortest post that fully answers the question. If you
can answer it well in 900 words, do — don't inflate it to hit a number.

## Why structure matters for AI discoverability (GEO)

GEO is optimising so LLMs *select and cite* your content inside their answers
([tryProfound](https://www.tryprofound.com/resources/articles/generative-engine-optimization-geo-guide-2025),
[O8](https://www.o8.agency/blog/ai/generative-engine-optimization)). What moves the needle:

- **Answer-ready blocks.** Self-contained, quotable chunks (the TL;DR, a definition,
  a numbered list, a table row). LLMs extract passages, not whole pages.
- **Clear structure & semantic HTML.** Descriptive headings, lists, tables, and a
  logical hierarchy make extraction reliable. Our markdown renderer already maps
  to proper `<h2>/<ul>/<table>` elements.
- **Entity clarity + schema.** Each post emits `BlogPosting` JSON-LD (author,
  date, headline, description, keywords) so engines know exactly what it is. The
  blog index emits `Blog` + `ItemList` schema, and `/llms.txt` lists every post
  for agent crawlers. (All handled by the tooling — you just fill frontmatter.)
- **Freshness.** Content updated within ~30 days earns materially more AI
  citations. Revisit evergreen posts and bump `updated` when you refresh them.
- **GEO sits on top of SEO, not instead of it.** ~90%+ of AI-cited pages also rank
  in the organic top 10. Do the SEO basics and the GEO wins follow.

---

## Post structure (use this skeleton)

```
# H1 — the post title (matches frontmatter `title`, one per post)

**[Answer block]** 2–4 sentences that directly answer the post's core
question. Mention FlyerBoard once, naturally. This is what AI lifts.

## A scannable H2 phrased as the question a reader would ask
2–4 short paragraphs or a list. Lead with the takeaway, then explain.

## Another H2 — keep sections focused and self-contained
- Bullets for steps, checklists, options
- One markdown table when comparing things (renders as a styled card)

## Frequently asked questions
**Q: A real question people ask?**
A one–three sentence answer.  ← these become quotable Q&A pairs for AI

---
*Soft call to action: invite the reader to post/browse/run a sale on FlyerBoard.*
```

Rules of thumb:
- **H1 once**, then only `##` and `###`. The renderer shifts headings, so author
  with normal markdown `#`/`##`/`###`.
- Sentences short. Paragraphs ≤ 4 lines. White space is free.
- Put the most important sentence **first** in each section.
- Link out to 1–2 authoritative sources where it adds trust (e.g. Scamwatch).
- Include at least one **list** and one **FAQ**; add a **table** if it fits.

---

## Frontmatter schema (required on every post)

Posts live in `src/content/blog/<slug>.md` and **must** begin with a YAML
frontmatter block. The loader parses simple `key: value` pairs and `key: [a, b]`
arrays — keep it flat (no nested objects), values may be quoted.

```markdown
---
title: "How to Spot a Marketplace Scam in Australia"
description: "A practical 7-point checklist for spotting and avoiding scams when buying secondhand online in Australia."
slug: spot-marketplace-scams-australia
date: 2026-06-30
updated: 2026-06-30
author: FlyerBoard Team
category: Safety
keywords: [marketplace scams, online safety, buying secondhand, Australia, Scamwatch]
readingTime: 5
---
```

| Field         | Required | Rules |
|---------------|----------|-------|
| `title`       | yes | ≤ 60 chars ideally. The H1 + `<title>` + `og:title`. |
| `description` | yes | 120–160 chars. Meta description + `og:description`. A real summary, not a teaser. |
| `slug`        | yes | kebab-case, must equal the filename (`<slug>.md`). Becomes `/blog/<slug>`. |
| `date`        | yes | `YYYY-MM-DD`. Original publish date. Drives newest-first ordering. |
| `updated`     | no  | `YYYY-MM-DD`. Bump when you meaningfully revise (freshness signal). |
| `author`      | yes | Display name, e.g. `FlyerBoard Team`. |
| `category`    | yes | One of: `Safety`, `Selling`, `Buying`, `Guides`, `Community`. |
| `keywords`    | yes | 3–6 terms. Drives JSON-LD `keywords` + `/llms.txt`. |
| `readingTime` | no  | Minutes (integer). If omitted, it's estimated at ~225 wpm. |

> The body **must not** repeat the frontmatter title as a second H1 — start the
> markdown body with the `#` H1 once (it can match `title`) followed by the
> answer block.

---

## Voice & topic fit

- **Audience:** everyday Australians buying and selling locally. Plain, warm,
  practical. No jargon, no hype.
- **Brand frame:** FlyerBoard is the *safer, local, community* marketplace. Lean
  into safety, sustainability (reuse), and local connection.
- **Good topic shapes:** "How to …", "X tips for …", "What to know before …",
  checklists, and decision guides. These match how people *and* AI assistants
  phrase queries.
- **Always Australian-specific** where relevant (currency, Scamwatch, local
  norms, seasons) — local specificity is a differentiator AI engines reward.
- **One clear next action** at the end (post an ad, browse, run a Moving Sale).

## Pre-publish checklist

- [ ] One search intent, fully answered.
- [ ] 800–1,500 words; nothing padded.
- [ ] Answer block directly under the H1.
- [ ] Descriptive `##` headings; short sections; ≥1 list; FAQ present.
- [ ] Complete, valid frontmatter; `slug` matches filename; title ≤ 60 / desc 120–160.
- [ ] 1–2 authoritative outbound links where useful.
- [ ] Clear, single call to action at the end.
- [ ] `npm run lint` passes (the post is bundled at build time).

---

### Sources

- [Yoast — Word count and SEO](https://yoast.com/blog-post-word-count-seo/)
- [Writesonic — How long should a blog post be (2025)](https://writesonic.com/blog/how-long-should-a-blog-post-be)
- [Bluehost — Ideal blog post length](https://www.bluehost.com/blog/ideal-blog-post-length/)
- [tryProfound — GEO framework 2025](https://www.tryprofound.com/resources/articles/generative-engine-optimization-geo-guide-2025)
- [O8 — Generative Engine Optimization](https://www.o8.agency/blog/ai/generative-engine-optimization)
- [Samyak — Guide to AI SEO / LLM SEO / GEO](https://www.samyakonline.net/blog/definitive-guide-ai-seo-llm-seo-geo/)
