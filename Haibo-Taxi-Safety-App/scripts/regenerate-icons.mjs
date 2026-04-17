#!/usr/bin/env node
// Regenerate the PNG app-icon derivatives from assets/images/icon.svg.
//
// Run from the repo root:
//   node scripts/regenerate-icons.mjs
//
// Touches three PNGs that map directly to the source SVG:
//   - assets/images/icon.png          (1024 — Expo app icon)
//   - assets/images/splash-icon.png   (1024 — native splash)
//   - assets/images/favicon.png       (64   — web favicon)
//
// Deliberately does NOT regenerate:
//   - android-icon-foreground.png (needs a 432px safe-zone composite)
//   - android-icon-background.png (solid-colour backdrop — design call)
//   - android-icon-monochrome.png (needs a white-on-transparent variant
//                                   of the SVG for Material You theming)
//
// Re-export those in Figma / Illustrator where you can see the result
// against Android's circular mask preview.

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

console.log("Done.");
