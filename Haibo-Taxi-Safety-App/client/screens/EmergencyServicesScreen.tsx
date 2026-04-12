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
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/hooks/useTheme";
import { getEmergencyContactsList, getEmergencyCategories } from "@/lib/localData";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";

interface EmergencyContact {
  id: string;
  name: string;
  category: string;
  phone: string;
  alternatePhone?: string;
  description?: string;
  availability?: string;
  province?: string;
  type?: string;
}

interface EmergencyStats {
  total: number;
  national: number;
  regional: number;
  categories: { [key: string]: number };
  provinces: string[];
}

interface PrimaryNumber {
  number: string;
  name: string;
  description: string;
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

const CATEGORY_COLORS: { [key: string]: string } = {
  police: "#1976D2",
  fire: "#FF5722",
  medical: "#E91E63",
  ambulance: "#D32F2F",
  crisis: "#9C27B0",
  municipal: "#4CAF50",
  traffic: "#FF9800",
  healthcare: "#00BCD4",
  general: "#607D8B",
};

export default function EmergencyServicesScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const localContacts = useMemo(() => getEmergencyContactsList(), []);
  const isLoading = false;

  const allContacts: EmergencyContact[] = useMemo(() => 
    localContacts.map((c) => ({
      id: String(c.id),
      name: c.name,
      category: c.category,
      phone: c.phone,
      description: c.description,
    })),
  [localContacts]);

  const primaryNumbers: PrimaryNumber[] = useMemo(() => 
    localContacts
      .filter((c) => c.category === "National Emergency Services" || c.category === "General Emergency Services")
      .slice(0, 4)
      .map((c) => ({
        id: String(c.id),
        name: c.name,
        number: c.phone,
        icon: "phone" as keyof typeof Feather.glyphMap,
        color: "#E74C3C",
        description: c.description,
      })),
  [localContacts]);

  const categories = useMemo(() => {
    const catMap = new Map<string, number>();
    allContacts.forEach((c) => {
      catMap.set(c.category, (catMap.get(c.category) || 0) + 1);
    });
    return Array.from(catMap.entries()).map(([name, count]) => ({
      name,
      count,
      icon: CATEGORY_ICONS[name.toLowerCase()] || "phone",
      color: CATEGORY_COLORS[name.toLowerCase()] || "#607D8B",
    }));
  }, [allContacts]);

  const filteredContacts = useMemo(() => {
    if (!allContacts) return [];
    
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
    if (Platform.OS !== "web") {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await Linking.openURL(`tel:${phone.replace(/\s/g, "")}`);
      } catch (error) {
        console.log("Could not open phone dialer");
      }
    }
  };

  const renderPrimaryNumber = (item: PrimaryNumber, index: number) => (
    <Pressable
      key={index}
      style={[styles.primaryCard, { backgroundColor: BrandColors.status.emergency }]}
      onPress={() => handleCall(item.number)}
    >
      <View style={styles.primaryIconContainer}>
        <Feather name="phone" size={24} color="#FFFFFF" />
      </View>
      <View style={styles.primaryInfo}>
        <ThemedText style={styles.primaryNumber}>{item.number}</ThemedText>
        <ThemedText style={styles.primaryName}>{item.name}</ThemedText>
        <ThemedText style={styles.primaryDescription} numberOfLines={1}>
          {item.description}
        </ThemedText>
      </View>
      <View style={styles.callBadge}>
        <Feather name="phone-call" size={16} color="#FFFFFF" />
      </View>
    </Pressable>
  );

  const renderCategory = ({
    item,
  }: {
    item: { name: string; count: number; icon: string; color: string };
  }) => {
    const isSelected = selectedCategory === item.name;
    return (
      <Pressable
        style={[
          styles.categoryChip,
          {
            backgroundColor: isSelected ? item.color : theme.backgroundDefault,
            borderColor: isSelected ? item.color : theme.border,
          },
        ]}
        onPress={() => {
          Haptics.selectionAsync();
          setSelectedCategory(isSelected ? null : item.name);
        }}
      >
        <Feather
          name={item.icon as any}
          size={14}
          color={isSelected ? "#FFFFFF" : item.color}
        />
        <ThemedText
          style={[
            styles.categoryText,
            { color: isSelected ? "#FFFFFF" : theme.text },
          ]}
        >
          {item.name}
        </ThemedText>
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
            {item.count}
          </ThemedText>
        </View>
      </Pressable>
    );
  };

