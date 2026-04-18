#!/usr/bin/env node
// Regenerate every PNG app-icon derivative from assets/images/icon.svg
// and every PNG wordmark derivative from the command-center SVG sources.
//
// Run from the repo root:
//   node scripts/regenerate-icons.mjs
//
// Outputs (mobile app):
//   Square derivatives (Expo / web):
//     - assets/images/icon.png          (1024×1024 — Expo app icon)
//     - assets/images/splash-icon.png   (1024×1024 — native splash)
//     - assets/images/favicon.png       (64×64     — web favicon)
//
//   Android adaptive icon layers (Android 8+):
//     - assets/images/android-icon-foreground.png (1024×1024, logo
//       centered in a 540px safe-zone box on transparent canvas)
//     - assets/images/android-icon-background.png (1024×1024, solid
//       backdrop colour matching app.json adaptiveIcon.backgroundColor)
//     - assets/images/android-icon-monochrome.png (1024×1024, logo
//       as a white silhouette for Material You themed icons)
//
// Outputs (command-center / web):
//   PNG derivatives (@1x/@2x/@3x for each SVG variant) so the browser
//   never has to render the logo's radial + linear gradients itself —
//   some rendering engines (notably older Safari + a subset of Android
//   WebView) drop the green radial fallback to flat colour. PNGs of the
//   exact same pre-rasterised output keep the brand mark consistent
//   across every surface.
//     - command-center/public/logo.{png,@2x.png,@3x.png}
//     - command-center/public/logo-vertical.{png,@2x.png,@3x.png}
//     - command-center/public/logo-landscape.{png,@2x.png,@3x.png}
//     - command-center/public/og-image.png (1200×630 social share card)

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Resvg } from "@resvg/resvg-js";

const ROOT = resolve(import.meta.dirname, "..");
const SRC = resolve(ROOT, "assets/images/icon.svg");

const TARGETS = [
  { out: "assets/images/icon.png", size: 1024 },
  { out: "assets/images/splash-icon.png", size: 1024 },
  { out: "assets/images/favicon.png", size: 64 },
];

// Source SVG viewBox: 537.13 × 644.35 (portrait). App icons must be
// square (Play Store / Expo both reject non-square icon.png), so we
// rewrite the viewBox to a square canvas centered on the logo with
// transparent padding on the short edge. This keeps the vector
// proportions intact while producing N×N PNGs.
const SRC_VB = { w: 537.13, h: 644.35 };
const side = Math.max(SRC_VB.w, SRC_VB.h);
const offsetX = (side - SRC_VB.w) / 2;
const offsetY = (side - SRC_VB.h) / 2;

const rawSvg = readFileSync(SRC, "utf-8");
const squareSvg = rawSvg.replace(
  /viewBox="[^"]*"/,
  `viewBox="${-offsetX} ${-offsetY} ${side} ${side}"`,
);

for (const { out, size } of TARGETS) {
  const resvg = new Resvg(squareSvg, {
    fitTo: { mode: "width", value: size },
  });
  const png = resvg.render().asPng();
  writeFileSync(resolve(ROOT, out), png);
  console.log(`  wrote ${out}  (${size}×${size})`);
}

// ─── Android adaptive icon layers ──────────────────────────────────────
//
// Android 8+ composites a foreground layer on top of a background layer
// and masks the result to one of several shapes (circle, squircle,
// etc.). Material You additionally may swap in the monochrome layer.
//
// Authoring rule of thumb:
//   - Full canvas: 108×108dp → 1024×1024px
//   - Visible after mask: ~72×72dp → ~683px (aggressive circular crop)
//   - Safe zone (always visible): 66×66dp → ~625px
//   - Recommended logo box: ~60×60dp → ~570px to leave breathing room
//
// We pad the logo into a 540px box to be conservatively safe across
// every mask shape (circle, rounded square, teardrop).

const ANDROID_CANVAS = 1024;
const ANDROID_SAFE_BOX = 540;

