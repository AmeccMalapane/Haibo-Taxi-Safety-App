#!/usr/bin/env node
// Regenerate every PNG app-icon derivative from assets/images/icon.svg.
//
// Run from the repo root:
//   node scripts/regenerate-icons.mjs
//
// Outputs:
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
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ANDROID_CANVAS} ${ANDROID_CANVAS}">
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
  const bgSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ANDROID_CANVAS} ${ANDROID_CANVAS}">
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

console.log("Done.");
