import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  Linking,
  Platform,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";

import { useTheme } from "@/hooks/useTheme";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  Spacing,
  BrandColors,
  BorderRadius,
  Typography,
} from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import {
  getEmergencyContactsList,
  getEmergencyCategories,
  LocalEmergencyContact,
} from "@/lib/localData";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

// typeui-clean rework — Safety Directory as a calm, browsable index of
// every safety-relevant phone number in SA, grouped by category. Shares
// the same data source as EmergencyServicesScreen but emphasises browsing
// (section headers, full categorisation) over quick-dialing primary numbers.
//
// NOTE: There's content overlap with EmergencyServicesScreen — both pull
// from getEmergencyContactsList(). Worth consolidating into a single
// screen later, but keeping them separate for now because they're linked
// from different MenuScreen entries with different user intents.

const CATEGORY_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  "National Emergency Services": "alert-circle",
  "General Emergency Services": "phone-call",
  "Medical Emergency Services": "heart",
  "Crime Reporting Safety": "shield",
  "Road Traffic Assistance": "truck",
  "Gender Based Violence Support": "users",
  "Mental Health Support": "smile",
  "Substance Abuse Support": "activity",
  "Family Child Support": "home",
  "Disaster Relief": "cloud-lightning",
  "Utility Services Emergencies": "zap",
  "Animal Emergencies Welfare": "github",
  "Departmental Contacts": "briefcase",
  "Gauteng Local Services": "map-pin",
  "South Coast Services": "compass",
  "Western Cape": "compass",
  "Other Essential Contacts": "info",
};

function categoryIconFor(category: string): keyof typeof Feather.glyphMap {
  return CATEGORY_ICONS[category] || "info";
}

