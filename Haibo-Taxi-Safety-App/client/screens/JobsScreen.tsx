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
import { useQuery } from "@tanstack/react-query";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";

import { useJobs } from "@/hooks/useApiData";
import { useTheme } from "@/hooks/useTheme";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  Spacing,
  BrandColors,
  BorderRadius,
  Typography,
} from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { SkeletonBlock } from "@/components/Skeleton";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

// typeui-clean rework — Jobs board for the SA taxi industry:
//   1. Rose gradient hero with briefcase badge + back button
//   2. Floating white card with rose-focus search bar
//   3. Category pills (Driver / Marshal / Mechanic / Admin / Security /
//      Other) with gradient-filled active state — drops the 7-color
//      rainbow that came before
//   4. Job cards with rose-tinted category icon, rose-tinted tag chips,
//      success-green salary highlight, expand-to-view-details
//   5. Action buttons: rose gradient "Call" + WhatsApp green for
//      WhatsApp (kept the WhatsApp brand because it's a third-party
//      identity affordance)
//   6. Skeleton loaders during fetch instead of plain ActivityIndicator

interface Job {
  id: string;
  title: string;
  company: string;
  description: string;
  requirements?: string;
  jobType: string;
  category: string;
  location: string;
  province?: string;
  salary?: string;
  salaryMin?: number;
  salaryMax?: number;
  contactPhone?: string;
  contactEmail?: string;
  contactWhatsapp?: string;
  experienceLevel?: string;
  licenseRequired?: string;
  benefits?: string[];
  isVerified: boolean;
  isFeatured: boolean;
  applicationDeadline?: string;
  viewCount: number;
  applicationCount: number;
  status: string;
  createdAt: string;
}

interface JobStats {
  total: number;
  categories: { category: string; count: number }[];
  provinces: { province: string; count: number }[];
}

type CategoryType =
  | "all"
  | "driver"
  | "marshal"
  | "mechanic"
  | "admin"
  | "security"
  | "other";

const CATEGORY_CONFIG: {
  id: CategoryType;
  label: string;
  icon: keyof typeof Feather.glyphMap;
}[] = [
  { id: "all", label: "All jobs", icon: "briefcase" },
  { id: "driver", label: "Driver", icon: "truck" },
  { id: "marshal", label: "Marshal", icon: "users" },
  { id: "mechanic", label: "Mechanic", icon: "tool" },
  { id: "admin", label: "Admin", icon: "file-text" },
  { id: "security", label: "Security", icon: "shield" },
  { id: "other", label: "Other", icon: "more-horizontal" },
];

const JOB_TYPE_LABELS: Record<string, string> = {
  "full-time": "Full-time",
  "part-time": "Part-time",
  contract: "Contract",
  temporary: "Temporary",
};

const EXPERIENCE_LABELS: Record<string, string> = {
  entry: "Entry level",
  intermediate: "Intermediate",
  senior: "Senior",
};

function getCategoryIcon(category: string): keyof typeof Feather.glyphMap {
  return CATEGORY_CONFIG.find((c) => c.id === category)?.icon || "briefcase";
}

