import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";

import { useTheme } from "@/hooks/useTheme";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BrandColors, BorderRadius, Typography } from "@/constants/theme";

/**
 * BalanceCard — role-dashboard primary surface. Shows a big number
 * (the balance), an optional subtitle (e.g. "Fare balance · settle
 * to owner"), and one or two CTAs. Used on Driver / Owner / Vendor
 * dashboards so the top-of-screen feels consistent across roles.
 *
 * The card's gradient is pluggable — roles pass their own accent so the
 * brand reads the same as the role tile on ProfileSetup.
 */
export interface BalanceCardAction {
  label: string;
  icon?: keyof typeof Feather.glyphMap;
  onPress: () => void;
  variant?: "primary" | "secondary";
}

interface BalanceCardProps {
  label: string;
  amount: number;
  currency?: string;
  subtitle?: string;
  /** Gradient pair for the card background. Defaults to brand rose. */
  gradient?: [string, string];
  actions?: BalanceCardAction[];
  /** Optional eyebrow shown above the label (e.g. "MY FARE BALANCE"). */
  eyebrow?: string;
  /** Delay in ms for the entrance animation stagger. */
  delay?: number;
}

export function BalanceCard({
  label,
  amount,
  currency = "R",
  subtitle,
  gradient,
  actions = [],
  eyebrow,
  delay = 0,
}: BalanceCardProps) {
  const reducedMotion = useReducedMotion();
  const { theme } = useTheme();
  const gradientColors = (gradient ||
    BrandColors.gradient.primary) as [string, string];

  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(delay)}
      style={styles.wrap}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {/* Decorative background blob — pure visual, pointerEvents none */}
        <View
          aria-hidden
          style={styles.blob}
          pointerEvents="none"
        />

        {eyebrow ? (
          <ThemedText style={styles.eyebrow}>{eyebrow}</ThemedText>
        ) : null}
        <ThemedText style={styles.label}>{label}</ThemedText>
        <View style={styles.amountRow}>
          <ThemedText style={styles.currency}>{currency}</ThemedText>
          <ThemedText style={styles.amount}>
            {amount.toLocaleString("en-ZA", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </ThemedText>
        </View>
        {subtitle ? (
          <ThemedText style={styles.subtitle}>{subtitle}</ThemedText>
        ) : null}

        {actions.length > 0 ? (
          <View style={styles.actions}>
            {actions.map((a, i) => (
              <Pressable
                key={a.label}
                onPress={a.onPress}
                style={({ pressed }) => [
                  styles.actionBtn,
                  a.variant === "secondary"
                    ? styles.actionSecondary
                    : styles.actionPrimary,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={a.label}
              >
                {a.icon ? (
                  <Feather
                    name={a.icon}
                    size={14}
                    color={
                      a.variant === "secondary" ? "#FFFFFF" : gradientColors[0]
                    }
                  />
                ) : null}
                <ThemedText
                  style={[
                    styles.actionLabel,
                    a.variant === "secondary"
                      ? styles.actionLabelSecondary
                      : { color: gradientColors[0] },
                  ]}
                >
                  {a.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        ) : null}
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: Spacing.lg,
  },
  card: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    paddingTop: Spacing.lg,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 10,
  },
  blob: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  eyebrow: {
    ...Typography.label,
    color: "rgba(255,255,255,0.75)",
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: "800",
    marginBottom: 4,
  },
  label: {
    ...Typography.body,
    color: "rgba(255,255,255,0.92)",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: Spacing.xs,
  },
  currency: {
    ...Typography.h2,
    color: "rgba(255,255,255,0.85)",
    fontSize: 22,
    fontWeight: "700",
  },
  amount: {
    ...Typography.h1,
    color: "#FFFFFF",
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
  subtitle: {
    ...Typography.small,
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    marginTop: Spacing.xs,
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    flexWrap: "wrap",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
  },
  actionPrimary: {
    backgroundColor: "#FFFFFF",
  },
  actionSecondary: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  actionLabel: {
    ...Typography.small,
    fontSize: 13,
    fontWeight: "700",
  },
  actionLabelSecondary: {
    color: "#FFFFFF",
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
});

export default BalanceCard;
