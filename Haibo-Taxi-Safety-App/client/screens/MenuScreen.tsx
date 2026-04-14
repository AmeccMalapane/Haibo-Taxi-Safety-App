import React from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  Spacing,
  BorderRadius,
  BrandColors,
  Typography,
} from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

// typeui-clean rework — Menu as a calm services hub:
//   1. Single brand-tinted icon palette across all rows (drops the 8-color
//      rainbow — visual differentiation comes from the icon shape, not random
//      hue assignments)
//   2. Section labels use h4 token, no inline 14/700/uppercase soup
//   3. Featured row: rose gradient "City Explorer" headline + subtle rose-
//      bordered "Rate Driver" follow-up
//   4. Theme toggle: gradient-filled active pill instead of solid red
//   5. Account section detects auth state — shows "Manage account" when
//      signed in, "Sign in" otherwise (was always "Dashboard Login")
//   6. Drops the legacy Animated pulse on the login button (too noisy for a
//      settings surface) and switches to staggered FadeInDown section entries

type ThemeMode = "light" | "dark" | "system";
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface MenuItemProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  hint?: string;
  onPress: () => void;
}

function MenuItem({ icon, label, hint, onPress }: MenuItemProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuItem,
        {
          backgroundColor: pressed ? theme.backgroundSecondary : "transparent",
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View
        style={[
          styles.menuIconContainer,
          { backgroundColor: BrandColors.primary.gradientStart + "12" },
        ]}
      >
        <Feather
          name={icon}
          size={18}
          color={BrandColors.primary.gradientStart}
        />
      </View>
      <View style={styles.menuLabelWrap}>
        <ThemedText style={styles.menuLabel}>{label}</ThemedText>
        {hint ? (
          <ThemedText
            style={[styles.menuHint, { color: theme.textSecondary }]}
            numberOfLines={1}
          >
            {hint}
          </ThemedText>
        ) : null}
      </View>
      <Feather name="chevron-right" size={18} color={theme.textSecondary} />
    </Pressable>
  );
}

interface ThemeOptionProps {
  mode: ThemeMode;
  currentMode: ThemeMode;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: (mode: ThemeMode) => void;
}

