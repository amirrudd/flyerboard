/**
 * The feed's sections — the ONLY thing extraction is allowed to tell the
 * display layer about how it grouped a page (rule 5, `.agent/PRODUCT-RULES.md`).
 *
 * A section is a NAME. Never a distance, a match score, or a match reason: the
 * moment a number crosses this boundary the UI renders it, sorts on it or
 * badges it, and extraction can never change shape again. If a distance is ever
 * shown, display derives it from data already on the card.
 *
 * The list is ORDERED, and that order is the render order. Display walks this
 * array and draws whatever arrives under each name without knowing what the
 * names mean, so adding, renaming or merging a section is a change to this file
 * plus the code that assigns them — never a change to a component.
 *
 * Leaf module on purpose: imported by both `convex/` and `src/`, so it must
 * pull in no server code.
 */
export const FEED_SECTIONS = ["near", "far"] as const;

export type FeedSection = (typeof FEED_SECTIONS)[number];

/**
 * Where an entry sorts, and which group renders it. An entry with no section
 * (no location set — the field is genuinely absent then) belongs to the first
 * one, which is what keeps the unfiltered feed a single continuous run.
 */
export const sectionRank = (section?: FeedSection): number =>
  FEED_SECTIONS.indexOf(section ?? FEED_SECTIONS[0]);
