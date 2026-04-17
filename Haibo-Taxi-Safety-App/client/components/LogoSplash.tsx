import React, { useEffect } from "react";
import { View, StyleSheet, useWindowDimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
} from "react-native-reanimated";

import { HaiboLogo } from "@/components/HaiboLogo";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { BrandColors, Typography } from "@/constants/theme";

// LogoSplash — the in-app launch screen that appears while fonts,
// auth state, and cached user data are resolving. Renders the Haibo
// brand mark centered on a neutral backdrop with an elegant entrance:
//
//   1. Logo fades in (300ms) while scaling from 0.9 → 1.0 with a
//      gentle overshoot for a "breath of life" feel.
//   2. A soft breathing loop keeps the mark alive if the load runs
//      longer than ~1s — avoids the "frozen screen" anxiety.
//   3. Word-mark slides up + fades in behind the logo after the
//      scale finishes.
//   4. Tagline sneaks in last, with a longer delay, so the composition
//      reveals hierarchically instead of all at once.
//
// `useReducedMotion()` collapses every animation to an instant render
// for users who have the OS-level accessibility flag enabled.
//
// This component intentionally does NOT touch SplashScreen.hideAsync()
// — the caller (App.tsx) decides when to unmount it. Keeps the
// component self-contained and testable in isolation.

const LOGO_SIZE = 168;

export function LogoSplash() {
  const { theme } = useTheme();
  const reducedMotion = useReducedMotion();
  const { width } = useWindowDimensions();

  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.9);
  const wordmarkOpacity = useSharedValue(0);
  const wordmarkTranslateY = useSharedValue(12);
  const taglineOpacity = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      logoOpacity.value = 1;
      logoScale.value = 1;
      wordmarkOpacity.value = 1;
      wordmarkTranslateY.value = 0;
      taglineOpacity.value = 1;
      return;
    }

    // Logo reveal — fade + scale with a tiny overshoot past 1.0 to
    // land on a "breath" feel instead of a linear stop.
    logoOpacity.value = withTiming(1, {
      duration: 420,
      easing: Easing.out(Easing.cubic),
    });
    logoScale.value = withSequence(
      withTiming(1.04, { duration: 380, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 220, easing: Easing.inOut(Easing.ease) }),
    );

    // Breathing loop — only kicks in after the entrance finishes so it
    // doesn't fight with the initial scale motion.
    const breathing = () =>
      withRepeat(
        withSequence(
          withTiming(1.015, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
    logoScale.value = withDelay(680, breathing());

    // Wordmark — slides up + fades in after the logo lands.
    wordmarkOpacity.value = withDelay(
      260,
      withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }),
    );
    wordmarkTranslateY.value = withDelay(
      260,
      withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) }),
    );

    // Tagline — last, most subtle.
    taglineOpacity.value = withDelay(
      520,
      withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }),
    );
  }, [reducedMotion]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: wordmarkOpacity.value,
    transform: [{ translateY: wordmarkTranslateY.value }],
  }));

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
  }));

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: theme.backgroundRoot },
      ]}
      // Match the status bar padding Expo's native splash uses so the
      // visible logo sits optically centered regardless of notch size.
      accessibilityRole="image"
      accessibilityLabel="Haibo!"
    >
      <View style={[styles.stack, { maxWidth: Math.min(width, 420) }]}>
        <Animated.View style={logoStyle}>
          <HaiboLogo size={LOGO_SIZE} />
        </Animated.View>

        <Animated.View style={[styles.wordmarkRow, wordmarkStyle]}>
          <ThemedText style={styles.wordmark}>Haibo!</ThemedText>
        </Animated.View>

        <Animated.View style={taglineStyle}>
          <ThemedText
            style={[styles.tagline, { color: theme.textSecondary }]}
          >
            Rise · Create · Thrive
          </ThemedText>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stack: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  wordmarkRow: {
    marginTop: 16,
  },
  wordmark: {
    ...Typography.h1,
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.6,
    color: BrandColors.primary.gradientStart,
    textAlign: "center",
  },
  tagline: {
    ...Typography.small,
    fontSize: 12,
    letterSpacing: 2.6,
    textTransform: "uppercase",
    marginTop: 10,
    textAlign: "center",
  },
});
