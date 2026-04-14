import React, { useState, useRef } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Keyboard,
  FlatList,
  Pressable,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";

interface TaxiStop {
  id: string;
  name: string;
  address?: string;
  distance?: string;
}

interface FloatingSearchBarProps {
  onSearch: (query: string) => void;
  onSelectStop?: (stop: TaxiStop) => void;
  stops?: TaxiStop[];
  placeholder?: string;
}

export default function FloatingSearchBar({
  onSearch,
  onSelectStop,
  stops = [],
  placeholder = "Search taxi stops...",
}: FloatingSearchBarProps) {
  const { theme, isDark } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredStops, setFilteredStops] = useState<TaxiStop[]>([]);
  const expandAnim = useRef(new Animated.Value(50)).current;
  const resultsAnim = useRef(new Animated.Value(0)).current;

  const handleExpand = () => {
    setIsExpanded(true);
    Animated.parallel([
      Animated.timing(expandAnim, {
        toValue: 200,
        duration: 250,
        useNativeDriver: false,
      }),
      Animated.timing(resultsAnim, {
        toValue: 1,
        duration: 200,
        delay: 100,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const handleCollapse = () => {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(expandAnim, {
        toValue: 50,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(resultsAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: false,
      }),
    ]).start(() => {
      setIsExpanded(false);
      setSearchQuery("");
      setFilteredStops([]);
    });
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    onSearch(text);

    if (text.length > 0) {
      const filtered = stops.filter(
        (stop) =>
          stop.name.toLowerCase().includes(text.toLowerCase()) ||
          (stop.address && stop.address.toLowerCase().includes(text.toLowerCase()))
      );
      setFilteredStops(filtered.slice(0, 5));
    } else {
      setFilteredStops([]);
    }
  };

  const handleSelectStop = (stop: TaxiStop) => {
    if (onSelectStop) {
      onSelectStop(stop);
    }
    handleCollapse();
  };

  const renderStopItem = ({ item }: { item: TaxiStop }) => (
    <Pressable
      style={[styles.stopItem, { borderBottomColor: theme.border }]}
      onPress={() => handleSelectStop(item)}
    >
      <View style={[styles.stopIcon, { backgroundColor: BrandColors.primary.blue + "20" }]}>
        <Feather name="map-pin" size={16} color={BrandColors.primary.blue} />
      </View>
      <View style={styles.stopInfo}>
        <ThemedText style={styles.stopName}>{item.name}</ThemedText>
        {item.address ? (
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {item.address}
          </ThemedText>
        ) : null}
      </View>
      {item.distance ? (
        <ThemedText type="small" style={[styles.stopDistance, { color: theme.textSecondary }]}>
          {item.distance}
        </ThemedText>
      ) : null}
    </Pressable>
  );

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? theme.backgroundSecondary : "#FFFFFF",
          height: expandAnim,
        },
      ]}
    >
      <View style={styles.searchRow}>
        <Feather name="search" size={20} color={theme.textSecondary} />
        <TextInput
          style={[styles.input, { color: theme.text }]}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          value={searchQuery}
          onChangeText={handleSearch}
          onFocus={handleExpand}
        />
        {isExpanded ? (
          <TouchableOpacity
            onPress={handleCollapse}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Close search"
          >
            <Feather name="x" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {isExpanded && filteredStops.length > 0 ? (
        <Animated.View style={[styles.results, { opacity: resultsAnim }]}>
          <FlatList
            data={filteredStops}
            renderItem={renderStopItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
        </Animated.View>
      ) : null}

      {isExpanded && searchQuery.length > 0 && filteredStops.length === 0 ? (
        <Animated.View style={[styles.noResults, { opacity: resultsAnim }]}>
          <ThemedText style={{ color: theme.textSecondary }}>No stops found</ThemedText>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: "hidden",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.sm,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  results: {
    flex: 1,
  },
  stopItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  stopIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  stopInfo: {
    flex: 1,
  },
  stopName: {
    fontWeight: "500",
  },
  stopDistance: {
    fontSize: 12,
  },
  noResults: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