function androidSvgWrapper(contents) {
  // Wraps the source SVG inner-content in a 1024-viewBox container,
  // scaling the logo to fit inside a 540px box at the centre.
  const scale = ANDROID_SAFE_BOX / Math.max(SRC_VB.w, SRC_VB.h);
  const logoW = SRC_VB.w * scale;
  const logoH = SRC_VB.h * scale;
  const tx = (ANDROID_CANVAS - logoW) / 2;
  const ty = (ANDROID_CANVAS - logoH) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${ANDROID_CANVAS} ${ANDROID_CANVAS}">
    <g transform="translate(${tx}, ${ty}) scale(${scale})">
      ${contents}
    </g>
  </svg>`;
}

// Extract the inner content of the source SVG (everything between the
// root <svg ...> tags). Keeps <defs> (gradients) and the drawing
// <g>...</g> so the logo renders correctly inside our wrapper.
const innerMatch = rawSvg.match(/<svg[^>]*>([\s\S]*)<\/svg>\s*$/);
if (!innerMatch) throw new Error("Could not parse inner content of icon.svg");
const svgInner = innerMatch[1];

// Foreground: the logo on a transparent canvas, inside the safe box.
{
  const fgSvg = androidSvgWrapper(svgInner);
  const resvg = new Resvg(fgSvg, {
    fitTo: { mode: "width", value: ANDROID_CANVAS },
  });
  const png = resvg.render().asPng();
  writeFileSync(resolve(ROOT, "assets/images/android-icon-foreground.png"), png);
  console.log("  wrote assets/images/android-icon-foreground.png  (1024×1024)");
}

// Background: solid colour matching the existing adaptiveIcon config
// in app.json. Rewrite this hex if the design brief moves to rose /
// green — the whole layer regenerates from the constant below.
const BG_COLOR = "#E6F4FE";
{
  const bgSvg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${ANDROID_CANVAS} ${ANDROID_CANVAS}">
    <rect width="${ANDROID_CANVAS}" height="${ANDROID_CANVAS}" fill="${BG_COLOR}"/>
  </svg>`;
  const resvg = new Resvg(bgSvg, {
    fitTo: { mode: "width", value: ANDROID_CANVAS },
  });
  const png = resvg.render().asPng();
  writeFileSync(resolve(ROOT, "assets/images/android-icon-background.png"), png);
  console.log("  wrote assets/images/android-icon-background.png  (1024×1024, " + BG_COLOR + ")");
}

// Monochrome: Material You themed icons override the foreground with a
// single-colour silhouette (the OS tints it to match the user's
// wallpaper palette). We generate this by replacing every `fill`
// attribute with white and every `stop-color` with white — the result
// is a flat white silhouette of all logo shapes.
{
  const monoInner = svgInner
    .replace(/fill="url\(#[^)]+\)"/g, 'fill="#ffffff"')
    .replace(/fill="#[0-9a-fA-F]+"/g, 'fill="#ffffff"')
    .replace(/fill="rgb\([^)]+\)"/gi, 'fill="#ffffff"')
    .replace(/stop-color="#[0-9a-fA-F]+"/g, 'stop-color="#ffffff"');
  const monoSvg = androidSvgWrapper(monoInner);
  const resvg = new Resvg(monoSvg, {
    fitTo: { mode: "width", value: ANDROID_CANVAS },
  });
  const png = resvg.render().asPng();
  writeFileSync(resolve(ROOT, "assets/images/android-icon-monochrome.png"), png);
  console.log("  wrote assets/images/android-icon-monochrome.png  (1024×1024)");
}

// ─── Command-center wordmark derivatives ──────────────────────────────
//
// Render each marketing-surface SVG (shield-only, vertical wordmark,
// landscape wordmark, plus white-foreground variants) into PNGs at @1x,
// @2x, and @3x so <img srcSet> can pick the right density for retina
// screens. The @1x width is the natural display width — picked to be a
// little larger than the biggest on-page slot (~64px for shield, ~360px
// for landscape wordmark) so any single derivative can serve any
// consumer without upscaling blur.
const CC_PUBLIC = "command-center/public";

// Match the viewBox values inside an SVG and rewrite to a square canvas
// centered on the original content (transparent padding on the short
// edge). Keeps a portrait shield in a square PNG without distortion.
function squareViewBox(svg) {
  return svg.replace(/viewBox="([-\d.\s]+)"/, (_, raw) => {
    const [x, y, w, h] = raw.trim().split(/\s+/).map(Number);
    const sideLocal = Math.max(w, h);
    const ox = x - (sideLocal - w) / 2;
    const oy = y - (sideLocal - h) / 2;
    return `viewBox="${ox} ${oy} ${sideLocal} ${sideLocal}"`;
  });
}

