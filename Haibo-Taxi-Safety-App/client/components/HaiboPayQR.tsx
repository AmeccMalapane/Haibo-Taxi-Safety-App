import React from "react";
import { View, StyleSheet, Share, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";

interface HaiboPayQRProps {
  driverName: string;
  plateNumber: string;
  payReferenceCode: string;
}

/**
 * Haibo Pay QR/Reference Card for Drivers
 * Displays the driver's unique payment reference code (HB-[PLATE])
 * that commuters can use to pay fares digitally.
 */
export function HaiboPayQR({ driverName, plateNumber, payReferenceCode }: HaiboPayQRProps) {
  const { theme, isDark } = useTheme();

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Pay your taxi fare with Haibo Pay!\n\nDriver: ${driverName}\nPlate: ${plateNumber}\nReference: ${payReferenceCode}\n\nDownload Haibo! app to pay digitally.`,
        title: "Haibo Pay Reference",
      });
    } catch (error) {
      console.error("Share error:", error);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? theme.backgroundSecondary : "#FFFFFF" }]}>
      <LinearGradient
        colors={BrandColors.gradient.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <Feather name="credit-card" size={20} color="#FFFFFF" />
        <ThemedText style={styles.headerText}>Haibo Pay</ThemedText>
      </LinearGradient>

      <View style={styles.content}>
        <ThemedText style={[styles.driverName, { color: theme.text }]}>{driverName}</ThemedText>
        <ThemedText style={[styles.plateNumber, { color: theme.textSecondary }]}>{plateNumber}</ThemedText>

        {/* Reference Code Display (replaces QR for now) */}
        <View style={[styles.referenceBox, { backgroundColor: BrandColors.primary.red + "08" }]}>
          <ThemedText style={[styles.referenceLabel, { color: theme.textSecondary }]}>
            Payment Reference
          </ThemedText>
          <ThemedText style={[styles.referenceCode, { color: BrandColors.primary.red }]}>
            {payReferenceCode}
          </ThemedText>
          <ThemedText style={[styles.referenceHint, { color: theme.textSecondary }]}>
            Share this code with commuters to receive payments
          </ThemedText>
        </View>

        <Pressable onPress={handleShare} style={styles.shareButton}>
          <LinearGradient
            colors={BrandColors.gradient.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.shareGradient}
          >
            <Feather name="share-2" size={18} color="#FFFFFF" />
            <ThemedText style={styles.shareText}>Share Reference</ThemedText>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  headerText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  content: {
    padding: Spacing.xl,
    alignItems: "center",
  },
  driverName: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  plateNumber: {
    fontSize: 14,
    marginBottom: Spacing.xl,
  },
  referenceBox: {
    width: "100%",
    padding: Spacing.xl,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  referenceLabel: {
    fontSize: 12,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  referenceCode: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: Spacing.sm,
  },
  referenceHint: {
    fontSize: 12,
    textAlign: "center",
  },
  shareButton: {
    width: "100%",
  },
  shareGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  shareText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
});