  const renderContact = ({ item }: { item: EmergencyContact }) => {
    const categoryColor =
      CATEGORY_COLORS[item.category.toLowerCase()] || "#607D8B";
    const categoryIcon =
      CATEGORY_ICONS[item.category.toLowerCase()] || "phone";

    return (
      <Pressable
        style={[styles.contactCard, { backgroundColor: theme.backgroundDefault }]}
        onPress={() => handleCall(item.phone)}
      >
        <View style={[styles.contactIcon, { backgroundColor: `${categoryColor}15` }]}>
          <Feather name={categoryIcon as any} size={20} color={categoryColor} />
        </View>
        <View style={styles.contactInfo}>
          <ThemedText style={styles.contactName} numberOfLines={1}>
            {item.name}
          </ThemedText>
          <View style={styles.contactMeta}>
            <View style={[styles.categoryBadge, { backgroundColor: `${categoryColor}20` }]}>
              <ThemedText style={[styles.categoryBadgeText, { color: categoryColor }]}>
                {item.category}
              </ThemedText>
            </View>
            {item.province && (
              <ThemedText style={[styles.provinceBadge, { color: theme.textSecondary }]}>
                {item.province}
              </ThemedText>
            )}
          </View>
          <ThemedText style={[styles.contactPhone, { color: BrandColors.primary.blue }]}>
            {item.phone}
          </ThemedText>
          {item.description && (
            <ThemedText
              style={[styles.contactDescription, { color: theme.textSecondary }]}
              numberOfLines={2}
            >
              {item.description}
            </ThemedText>
          )}
        </View>
        <Pressable
          style={[styles.callButton, { backgroundColor: BrandColors.primary.blue }]}
          onPress={() => handleCall(item.phone)}
        >
          <Feather name="phone" size={18} color="#FFFFFF" />
        </Pressable>
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
            placeholder="Search emergency services..."
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

      {primaryNumbers && primaryNumbers.length > 0 && !searchQuery && !selectedCategory && (
        <View style={styles.primarySection}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
            Primary Emergency Numbers
          </ThemedText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.primaryList}
          >
            {primaryNumbers.map(renderPrimaryNumber)}
          </ScrollView>
        </View>
      )}

      {categories.length > 0 && (
        <View style={styles.categoriesSection}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
            Categories
          </ThemedText>
          <FlatList
            data={categories}
            renderItem={renderCategory}
            keyExtractor={(item) => item.name}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesList}
          />
        </View>
      )}

      <View style={styles.statsBar}>
        <ThemedText style={[styles.statsText, { color: theme.textSecondary }]}>
          {selectedCategory
            ? `${filteredContacts.length} ${selectedCategory} contacts`
            : searchQuery
            ? `${filteredContacts.length} results`
            : `${allContacts.length} emergency contacts across ${categories.length} categories`}
        </ThemedText>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BrandColors.primary.blue} />
          <ThemedText style={{ marginTop: Spacing.md, color: theme.textSecondary }}>
            Loading emergency contacts...
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={filteredContacts}
          keyExtractor={(item) => item.id}
          renderItem={renderContact}
          contentContainerStyle={{
            paddingHorizontal: Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl,
          }}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="phone-off" size={48} color={theme.textSecondary} />
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                No emergency contacts found
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
  primarySection: {
    paddingTop: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  primaryList: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  primaryCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    width: 200,
  },
  primaryIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryInfo: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  primaryNumber: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  primaryName: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
    marginTop: 2,
  },
  primaryDescription: {
    fontSize: 10,
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },
  callBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  categoriesSection: {
    paddingTop: Spacing.md,
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
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  contactIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  contactMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: 4,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  provinceBadge: {
    fontSize: 11,
  },
  contactPhone: {
    fontSize: 14,
    fontWeight: "600",
  },
  contactDescription: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: Spacing.sm,
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
