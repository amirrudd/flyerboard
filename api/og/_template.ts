// Shared Open Graph card templates, rendered to PNG by `@vercel/og` (satori).
//
// Written with `React.createElement` (aliased `h`) rather than JSX so the exact
// same module renders both in the Vercel edge functions (api/og/*) and in the
// local verification harness — no JSX build step needed to preview a card.
//
// Three link types, one visual system (ink brand panel left, imagery right):
//   flyerOgElement   — single listing  → one cover photo
//   bundleOgElement  — 2–4 grouped ads → photo mosaic + savings
//   saleOgElement    — moving sale     → photo mosaic + "+N" remainder
//
// Satori quirks that shape this file:
//  - every element with >1 child MUST set `display: 'flex'`.
//  - titles use satori `lineClamp` (needs display:block); `clamp` = eyebrow only.
//  - `objectFit: 'cover'` on <img> is supported and does the crop.
//
// The FlyerBoard mark is the app icon (red pushpin "F"); the wordmark is
// Fraunces to match `font-display` in the app header (Header.tsx).

import { createElement as h, type ReactElement } from "react";

const INK = "#242428";
const ACCENT = "#DC3626";
const MUTED = "#A1A1AA";
const SUBTLE = "#71717A";
const PANEL_W = 540;
const VIS_W = 660; // right visual column
const HEIGHT = 630;
const GAP = 6;

/** AUD, no cents, grouped thousands — edge Intl is unreliable, so format by hand. */
export function formatPrice(price: number): string {
  return "$" + Math.round(price).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function clamp(text: string, max: number): string {
  const t = text.trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
}

// ---------------------------------------------------------------- chrome bits

function lockup(iconDataUri: string) {
  return h(
    "div",
    { style: { display: "flex", flexDirection: "row", alignItems: "center", gap: 14 } },
    h("img", { src: iconDataUri, width: 48, height: 48, style: { borderRadius: 11 } }),
    h(
      "div",
      { style: { display: "flex", fontFamily: "Fraunces", fontWeight: 600, fontSize: 32, letterSpacing: -0.5 } },
      "FlyerBoard"
    )
  );
}

function priceChip(label: string) {
  return h(
    "div",
    {
      style: {
        display: "flex",
        backgroundColor: ACCENT,
        color: "#fff",
        fontFamily: "Jakarta",
        fontWeight: 800,
        fontSize: 58,
        padding: "2px 26px 12px",
        borderRadius: 18,
      },
    },
    label
  );
}

function exchangeChip() {
  return h(
    "div",
    {
      style: {
        display: "flex",
        border: `3px solid ${ACCENT}`,
        color: ACCENT,
        fontFamily: "Jakarta",
        fontWeight: 800,
        fontSize: 38,
        padding: "10px 26px",
        borderRadius: 16,
      },
    },
    "Swap / Exchange"
  );
}

/** The ink brand panel shared by all three card types. */
function leftPanel(opts: {
  iconDataUri: string;
  eyebrow: string;
  eyebrowAccent?: boolean;
  title: string;
  chip: ReactElement | null;
  note?: string;
}) {
  return h(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        width: PANEL_W,
        height: HEIGHT,
        padding: "60px 56px 54px",
        color: "#fff",
      },
    },
    lockup(opts.iconDataUri),
    h(
      "div",
      {
        style: {
          display: "flex",
          marginTop: 70,
          fontFamily: "Jakarta",
          fontWeight: 800,
          fontSize: 23,
          letterSpacing: opts.eyebrowAccent ? 2 : 0,
          textTransform: opts.eyebrowAccent ? "uppercase" : "none",
          color: opts.eyebrowAccent ? ACCENT : MUTED,
        },
      },
      clamp(opts.eyebrow, 44)
    ),
    h(
      "div",
      {
        style: {
          // satori's lineClamp truncates to N lines WITH an ellipsis, in lines
          // (not a hand-tuned pixel height), so it can't desync from fontSize and
          // a long title can never overrun the chip below. Requires display:block.
          display: "block",
          lineClamp: 3,
          marginTop: 14,
          fontFamily: "Fraunces",
          fontWeight: 600,
          fontSize: 52,
          lineHeight: 1.1,
          letterSpacing: -0.5,
          color: "#fff",
        },
      },
      opts.title
    ),
    h("div", { style: { display: "flex", flex: 1 } }),
    // createElement ignores null children, so no need to spread empty arrays.
    opts.chip ? h("div", { style: { display: "flex" } }, opts.chip) : null,
    opts.note
      ? h(
          "div",
          { style: { display: "flex", marginTop: 14, fontFamily: "Jakarta", fontWeight: 700, fontSize: 24, color: MUTED } },
          opts.note
        )
      : null,
    h(
      "div",
      { style: { display: "flex", marginTop: 22, fontFamily: "Jakarta", fontWeight: 700, fontSize: 22, color: SUBTLE } },
      "flyerboard.com.au"
    )
  );
}

