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
import { HaiboLogo } from "@/components/HaiboLogo";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useLanguage } from "@/hooks/useLanguage";
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
  /** Icon chip accent color. Defaults to the brand rose. Pass one of the
   *  BrandColors.accent.* or status palette entries so each service gets
   *  its own visual anchor (faster scanning, less visual monotony). */
  accent?: string;
}

function MenuItem({ icon, label, hint, onPress, accent }: MenuItemProps) {
  const { theme } = useTheme();
  const tint = accent || BrandColors.primary.gradientStart;

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
          { backgroundColor: tint + "16" },
        ]}
      >
        <Feather name={icon} size={18} color={tint} />
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

// PayTile — square quick-action card used only in the Pay grid. Icon
// chip sits above the label so all four tiles read like a single
// poster row instead of four separate list items. Tile card colour
// picks up the theme surface so the rose/teal/fuchsia/sky accents
// have a neutral backdrop to contrast against.
interface PayTileProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  accent: string;
  onPress: () => void;
  accessibilityLabel: string;
}

function PayTile({
  icon,
  label,
  accent,
  onPress,
  accessibilityLabel,
}: PayTileProps) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.payTile,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <View
        style={[
          styles.payTileIcon,
          { backgroundColor: accent + "18" },
        ]}
      >
        <Feather name={icon} size={20} color={accent} />
      </View>
      <ThemedText style={styles.payTileLabel} numberOfLines={1}>
        {label}
      </ThemedText>
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
  const { t } = useLanguage();
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

  const handlePayVendor = () => navigation.navigate("PayVendor");
  const handlePayDriver = () => navigation.navigate("PayDriver");
  const handleWallet = () => navigation.navigate("Wallet");
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
    ? user?.displayName || t("menu.manageAccount")
    : t("menu.signIn");
  const accountHint = isAuthenticated
    ? t("menu.manageAccountHint")
    : t("menu.signInHint");

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
        {/* Header — Haibo shield anchors the services hub as the app's
            "home base". Small enough to read as an identity mark rather
            than a hero image, positioned left of the title so it reads
            as a single header unit instead of stacked decoration. */}
        <Animated.View
          entering={reducedMotion ? undefined : FadeIn.duration(400)}
          style={styles.header}
        >
          <HaiboLogo size={52} style={styles.headerLogo} />
          <View style={styles.headerTextWrap}>
            <ThemedText style={styles.headerTitle}>{t("menu.title")}</ThemedText>
            <ThemedText
              style={[styles.headerSubtitle, { color: theme.textSecondary }]}
              numberOfLines={2}
            >
              {t("menu.subtitle")}
            </ThemedText>
          </View>
        </Animated.View>

        {/* Appearance */}
        <Animated.View
          entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(100)}
          style={styles.section}
        >
          <ThemedText
            style={[styles.sectionTitle, { color: theme.textSecondary }]}
          >
            {t("menu.appearance")}
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
              label={t("menu.light")}
              onPress={handleThemeChange}
            />
            <ThemeOption
              mode="dark"
              currentMode={themeMode}
              icon="moon"
              label={t("menu.dark")}
              onPress={handleThemeChange}
            />
            <ThemeOption
              mode="system"
              currentMode={themeMode}
              icon="smartphone"
              label={t("menu.auto")}
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
            {t("menu.featured")}
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
                  {t("menu.cityExplorer")}
                </ThemedText>
                <ThemedText style={styles.featuredSubtitle}>
                  {t("menu.cityExplorerHint")}
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
                {t("menu.rateDriver")}
              </ThemedText>
              <ThemedText
                style={[
                  styles.featuredOutlineSubtitle,
                  { color: theme.textSecondary },
                ]}
              >
                {t("menu.rateDriverHint")}
              </ThemedText>
            </View>
            <Feather
              name="chevron-right"
              size={18}
              color={theme.textSecondary}
            />
          </Pressable>
        </Animated.View>

        {/* Pay — 4-up horizontal quick-grid. These are the highest-
            intent taps in the services hub (money moves + logistics) so
            they get their own poster-style row at the top of the menu
            instead of living buried inside the generic services list.
            Each tile is a square card with a colored icon chip + short
            label, sized so all four fit on a 375px screen without
            shrinking below the 44pt touch target. */}
        <Animated.View
          entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(250)}
          style={styles.section}
        >
          <ThemedText
            style={[styles.sectionTitle, { color: theme.textSecondary }]}
          >
            PAY
          </ThemedText>
          <View style={styles.payGrid}>
            <PayTile
              icon="shopping-bag"
              label="Pay vendor"
              accent={BrandColors.primary.gradientStart}
              onPress={handlePayVendor}
              accessibilityLabel="Pay a vendor"
            />
            <PayTile
              icon="truck"
              label="Pay fare"
              accent={BrandColors.accent.teal}
              onPress={handlePayDriver}
              accessibilityLabel="Pay a taxi fare"
            />
            <PayTile
              icon="credit-card"
              label="Wallet"
              accent={BrandColors.accent.fuchsia}
              onPress={handleWallet}
              accessibilityLabel="Wallet"
            />
            <PayTile
              icon="package"
              label="Haibo! Hub"
              accent={BrandColors.accent.sky}
              onPress={handleHub}
              accessibilityLabel="Haibo Hub"
            />
          </View>
        </Animated.View>

        {/* Services */}
        <Animated.View
          entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(300)}
          style={styles.section}
        >
          <ThemedText
            style={[styles.sectionTitle, { color: theme.textSecondary }]}
          >
            {t("menu.services")}
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
              label={t("menu.emergencyServices")}
              hint={t("menu.emergencyServicesHint")}
              onPress={handleEmergencyServices}
              accent={BrandColors.status.emergency}
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <MenuItem
              icon="book-open"
              label={t("menu.safetyDirectory")}
              hint={t("menu.safetyDirectoryHint")}
              onPress={handleSafetyDirectory}
              accent={BrandColors.accent.sky}
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <MenuItem
              icon="search"
              label={t("menu.lostFound")}
              hint={t("menu.lostFoundHint")}
              onPress={handleLostFound}
              accent={BrandColors.accent.yellow}
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <MenuItem
              icon="gift"
              label={t("menu.referFriends")}
              hint={t("menu.referFriendsHint")}
              onPress={handleReferral}
              accent={BrandColors.accent.fuchsia}
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <MenuItem
              icon="briefcase"
              label={t("menu.jobs")}
              hint={t("menu.jobsHint")}
              onPress={handleJobs}
              accent={BrandColors.accent.lime}
            />
            {isDriver ? (
              <>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <MenuItem
                  icon="truck"
                  label={t("menu.driverDashboard")}
                  hint={t("menu.driverDashboardHint")}
                  onPress={handleDriverDashboard}
                  accent={BrandColors.primary.blue}
                />
              </>
            ) : (
              <>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <MenuItem
                  icon="truck"
                  label={t("menu.becomeDriver")}
                  hint={t("menu.becomeDriverHint")}
                  onPress={handleDriverOnboarding}
                  accent={BrandColors.primary.blue}
                />
              </>
            )}
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <MenuItem
              icon="bell"
              label={t("menu.notifications")}
              hint={t("menu.notificationsHint")}
              onPress={handleNotifications}
              accent={BrandColors.primary.green}
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <MenuItem
              icon="settings"
              label={t("menu.settingsLabel")}
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
            {t("menu.account")}
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
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  headerLogo: {
    // The HaiboLogo wraps a square image, but the shield itself is
    // portrait inside a padded square. A little negative margin on the
    // right snugs the title up against the wordmark-free shield without
    // making the header feel cramped.
    marginRight: -2,
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    ...Typography.h1,
    lineHeight: Typography.h1.lineHeight - 6,
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

  // Pay quick-grid — 4-up horizontal row. Each tile ~23% of the row
  // width so all four fit inside the Spacing.lg-padded scroll area on
  // a 375px screen without tile labels truncating. Square-ish aspect
  // keeps the icon chip visually dominant (quick recognition) with
  // the label as a caption underneath.
  payGrid: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  payTile: {
    flex: 1,
    aspectRatio: 0.95,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    gap: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  payTileIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  payTileLabel: {
    ...Typography.small,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
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
