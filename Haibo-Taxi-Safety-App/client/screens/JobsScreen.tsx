import React, { useState, useMemo } from "react";
import {
  View,
  FlatList,
  TextInput,
  Pressable,
  StyleSheet,
  Linking,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

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

type CategoryType = "all" | "driver" | "marshal" | "mechanic" | "admin" | "security" | "other";

const CATEGORY_CONFIG: { id: CategoryType; label: string; icon: keyof typeof Feather.glyphMap; color: string }[] = [
  { id: "all", label: "All Jobs", icon: "briefcase", color: "#607D8B" },
  { id: "driver", label: "Driver", icon: "truck", color: "#1976D2" },
  { id: "marshal", label: "Marshal", icon: "users", color: "#4CAF50" },
  { id: "mechanic", label: "Mechanic", icon: "tool", color: "#FF9800" },
  { id: "admin", label: "Admin", icon: "file-text", color: "#9C27B0" },
  { id: "security", label: "Security", icon: "shield", color: "#D32F2F" },
  { id: "other", label: "Other", icon: "more-horizontal", color: "#607D8B" },
];

const JOB_TYPE_LABELS: { [key: string]: string } = {
  "full-time": "Full-time",
  "part-time": "Part-time",
  "contract": "Contract",
  "temporary": "Temporary",
};

const EXPERIENCE_LABELS: { [key: string]: string } = {
  "entry": "Entry Level",
  "intermediate": "Intermediate",
  "senior": "Senior",
};

export default function JobsScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>("all");
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  const jobsQueryUrl = selectedCategory === "all" 
    ? "/api/jobs" 
    : `/api/jobs?category=${selectedCategory}`;
  
  const { data: jobs, isLoading } = useQuery<Job[]>({
    queryKey: [jobsQueryUrl],
  });

  const { data: stats } = useQuery<JobStats>({
    queryKey: ["/api/jobs-stats"],
  });

  const filteredJobs = useMemo(() => {
    if (!jobs) return [];
    
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

  const handleCall = async (phone: string) => {
    if (Platform.OS !== "web") {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await Linking.openURL(`tel:${phone.replace(/\s/g, "")}`);
      } catch (error) {
        console.log("Could not open phone dialer");
      }
    }
  };

  const handleWhatsApp = async (phone: string, jobTitle: string) => {
    if (Platform.OS !== "web") {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const message = `Hi, I'm interested in the "${jobTitle}" position I found on Haibo! Taxi.`;
        await Linking.openURL(`whatsapp://send?phone=${phone.replace(/\D/g, "")}&text=${encodeURIComponent(message)}`);
      } catch (error) {
        console.log("Could not open WhatsApp");
      }
    }
  };

  const handleCategoryPress = async (categoryId: CategoryType) => {
    setSelectedCategory(categoryId);
    if (Platform.OS !== "web") {
      try {
        await Haptics.selectionAsync();
      } catch {}
    }
  };

  const toggleJobExpand = async (jobId: string) => {
    setExpandedJobId(expandedJobId === jobId ? null : jobId);
    if (Platform.OS !== "web") {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
  };

  const getCategoryColor = (category: string) => {
    const config = CATEGORY_CONFIG.find((c) => c.id === category);
    return config?.color || "#607D8B";
  };

  const renderCategoryTab = ({ item }: { item: typeof CATEGORY_CONFIG[0] }) => {
    const isSelected = selectedCategory === item.id;
    const count = item.id === "all" 
      ? stats?.total || 0 
      : stats?.categories.find((c) => c.category === item.id)?.count || 0;
    
    return (
      <Pressable
        style={[
          styles.categoryTab,
          {
            backgroundColor: isSelected ? item.color : theme.backgroundDefault,
            borderColor: isSelected ? item.color : theme.border,
          },
        ]}
        onPress={() => handleCategoryPress(item.id)}
      >
        <Feather
          name={item.icon}
          size={14}
          color={isSelected ? "#FFFFFF" : item.color}
        />
        <ThemedText
          style={[
            styles.categoryText,
            { color: isSelected ? "#FFFFFF" : theme.text },
          ]}
        >
          {item.label}
        </ThemedText>
        {count > 0 && (
          <View
            style={[
              styles.categoryCount,
              { backgroundColor: isSelected ? "rgba(255,255,255,0.3)" : theme.backgroundTertiary },
            ]}
          >
            <ThemedText
              style={[
                styles.categoryCountText,
                { color: isSelected ? "#FFFFFF" : theme.textSecondary },
              ]}
            >
              {count}
            </ThemedText>
          </View>
        )}
      </Pressable>
    );
  };

  const renderJob = ({ item }: { item: Job }) => {
    const isExpanded = expandedJobId === item.id;
    const categoryColor = getCategoryColor(item.category);

    return (
      <Pressable
        style={[styles.jobCard, { backgroundColor: theme.backgroundDefault }]}
        onPress={() => toggleJobExpand(item.id)}
      >
        <View style={styles.jobHeader}>
          <View style={[styles.jobIcon, { backgroundColor: `${categoryColor}15` }]}>
            <Feather
              name={CATEGORY_CONFIG.find((c) => c.id === item.category)?.icon || "briefcase"}
              size={20}
              color={categoryColor}
            />
          </View>
          <View style={styles.jobInfo}>
            <View style={styles.jobTitleRow}>
              <ThemedText style={styles.jobTitle} numberOfLines={1}>
                {item.title}
              </ThemedText>
              {item.isFeatured && (
                <View style={[styles.featuredBadge, { backgroundColor: BrandColors.secondary.orange }]}>
                  <Feather name="star" size={10} color="#FFFFFF" />
                </View>
              )}
            </View>
            <ThemedText style={[styles.jobCompany, { color: theme.textSecondary }]}>
              {item.company}
            </ThemedText>
            <View style={styles.jobMeta}>
              <View style={styles.metaItem}>
                <Feather name="map-pin" size={12} color={theme.textSecondary} />
                <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                  {item.location}
                </ThemedText>
              </View>
              {item.salary && (
                <View style={styles.metaItem}>
                  <Feather name="dollar-sign" size={12} color={BrandColors.primary.green} />
                  <ThemedText style={[styles.metaText, { color: BrandColors.primary.green }]}>
                    {item.salary}
                  </ThemedText>
                </View>
              )}
            </View>
          </View>
          <Feather
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={20}
            color={theme.textSecondary}
          />
        </View>

        <View style={styles.tagRow}>
          <View style={[styles.tag, { backgroundColor: `${categoryColor}20` }]}>
            <ThemedText style={[styles.tagText, { color: categoryColor }]}>
              {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
            </ThemedText>
          </View>
          <View style={[styles.tag, { backgroundColor: theme.backgroundTertiary }]}>
            <ThemedText style={[styles.tagText, { color: theme.textSecondary }]}>
              {JOB_TYPE_LABELS[item.jobType] || item.jobType}
            </ThemedText>
          </View>
          {item.experienceLevel && (
            <View style={[styles.tag, { backgroundColor: theme.backgroundTertiary }]}>
              <ThemedText style={[styles.tagText, { color: theme.textSecondary }]}>
                {EXPERIENCE_LABELS[item.experienceLevel] || item.experienceLevel}
              </ThemedText>
            </View>
          )}
        </View>

        {isExpanded && (
          <View style={styles.expandedContent}>
            <ThemedText style={[styles.descriptionText, { color: theme.text }]}>
              {item.description}
            </ThemedText>

            {item.requirements && (
              <View style={styles.section}>
                <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
                  Requirements
                </ThemedText>
                <ThemedText style={[styles.sectionText, { color: theme.textSecondary }]}>
                  {item.requirements}
                </ThemedText>
              </View>
            )}

            {item.licenseRequired && (
              <View style={styles.section}>
                <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
                  License Required
                </ThemedText>
                <ThemedText style={[styles.sectionText, { color: theme.textSecondary }]}>
                  {item.licenseRequired}
                </ThemedText>
              </View>
            )}

            {item.benefits && item.benefits.length > 0 && (
              <View style={styles.section}>
                <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
                  Benefits
                </ThemedText>
                <View style={styles.benefitsList}>
                  {item.benefits.map((benefit, index) => (
                    <View key={index} style={styles.benefitItem}>
                      <Feather name="check" size={14} color={BrandColors.primary.green} />
                      <ThemedText style={[styles.benefitText, { color: theme.textSecondary }]}>
                        {benefit}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.actionButtons}>
              {item.contactPhone && (
                <Pressable
                  style={[styles.actionButton, { backgroundColor: BrandColors.primary.blue }]}
                  onPress={() => handleCall(item.contactPhone!)}
                >
                  <Feather name="phone" size={16} color="#FFFFFF" />
                  <ThemedText style={styles.actionButtonText}>Call</ThemedText>
                </Pressable>
              )}
              {item.contactWhatsapp && (
                <Pressable
                  style={[styles.actionButton, { backgroundColor: "#25D366" }]}
                  onPress={() => handleWhatsApp(item.contactWhatsapp!, item.title)}
                >
                  <Feather name="message-circle" size={16} color="#FFFFFF" />
                  <ThemedText style={styles.actionButtonText}>WhatsApp</ThemedText>
                </Pressable>
              )}
            </View>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: theme.backgroundDefault }]}>
          <Feather name="search" size={18} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search jobs..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")}>
              <Feather name="x" size={18} color={theme.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        data={CATEGORY_CONFIG}
        renderItem={renderCategoryTab}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoriesList}
        style={styles.categoriesContainer}
      />

      {stats && (
        <View style={styles.statsBar}>
          <ThemedText style={[styles.statsText, { color: theme.textSecondary }]}>
            {filteredJobs.length} job{filteredJobs.length !== 1 ? "s" : ""} available
          </ThemedText>
        </View>
      )}

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BrandColors.primary.blue} />
          <ThemedText style={{ marginTop: Spacing.md, color: theme.textSecondary }}>
            Loading jobs...
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={filteredJobs}
          keyExtractor={(item) => item.id}
          renderItem={renderJob}
          contentContainerStyle={{
            paddingHorizontal: Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl,
          }}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="briefcase" size={48} color={theme.textSecondary} />
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                No jobs found
              </ThemedText>
              <ThemedText
                type="small"
                style={{ color: theme.textSecondary, textAlign: "center" }}
              >
                Try adjusting your search or filters
              </ThemedText>
            </View>
          }
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    height: 44,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  categoriesContainer: {
    maxHeight: 50,
  },
  categoriesList: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  categoryTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: "500",
  },
  categoryCount: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  categoryCountText: {
    fontSize: 11,
    fontWeight: "600",
  },
  statsBar: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  statsText: {
    fontSize: 13,
  },
  jobCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  jobHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  jobIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  jobInfo: {
    flex: 1,
  },
  jobTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  jobTitle: {
    fontSize: 15,
    fontWeight: "600",
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
    fontSize: 13,
    marginTop: 2,
  },
  jobMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    marginLeft: 56,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  tagText: {
    fontSize: 11,
    fontWeight: "500",
  },
  expandedContent: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    marginTop: Spacing.md,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
  },
  sectionText: {
    fontSize: 13,
    lineHeight: 18,
  },
  benefitsList: {
    gap: Spacing.xs,
  },
  benefitItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  benefitText: {
    fontSize: 13,
  },
  actionButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
    flex: 1,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 100,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["5xl"],
    paddingHorizontal: Spacing.lg,
  },
  emptyText: {
    marginTop: Spacing.md,
    fontSize: 16,
    fontWeight: "600",
  },
});
