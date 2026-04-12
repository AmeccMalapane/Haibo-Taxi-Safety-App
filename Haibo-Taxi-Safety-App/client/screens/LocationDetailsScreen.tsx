import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
  Dimensions,
  ScrollView,
  Linking,
} from "react-native";
import { Image } from "expo-image";
import { useRoute, RouteProp, useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";
import { getTaxiLocationById, getTaxiRoutes } from "@/lib/localData";
import { useLocationDetails } from "@/hooks/useApiData";
import type { TaxiLocation, LocationType, TaxiRoute } from "@/lib/types";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

const { width: screenWidth } = Dimensions.get("window");

type LocationDetailsRouteProp = RouteProp<RootStackParamList, "LocationDetails">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const locationTypeConfig: Record<LocationType, { color: string; icon: keyof typeof Feather.glyphMap; label: string }> = {
  rank: { color: BrandColors.primary.blue, icon: "home", label: "Taxi Rank" },
  formal_stop: { color: BrandColors.primary.green, icon: "map-pin", label: "Formal Stop" },
  informal_stop: { color: BrandColors.secondary.orange, icon: "navigation", label: "Informal Stop" },
  landmark: { color: "#9B59B6", icon: "flag", label: "Landmark" },
  interchange: { color: "#E74C3C", icon: "repeat", label: "Interchange" },
};

export default function LocationDetailsScreen() {
  const { theme, isDark } = useTheme();
  const route = useRoute<LocationDetailsRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { locationId } = route.params;

  const [location, setLocation] = useState<TaxiLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const { data: apiLocation } = useLocationDetails(locationId);

  useEffect(() => {
    // Use API data if available, fall back to local
    if (apiLocation) {
      setLocation({
        id: apiLocation.id,
        name: apiLocation.name,
        type: apiLocation.type || "informal_stop",
        latitude: apiLocation.latitude,
        longitude: apiLocation.longitude,
        address: apiLocation.address || "",
        description: apiLocation.description || "",
        verificationStatus: apiLocation.verificationStatus || "pending",
        confidenceScore: apiLocation.confidenceScore || 50,
        upvotes: apiLocation.upvotes || 0,
        downvotes: apiLocation.downvotes || 0,
        isActive: apiLocation.isActive !== false,
      } as TaxiLocation);
      setLoading(false);
    } else {
      const loc = getTaxiLocationById(locationId);
      if (loc) setLocation(loc);
      setLoading(false);
    }
  }, [locationId, apiLocation]);

  const connectedRoutes = useMemo(() => {
    if (!location) return [];
    const allRoutes = getTaxiRoutes();
    return allRoutes.filter(r => 
      r.origin.toLowerCase().includes(location.name.toLowerCase()) || 
      r.destination.toLowerCase().includes(location.name.toLowerCase())
    ).slice(0, 5);
  }, [location]);

  if (loading) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={BrandColors.primary.red} />
      </ThemedView>
    );
  }

  if (!location) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <Feather name="alert-circle" size={48} color={theme.textSecondary} />
        <ThemedText style={{ marginTop: 16 }}>Location not found</ThemedText>
        <Pressable 
          onPress={() => navigation.goBack()}
          style={[styles.backButton, { backgroundColor: BrandColors.primary.red }]}
        >
          <ThemedText style={{ color: "#FFF", fontWeight: "700" }}>Go Back</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  const config = locationTypeConfig[location.type] || locationTypeConfig.rank;

  const openInMaps = () => {
    const url = Platform.select({
      ios: `maps:0,0?q=${location.latitude},${location.longitude}`,
      android: `geo:0,0?q=${location.latitude},${location.longitude}(${location.name})`,
    });
    if (url) Linking.openURL(url);
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header with Map/Image */}
        <View style={styles.headerContainer}>
          <Image
            source={{ uri: "https://images.unsplash.com/photo-1517649763962-0c623066013b?q=80&w=1000" }}
            style={styles.headerImage}
            contentFit="cover"
          />
          <Pressable style={styles.backIcon} onPress={() => navigation.goBack()}>
            <Feather name="arrow-left" size={24} color="#FFF" />
          </Pressable>
          <View style={[styles.typeBadge, { backgroundColor: config.color }]}>
            <Feather name={config.icon} size={14} color="#FFFFFF" />
            <ThemedText style={styles.typeBadgeText}>{config.label}</ThemedText>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <ThemedText type="h2" style={styles.mainTitle}>{location.name}</ThemedText>
              <View style={styles.locationRow}>
                <Feather name="map-pin" size={14} color={theme.textSecondary} />
                <ThemedText style={[styles.addressText, { color: theme.textSecondary }]}>
                  {location.address || "Johannesburg, Gauteng"}
                </ThemedText>
              </View>
            </View>
            <Pressable 
              onPress={openInMaps}
              style={[styles.navButton, { backgroundColor: BrandColors.primary.red }]}
            >
              <Feather name="navigation" size={20} color="#FFF" />
            </Pressable>
          </View>

          {/* About Section */}
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>About this Rank</ThemedText>
            <ThemedText style={[styles.description, { color: theme.textSecondary }]}>
              {location.description || "This taxi rank is a major hub providing transport services to local and regional destinations. It features 24/7 security and verified taxi associations."}
            </ThemedText>
          </View>

          {/* Connected Routes */}
          {connectedRoutes.length > 0 && (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Connected Routes</ThemedText>
              <View style={styles.routesList}>
                {connectedRoutes.map((route) => (
                  <Pressable 
                    key={route.id}
                    style={[styles.routeItem, { backgroundColor: theme.surface, borderColor: theme.border }]}
                    onPress={() => navigation.navigate("RouteDetail", { routeId: route.id })}
                  >
                    <View style={styles.routeInfo}>
                      <ThemedText style={styles.routeText}>{route.origin} → {route.destination}</ThemedText>
                      <ThemedText style={[styles.routeFare, { color: BrandColors.primary.green }]}>R{route.fare}</ThemedText>
                    </View>
                    <Feather name="chevron-right" size={16} color={theme.textSecondary} />
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Rating CTA */}
          <Pressable 
            style={[styles.ratingCTA, { backgroundColor: BrandColors.primary.red }]}
            onPress={() => navigation.navigate("Rating")}
          >
            <Feather name="star" size={20} color="#FFF" />
            <ThemedText style={styles.ratingCTAText}>Rate Driver or Rank Service</ThemedText>
            <Feather name="arrow-right" size={16} color="#FFF" />
          </Pressable>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  centered: { alignItems: "center", justifyContent: "center" },
  headerContainer: { width: "100%", height: 200, position: "relative" },
  headerImage: { width: "100%", height: "100%" },
  backIcon: { position: "absolute", top: 50, left: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
  typeBadge: { position: "absolute", bottom: 16, left: 16, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6 },
  typeBadgeText: { color: "#FFF", fontSize: 12, fontWeight: "800" },
  content: { padding: 20, marginTop: -10 },
  titleRow: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  mainTitle: { fontSize: 24, fontWeight: "800", marginBottom: 4 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  addressText: { fontSize: 14 },
  navButton: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", elevation: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1, color: BrandColors.primary.red, marginBottom: 10 },
  description: { fontSize: 15, lineHeight: 22 },
  routesList: { gap: 10 },
  routeItem: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1, justifyContent: "space-between" },
  routeInfo: { flex: 1 },
  routeText: { fontSize: 14, fontWeight: "700", marginBottom: 2 },
  routeFare: { fontSize: 13, fontWeight: "800" },
  ratingCTA: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 16, borderRadius: 12, gap: 10, marginTop: 10 },
  ratingCTAText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  backButton: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 25 },
});
