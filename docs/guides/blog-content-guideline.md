# FlyerBoard Blog — Content Contract

> **Audience:** anyone (human or AI agent) writing a FlyerBoard blog post.
> **Scope of this file:** the *technical* contract the blog tooling depends on — the
> frontmatter schema parsed by [`src/lib/blog.ts`](../../src/lib/blog.ts), the body
> structure the renderer and the FAQ extractor rely on, and the cover-asset spec.
> **Editorial rules** (voice, length, topic fit, SEO/GEO reasoning) live in the product
> vault: `~/flyerboard-vault/Growth/Content & blog guideline.md`. The vault wins on
> editorial questions; this file wins on anything the parser depends on.

---

## Post structure (use this skeleton)

```
# H1 — the post title (matches frontmatter `title`, one per post)

**[Answer block]** 2–4 sentences that directly answer the post's core
question. This is what AI engines lift.

## A scannable H2 phrased as the question a reader would ask
2–4 short paragraphs or a list.

## Another H2 — keep sections focused and self-contained
- Bullets for steps, checklists, options
- One markdown table when comparing things (renders as a styled card)

## Frequently asked questions
**Q: A real question people ask?**
A one–three sentence answer.  ← these become quotable Q&A pairs for AI

> **Keep this exact format.** `blog.ts`'s `extractFaqs()` parses `**Q: …?**` lines
> (an optional leading `A:` on the answer is fine) to emit `FAQPage` JSON-LD on
> every post. Change the marker and you silently lose the FAQ rich-result schema.

---
*Soft call to action.*
```

Parser-dependent rules:
- **H1 once**, then only `##` and `###`. The renderer shifts headings, so author
  with normal markdown `#`/`##`/`###`.
- The body **must not** repeat the frontmatter title as a second H1 — start the
  markdown body with the `#` H1 once (it can match `title`) followed by the
  answer block.
- The FAQ section must use the `**Q: …?**` marker exactly as above.

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
heroImage: /blog-covers/spot-marketplace-scams-australia.svg
heroAlt: Editorial illustration of a safety shield
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
| `heroImage`   | no  | Path (under `/public`, e.g. `/blog-covers/<slug>.svg`) or absolute URL of the cover image, shown at the top of the post and on the index card. Omit for a text-only card. Use a 16:9 asset. |
| `heroAlt`     | no  | Alt text for `heroImage`. Falls back to the title. Describe the image plainly; **no emojis**. |

### Cover images

`heroImage` is optional but recommended. House covers are **minimalist editorial
SVGs** in `public/blog-covers/<slug>.svg`: a warm-bone canvas (`#F7F6F3`), one
muted-pastel offset shape, and a single bold charcoal line-art motif — no
gradients, no stock-photo clutter, no emojis. Match the file's `<slug>` to the
post. You can also drop in a real 16:9 photo (desaturated, warm-toned) by
pointing `heroImage` at any `/public` path or absolute URL. Note: SVG/relative
hero images render on-page and in JSON-LD, but social `og:image` stays the raster
site default — supply a raster cover if you need a custom social preview.

---

## What the tooling emits (so you know what the frontmatter feeds)

- Each post: `BlogPosting` JSON-LD (author, date, headline, description, keywords)
  plus `FAQPage` JSON-LD from the FAQ section.
- Blog index: `Blog` + `ItemList` schema; `/llms.txt` lists every post for agent crawlers.
- Posts are bundled at build time; `npm run lint` validates them.

## Pre-publish checklist (technical)

- [ ] Complete, valid frontmatter; `slug` matches filename; title ≤ 60 / desc 120–160.
- [ ] One H1; `##`/`###` only below it; FAQ uses the `**Q: …?**` marker.
- [ ] Cover asset matches the slug (or `heroImage` omitted deliberately).
- [ ] `npm run lint` passes (the post is bundled at build time).
- [ ] Editorial checklist in the vault guide is done.
