import React, { useState, useMemo } from "react";
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
import { getEmergencyContactsList } from "@/lib/localData";
import {
  Spacing,
  BrandColors,
  BorderRadius,
  Typography,
} from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

// typeui-clean rework — emergency services as a calm directory:
//   1. Rose gradient hero with phone-call badge + back button
//   2. Primary numbers (10111, ambulance, fire) as bold emergency-red
//      cards — keeps the high-urgency colour because the context demands it
//   3. Category chips in rose tint with a gradient-filled active state
//      (drops the 9-color rainbow that came before)
//   4. Contact rows with rose monogram icons, rose phone numbers, and a
//      rose-gradient call button — single brand palette
//   5. Empty state with rose-tinted phone-off icon
//   6. Drops the dead `isLoading = false` branch and the unused PrimaryNumber
//      `icon` / `color` fields that were assigned but never read

interface EmergencyContact {
  id: string;
  name: string;
  category: string;
  phone: string;
  description?: string;
}

interface PrimaryNumber {
  id: string;
  number: string;
  name: string;
  description?: string;
}

const CATEGORY_ICONS: { [key: string]: keyof typeof Feather.glyphMap } = {
  police: "shield",
  fire: "zap",
  medical: "heart",
  ambulance: "truck",
  crisis: "phone-call",
  municipal: "home",
  traffic: "navigation",
  healthcare: "activity",
  general: "phone",
};

function categoryIcon(category: string): keyof typeof Feather.glyphMap {
  const key = category.toLowerCase();
  for (const k of Object.keys(CATEGORY_ICONS)) {
    if (key.includes(k)) return CATEGORY_ICONS[k];
  }
  return "phone";
}

