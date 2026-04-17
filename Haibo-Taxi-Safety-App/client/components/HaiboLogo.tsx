import React from "react";
import { View, StyleSheet } from "react-native";
import HaiboIcon from "../../assets/images/icon.svg";

// Single source of truth for rendering the Haibo brand mark in React
// Native. Wraps the SVG import from react-native-svg-transformer so
// callers never have to wrestle with SvgProps or the relative path to
// the asset. Use the `size` prop for square sizing — width + height
// are locked together to preserve the logo's 537×644 aspect ratio.

interface HaiboLogoProps {
  /** Rendered size in dp. Aspect ratio (~0.83) is preserved automatically. */
  size?: number;
  /** Optional style override for the wrapping View. */
  style?: any;
}

export function HaiboLogo({ size = 96, style }: HaiboLogoProps) {
  // Width ÷ height = 537.13 / 644.35 ≈ 0.8336. Scale the displayed
  // width so a `size` of N means the bounding box is N×N, with the
  // logo itself centered inside.
  const logoWidth = size * (537.13 / 644.35);
  return (
    <View
      style={[
        styles.wrap,
        { width: size, height: size },
        style,
      ]}
      pointerEvents="none"
    >
      <HaiboIcon width={logoWidth} height={size} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
});