// ---------------------------------------------------------------- imagery

function root(rightNode: ReactElement, leftNode: ReactElement) {
  return h(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "row",
        width: PANEL_W + VIS_W,
        height: HEIGHT,
        backgroundColor: INK,
        fontFamily: "Jakarta",
      },
    },
    leftNode,
    h("div", { style: { display: "flex", overflow: "hidden" } }, rightNode)
  );
}

function coverPhoto(url: string) {
  return h("img", { src: url, width: VIS_W, height: HEIGHT, style: { width: VIS_W, height: HEIGHT, objectFit: "cover" } });
}

function brandFallback(iconDataUri: string) {
  return h(
    "div",
    { style: { display: "flex", width: VIS_W, height: HEIGHT, backgroundColor: "#1f1f23", alignItems: "center", justifyContent: "center" } },
    h("img", { src: iconDataUri, width: 190, height: 190, style: { opacity: 0.85 } })
  );
}

function tile(url: string | null, w: number, hgt: number, badge?: string, iconDataUri?: string) {
  const inner = url
    ? h("img", { src: url, width: w, height: hgt, style: { width: w, height: hgt, objectFit: "cover" } })
    : h(
        "div",
        { style: { display: "flex", width: w, height: hgt, backgroundColor: "#1f1f23", alignItems: "center", justifyContent: "center" } },
        iconDataUri ? h("img", { src: iconDataUri, width: 90, height: 90, style: { opacity: 0.7 } }) : ""
      );
  const children: ReactElement[] = [inner];
  if (badge) {
    children.push(
      h(
        "div",
        {
          style: {
            display: "flex",
            position: "absolute",
            top: 0,
            left: 0,
            width: w,
            height: hgt,
            backgroundColor: "rgba(20,15,10,0.58)",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "Jakarta",
            fontWeight: 800,
            fontSize: 52,
            color: "#fff",
          },
        },
        badge
      )
    );
  }
  return h("div", { style: { display: "flex", position: "relative", width: w, height: hgt, overflow: "hidden" } }, ...children);
}

const col = (...kids: ReactElement[]) =>
  h("div", { style: { display: "flex", flexDirection: "column", gap: GAP } }, ...kids);
const row = (...kids: ReactElement[]) =>
  h("div", { style: { display: "flex", flexDirection: "row", gap: GAP } }, ...kids);

/** 1–4 photos laid out gaplessly to fill the 660×630 visual column. `extra` > 0
 *  stamps a "+N" badge on the last tile (for sales with more items than shown). */