export default function EmergencyServicesScreen() {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const localContacts = useMemo(() => getEmergencyContactsList(), []);

  const allContacts: EmergencyContact[] = useMemo(
    () =>
      localContacts.map((c) => ({
        id: String(c.id),
        name: c.name,
        category: c.category,
        phone: c.phone,
        description: c.description,
      })),
    [localContacts]
  );

  const primaryNumbers: PrimaryNumber[] = useMemo(
    () =>
      localContacts
        .filter(
          (c) =>
            c.category === "National Emergency Services" ||
            c.category === "General Emergency Services"
        )
        .slice(0, 4)
        .map((c) => ({
          id: String(c.id),
          name: c.name,
          number: c.phone,
          description: c.description,
        })),
    [localContacts]
  );

  const categories = useMemo(() => {
    const catMap = new Map<string, number>();
    allContacts.forEach((c) => {
      catMap.set(c.category, (catMap.get(c.category) || 0) + 1);
    });
    return Array.from(catMap.entries()).map(([name, count]) => ({
      name,
      count,
      icon: categoryIcon(name),
    }));
  }, [allContacts]);

  const filteredContacts = useMemo(() => {
    let filtered = allContacts;

    if (selectedCategory) {
      filtered = filtered.filter(
        (c) => c.category.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.category.toLowerCase().includes(query) ||
          c.phone.includes(query) ||
          c.description?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [allContacts, selectedCategory, searchQuery]);

  const handleCall = async (phone: string) => {
    if (Platform.OS === "web") return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await Linking.openURL(`tel:${phone.replace(/\s/g, "")}`);
    } catch {
      console.log("Could not open phone dialer");
    }
  };

  const handleCategorySelect = (name: string) => {
    Haptics.selectionAsync();
    setSelectedCategory(selectedCategory === name ? null : name);
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing["3xl"] },
        ]}
        showsVerticalScrollIndicator={false}
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
              <Feather name="phone-call" size={32} color={BrandColors.primary.gradientStart} />
            </View>
          </Animated.View>

          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(150)}
            style={styles.heroText}
          >
            <ThemedText style={styles.heroTitle}>Emergency services</ThemedText>
            <ThemedText style={styles.heroSubtitle}>
              Tap any number to dial directly. Help is one tap away.
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
              placeholder="Search by name, number or category"
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

          {/* Primary numbers — only when not searching/filtering */}
          {primaryNumbers.length > 0 && !searchQuery && !selectedCategory ? (
            <Animated.View
              entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(250)}
              style={styles.primarySection}
            >
              <ThemedText
                style={[styles.sectionLabel, { color: theme.textSecondary }]}
              >
                CALL FIRST
              </ThemedText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.primaryList}
              >
                {primaryNumbers.map((item, index) => (
                  <Animated.View
                    key={item.id}
                    entering={reducedMotion ? undefined : FadeInDown.duration(400).delay(300 + index * 60)}
                  >
                    <Pressable
                      onPress={() => handleCall(item.number)}
                      style={({ pressed }) => [pressed && styles.pressed]}
                      accessibilityRole="button"
                      accessibilityLabel={`Call ${item.name} at ${item.number}`}
                    >
                      <View
                        style={[
                          styles.primaryCard,
                          { backgroundColor: BrandColors.status.emergency },
                        ]}
                      >
                        <View style={styles.primaryIconContainer}>
                          <Feather name="phone" size={22} color="#FFFFFF" />
                        </View>
                        <View style={styles.primaryInfo}>
                          <ThemedText style={styles.primaryNumber}>
                            {item.number}
                          </ThemedText>
                          <ThemedText
                            style={styles.primaryName}
                            numberOfLines={1}
                          >
                            {item.name}
                          </ThemedText>
                        </View>
                      </View>
                    </Pressable>
                  </Animated.View>
                ))}
              </ScrollView>
            </Animated.View>
          ) : null}

          {/* Categories */}
          {categories.length > 0 ? (
            <Animated.View
              entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(300)}
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
              >
                {categories.map((cat) => {
                  const isSelected = selectedCategory === cat.name;
                  if (isSelected) {
                    return (
                      <Pressable
                        key={cat.name}
                        onPress={() => handleCategorySelect(cat.name)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: true }}
                      >
                        <LinearGradient
                          colors={BrandColors.gradient.primary}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.categoryChipActive}
                        >
                          <Feather name={cat.icon} size={16} color="#FFFFFF" />
                          <ThemedText style={styles.categoryChipActiveText}>
                            {cat.name}
                          </ThemedText>
                          <View style={styles.categoryCountActive}>
                            <ThemedText style={styles.categoryCountActiveText}>
                              {cat.count}
                            </ThemedText>
                          </View>
                        </LinearGradient>
                      </Pressable>
                    );
                  }

                  return (
                    <Pressable
                      key={cat.name}
                      onPress={() => handleCategorySelect(cat.name)}
                      style={({ pressed }) => [
                        styles.categoryChip,
                        {
                          backgroundColor: theme.backgroundDefault,
                          borderColor: theme.border,
                        },
                        pressed && styles.pressed,
                      ]}
                      accessibilityRole="button"
                    >
                      <Feather
                        name={cat.icon}
                        size={16}
                        color={BrandColors.primary.gradientStart}
                      />
                      <ThemedText style={[styles.categoryChipText, { color: theme.text }]}>
                        {cat.name}
                      </ThemedText>
                      <View
                        style={[
                          styles.categoryCount,
                          { backgroundColor: BrandColors.primary.gradientStart + "15" },
                        ]}
                      >
                        <ThemedText style={styles.categoryCountText}>
                          {cat.count}
                        </ThemedText>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Animated.View>
          ) : null}

          {/* Stats line */}
          <View style={styles.statsBar}>
            <ThemedText
              style={[styles.statsText, { color: theme.textSecondary }]}
            >
              {selectedCategory
                ? `${filteredContacts.length} ${selectedCategory} contact${
                    filteredContacts.length === 1 ? "" : "s"
                  }`
                : searchQuery
                ? `${filteredContacts.length} result${
                    filteredContacts.length === 1 ? "" : "s"
                  }`
                : `${allContacts.length} contacts across ${categories.length} categories`}
            </ThemedText>
          </View>

          {/* Contact list */}
          {filteredContacts.length === 0 ? (
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
              <ThemedText style={styles.emptyTitle}>No matches</ThemedText>
              <ThemedText
                style={[styles.emptyHint, { color: theme.textSecondary }]}
              >
                Try a different search or clear the active category filter.
              </ThemedText>
            </Animated.View>
          ) : (
            <View style={styles.contactList}>
              {filteredContacts.map((contact, index) => {
                const icon = categoryIcon(contact.category);
                return (
                  <Animated.View
                    key={contact.id}
                    entering={reducedMotion ? undefined : FadeInDown.duration(300).delay(
                      Math.min(index * 25, 250)
                    )}
                  >
                    <Pressable
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
                      <View
                        style={[
                          styles.contactIcon,
                          {
                            backgroundColor:
                              BrandColors.primary.gradientStart + "12",
                          },
                        ]}
                      >
                        <Feather
                          name={icon}
                          size={18}
                          color={BrandColors.primary.gradientStart}
                        />
                      </View>
                      <View style={styles.contactInfo}>
                        <ThemedText style={styles.contactName} numberOfLines={1}>
                          {contact.name}
                        </ThemedText>
                        <View style={styles.contactMeta}>
                          <View
                            style={[
                              styles.categoryBadge,
                              {
                                backgroundColor:
                                  BrandColors.primary.gradientStart + "12",
                              },
                            ]}
                          >
                            <ThemedText style={styles.categoryBadgeText}>
                              {contact.category}
                            </ThemedText>
                          </View>
                        </View>
                        <ThemedText
                          style={styles.contactPhone}
                          numberOfLines={1}
                        >
                          {contact.phone}
                        </ThemedText>
                        {contact.description ? (
                          <ThemedText
                            style={[
                              styles.contactDescription,
                              { color: theme.textSecondary },
                            ]}
                            numberOfLines={2}
                          >
                            {contact.description}
                          </ThemedText>
                        ) : null}
                      </View>
                      <Pressable
                        onPress={() => handleCall(contact.phone)}
                        hitSlop={8}
                        style={({ pressed }) => [
                          styles.callButton,
                          pressed && styles.pressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Call ${contact.phone}`}
                      >
                        <LinearGradient
                          colors={BrandColors.gradient.primary}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.callButtonGradient}
                        >
                          <Feather name="phone" size={18} color="#FFFFFF" />
                        </LinearGradient>
                      </Pressable>
                    </Pressable>
                  </Animated.View>
                );
              })}
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

  // Section labels
  sectionLabel: {
    ...Typography.label,
    letterSpacing: 1.4,
    fontSize: 11,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },

  // Primary numbers
  primarySection: {
    marginBottom: Spacing.lg,
  },
  primaryList: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  primaryCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    width: 220,
    shadowColor: BrandColors.status.emergency,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  primaryInfo: {
    flex: 1,
  },
  primaryNumber: {
    ...Typography.h3,
    color: "#FFFFFF",
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.5,
  },
  primaryName: {
    ...Typography.small,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "600",
    marginTop: 2,
  },

  // Categories
  categoriesSection: {
    marginBottom: Spacing.md,
  },
  categoriesList: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    gap: Spacing.xs,
  },
  categoryChipText: {
    ...Typography.small,
    fontWeight: "600",
  },
  categoryCount: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    minWidth: 20,
    alignItems: "center",
  },
  categoryCountText: {
    ...Typography.label,
    fontSize: 10,
    fontWeight: "700",
    color: BrandColors.primary.gradientStart,
  },
  categoryChipActive: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  categoryChipActiveText: {
    ...Typography.small,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  categoryCountActive: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    minWidth: 20,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  categoryCountActiveText: {
    ...Typography.label,
    fontSize: 10,
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

  // Contact list
  contactList: {
    paddingHorizontal: Spacing.lg,
  },
  contactCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  contactIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
    marginTop: 2,
  },
  contactInfo: {
    flex: 1,
    minWidth: 0,
  },
  contactName: {
    ...Typography.body,
    fontWeight: "700",
  },
  contactMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: 4,
  },
  categoryBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  categoryBadgeText: {
    ...Typography.label,
    fontSize: 10,
    fontWeight: "700",
    color: BrandColors.primary.gradientStart,
    letterSpacing: 0.6,
  },
  contactPhone: {
    ...Typography.body,
    fontWeight: "700",
    color: BrandColors.primary.gradientStart,
    fontVariant: ["tabular-nums"],
    marginTop: 4,
  },
  contactDescription: {
    ...Typography.small,
    fontSize: 12,
    marginTop: 4,
  },
  callButton: {
    marginLeft: Spacing.sm,
    marginTop: 2,
    borderRadius: BorderRadius.full,
    overflow: "hidden",
  },
  callButtonGradient: {
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
