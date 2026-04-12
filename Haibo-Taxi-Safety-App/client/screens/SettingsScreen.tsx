import React from "react";
import { View, StyleSheet, ScrollView, Pressable, Switch, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";

interface SettingItemProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value?: boolean;
  onValueChange?: (value: boolean) => void;
  onPress?: () => void;
  type?: "toggle" | "link";
  color?: string;
}

function SettingItem({ icon, label, value, onValueChange, onPress, type = "link", color }: SettingItemProps) {
  const { theme } = useTheme();
  return (
    <Pressable 
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingItem,
        { backgroundColor: pressed ? theme.backgroundSecondary : "transparent" }
      ]}
    >
      <View style={[styles.settingIconContainer, { backgroundColor: (color || BrandColors.primary.red) + "15" }]}>
        <Feather name={icon} size={20} color={color || BrandColors.primary.red} />
      </View>
      <ThemedText style={styles.settingLabel}>{label}</ThemedText>
      {type === "toggle" ? (
        <Switch 
          value={value} 
          onValueChange={onValueChange}
          trackColor={{ false: theme.border, true: BrandColors.primary.red }}
          thumbColor={Platform.OS === "ios" ? undefined : "#FFFFFF"}
        />
      ) : (
        <Feather name="chevron-right" size={20} color={theme.textSecondary} />
      )}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = React.useState(true);
  const [locationSharing, setLocationSharing] = React.useState(true);

  return (
    <ThemedView style={styles.container}>
      <ScrollView 
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.xl }
        ]}
      >
        <ThemedText type="h2" style={styles.title}>Settings</ThemedText>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Privacy & Security</ThemedText>
          <View style={[styles.card, { backgroundColor: theme.backgroundSecondary }]}>
            <SettingItem 
              icon="bell" 
              label="Push Notifications" 
              type="toggle" 
              value={notifications} 
              onValueChange={setNotifications} 
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <SettingItem 
              icon="map-pin" 
              label="Real-time Location" 
              type="toggle" 
              value={locationSharing} 
              onValueChange={setLocationSharing} 
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <SettingItem icon="shield" label="Privacy Policy" />
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Support</ThemedText>
          <View style={[styles.card, { backgroundColor: theme.backgroundSecondary }]}>
            <SettingItem icon="help-circle" label="Help Center" />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <SettingItem icon="mail" label="Contact Support" />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <SettingItem icon="info" label="App Version" type="link" />
          </View>
        </View>

        <Pressable style={styles.logoutButton}>
          <Feather name="log-out" size={20} color={BrandColors.status.emergency} />
          <ThemedText style={styles.logoutText}>Logout</ThemedText>
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  title: {
    marginBottom: Spacing.xl,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: BrandColors.primary.red,
    marginBottom: Spacing.md,
    marginLeft: 4,
  },
  card: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
  },
  settingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  settingLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    marginHorizontal: Spacing.lg,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: BorderRadius.lg,
    gap: 12,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: BrandColors.status.emergency,
  },
  logoutText: {
    color: BrandColors.status.emergency,
    fontSize: 16,
    fontWeight: "700",
  },
});
