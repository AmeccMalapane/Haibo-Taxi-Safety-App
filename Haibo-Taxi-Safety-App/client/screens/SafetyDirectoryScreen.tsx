import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  FlatList,
  TextInput,
  Pressable,
  StyleSheet,
  Linking,
  Platform,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { getEmergencyContactsList, getEmergencyCategories, LocalEmergencyContact } from "@/lib/localData";

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

const CATEGORY_COLORS: Record<string, string> = {
  "National Emergency Services": "#E74C3C",
  "General Emergency Services": "#E74C3C",
  "Medical Emergency Services": "#E91E63",
  "Crime Reporting Safety": "#3F51B5",
  "Road Traffic Assistance": "#FF9800",
  "Gender Based Violence Support": "#9C27B0",
  "Mental Health Support": "#00BCD4",
  "Substance Abuse Support": "#FF5722",
  "Family Child Support": "#4CAF50",
  "Disaster Relief": "#795548",
  "Utility Services Emergencies": "#FFC107",
  "Animal Emergencies Welfare": "#8BC34A",
  "Departmental Contacts": "#607D8B",
  "Gauteng Local Services": "#2196F3",
  "South Coast Services": "#009688",
  "Western Cape": "#009688",
  "Other Essential Contacts": "#9E9E9E",
};

export default function SafetyDirectoryScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();

  const [searchQuery, setSearchQuery] = useState("");
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

  // Group contacts by category
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

  // Flatten for FlatList
  const flatData = useMemo(() => {
    const items: { type: "header" | "contact"; data: any }[] = [];
    groupedData.forEach((group) => {
      items.push({ type: "header", data: group.title });
      group.data.forEach((c) => items.push({ type: "contact", data: c }));
    });
    return items;
  }, [groupedData]);

  const handleCall = useCallback(async (phone: string) => {
    try {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      const url = `tel:${phone.replace(/\s/g, "")}`;
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        Linking.openURL(url);
      }
    } catch {}
  }, []);

  const renderCategoryHeader = (title: string) => {
    const icon = CATEGORY_ICONS[title] || "info";
    const color = CATEGORY_COLORS[title] || BrandColors.primary.blue;
    return (
      <View style={[styles.sectionHeader, { borderBottomColor: theme.border }]}>
        <View style={[styles.sectionIcon, { backgroundColor: color + "20" }]}>
          <Feather name={icon} size={16} color={color} />
        </View>
        <ThemedText style={[styles.sectionTitle, { color }]}>{title}</ThemedText>
      </View>
    );
  };

  const renderContactCard = (contact: LocalEmergencyContact) => {
    const catColor = CATEGORY_COLORS[contact.category] || BrandColors.primary.blue;
    return (
      <Pressable
        key={contact.id}
        style={[
          styles.contactCard,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
          },
        ]}
        onPress={() => handleCall(contact.phone)}
      >
        <View style={styles.contactContent}>
          <View style={styles.contactInfo}>
            <ThemedText style={[styles.contactName, { color: theme.text }]}>
              {contact.name}
            </ThemedText>
            <ThemedText
              style={[styles.contactDescription, { color: theme.textSecondary }]}
              numberOfLines={2}
            >
              {contact.description}
            </ThemedText>
          </View>
          <View style={styles.phoneContainer}>
            <View style={[styles.callButton, { backgroundColor: catColor }]}>
              <Feather name="phone" size={16} color="#FFFFFF" />
            </View>
            <ThemedText style={[styles.phoneText, { color: catColor }]}>
              {contact.phone}
            </ThemedText>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {/* Search Bar */}
      <View
        style={[
          styles.searchContainer,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
          },
        ]}
      >
        <Feather name="search" size={18} color={theme.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search contacts, categories..."
          placeholderTextColor={theme.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <Pressable onPress={() => setSearchQuery("")}>
            <Feather name="x" size={18} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterList}
        style={styles.filterContainer}
      >
        {categories.map((cat) => {
          const isActive = selectedCategory === cat;
          const catColor = cat === "All" ? BrandColors.primary.blue : (CATEGORY_COLORS[cat] || BrandColors.primary.blue);
          return (
            <Pressable
              key={cat}
              onPress={() => setSelectedCategory(cat)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: isActive ? catColor : theme.surface,
                  borderColor: isActive ? catColor : theme.border,
                  borderWidth: 1,
                },
              ]}
            >
              <ThemedText
                style={[
                  styles.filterChipText,
                  { color: isActive ? "#FFFFFF" : theme.textSecondary },
                ]}
              >
                {cat === "All" ? `All (${allContacts.length})` : cat}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Contacts List */}
      <FlatList
        data={flatData}
        keyExtractor={(item, index) =>
          item.type === "header" ? `header-${item.data}` : `contact-${item.data.id}-${index}`
        }
        renderItem={({ item }) =>
          item.type === "header"
            ? renderCategoryHeader(item.data as string)
            : renderContactCard(item.data as LocalEmergencyContact)
        }
        contentContainerStyle={{
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: Spacing.lg,
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="phone-off" size={48} color={theme.textSecondary} />
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              No contacts found
            </ThemedText>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    height: 48,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: 16,
  },
  filterContainer: {
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    maxHeight: 44,
  },
  filterList: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "500",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  contactCard: {
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    overflow: "hidden",
  },
  contactContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
  },
  contactInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  contactName: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  contactDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  phoneContainer: {
    alignItems: "center",
    gap: 4,
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  phoneText: {
    fontSize: 11,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["5xl"],
  },
  emptyText: {
    marginTop: Spacing.md,
    fontSize: 16,
  },
});