function photoMosaic(images: (string | null)[], iconDataUri: string, extra = 0) {
  const imgs = images.slice(0, 4);
  const halfW = (VIS_W - GAP) / 2;
  const halfH = (HEIGHT - GAP) / 2;
  const badge = extra > 0 ? `+${extra}` : undefined;
  let inner: ReactElement;

  if (imgs.length <= 1) {
    inner = imgs[0] ? coverPhoto(imgs[0]) : brandFallback(iconDataUri);
  } else if (imgs.length === 2) {
    inner = row(
      tile(imgs[0], halfW, HEIGHT, undefined, iconDataUri),
      tile(imgs[1], halfW, HEIGHT, badge, iconDataUri)
    );
  } else if (imgs.length === 3) {
    inner = row(
      tile(imgs[0], halfW, HEIGHT, undefined, iconDataUri),
      col(tile(imgs[1], halfW, halfH, undefined, iconDataUri), tile(imgs[2], halfW, halfH, badge, iconDataUri))
    );
  } else {
    inner = row(
      col(tile(imgs[0], halfW, halfH, undefined, iconDataUri), tile(imgs[2], halfW, halfH, undefined, iconDataUri)),
      col(tile(imgs[1], halfW, halfH, undefined, iconDataUri), tile(imgs[3], halfW, halfH, badge, iconDataUri))
    );
  }
  return h("div", { style: { display: "flex", width: VIS_W, height: HEIGHT, backgroundColor: INK } }, inner);
}

// ---------------------------------------------------------------- card types

export interface FlyerCard {
  title: string;
  price?: number;
  exchange?: boolean;
  category: string;
  location: string;
  photoUrl: string | null;
  iconDataUri: string;
}

export function flyerOgElement(c: FlyerCard) {
  const hasPrice = c.price !== undefined && c.price !== null;
  const chip = hasPrice ? priceChip(formatPrice(c.price as number)) : c.exchange ? exchangeChip() : null;
  return root(
    c.photoUrl ? coverPhoto(c.photoUrl) : brandFallback(c.iconDataUri),
    leftPanel({ iconDataUri: c.iconDataUri, eyebrow: `${c.category} · ${c.location}`, title: c.title, chip })
  );
}

export interface BundleCard {
  label: string;
  bundlePrice: number;
  /** Sum of the items' individual prices, for the strikethrough/savings line. */
  separatelyTotal: number;
  savingsPct: number;
  location: string;
  images: (string | null)[];
  iconDataUri: string;
}

export function bundleOgElement(c: BundleCard) {
  const note = c.savingsPct > 0 ? `was ${formatPrice(c.separatelyTotal)} · save ${c.savingsPct}%` : c.location;
  return root(
    photoMosaic(c.images, c.iconDataUri),
    leftPanel({
      iconDataUri: c.iconDataUri,
      eyebrow: `Bundle · ${c.images.length} items`,
      eyebrowAccent: true,
      title: c.label,
      chip: priceChip(formatPrice(c.bundlePrice)),
      note,
    })
  );
}

export interface SaleCard {
  title: string;
  suburb: string;
  /** Lowest item price, for the "from $X" chip; omit if nothing priced. */
  fromPrice?: number;
  availableCount: number;
  totalCount: number;
  images: (string | null)[];
  iconDataUri: string;
}

export function saleOgElement(c: SaleCard) {
  const shown = Math.min(c.images.length, 4);
  const extra = c.totalCount - shown;
  return root(
    photoMosaic(c.images, c.iconDataUri, extra > 0 ? extra : 0),
    leftPanel({
      iconDataUri: c.iconDataUri,
      eyebrow: `Moving sale · ${c.suburb}`,
      eyebrowAccent: true,
      title: c.title,
      chip: c.fromPrice !== undefined ? priceChip(`from ${formatPrice(c.fromPrice)}`) : null,
      note: `${c.availableCount} of ${c.totalCount} items available`,
    })
  );
}

// ---------------------------------------------------------------- editorial (blog / brand)
//
// Blog and the default brand card share a cream editorial ground, distinct
// from the flyer/bundle/sale ink cards — these aren't a marketplace listing,
// so borrowing that visual language would misrepresent the content. Built at
// BUILD TIME (vite.config.ts), not as an edge function: blog posts are static
// markdown bundled into the SPA, not reachable from the separately-bundled
// api/ edge functions.

const CREAM = "#F7F6F3";