export default function JobsScreen() {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>("all");
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  // useJobs unwraps the server's { data, pagination } envelope.
  // A prior direct useQuery<Job[]> call crashed because jobs was the
  // envelope object and jobs.filter was undefined.
  const { data: jobsData, isLoading } = useJobs(
    selectedCategory === "all" ? undefined : selectedCategory
  );
  const jobs: Job[] = (jobsData as Job[] | undefined) ?? [];

  const { data: stats } = useQuery<JobStats>({
    queryKey: ["/api/jobs-stats"],
  });

  const filteredJobs = useMemo(() => {
    if (!searchQuery.trim()) return jobs;
    const query = searchQuery.toLowerCase();
    return jobs.filter(
      (job) =>
        job.title.toLowerCase().includes(query) ||
        job.company.toLowerCase().includes(query) ||
        job.location.toLowerCase().includes(query) ||
        job.description.toLowerCase().includes(query)
    );
  }, [jobs, searchQuery]);

  const triggerHaptic = (type: "selection" | "medium" = "selection") => {
    if (Platform.OS === "web") return;
    try {
      if (type === "medium") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        Haptics.selectionAsync();
      }
    } catch {}
  };

  const handleCall = async (phone: string) => {
    if (Platform.OS === "web") return;
    triggerHaptic("medium");
    try {
      await Linking.openURL(`tel:${phone.replace(/\s/g, "")}`);
    } catch {}
  };

  const handleWhatsApp = async (phone: string, jobTitle: string) => {
    if (Platform.OS === "web") return;
    triggerHaptic("selection");
    const message = `Hi, I'm interested in the "${jobTitle}" position I found on Haibo!`;
    try {
      await Linking.openURL(
        `whatsapp://send?phone=${phone.replace(/\D/g, "")}&text=${encodeURIComponent(message)}`
      );
    } catch {}
  };

  const handleCategoryPress = (categoryId: CategoryType) => {
    triggerHaptic("selection");
    setSelectedCategory(categoryId);
  };

  const toggleJobExpand = (jobId: string) => {
    triggerHaptic("selection");
    setExpandedJobId(expandedJobId === jobId ? null : jobId);
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
              <Feather
                name="briefcase"
                size={32}
                color={BrandColors.primary.gradientStart}
              />
            </View>
          </Animated.View>

          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(150)}
            style={styles.heroText}
          >
            <ThemedText style={styles.heroTitle}>Jobs board</ThemedText>
            <ThemedText style={styles.heroSubtitle}>
              Driver, marshal, mechanic, admin and security roles across SA.
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
              placeholder="Search by role, company or location"
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

          {/* Category pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesList}
            keyboardShouldPersistTaps="handled"
          >
            {CATEGORY_CONFIG.map((cat) => {
              const isActive = selectedCategory === cat.id;
              const count =
                cat.id === "all"
                  ? stats?.total || 0
                  : stats?.categories.find((c) => c.category === cat.id)?.count || 0;

              if (isActive) {
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => handleCategoryPress(cat.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: true }}
                  >
                    <LinearGradient
                      colors={BrandColors.gradient.primary}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.categoryTabActive}
                    >
                      <Feather name={cat.icon} size={16} color="#FFFFFF" />
                      <ThemedText style={styles.categoryTabActiveText}>
                        {cat.label}
                      </ThemedText>
                      {count > 0 ? (
                        <View style={styles.categoryCountActive}>
                          <ThemedText style={styles.categoryCountActiveText}>
                            {count}
                          </ThemedText>
                        </View>
                      ) : null}
                    </LinearGradient>
                  </Pressable>
                );
              }

              return (
                <Pressable
                  key={cat.id}
                  onPress={() => handleCategoryPress(cat.id)}
                  style={({ pressed }) => [
                    styles.categoryTab,
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
                  <ThemedText
                    style={[styles.categoryTabText, { color: theme.text }]}
                  >
                    {cat.label}
                  </ThemedText>
                  {count > 0 ? (
                    <View
                      style={[
                        styles.categoryCount,
                        {
                          backgroundColor:
                            BrandColors.primary.gradientStart + "12",
                        },
                      ]}
                    >
                      <ThemedText style={styles.categoryCountText}>
                        {count}
                      </ThemedText>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Stats line */}
          <View style={styles.statsBar}>
            <ThemedText
              style={[styles.statsText, { color: theme.textSecondary }]}
            >
              {filteredJobs.length} job{filteredJobs.length === 1 ? "" : "s"} available
            </ThemedText>
          </View>

          {/* Jobs list */}
          {isLoading ? (
            <View style={styles.skeletonList}>
              {[0, 1, 2].map((i) => (
                <SkeletonBlock key={i} style={styles.skeletonCard} />
              ))}
            </View>
          ) : filteredJobs.length === 0 ? (
            <Animated.View
              entering={reducedMotion ? undefined : FadeIn.duration(400)}
              style={[
                styles.emptyState,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <View
                style={[
                  styles.emptyIcon,
                  {
                    backgroundColor: BrandColors.primary.gradientStart + "12",
                  },
                ]}
              >
                <Feather
                  name="briefcase"
                  size={26}
                  color={BrandColors.primary.gradientStart}
                />
              </View>
              <ThemedText style={styles.emptyTitle}>No jobs found</ThemedText>
              <ThemedText
                style={[styles.emptyHint, { color: theme.textSecondary }]}
              >
                Try a different search or category filter.
              </ThemedText>
            </Animated.View>
          ) : (
            filteredJobs.map((item, index) => {
              const isExpanded = expandedJobId === item.id;
              const icon = getCategoryIcon(item.category);
              return (
                <Animated.View
                  key={item.id}
                  entering={reducedMotion ? undefined : FadeInDown.duration(300).delay(
                    Math.min(index * 30, 300)
                  )}
                >
                  <Pressable
                    style={({ pressed }) => [
                      styles.jobCard,
                      {
                        backgroundColor: theme.surface,
                        borderColor: theme.border,
                      },
                      pressed && styles.pressed,
                    ]}
                    onPress={() => toggleJobExpand(item.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.title} at ${item.company}`}
                  >
                    <View style={styles.jobHeader}>
                      <View
                        style={[
                          styles.jobIcon,
                          {
                            backgroundColor:
                              BrandColors.primary.gradientStart + "12",
                          },
                        ]}
                      >
                        <Feather
                          name={icon}
                          size={20}
                          color={BrandColors.primary.gradientStart}
                        />
                      </View>
                      <View style={styles.jobInfo}>
                        <View style={styles.jobTitleRow}>
                          <ThemedText style={styles.jobTitle} numberOfLines={1}>
                            {item.title}
                          </ThemedText>
                          {item.isFeatured ? (
                            <View
                              style={[
                                styles.featuredBadge,
                                {
                                  backgroundColor:
                                    BrandColors.primary.gradientStart,
                                },
                              ]}
                            >
                              <Feather name="star" size={9} color="#FFFFFF" />
                            </View>
                          ) : null}
                        </View>
                        <ThemedText
                          style={[
                            styles.jobCompany,
                            { color: theme.textSecondary },
                          ]}
                          numberOfLines={1}
                        >
                          {item.company}
                        </ThemedText>
                        <View style={styles.jobMeta}>
                          <View style={styles.metaItem}>
                            <Feather
                              name="map-pin"
                              size={12}
                              color={theme.textSecondary}
                            />
                            <ThemedText
                              style={[
                                styles.metaText,
                                { color: theme.textSecondary },
                              ]}
                              numberOfLines={1}
                            >
                              {item.location}
                            </ThemedText>
                          </View>
                          {item.salary ? (
                            <View style={styles.metaItem}>
                              <Feather
                                name="dollar-sign"
                                size={12}
                                color={BrandColors.status.success}
                              />
                              <ThemedText
                                style={[
                                  styles.metaText,
                                  {
                                    color: BrandColors.status.success,
                                    fontWeight: "700",
                                  },
                                ]}
                              >
                                {item.salary}
                              </ThemedText>
                            </View>
                          ) : null}
                        </View>
                      </View>
                      <Feather
                        name={isExpanded ? "chevron-up" : "chevron-down"}
                        size={18}
                        color={theme.textSecondary}
                      />
                    </View>

                    <View style={styles.tagRow}>
                      <View
                        style={[
                          styles.tag,
                          {
                            backgroundColor:
                              BrandColors.primary.gradientStart + "12",
                          },
                        ]}
                      >
                        <ThemedText
                          style={[
                            styles.tagText,
                            { color: BrandColors.primary.gradientStart },
                          ]}
                        >
                          {item.category.charAt(0).toUpperCase() +
                            item.category.slice(1)}
                        </ThemedText>
                      </View>
                      <View
                        style={[
                          styles.tag,
                          { backgroundColor: theme.backgroundDefault },
                        ]}
                      >
                        <ThemedText
                          style={[
                            styles.tagText,
                            { color: theme.textSecondary },
                          ]}
                        >
                          {JOB_TYPE_LABELS[item.jobType] || item.jobType}
                        </ThemedText>
                      </View>
                      {item.experienceLevel ? (
                        <View
                          style={[
                            styles.tag,
                            { backgroundColor: theme.backgroundDefault },
                          ]}
                        >
                          <ThemedText
                            style={[
                              styles.tagText,
                              { color: theme.textSecondary },
                            ]}
                          >
                            {EXPERIENCE_LABELS[item.experienceLevel] ||
                              item.experienceLevel}
                          </ThemedText>
                        </View>
                      ) : null}
                    </View>

                    {isExpanded ? (
                      <View
                        style={[
                          styles.expandedContent,
                          { borderTopColor: theme.border },
                        ]}
                      >
                        <ThemedText
                          style={[styles.descriptionText, { color: theme.text }]}
                        >
                          {item.description}
                        </ThemedText>

                        {item.requirements ? (
                          <View style={styles.section}>
                            <ThemedText
                              style={[
                                styles.sectionLabel,
                                { color: theme.textSecondary },
                              ]}
                            >
                              REQUIREMENTS
                            </ThemedText>
                            <ThemedText
                              style={[
                                styles.sectionText,
                                { color: theme.textSecondary },
                              ]}
                            >
                              {item.requirements}
                            </ThemedText>
                          </View>
                        ) : null}

                        {item.licenseRequired ? (
                          <View style={styles.section}>
                            <ThemedText
                              style={[
                                styles.sectionLabel,
                                { color: theme.textSecondary },
                              ]}
                            >
                              LICENSE REQUIRED
                            </ThemedText>
                            <ThemedText
                              style={[
                                styles.sectionText,
                                { color: theme.textSecondary },
                              ]}
                            >
                              {item.licenseRequired}
                            </ThemedText>
                          </View>
                        ) : null}

                        {item.benefits && item.benefits.length > 0 ? (
                          <View style={styles.section}>
                            <ThemedText
                              style={[
                                styles.sectionLabel,
                                { color: theme.textSecondary },
                              ]}
                            >
                              BENEFITS
                            </ThemedText>
                            <View style={styles.benefitsList}>
                              {item.benefits.map((benefit, idx) => (
                                <View key={idx} style={styles.benefitItem}>
                                  <Feather
                                    name="check"
                                    size={12}
                                    color={BrandColors.status.success}
                                  />
                                  <ThemedText
                                    style={[
                                      styles.benefitText,
                                      { color: theme.textSecondary },
                                    ]}
                                  >
                                    {benefit}
                                  </ThemedText>
                                </View>
                              ))}
                            </View>
                          </View>
                        ) : null}

                        <View style={styles.actionButtons}>
                          {item.contactPhone ? (
                            <Pressable
                              onPress={() => handleCall(item.contactPhone!)}
                              style={({ pressed }) => [
                                styles.callButtonWrap,
                                pressed && styles.pressed,
                              ]}
                              accessibilityRole="button"
                              accessibilityLabel="Call employer"
                            >
                              <LinearGradient
                                colors={BrandColors.gradient.primary}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.callButton}
                              >
                                <Feather
                                  name="phone"
                                  size={16}
                                  color="#FFFFFF"
                                />
                                <ThemedText style={styles.actionButtonText}>
                                  Call
                                </ThemedText>
                              </LinearGradient>
                            </Pressable>
                          ) : null}
                          {item.contactWhatsapp ? (
                            <Pressable
                              onPress={() =>
                                handleWhatsApp(item.contactWhatsapp!, item.title)
                              }
                              style={({ pressed }) => [
                                styles.whatsappButton,
                                pressed && styles.pressed,
                              ]}
                              accessibilityRole="button"
                              accessibilityLabel="Message on WhatsApp"
                            >
                              <Feather
                                name="message-circle"
                                size={16}
                                color="#FFFFFF"
                              />
                              <ThemedText style={styles.actionButtonText}>
                                WhatsApp
                              </ThemedText>
                            </Pressable>
                          ) : null}
                        </View>
                      </View>
                    ) : null}
                  </Pressable>
                </Animated.View>
              );
            })
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
    paddingTop: Spacing["2xl"],
    paddingHorizontal: Spacing.lg,
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
    paddingHorizontal: Spacing.md,
    height: 48,
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  searchInput: {
    ...Typography.body,
    flex: 1,
  },

  // Categories
  categoriesList: {
    paddingVertical: Spacing.xs,
    gap: Spacing.sm,
  },
  categoryTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    gap: 6,
  },
  categoryTabText: {
    ...Typography.small,
    fontWeight: "600",
  },
  categoryCount: {
    paddingHorizontal: 6,
    paddingVertical: 1,
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
  categoryTabActive: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: 6,
  },
  categoryTabActiveText: {
    ...Typography.small,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  categoryCountActive: {
    paddingHorizontal: 6,
    paddingVertical: 1,
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
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  statsText: {
    ...Typography.small,
    fontSize: 12,
  },

  // Job card
  jobCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  jobHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  jobIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  jobInfo: {
    flex: 1,
    minWidth: 0,
  },
  jobTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  jobTitle: {
    ...Typography.body,
    fontWeight: "700",
    flex: 1,
  },
  featuredBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  jobCompany: {
    ...Typography.small,
    fontSize: 12,
    marginTop: 2,
  },
  jobMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginTop: 4,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    ...Typography.small,
    fontSize: 11,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    marginLeft: 52,
  },
  tag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  tagText: {
    ...Typography.label,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  expandedContent: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  descriptionText: {
    ...Typography.body,
    lineHeight: 22,
  },
  section: {
    marginTop: Spacing.md,
  },
  sectionLabel: {
    ...Typography.label,
    letterSpacing: 1.2,
    fontSize: 11,
    marginBottom: Spacing.xs,
  },
  sectionText: {
    ...Typography.small,
    lineHeight: 18,
  },
  benefitsList: {
    gap: Spacing.xs,
    marginTop: 2,
  },
  benefitItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  benefitText: {
    ...Typography.small,
  },
  actionButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  callButtonWrap: {
    flex: 1,
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
  },
  callButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    gap: 6,
  },
  whatsappButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: 6,
    backgroundColor: "#25D366",
  },
  actionButtonText: {
    color: "#FFFFFF",
    ...Typography.small,
    fontSize: 13,
    fontWeight: "700",
  },

  // Skeleton
  skeletonList: {
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  skeletonCard: {
    height: 96,
    borderRadius: BorderRadius.lg,
  },

  // Empty
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
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
