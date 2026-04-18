import React from "react";

// Single place every surface in the command-center resolves the Haibo
// brand mark. Renders PNG derivatives of the logo instead of the raw
// SVG because the Illustrator export embeds the shield outline as a
// base64 raster layer — some browsers (older Safari, older Android
// WebView) stumble on the combination of xlink:href'd gradients and
// embedded data-URI images, dropping the outline or the gradient stops.
// The PNGs are pre-rasterised at @1x/@2x/@3x via scripts/regenerate-
// icons.mjs so retina renders stay sharp without bundling the heavy
// (144 KB) full-colour SVG into every page.
//
// Variants:
//   - "shield"     square mark only (uses /logo*.png — natural width 128px)
//   - "vertical"   shield stacked over "haibo!" wordmark (natural width 140px)
//   - "landscape"  shield beside "haibo!" wordmark (natural width 360px)

type Variant = "shield" | "vertical" | "landscape";

interface HaiboMarkProps {
  variant?: Variant;
  /**
   * Rendered width in CSS pixels. Height auto-computes from the source
   * aspect ratio. Pass `height` instead if a vertical slot is the
   * constraint.
   */
  width?: number;
  height?: number;
  /** Optional accessible name. Defaults to "Haibo!". Pass "" for decorative use. */
  alt?: string;
  /** Optional drop shadow — enabled by default for readability on photographic backdrops. */
  glow?: boolean;
  /** Extra inline styles, e.g. margin. */
  style?: React.CSSProperties;
  className?: string;
}

const VARIANT_BASE: Record<Variant, string> = {
  shield: "/logo",
  vertical: "/logo-vertical",
  landscape: "/logo-landscape",
};

// Natural @1x dimensions of the rasterised PNGs (see CC_VARIANTS in
// scripts/regenerate-icons.mjs). Source-of-truth for the default size
// and for computing height from width when only one is specified.
const VARIANT_SIZE: Record<Variant, { w: number; h: number }> = {
  // Shield PNG is squared during generation — padded to 1:1 from the
  // 537×644 source viewBox — so every shield slot can be styled as a
  // simple square without aspect-ratio bookkeeping on the consumer side.
  shield: { w: 128, h: 128 },
  vertical: { w: 140, h: 177 },
  landscape: { w: 360, h: 110 },
};

export function HaiboMark({
  variant = "shield",
  width,
  height,
  alt = "Haibo!",
  glow = true,
  style,
  className,
}: HaiboMarkProps) {
  const base = VARIANT_BASE[variant];
  const { w: natW, h: natH } = VARIANT_SIZE[variant];

  // Resolve a concrete width so browsers don't have to infer from the
  // image itself — avoids layout shift when the PNG arrives.
  const resolvedWidth =
    width ?? (height ? Math.round((height * natW) / natH) : natW);
  const resolvedHeight =
    height ?? Math.round((resolvedWidth * natH) / natW);

  return (
    <img
      src={`${base}.png`}
      srcSet={`${base}.png 1x, ${base}@2x.png 2x, ${base}@3x.png 3x`}
      width={resolvedWidth}
      height={resolvedHeight}
      alt={alt}
      decoding="async"
      loading="lazy"
      draggable={false}
      className={className}
      style={{
        display: "block",
        width: resolvedWidth,
        height: resolvedHeight,
        // Subtle brand-tinted drop shadow so the mark pops on either
        // white surfaces or photographic hero backgrounds without
        // needing a second element.
        filter: glow ? "drop-shadow(0 4px 12px rgba(231, 35, 105, 0.28))" : undefined,
        ...style,
      }}
    />
  );
}