function ThemeOption({
  mode,
  currentMode,
  icon,
  label,
  onPress,
}: ThemeOptionProps) {
  const { theme } = useTheme();
  const isActive = mode === currentMode;

  if (isActive) {
    return (
      <Pressable
        onPress={() => onPress(mode)}
        style={styles.themeOptionWrap}
        accessibilityRole="button"
        accessibilityState={{ selected: true }}
        accessibilityLabel={`${label} theme`}
      >
        <LinearGradient
          colors={BrandColors.gradient.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.themeOptionActive}
        >
          <Feather name={icon} size={16} color="#FFFFFF" />
          <ThemedText style={styles.themeOptionActiveLabel}>
            {label}
          </ThemedText>
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={() => onPress(mode)}
      style={styles.themeOption}
      accessibilityRole="button"
      accessibilityLabel={`${label} theme`}
    >
      <Feather name={icon} size={16} color={theme.textSecondary} />
      <ThemedText
        style={[styles.themeOptionLabel, { color: theme.textSecondary }]}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

export default function MenuScreen() {
  const reducedMotion = useReducedMotion();
  const { theme, themeMode, setThemeMode } = useTheme();
  const { isAuthenticated, user } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

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
  const handleCityExplorer = () => navigation.navigate("CityExplorer");
  const handleAuthLogin = () => navigation.navigate("Auth");
  const handleSettings = () => navigation.navigate("Settings");
  const handleRating = () => navigation.navigate("Rating");
  const handleDriverDashboard = () => navigation.navigate("DriverDashboard");
  const handleDriverOnboarding = () => navigation.navigate("DriverOnboarding");
  const handleNotifications = () => navigation.navigate("Notifications");

  const isDriver = user?.avatarType === "driver";

  const accountTitle = isAuthenticated
    ? user?.displayName || "Manage your account"
    : "Sign in to Haibo!";
  const accountHint = isAuthenticated
    ? "View profile, edit details and security"
    : "Save your contacts and unlock Haibo Pay";

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + Spacing.lg,
            paddingBottom: insets.bottom + Spacing["3xl"],
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(400)} style={styles.header}>
          <ThemedText style={styles.headerTitle}>Menu</ThemedText>
          <ThemedText
            style={[styles.headerSubtitle, { color: theme.textSecondary }]}
          >
            Services, safety tools and your account
          </ThemedText>
        </Animated.View>

        {/* Appearance */}
        <Animated.View
          entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(100)}
          style={styles.section}
        >
          <ThemedText
            style={[styles.sectionTitle, { color: theme.textSecondary }]}
          >
            APPEARANCE
          </ThemedText>
          <View
            style={[
              styles.themeToggle,
              { backgroundColor: theme.backgroundSecondary },
            ]}
          >
            <ThemeOption
              mode="light"
              currentMode={themeMode}
              icon="sun"
              label="Light"
              onPress={handleThemeChange}
            />
            <ThemeOption
              mode="dark"
              currentMode={themeMode}
              icon="moon"
              label="Dark"
              onPress={handleThemeChange}
            />
            <ThemeOption
              mode="system"
              currentMode={themeMode}
              icon="smartphone"
              label="Auto"
              onPress={handleThemeChange}
            />
          </View>
        </Animated.View>

        {/* Featured */}
        <Animated.View
          entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(200)}
          style={styles.section}
        >
          <ThemedText
            style={[styles.sectionTitle, { color: theme.textSecondary }]}
          >
            FEATURED
          </ThemedText>

          {/* City Explorer — gradient hero card */}
          <Pressable
            onPress={handleCityExplorer}
            style={({ pressed }) => [pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="City Explorer Challenge"
          >
            <LinearGradient
              colors={BrandColors.gradient.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.featuredCard}
            >
              <View style={styles.featuredIconWrap}>
                <Feather name="map" size={22} color="#FFFFFF" />
              </View>
              <View style={styles.featuredTextWrap}>
                <ThemedText style={styles.featuredTitle}>
                  City Explorer Challenge
                </ThemedText>
                <ThemedText style={styles.featuredSubtitle}>
                  Earn points across Mzansi
                </ThemedText>
              </View>
              <View style={styles.featuredBadge}>
                <ThemedText style={styles.featuredBadgeText}>+50</ThemedText>
              </View>
            </LinearGradient>
          </Pressable>

          {/* Rate Driver — rose-bordered follow-up */}
          <Pressable
            onPress={handleRating}
            style={({ pressed }) => [
              styles.featuredOutline,
              {
                backgroundColor: theme.surface,
                borderColor: BrandColors.primary.gradientStart + "33",
              },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Rate your driver"
          >
            <View
              style={[
                styles.featuredOutlineIcon,
                {
                  backgroundColor: BrandColors.primary.gradientStart + "12",
                },
              ]}
            >
              <Feather
                name="star"
                size={20}
                color={BrandColors.primary.gradientStart}
              />
            </View>
            <View style={styles.featuredTextWrap}>
              <ThemedText style={styles.featuredOutlineTitle}>
                Rate your driver
              </ThemedText>
              <ThemedText
                style={[
                  styles.featuredOutlineSubtitle,
                  { color: theme.textSecondary },
                ]}
              >
                Help us improve safety on every trip
              </ThemedText>
            </View>
            <Feather
              name="chevron-right"
              size={18}
              color={theme.textSecondary}
            />
          </Pressable>
        </Animated.View>

        {/* Services */}
        <Animated.View
          entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(300)}
          style={styles.section}
        >
          <ThemedText
            style={[styles.sectionTitle, { color: theme.textSecondary }]}
          >
            SERVICES
          </ThemedText>
          <View
            style={[
              styles.menuCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <MenuItem
              icon="phone-call"
              label="Emergency services"
              hint="10111, ambulance, fire"
              onPress={handleEmergencyServices}
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <MenuItem
              icon="book-open"
              label="Safety directory"
              hint="Trusted contacts and resources"
              onPress={handleSafetyDirectory}
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <MenuItem
              icon="search"
              label="Lost & found"
              hint="Report or claim items left in taxis"
              onPress={handleLostFound}
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <MenuItem
              icon="package"
              label="Haibo! Hub"
              hint="Send packages across SA"
              onPress={handleHub}
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <MenuItem
              icon="gift"
              label="Refer friends"
              hint="Earn rewards for every signup"
              onPress={handleReferral}
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <MenuItem
              icon="briefcase"
              label="Jobs"
              hint="Driver, association and admin roles"
              onPress={handleJobs}
            />
            {isDriver ? (
              <>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <MenuItem
                  icon="truck"
                  label="Driver dashboard"
                  hint="GPS tracking, Haibo Pay, quick actions"
                  onPress={handleDriverDashboard}
                />
              </>
            ) : (
              <>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <MenuItem
                  icon="truck"
                  label="Become a driver"
                  hint="Register your taxi to accept Haibo Pay"
                  onPress={handleDriverOnboarding}
                />
              </>
            )}
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <MenuItem
              icon="bell"
              label="Notifications"
              hint="Payment receipts, alerts and updates"
              onPress={handleNotifications}
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <MenuItem
              icon="settings"
              label="Settings"
              onPress={handleSettings}
            />
          </View>
        </Animated.View>

        {/* Account */}
        <Animated.View
          entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(400)}
          style={styles.section}
        >
          <ThemedText
            style={[styles.sectionTitle, { color: theme.textSecondary }]}
          >
            ACCOUNT
          </ThemedText>

          <Pressable
            onPress={handleAuthLogin}
            style={({ pressed }) => [pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={accountTitle}
          >
            <LinearGradient
              colors={BrandColors.gradient.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.accountCard}
            >
              <View style={styles.featuredIconWrap}>
                <Feather
                  name={isAuthenticated ? "user" : "log-in"}
                  size={22}
                  color="#FFFFFF"
                />
              </View>
              <View style={styles.featuredTextWrap}>
                <ThemedText style={styles.featuredTitle} numberOfLines={1}>
                  {accountTitle}
                </ThemedText>
                <ThemedText style={styles.featuredSubtitle} numberOfLines={1}>
                  {accountHint}
                </ThemedText>
              </View>
              <Feather name="arrow-right" size={20} color="#FFFFFF" />
            </LinearGradient>
          </Pressable>
        </Animated.View>
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

  // Header
  header: {
    marginBottom: Spacing.xl,
  },
  headerTitle: {
    ...Typography.h1,
  },
  headerSubtitle: {
    ...Typography.body,
    marginTop: 2,
  },

  // Section
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    ...Typography.label,
    letterSpacing: 1.4,
    fontSize: 11,
    marginBottom: Spacing.md,
    marginLeft: Spacing.xs,
  },

  // Theme toggle
  themeToggle: {
    flexDirection: "row",
    borderRadius: BorderRadius.md,
    padding: 4,
    gap: 4,
  },
  themeOptionWrap: {
    flex: 1,
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
  },
  themeOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: 6,
  },
  themeOptionActive: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    gap: 6,
  },
  themeOptionLabel: {
    ...Typography.small,
    fontWeight: "600",
  },
  themeOptionActiveLabel: {
    ...Typography.small,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // Featured (gradient card)
  featuredCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    shadowColor: BrandColors.primary.gradientStart,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 8,
  },
  featuredIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  featuredTextWrap: {
    flex: 1,
  },
  featuredTitle: {
    ...Typography.h4,
    color: "#FFFFFF",
  },
  featuredSubtitle: {
    ...Typography.small,
    color: "rgba(255,255,255,0.85)",
    marginTop: 2,
  },
  featuredBadge: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  featuredBadgeText: {
    ...Typography.label,
    fontSize: 11,
    fontWeight: "800",
    color: BrandColors.primary.gradientStart,
  },

  // Featured outline (rose-bordered)
  featuredOutline: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
  },
  featuredOutlineIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  featuredOutlineTitle: {
    ...Typography.body,
    fontWeight: "700",
  },
  featuredOutlineSubtitle: {
    ...Typography.small,
    marginTop: 2,
  },

  // Menu card + items
  menuCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  menuLabelWrap: {
    flex: 1,
  },
  menuLabel: {
    ...Typography.body,
    fontWeight: "600",
  },
  menuHint: {
    ...Typography.small,
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginLeft: Spacing.lg + 36 + Spacing.md,
  },

  // Account
  accountCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    shadowColor: BrandColors.primary.gradientStart,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 8,
  },

  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});
