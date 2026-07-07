#!/usr/bin/env node
// Readability audit for FlyerBoard blog posts.
// Flags what hurts comprehension for younger / non-native readers:
// low reading ease, long sentences, passive voice, and complex/jargon words.
//
// Usage: node audit-readability.mjs src/content/blog/<slug>.md
// Exits 0 always (advisory); prints a report to stdout.

import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node audit-readability.mjs <path-to-post.md>");
  process.exit(2);
}

let raw;
try {
  raw = readFileSync(file, "utf8");
} catch (e) {
  console.error(`Cannot read ${file}: ${e.message}`);
  process.exit(2);
}

// --- Strip frontmatter and markdown chrome so we score the prose only ---
let body = raw.replace(/^---\n[\s\S]*?\n---\n/, "");
body = body
  .replace(/```[\s\S]*?```/g, " ") // code fences
  .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
  .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links -> text
  .replace(/^#{1,6}\s+/gm, "") // heading markers
  .replace(/[*_`>#|]/g, " ") // md punctuation
  .replace(/\r/g, "");

// Treat each line/list-item as its own unit (a bullet isn't part of the prior
// sentence), then split each unit on sentence-ending punctuation.
const sentences = body
  .split(/\n+/)
  .flatMap((line) =>
    line
      .replace(/^\s*[-*]\s+/, "") // drop bullet markers
      .split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/),
  )
  .map((s) => s.trim())
  .filter((s) => s.split(/\s+/).filter(Boolean).length >= 3);

const words = body.split(/\s+/).filter((w) => /[a-zA-Z]/.test(w));

function syllables(word) {
  word = word.toLowerCase().replace(/[^a-z]/g, "");
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const m = word.match(/[aeiouy]{1,2}/g);
  return m ? m.length : 1;
}

const wordCount = words.length;
const sentCount = sentences.length || 1;
const syllCount = words.reduce((n, w) => n + syllables(w), 0);

// Flesch Reading Ease + Flesch–Kincaid Grade
const readingEase =
  206.835 - 1.015 * (wordCount / sentCount) - 84.6 * (syllCount / wordCount);
const grade =
  0.39 * (wordCount / sentCount) + 11.8 * (syllCount / wordCount) - 15.59;

// --- Long sentences ---
const LONG = 25;
const longSentences = sentences
  .map((s) => ({ s, n: s.split(/\s+/).filter(Boolean).length }))
  .filter((x) => x.n > LONG)
  .sort((a, b) => b.n - a.n);

// --- Passive voice (heuristic) ---
const passiveRe =
  /\b(is|are|was|were|be|been|being|get|got)\s+(\w+ed|\w+en|done|made|sent|held|paid|given|taken|seen|known|shown|built)\b/gi;
const passiveHits = [];
for (const s of sentences) {
  const m = s.match(passiveRe);
  if (m) passiveHits.push({ s, m });
}

// --- Complex / jargon words with plainer swaps ---
const SWAPS = {
  utilize: "use",
  utilise: "use",
  leverage: "use",
  purchase: "buy",
  commence: "start",
  initiate: "start",
  approximately: "about",
  facilitate: "help",
  numerous: "many",
  additional: "more",
  endeavour: "try",
  endeavor: "try",
  regarding: "about",
  obtain: "get",
  require: "need",
  sufficient: "enough",
  demonstrate: "show",
  subsequently: "then",
  prior: "before",
  seamless: "smooth",
  "in order to": "to",
};
const lowerBody = ` ${body.toLowerCase()} `;
const swapHits = Object.entries(SWAPS).filter(([w]) =>
  new RegExp(`\\b${w.replace(/ /g, "\\s+")}\\b`).test(lowerBody),
);

// --- Report ---
const pass = readingEase >= 60;
const bar = (label, ok) => `${ok ? "✅" : "⚠️ "} ${label}`;

console.log(`\n📖 Readability audit — ${file}\n`);
console.log(`Words: ${wordCount}   Sentences: ${sentCount}   Avg sentence: ${(wordCount / sentCount).toFixed(1)} words`);
console.log(
  bar(
    `Flesch Reading Ease: ${readingEase.toFixed(0)} (target ≥ 60, plain English)`,
    pass,
  ),
);
console.log(
  bar(
    `Approx. grade level: ${Math.max(1, grade).toFixed(1)} (target 6–8)`,
    grade <= 9,
  ),
);

if (wordCount < 800 || wordCount > 1500) {
  console.log(`⚠️  Word count ${wordCount} is outside the 800–1,500 house range.`);
}

console.log(`\n${bar(`Long sentences (> ${LONG} words): ${longSentences.length}`, longSentences.length === 0)}`);
longSentences.slice(0, 5).forEach((x) =>
  console.log(`   • [${x.n}w] ${x.s.slice(0, 100)}${x.s.length > 100 ? "…" : ""}`),
);

console.log(`\n${bar(`Possible passive voice: ${passiveHits.length}`, passiveHits.length <= 3)}`);
passiveHits.slice(0, 5).forEach((x) =>
  console.log(`   • "${x.m[0]}" — ${x.s.slice(0, 80)}${x.s.length > 80 ? "…" : ""}`),
);

console.log(`\n${bar(`Complex/jargon words: ${swapHits.length}`, swapHits.length === 0)}`);
swapHits.forEach(([w, better]) => console.log(`   • "${w}" → try "${better}"`));

console.log(
  `\n${pass ? "✅ Reads at plain-English level." : "⚠️  Simplify: shorten sentences and swap complex words, then re-run."}\n`,
);
