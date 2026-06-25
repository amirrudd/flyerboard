#!/usr/bin/env node
/**
 * DOM-structure audit — walks each redesigned page in a real browser
 * and reports semantic landmarks, heading order, accessible-name gaps,
 * and interactive-in-interactive nesting issues.
 *
 * Usage: node scripts/dom-audit.mjs
 * Requires: dev server running at http://localhost:5173
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';

const ROUTES = [
  { path: '/', label: 'Home' },
  { path: '/about', label: 'About' },
  { path: '/community-guidelines', label: 'Community Guidelines' },
  { path: '/terms', label: 'Terms' },
  { path: '/support', label: 'Support' },
  { path: '/post', label: 'Post Ad (likely auth-gated)' },
  { path: '/dashboard', label: 'Dashboard (likely auth-gated)' },
];

function color(s, c) {
  const codes = { red: 31, green: 32, yellow: 33, blue: 34, cyan: 36, gray: 90, bold: 1 };
  return `\x1b[${codes[c] || 0}m${s}\x1b[0m`;
}

async function auditRoute(page, route) {
  await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  // Small wait for lazy chunks
  await page.waitForTimeout(800);

  const data = await page.evaluate(() => {
    const out = {};

    // 1. Landmark counts
    const landmarks = ['header', 'main', 'nav', 'footer', 'aside', 'section', 'article'];
    out.landmarks = Object.fromEntries(
      landmarks.map(tag => [tag, document.querySelectorAll(tag).length])
    );

    // 2. Heading order
    const headings = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')];
    out.headings = headings.map(h => ({
      level: parseInt(h.tagName[1]),
      text: (h.textContent || '').trim().slice(0, 60),
    }));

    // 3. Interactive-in-interactive nesting (button-in-button, a-in-button, etc.)
    const interactiveSelectors = 'a, button, [role="button"], input, select, textarea';
    const nested = [];
    document.querySelectorAll(interactiveSelectors).forEach(el => {
      const parent = el.parentElement?.closest(interactiveSelectors);
      if (parent && parent !== el) {
        nested.push({
          outer: parent.tagName.toLowerCase() + (parent.getAttribute('role') ? `[role=${parent.getAttribute('role')}]` : ''),
          inner: el.tagName.toLowerCase() + (el.getAttribute('role') ? `[role=${el.getAttribute('role')}]` : ''),
          innerText: (el.textContent || '').trim().slice(0, 40),
        });
      }
    });
    out.nestedInteractive = nested.slice(0, 8);

    // 4. Buttons/links missing accessible names
    const noNameButtons = [];
    document.querySelectorAll('button, a').forEach(el => {
      const text = (el.textContent || '').trim();
      const aria = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
      const title = el.getAttribute('title');
      const hasImg = el.querySelector('img[alt]');
      if (!text && !aria && !title && !hasImg) {
        noNameButtons.push({
          tag: el.tagName.toLowerCase(),
          html: el.outerHTML.slice(0, 100).replace(/\s+/g, ' '),
        });
      }
    });
    out.noAccessibleName = noNameButtons.slice(0, 6);

    // 5. H1 count (should be ≤ 1 per page)
    out.h1Count = document.querySelectorAll('h1').length;

    // 6. Total interactive elements + total depth
    out.interactiveCount = document.querySelectorAll(interactiveSelectors).length;

    // 7. Max DOM depth (sanity check for divsoup)
    let maxDepth = 0;
    function walk(node, depth) {
      if (depth > maxDepth) maxDepth = depth;
      for (const child of node.children) walk(child, depth + 1);
    }
    walk(document.body, 0);
    out.maxDepth = maxDepth;

    // 8. Console errors during this navigation are captured outside
    return out;
  });

  return data;
}

function checkHeadingOrder(headings) {
  const issues = [];
  let lastLevel = 0;
  for (const h of headings) {
    if (lastLevel && h.level > lastLevel + 1) {
      issues.push(`skip from h${lastLevel} → h${h.level} ("${h.text}")`);
    }
    lastLevel = h.level;
  }
  return issues;
}

function report(routeLabel, path, d) {
  console.log('');
  console.log(color(`▸ ${routeLabel}`, 'bold') + color(`  (${path})`, 'gray'));
  console.log(color('  landmarks', 'gray') + `   ` +
    Object.entries(d.landmarks).filter(([, v]) => v > 0)
      .map(([k, v]) => `${k}:${v}`).join('  ') || color('(none)', 'red')
  );

  const order = checkHeadingOrder(d.headings);
  const h1msg = d.h1Count === 1 ? color('✓ 1 h1', 'green')
               : d.h1Count === 0 ? color('⚠ 0 h1', 'yellow')
               : color(`⚠ ${d.h1Count} h1s`, 'yellow');
  console.log(color('  headings', 'gray') + `    ${h1msg}, ${d.headings.length} total` +
    (order.length ? color(`, skips: ${order.join(', ')}`, 'yellow') : ''));

  if (d.headings.length) {
    const seq = d.headings.slice(0, 6).map(h => `h${h.level}`).join('→');
    console.log(color('             ', 'gray') + color(seq, 'gray'));
  }

  if (d.nestedInteractive.length) {
    console.log(color('  ⚠ nested interactive', 'red'));
    d.nestedInteractive.forEach(n =>
      console.log(`    ${n.outer} > ${n.inner}  ${color('"' + n.innerText + '"', 'gray')}`)
    );
  } else {
    console.log(color('  nested intr.', 'gray') + `  ` + color('✓ none', 'green'));
  }

  if (d.noAccessibleName.length) {
    console.log(color(`  ⚠ ${d.noAccessibleName.length} interactive(s) without accessible name`, 'red'));
    d.noAccessibleName.slice(0, 3).forEach(b =>
      console.log(`    ${color(b.html, 'gray')}`)
    );
  } else {
    console.log(color('  a11y names', 'gray') + `    ` + color('✓ all named', 'green'));
  }

  console.log(color('  density', 'gray') + `      ` +
    `${d.interactiveCount} interactive  ·  max depth ${d.maxDepth}`
  );
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(`${msg.location().url}: ${msg.text().slice(0, 140)}`);
  });

  console.log(color('FlyerBoard — DOM-structure audit', 'bold'));
  console.log(color(`(${ROUTES.length} routes against ${BASE})`, 'gray'));

  for (const route of ROUTES) {
    try {
      const d = await auditRoute(page, route);
      report(route.label, route.path, d);
    } catch (e) {
      console.log('');
      console.log(color(`▸ ${route.label}  (${route.path})`, 'bold'));
      console.log(color(`  ✗ navigation failed: ${e.message.slice(0, 140)}`, 'red'));
    }
  }

  if (consoleErrors.length) {
    console.log('');
    console.log(color('Browser console errors observed:', 'yellow'));
    [...new Set(consoleErrors)].slice(0, 10).forEach(e => console.log('  ' + color(e, 'gray')));
  }

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
