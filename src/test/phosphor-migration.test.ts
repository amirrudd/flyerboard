import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Regression guards for the lucide-react → @phosphor-icons/react migration.
 *
 * The migration was a token-level find-replace, which produced two classes of
 * bug that the test suite did NOT catch at the time:
 *
 *   1. Icon names bled into user-facing strings — e.g. a "Send" button that
 *      rendered the literal text "PaperPlane", aria-labels reading
 *      "Funnel reports by status", a filter label reading "Funnel".
 *   2. `<Heart fill="none">` — valid on Lucide (outline icon), but Phosphor
 *      icons are filled paths with no stroke, so `fill="none"` renders nothing.
 *      The save heart and the unselected rating stars became invisible.
 *
 * These are source-level guards (not render tests) because the bugs are a
 * whole class, not single instances — a future careless rename would
 * reintroduce them in new spots that targeted render tests wouldn't cover.
 */

const SRC_DIR = join(process.cwd(), 'src'); // vitest runs from the project root

function listSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      listSourceFiles(full, acc);
    } else if (
      /\.tsx?$/.test(name) &&
      !/\.(test|spec)\.tsx?$/.test(name) &&
      !name.endsWith('.d.ts')
    ) {
      acc.push(full);
    }
  }
  return acc;
}

const FILES = listSourceFiles(SRC_DIR);
const rel = (f: string) => f.slice(SRC_DIR.length);

/** Local identifiers imported from @phosphor-icons/react (handles `X as Y` aliases). */
function phosphorLocalNames(content: string): Set<string> {
  const names = new Set<string>();
  const re = /import\s*\{([^}]*)\}\s*from\s*['"]@phosphor-icons\/react['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    for (const raw of m[1].split(',')) {
      const part = raw.trim();
      if (!part) continue;
      const alias = part.match(/^(\w+)\s+as\s+(\w+)$/);
      names.add(alias ? alias[2] : part);
    }
  }
  return names;
}

/** Blank out import blocks (preserving line numbers) so icon imports don't look like text leaks. */
function withoutImports(content: string): string {
  return content.replace(
    /import\s*\{[\s\S]*?\}\s*from\s*['"][^'"]*['"];?/g,
    (block) => block.replace(/[^\n]/g, ' '),
  );
}

describe('Phosphor migration guards', () => {
  it('never passes a `fill` prop to a Phosphor icon (use `weight`; fill="none" renders invisible)', () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      const content = readFileSync(file, 'utf8');
      const locals = phosphorLocalNames(content);
      if (locals.size === 0) continue;
      // Precompile one pattern per imported icon (not per line) — these only depend on the name.
      const fillRes = [...locals].map((name) => new RegExp(`<${name}\\b[^>]*\\bfill=`));
      content.split('\n').forEach((line, i) => {
        if (fillRes.some((re) => re.test(line))) {
          offenders.push(`${rel(file)}:${i + 1}  ${line.trim()}`);
        }
      });
    }
    expect(
      offenders,
      `Phosphor icons take \`weight\` (regular/light/bold/fill), not \`fill\`.\n` +
        `\`fill="none"\` makes them invisible. Offending lines:\n  ${offenders.join('\n  ')}`,
    ).toEqual([]);
  });

  // Phosphor icon names that must never appear in visible UI strings. Restricted to
  // multi-word/compound names (plus "Funnel") that have no business in prose — single
  // common-word icons (Image, Heart, Star, House…) are excluded to avoid false positives.
  const FORBIDDEN_IN_STRINGS = [
    'PaperPlane', 'PencilSimple', 'MagnifyingGlass', 'NavigationArrow', 'ChatText',
    'ChatCircle', 'ShareNetwork', 'SmileySad', 'ArrowsClockwise', 'CurrencyDollar',
    'DeviceMobile', 'SquaresFour', 'GridFour', 'CircleNotch', 'CaretLeft', 'CaretRight',
    'CaretUp', 'CaretDown', 'SignIn', 'SignOut', 'Funnel',
  ];
  // Precompile each token's three position patterns once, not per line × per file.
  const FORBIDDEN_PATTERNS = FORBIDDEN_IN_STRINGS.map((token) => ({
    attr: new RegExp(`(aria-label|placeholder|title)\\s*=\\s*\\{?\\s*[\`"'][^\`"'}]*\\b${token}\\b`),
    jsx: new RegExp(`>\\s*${token}\\b`),
    standalone: new RegExp(`^${token}\\b`),
  }));
  const PLAIN_TEXT = /^[A-Za-z][A-Za-z ]*$/;

  it('never leaks a Phosphor icon name into visible text, aria-label, placeholder, or title', () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      const lines = withoutImports(readFileSync(file, 'utf8')).split('\n');
      lines.forEach((line, i) => {
        const trimmed = line.trim();
        const isPlainText = PLAIN_TEXT.test(trimmed);
        for (const { attr, jsx, standalone } of FORBIDDEN_PATTERNS) {
          if (attr.test(line) || jsx.test(line) || (isPlainText && standalone.test(trimmed))) {
            offenders.push(`${rel(file)}:${i + 1}  ${trimmed.slice(0, 90)}`);
          }
        }
      });
    }
    expect(
      offenders,
      `A Phosphor icon name leaked into user-facing text (a find-replace bug).\n` +
        `Offending lines:\n  ${offenders.join('\n  ')}`,
    ).toEqual([]);
  });

  it('keeps the AdDetail thumbnail strip padded so the selected ring is not clipped', () => {
    // The selected thumbnail uses `ring-2 ring-offset-2` (~4px outside the box). The
    // overflow-x-auto scroll container clips that ring on the first thumbnail unless it
    // has padding. Guards the exact fix for "red bracket cut off from left".
    const content = readFileSync(join(SRC_DIR, 'features/ads/AdDetail.tsx'), 'utf8');
    const stripLine = content
      .split('\n')
      .find((l) => l.includes('overflow-x-auto') && l.includes('scrollbar-hide'));
    expect(stripLine, 'AdDetail thumbnail scroll container not found').toBeDefined();
    expect(
      /\b(p|px|pl)-\d/.test(stripLine!),
      `The thumbnail scroll container must keep horizontal padding so the selected\n` +
        `ring-offset isn't clipped. Line:\n  ${stripLine!.trim()}`,
    ).toBe(true);
  });
});
