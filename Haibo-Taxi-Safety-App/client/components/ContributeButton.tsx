import React from "react";
import { Pressable, StyleSheet, ViewStyle, StyleProp } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

interface ContributeButtonProps {
  variant?: "filled" | "outlined" | "compact";
  style?: StyleProp<ViewStyle>;
}

export function ContributeButton({ variant = "filled", style }: ContributeButtonProps) {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const handlePress = async () => {
    try {
      const Haptics = await import("expo-haptics");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    navigation.navigate("RouteDrawing");
  };

  if (variant === "compact") {
    return (
      <Pressable
        style={[styles.compactButton, { backgroundColor: `${BrandColors.primary.blue}15` }, style]}
        onPress={handlePress}
      >
        <Feather name="plus" size={16} color={BrandColors.primary.blue} />
      </Pressable>
    );
  }

  if (variant === "outlined") {
    return (
      <Pressable
        style={[
          styles.outlinedButton,
          { borderColor: BrandColors.primary.blue, backgroundColor: "transparent" },
          style,
        ]}
        onPress={handlePress}
      >
        <Feather name="plus-circle" size={18} color={BrandColors.primary.blue} />
        <ThemedText style={[styles.outlinedButtonText, { color: BrandColors.primary.blue }]}>
          Contribute
        </ThemedText>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={[styles.filledButton, { backgroundColor: BrandColors.primary.blue }, style]}
      onPress={handlePress}
    >
      <Feather name="plus" size={18} color="#FFFFFF" />
      <ThemedText style={styles.filledButtonText}>Contribute Route</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  filledButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  filledButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  outlinedButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
    gap: Spacing.xs,
  },
  outlinedButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  compactButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
