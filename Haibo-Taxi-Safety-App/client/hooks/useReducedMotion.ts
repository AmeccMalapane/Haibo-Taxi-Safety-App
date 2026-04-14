/**
 * useReducedMotion — WCAG 2.3.3 compliance hook for React Native.
 *
 * Reads the device's "Reduce Motion" accessibility setting and re-renders
 * when it changes. React Native Reanimated does NOT auto-honour this
 * preference — every animated surface has to ask for it explicitly.
 *
 * Two ways to use:
 *
 *   1. Direct — get the raw boolean and ternary-gate the entering prop:
 *
 *      const reduced = useReducedMotion();
 *      <Animated.View entering={reduced ? undefined : FadeInDown.duration(400)}>
 *
 *   2. Helper — wrap the entering value in one call:
 *
 *      <Animated.View entering={useMotionEntry(FadeInDown.duration(400))}>
 *
 * The helper is lighter at the call site and keeps the default-motion
 * intent visible. Pick whichever reads better per screen.
 */

import { useState, useEffect } from "react";
import { AccessibilityInfo } from "react-native";

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduced(value);
      })
      .catch(() => {
        // Reduce-motion probing is best-effort. If the platform doesn't
        // expose it (rare), we default to motion on, same as AAA browsers.
      });

    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced
    );

    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduced;
}

/**
 * Helper: returns the entering value or undefined based on reduced motion.
 * Use at the call site to keep the animation intent obvious:
 *
 *   entering={useMotionEntry(FadeInDown.duration(400))}
 *
 * When reduced motion is on, the prop resolves to undefined and the
 * Animated.View mounts without any entering transition.
 */
export function useMotionEntry<T>(entering: T): T | undefined {
  const reduced = useReducedMotion();
  return reduced ? undefined : entering;
}