function creamLockup(iconDataUri: string, size: 34 | 40 = 34) {
  return h(
    "div",
    { style: { display: "flex", flexDirection: "row", alignItems: "center", gap: 12 } },
    h("img", { src: iconDataUri, width: size, height: size, style: { borderRadius: size === 40 ? 9 : 8 } }),
    h(
      "div",
      { style: { display: "flex", fontFamily: "Fraunces", fontWeight: 600, fontSize: size === 40 ? 28 : 24, color: INK, letterSpacing: -0.3 } },
      "FlyerBoard"
    )
  );
}

export interface BlogCard {
  title: string;
  category: string;
  readingTime: number;
  /** Rasterized cover art as a data URI (SVG source rasterized to PNG at build time — satori/resvg can't embed nested SVG reliably). Null shows the brand mark instead. */
  coverDataUri: string | null;
  iconDataUri: string;
}

export function blogOgElement(c: BlogCard) {
  const art = c.coverDataUri
    ? h("img", { src: c.coverDataUri, width: VIS_W, height: HEIGHT, style: { width: VIS_W, height: HEIGHT, objectFit: "cover" } })
    : h(
        "div",
        { style: { display: "flex", width: VIS_W, height: HEIGHT, backgroundColor: "#EFECE5", alignItems: "center", justifyContent: "center" } },
        h("img", { src: c.iconDataUri, width: 170, height: 170, style: { opacity: 0.5 } })
      );

  return h(
    "div",
    { style: { display: "flex", flexDirection: "row", width: PANEL_W + VIS_W, height: HEIGHT, backgroundColor: CREAM, fontFamily: "Jakarta" } },
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", width: PANEL_W, height: HEIGHT, padding: "56px 24px 48px 60px" } },
      creamLockup(c.iconDataUri),
      h(
        "div",
        { style: { display: "flex", marginTop: 66, fontFamily: "Jakarta", fontWeight: 800, fontSize: 21, letterSpacing: 2, textTransform: "uppercase", color: ACCENT } },
        clamp(`FlyerBoard Blog · ${c.category}`, 40)
      ),
      h(
        "div",
        { style: { display: "block", lineClamp: 4, marginTop: 20, fontFamily: "Fraunces", fontWeight: 600, fontSize: 46, lineHeight: 1.14, letterSpacing: -0.3, color: INK } },
        c.title
      ),
      h("div", { style: { display: "flex", flex: 1 } }),
      h(
        "div",
        { style: { display: "flex", fontFamily: "Jakarta", fontWeight: 600, fontSize: 22, color: SUBTLE } },
        `${c.readingTime} min read`
      )
    ),
    h("div", { style: { display: "flex", overflow: "hidden" } }, art)
  );
}

export interface BrandCard {
  headline: string;
  subline: string;
  iconDataUri: string;
}

/** The default share card for the homepage and any route without its own — also fixes the site-wide og-preview.png 404. */
export function brandOgElement(c: BrandCard) {
  return h(
    "div",
    { style: { display: "flex", flexDirection: "column", width: PANEL_W + VIS_W, height: HEIGHT, backgroundColor: CREAM, fontFamily: "Jakarta", padding: "64px 64px 56px" } },
    creamLockup(c.iconDataUri, 40),
    h("div", { style: { display: "flex", flex: 1 } }),
    h(
      "div",
      { style: { display: "flex", fontFamily: "Fraunces", fontWeight: 600, fontSize: 62, lineHeight: 1.08, letterSpacing: -0.5, color: INK, maxWidth: 760 } },
      c.headline
    ),
    h(
      "div",
      { style: { display: "flex", marginTop: 22, fontFamily: "Jakarta", fontWeight: 600, fontSize: 27, lineHeight: 1.4, color: SUBTLE, maxWidth: 640 } },
      c.subline
    ),
    h(
      "div",
      { style: { display: "flex", marginTop: 34, fontFamily: "Jakarta", fontWeight: 700, fontSize: 22, color: SUBTLE } },
      "flyerboard.com.au"
    )
  );
}