// The brand SVGs from the Illustrator export embed the shield outline as
// a base64-encoded raster layer (via <image xlink:href="data:image/png;…"/>).
// That means a "white silhouette" derivative can't be synthesised by text
// substitution — the embedded raster always dominates. The full-colour
// logo reads well on both light and dark surfaces (the shield's own
// rose/green/blue/white palette is self-contained), so a single colour
// PNG is used everywhere and no white variant is generated.
const CC_VARIANTS = [
  // Shield viewBox is portrait (537×644); squared here so a single
  // 1:1 PNG drops cleanly into square slots (sidebar avatar, login hero).
  { src: "logo.svg", base: "logo", baseWidth: 128, square: true },
  { src: "logo-vertical.svg", base: "logo-vertical", baseWidth: 140, square: false },
  { src: "logo-landscape.svg", base: "logo-landscape", baseWidth: 360, square: false },
];

for (const { src, base, baseWidth, square } of CC_VARIANTS) {
  const srcPath = resolve(ROOT, CC_PUBLIC, src);
  let svg = readFileSync(srcPath, "utf-8");
  if (square) svg = squareViewBox(svg);
  for (const [suffix, multiplier] of [["", 1], ["@2x", 2], ["@3x", 3]]) {
    const width = baseWidth * multiplier;
    const resvg = new Resvg(svg, { fitTo: { mode: "width", value: width } });
    const png = resvg.render().asPng();
    const out = `${CC_PUBLIC}/${base}${suffix}.png`;
    writeFileSync(resolve(ROOT, out), png);
    console.log(`  wrote ${out}  (width ${width}px)`);
  }
}

// ─── OG / social share card ───────────────────────────────────────────
//
// Twitter / Facebook / LinkedIn / Slack render share cards at ~1200×630.
// We wrap the landscape wordmark on a brand-tinted background so the
// mark reads at thumbnail size instead of getting lost as a transparent
// silhouette on whatever card background the crawler renders behind it.
{
  const landscape = readFileSync(resolve(ROOT, CC_PUBLIC, "logo-landscape.svg"), "utf-8");
  const landscapeInner = landscape.match(/<svg[^>]*>([\s\S]*)<\/svg>\s*$/)?.[1];
  const landscapeVbMatch = landscape.match(/viewBox="([-\d.\s]+)"/);
  if (!landscapeInner || !landscapeVbMatch) {
    throw new Error("Could not parse logo-landscape.svg for OG card");
  }
  const [, raw] = landscapeVbMatch;
  const [, , lw, lh] = raw.trim().split(/\s+/).map(Number);

  const OG_W = 1200;
  const OG_H = 630;
  const LOGO_TARGET_W = 780;
  const scale = LOGO_TARGET_W / lw;
  const logoDrawW = lw * scale;
  const logoDrawH = lh * scale;
  const tx = (OG_W - logoDrawW) / 2;
  const ty = (OG_H - logoDrawH) / 2;

  const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${OG_W} ${OG_H}">
    <defs>
      <linearGradient id="og-bg" x1="0" y1="0" x2="${OG_W}" y2="${OG_H}" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#FCFBFA"/>
        <stop offset="1" stop-color="#F5E8EE"/>
      </linearGradient>
      <radialGradient id="og-glow" cx="${OG_W / 2}" cy="${OG_H / 2}" r="${OG_W / 2}" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#E72369" stop-opacity="0.10"/>
        <stop offset="1" stop-color="#E72369" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${OG_W}" height="${OG_H}" fill="url(#og-bg)"/>
    <rect width="${OG_W}" height="${OG_H}" fill="url(#og-glow)"/>
    <g transform="translate(${tx}, ${ty}) scale(${scale})">${landscapeInner}</g>
  </svg>`;
  const resvg = new Resvg(ogSvg, { fitTo: { mode: "width", value: OG_W } });
  const png = resvg.render().asPng();
  writeFileSync(resolve(ROOT, `${CC_PUBLIC}/og-image.png`), png);
  console.log(`  wrote ${CC_PUBLIC}/og-image.png  (${OG_W}×${OG_H})`);
}

console.log("Done.");