export default function SafetyDirectoryScreen() {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All");

  const allContacts = useMemo(() => getEmergencyContactsList(), []);
  const categories = useMemo(() => getEmergencyCategories(), []);

  const filteredContacts = useMemo(() => {
    let result = allContacts;
    if (selectedCategory !== "All") {
      result = result.filter((c) => c.category === selectedCategory);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q)
      );
    }
    return result;
  }, [allContacts, selectedCategory, searchQuery]);

  const groupedData = useMemo(() => {
    const groups: { title: string; data: LocalEmergencyContact[] }[] = [];
    const catMap = new Map<string, LocalEmergencyContact[]>();
    filteredContacts.forEach((c) => {
      const existing = catMap.get(c.category);
      if (existing) existing.push(c);
      else catMap.set(c.category, [c]);
    });
    catMap.forEach((data, title) => groups.push({ title, data }));
    return groups;
  }, [filteredContacts]);

  const handleCall = useCallback(async (phone: string) => {
    try {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
      const url = `tel:${phone.replace(/\s/g, "")}`;
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        Linking.openURL(url);
      }
    } catch {}
  }, []);

  const handleCategorySelect = (cat: string) => {
    Haptics.selectionAsync();
    setSelectedCategory(cat);
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing["3xl"] },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Rose gradient hero */}
        <LinearGradient
          colors={BrandColors.gradient.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + Spacing.lg }]}
        >
          <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(300)}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Feather name="arrow-left" size={22} color="#FFFFFF" />
            </Pressable>
          </Animated.View>

          <Animated.View
            entering={reducedMotion ? undefined : FadeIn.duration(400).delay(100)}
            style={styles.heroBadgeWrap}
          >
            <View style={styles.heroBadge}>
              <Feather name="book-open" size={32} color={BrandColors.primary.gradientStart} />
            </View>
          </Animated.View>

          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(150)}
            style={styles.heroText}
          >
            <ThemedText style={styles.heroTitle}>Safety directory</ThemedText>
            <ThemedText style={styles.heroSubtitle}>
              Every safety hotline across South Africa, organised by category.
            </ThemedText>
          </Animated.View>
        </LinearGradient>

        {/* Floating content card */}
        <Animated.View
          entering={reducedMotion ? undefined : FadeInUp.duration(500).delay(200)}
          style={[
            styles.contentCard,
            { backgroundColor: theme.backgroundRoot },
          ]}
        >
          {/* Search bar */}
          <View
            style={[
              styles.searchBar,
              {
                backgroundColor: theme.backgroundDefault,
                borderColor: searchFocused
                  ? BrandColors.primary.gradientStart
                  : theme.border,
              },
            ]}
          >
            <Feather name="search" size={18} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search by name, number or description"
              placeholderTextColor={theme.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              returnKeyType="search"
            />
            {searchQuery ? (
              <Pressable
                onPress={() => setSearchQuery("")}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Feather name="x" size={16} color={theme.textSecondary} />
              </Pressable>
            ) : null}
          </View>

          {/* Category filter */}
          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(250)}
            style={styles.categoriesSection}
          >
            <ThemedText
              style={[styles.sectionLabel, { color: theme.textSecondary }]}
            >
              CATEGORIES
            </ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesList}
              keyboardShouldPersistTaps="handled"
            >
              {categories.map((cat) => {
                const isActive = selectedCategory === cat;
                const label = cat === "All" ? `All · ${allContacts.length}` : cat;

                if (isActive) {
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => handleCategorySelect(cat)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: true }}
                    >
                      <LinearGradient
                        colors={BrandColors.gradient.primary}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.filterChipActive}
                      >
                        <ThemedText style={styles.filterChipActiveText}>
                          {label}
                        </ThemedText>
                      </LinearGradient>
                    </Pressable>
                  );
                }

                return (
                  <Pressable
                    key={cat}
                    onPress={() => handleCategorySelect(cat)}
                    style={({ pressed }) => [
                      styles.filterChip,
                      {
                        backgroundColor: theme.backgroundDefault,
                        borderColor: theme.border,
                      },
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                  >
                    <ThemedText
                      style={[styles.filterChipText, { color: theme.text }]}
                    >
                      {label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Animated.View>

          {/* Stats line */}
          <View style={styles.statsBar}>
            <ThemedText
              style={[styles.statsText, { color: theme.textSecondary }]}
            >
              {filteredContacts.length} contact
              {filteredContacts.length === 1 ? "" : "s"} ·{" "}
              {groupedData.length} categor
              {groupedData.length === 1 ? "y" : "ies"}
            </ThemedText>
          </View>

          {/* Grouped contacts */}
          {groupedData.length === 0 ? (
            <Animated.View
              entering={reducedMotion ? undefined : FadeIn.duration(400)}
              style={styles.emptyState}
            >
              <View
                style={[
                  styles.emptyIcon,
                  { backgroundColor: BrandColors.primary.gradientStart + "12" },
                ]}
              >
                <Feather
                  name="phone-off"
                  size={26}
                  color={BrandColors.primary.gradientStart}
                />
              </View>
              <ThemedText style={styles.emptyTitle}>No contacts found</ThemedText>
              <ThemedText
                style={[styles.emptyHint, { color: theme.textSecondary }]}
              >
                Try a different search or clear the active category filter.
              </ThemedText>
            </Animated.View>
          ) : (
            <View style={styles.groupsContainer}>
              {groupedData.map((group, groupIndex) => (
                <Animated.View
                  key={group.title}
                  entering={reducedMotion ? undefined : FadeInDown.duration(400).delay(
                    Math.min(groupIndex * 60, 400)
                  )}
                  style={styles.group}
                >
                  <View style={styles.groupHeader}>
                    <View
                      style={[
                        styles.groupIcon,
                        {
                          backgroundColor:
                            BrandColors.primary.gradientStart + "12",
                        },
                      ]}
                    >
                      <Feather
                        name={categoryIconFor(group.title)}
                        size={14}
                        color={BrandColors.primary.gradientStart}
                      />
                    </View>
                    <ThemedText style={styles.groupTitle}>
                      {group.title}
                    </ThemedText>
                    <View
                      style={[
                        styles.groupCount,
                        {
                          backgroundColor:
                            BrandColors.primary.gradientStart + "12",
                        },
                      ]}
                    >
                      <ThemedText style={styles.groupCountText}>
                        {group.data.length}
                      </ThemedText>
                    </View>
                  </View>

                  {group.data.map((contact, idx) => (
                    <Pressable
                      key={`${contact.id}-${idx}`}
                      onPress={() => handleCall(contact.phone)}
                      style={({ pressed }) => [
                        styles.contactCard,
                        {
                          backgroundColor: theme.surface,
                          borderColor: theme.border,
                        },
                        pressed && styles.pressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Call ${contact.name}`}
                    >
                      <View style={styles.contactInfo}>
                        <ThemedText
                          style={styles.contactName}
                          numberOfLines={1}
                        >
                          {contact.name}
                        </ThemedText>
                        <ThemedText
                          style={[
                            styles.contactDescription,
                            { color: theme.textSecondary },
                          ]}
                          numberOfLines={2}
                        >
                          {contact.description}
                        </ThemedText>
                        <ThemedText
                          style={styles.contactPhone}
                          numberOfLines={1}
                        >
                          {contact.phone}
                        </ThemedText>
                      </View>
                      <View style={styles.callButtonWrap}>
                        <LinearGradient
                          colors={BrandColors.gradient.primary}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.callButton}
                        >
                          <Feather name="phone" size={18} color="#FFFFFF" />
                        </LinearGradient>
                      </View>
                    </Pressable>
                  ))}
                </Animated.View>
              ))}
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // Hero
  hero: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    marginBottom: Spacing.lg,
  },
  heroBadgeWrap: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  heroBadge: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  heroText: {
    alignItems: "center",
  },
  heroTitle: {
    ...Typography.h2,
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  heroSubtitle: {
    ...Typography.body,
    color: "rgba(255,255,255,0.92)",
    textAlign: "center",
    maxWidth: 320,
  },

  // Content card
  contentCard: {
    flex: 1,
    marginTop: -Spacing["2xl"],
    borderTopLeftRadius: BorderRadius["2xl"],
    borderTopRightRadius: BorderRadius["2xl"],
    paddingTop: Spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },

  // Search
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.lg,
    paddingHorizontal: Spacing.md,
    height: 48,
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  searchInput: {
    ...Typography.body,
    flex: 1,
  },

  sectionLabel: {
    ...Typography.label,
    letterSpacing: 1.4,
    fontSize: 11,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },

  // Categories
  categoriesSection: {
    marginBottom: Spacing.md,
  },
  categoriesList: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
  },
  filterChipText: {
    ...Typography.small,
    fontWeight: "600",
  },
  filterChipActive: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  filterChipActiveText: {
    ...Typography.small,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // Stats
  statsBar: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  statsText: {
    ...Typography.small,
    fontSize: 12,
  },

  // Groups
  groupsContainer: {
    paddingHorizontal: Spacing.lg,
  },
  group: {
    marginBottom: Spacing.lg,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  groupIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  groupTitle: {
    ...Typography.label,
    letterSpacing: 1.2,
    fontSize: 11,
    color: BrandColors.primary.gradientStart,
    flex: 1,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  groupCount: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    minWidth: 24,
    alignItems: "center",
  },
  groupCountText: {
    ...Typography.label,
    fontSize: 10,
    fontWeight: "700",
    color: BrandColors.primary.gradientStart,
  },

  // Contact card
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  contactInfo: {
    flex: 1,
    marginRight: Spacing.md,
    minWidth: 0,
  },
  contactName: {
    ...Typography.body,
    fontWeight: "700",
  },
  contactDescription: {
    ...Typography.small,
    fontSize: 12,
    marginTop: 2,
  },
  contactPhone: {
    ...Typography.body,
    fontWeight: "700",
    color: BrandColors.primary.gradientStart,
    fontVariant: ["tabular-nums"],
    marginTop: 4,
  },
  callButtonWrap: {
    borderRadius: BorderRadius.full,
    overflow: "hidden",
  },
  callButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  // Empty
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    ...Typography.h4,
    marginBottom: Spacing.xs,
  },
  emptyHint: {
    ...Typography.small,
    textAlign: "center",
    maxWidth: 280,
  },

  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});
