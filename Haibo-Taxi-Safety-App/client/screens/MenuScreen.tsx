import React, { useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Linking,
  Platform,
  Animated,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, BrandColors } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface MenuItemProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  color?: string;
}

function MenuItem({ icon, label, onPress, color }: MenuItemProps) {
  const { theme } = useTheme();
  const iconColor = color || theme.text;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuItem,
        { 
          backgroundColor: pressed ? theme.backgroundSecondary : 'transparent',
        },
      ]}
    >
      <View style={[styles.menuIconContainer, { backgroundColor: (color || theme.text) + "15" }]}>
        <Feather name={icon} size={20} color={iconColor} />
      </View>
      <ThemedText style={styles.menuLabel}>{label}</ThemedText>
      <Feather name="chevron-right" size={18} color={theme.textSecondary} />
    </Pressable>
  );
}

type ThemeMode = "light" | "dark" | "system";

interface ThemeOptionProps {
  mode: ThemeMode;
  currentMode: ThemeMode;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: (mode: ThemeMode) => void;
}

function ThemeOption({ mode, currentMode, icon, label, onPress }: ThemeOptionProps) {
  const { theme } = useTheme();
  const isActive = mode === currentMode;

  return (
    <Pressable
      onPress={() => onPress(mode)}
      style={[
        styles.themeOption,
        { 
          backgroundColor: isActive ? BrandColors.primary.red : 'transparent',
        },
      ]}
    >
      <Feather name={icon} size={18} color={isActive ? '#FFFFFF' : theme.textSecondary} />
      <ThemedText 
        style={[
          styles.themeOptionLabel,
          { color: isActive ? '#FFFFFF' : theme.textSecondary },
        ]}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

export default function MenuScreen() {
  const { theme, themeMode, setThemeMode } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const handleThemeChange = async (mode: ThemeMode) => {
    setThemeMode(mode);
    if (Platform.OS !== "web") {
      try {
        const Haptics = await import("expo-haptics");
        await Haptics.selectionAsync();
      } catch {}
    }
  };

  const handleEmergencyServices = () => navigation.navigate("EmergencyServices");
  const handleSafetyDirectory = () => navigation.navigate("SafetyDirectory");
  const handleHub = () => navigation.navigate("Hub");
  const handleLostFound = () => navigation.navigate("LostFound");
  const handleReferral = () => navigation.navigate("Referral");
  const handleJobs = () => navigation.navigate("Jobs");
  const handleEvents = () => navigation.navigate("Events");
  const handleCityExplorer = () => navigation.navigate("CityExplorer");
  const handleAuthLogin = () => navigation.navigate("Auth");
  const handleSettings = () => navigation.navigate("Settings");
  const handleRating = () => navigation.navigate("Rating");

  return (
    <ThemedView style={styles.container}>
      <ScrollView 
        contentContainerStyle={[
          styles.scrollContent, 
          { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.xl }
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Appearance</ThemedText>
          <View style={[styles.themeToggle, { backgroundColor: theme.backgroundSecondary }]}>
            <ThemeOption mode="light" currentMode={themeMode} icon="sun" label="Light" onPress={handleThemeChange} />
            <ThemeOption mode="dark" currentMode={themeMode} icon="moon" label="Dark" onPress={handleThemeChange} />
            <ThemeOption mode="system" currentMode={themeMode} icon="smartphone" label="System" onPress={handleThemeChange} />
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Featured</ThemedText>
          <Pressable
            onPress={handleCityExplorer}
            style={({ pressed }) => [
              styles.unifiedButton,
              { 
                backgroundColor: BrandColors.primary.red,
                opacity: pressed ? 0.9 : 1,
                marginBottom: Spacing.md,
              },
            ]}
          >
            <View style={styles.buttonIconContainer}>
              <Feather name="map" size={24} color="#FFFFFF" />
            </View>
            <View style={styles.buttonTextContainer}>
              <ThemedText style={styles.buttonTitle}>City Explorer Challenge</ThemedText>
              <ThemedText style={styles.buttonSubtitle}>Earn points & win rewards</ThemedText>
            </View>
            <View style={styles.buttonBadge}>
              <ThemedText style={styles.buttonBadgeText}>+50</ThemedText>
            </View>
          </Pressable>

          <Pressable
            onPress={handleRating}
            style={({ pressed }) => [
              styles.unifiedButton,
              { 
                backgroundColor: BrandColors.secondary.orange,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <View style={styles.buttonIconContainer}>
              <Feather name="star" size={24} color="#FFFFFF" />
            </View>
            <View style={styles.buttonTextContainer}>
              <ThemedText style={styles.buttonTitle}>Rate Your Driver</ThemedText>
              <ThemedText style={styles.buttonSubtitle}>Help improve safety & service</ThemedText>
            </View>
            <Feather name="chevron-right" size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Services</ThemedText>
          <View style={[styles.menuCard, { backgroundColor: theme.backgroundSecondary }]}>
            <MenuItem icon="gift" label="Refer Friends" onPress={handleReferral} color={BrandColors.primary.green} />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <MenuItem icon="package" label="Haibo! Hub" onPress={handleHub} color={BrandColors.primary.blue} />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <MenuItem icon="search" label="Lost & Found" onPress={handleLostFound} color={BrandColors.secondary.orange} />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <MenuItem icon="phone-call" label="Emergency Services" onPress={handleEmergencyServices} color={BrandColors.primary.red} />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <MenuItem icon="book-open" label="Safety Directory" onPress={handleSafetyDirectory} color="#00BCD4" />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <MenuItem icon="briefcase" label="Job Search" onPress={handleJobs} color="#1976D2" />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <MenuItem icon="settings" label="Settings" onPress={handleSettings} color={BrandColors.gray[600]} />
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Account</ThemedText>
          <Animated.View style={{ transform: [{ scale: pulseAnim }], marginBottom: Spacing.md }}>
            <Pressable
              onPress={handleAuthLogin}
              style={({ pressed }) => [
                styles.unifiedButton,
                { backgroundColor: BrandColors.primary.red, opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <View style={styles.buttonIconContainer}>
                <Feather name="user" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.buttonTextContainer}>
                <ThemedText style={styles.buttonTitle}>Dashboard Login</ThemedText>
                <ThemedText style={styles.buttonSubtitle}>Access your full account</ThemedText>
              </View>
              <Feather name="arrow-right" size={20} color="#FFFFFF" />
            </Pressable>
          </Animated.View>
        </View>
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
  themeToggle: {
    flexDirection: "row",
    borderRadius: BorderRadius.md,
    padding: 4,
  },
  themeOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: BorderRadius.sm,
    gap: 8,
  },
  themeOptionLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  unifiedButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  buttonTextContainer: {
    flex: 1,
  },
  buttonTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  buttonSubtitle: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.8)",
  },
  buttonBadge: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  buttonBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: BrandColors.primary.red,
  },
  menuCard: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  menuLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    marginHorizontal: Spacing.lg,
  },
});
