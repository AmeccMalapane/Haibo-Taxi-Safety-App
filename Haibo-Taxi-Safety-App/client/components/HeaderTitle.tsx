import React from "react";
import { View, StyleSheet, Image } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, BrandColors } from "@/constants/theme";

export function HeaderTitle() {
  return (
    <View style={styles.container}>
      <Image
        source={require("../../assets/images/icon.png")}
        style={styles.icon}
        resizeMode="contain"
      />
      <View style={styles.textContainer}>
        <ThemedText style={styles.title}>Haibo!</ThemedText>
        <ThemedText style={styles.subtitle}>Taxi</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  icon: {
    width: 32,
    height: 32,
    marginRight: Spacing.sm,
    borderRadius: 8,
  },
  textContainer: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: BrandColors.primary.red,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: "600",
    marginLeft: 4,
  },
});
