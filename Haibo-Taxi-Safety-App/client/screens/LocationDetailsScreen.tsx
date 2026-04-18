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
  Alert,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRoute, RouteProp, useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQueryClient } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";
import { getTaxiLocationById, getTaxiRoutes } from "@/lib/localData";
import { useLocationDetails } from "@/hooks/useApiData";
import type { TaxiLocation, LocationType, TaxiRoute } from "@/lib/types";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { uploadFromUri } from "@/lib/uploads";
import { apiRequest } from "@/lib/query-client";
import { useTaxiHero } from "@/hooks/useTaxiHero";

type LocationImageRow = {
  id: string;
  url: string;
  caption?: string | null;
  verified?: boolean | null;
};

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
  const queryClient = useQueryClient();
  const { locationId } = route.params;

  const [location, setLocation] = useState<TaxiLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const { data: apiLocation } = useLocationDetails(locationId);

  // Photos come from the locationImages table via GET /api/locations/:id.
  // The hook shape is loose (useApiData returns the raw response) so we
  // cast through a minimal local type instead of widening LocationDetails.
  const contributedImages: LocationImageRow[] = useMemo(() => {
    const raw = (apiLocation as any)?.images;
    if (!Array.isArray(raw)) return [];
    return raw as LocationImageRow[];
  }, [apiLocation]);

  // Hero source: prefer a community-contributed image if one exists,
  // otherwise fall back to a bundled SA minibus taxi photo picked
  // deterministically from the location's id — so the same rank always
  // gets the same fallback van rather than re-shuffling on every
  // focus, and two ranks visible in the same session get different
  // vans. Old fallback was an Unsplash cyclist photo that had nothing
  // to do with minibus taxis.
  const fallbackHero = useTaxiHero(locationId);
  const heroSource = contributedImages[0]?.url
    ? { uri: contributedImages[0].url }
    : fallbackHero;

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
    ).slice(0, 10);
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

  // Contribute a rank photo. New uploads land in locationImages with
  // verified=false, so they still show immediately to the uploader (and
  // everyone else) but the command-center team can sweep bad contributions.
  const handleContributePhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Permission needed",
          "Grant photo library access to contribute a photo.",
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.85,
      });
      if (result.canceled || !result.assets[0]) return;

      setUploading(true);
      const uploaded = await uploadFromUri(result.assets[0].uri, {
        folder: "locations",
        name: result.assets[0].fileName || undefined,
      });
      await apiRequest(`/api/locations/${locationId}/images`, {
        method: "POST",
        body: JSON.stringify({
          url: uploaded.url,
          imageType: "general",
        }),
      });
      await queryClient.invalidateQueries({
        queryKey: ["/api/locations", locationId],
      });
    } catch (error: any) {
      Alert.alert("Upload failed", error.message || "Please try again.");
    } finally {
      setUploading(false);
    }
  };

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
            source={heroSource}
            style={styles.headerImage}
            contentFit="cover"
          />
          <Pressable
            style={styles.backIcon}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
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
              accessibilityRole="button"
              accessibilityLabel="Open in maps"
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

          {/* Photos — contributed by commuters. Horizontal strip so a
              location can slowly build up a visual wayfinding library
              (pay-point signage, entry gates, recognizable landmarks). */}
          <View style={styles.section}>
            <View style={styles.photosHeader}>
              <ThemedText style={styles.sectionTitle}>Photos</ThemedText>
              <Pressable
                onPress={handleContributePhoto}
                disabled={uploading}
                style={[
                  styles.contributeButton,
                  { borderColor: BrandColors.primary.red, opacity: uploading ? 0.6 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Add a photo"
              >
                {uploading ? (
                  <ActivityIndicator size="small" color={BrandColors.primary.red} />
                ) : (
                  <>
                    <Feather name="camera" size={14} color={BrandColors.primary.red} />
                    <ThemedText style={[styles.contributeText, { color: BrandColors.primary.red }]}>
                      Add photo
                    </ThemedText>
                  </>
                )}
              </Pressable>
            </View>
            {contributedImages.length > 0 ? (
              <View style={styles.mosaicGrid}>
                {contributedImages.map((img, idx) => {
                  const isFirst = idx === 0;
                  return (
                    <View
                      key={img.id}
                      style={isFirst ? styles.mosaicTileHero : styles.mosaicTileSmall}
                    >
                      <Image
                        source={{ uri: img.url }}
                        style={styles.photoImage}
                        contentFit="cover"
                      />
                    </View>
                  );
                })}
              </View>
            ) : (
              <ThemedText style={[styles.emptyPhotos, { color: theme.textSecondary }]}>
                No photos yet — be the first to help commuters find this rank.
              </ThemedText>
            )}
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

          {/* Community Confidence */}
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Community Rating</ThemedText>
            <View style={[styles.confidenceCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.confidenceRow}>
                <View style={styles.confidenceStat}>
                  <ThemedText style={styles.confidenceValue}>
                    {location.confidenceScore ?? 50}%
                  </ThemedText>
                  <ThemedText style={[styles.confidenceLabel, { color: theme.textSecondary }]}>
                    Confidence
                  </ThemedText>
                </View>
                <View style={styles.confidenceDivider} />
                <View style={styles.confidenceStat}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Feather name="thumbs-up" size={16} color={BrandColors.primary.green} />
                    <ThemedText style={styles.confidenceValue}>
                      {location.upvotes ?? 0}
                    </ThemedText>
                  </View>
                  <ThemedText style={[styles.confidenceLabel, { color: theme.textSecondary }]}>
                    Upvotes
                  </ThemedText>
                </View>
                <View style={styles.confidenceDivider} />
                <View style={styles.confidenceStat}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Feather name="thumbs-down" size={16} color={BrandColors.secondary.orange} />
                    <ThemedText style={styles.confidenceValue}>
                      {location.downvotes ?? 0}
                    </ThemedText>
                  </View>
                  <ThemedText style={[styles.confidenceLabel, { color: theme.textSecondary }]}>
                    Downvotes
                  </ThemedText>
                </View>
              </View>
            </View>
          </View>

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
  photosHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  contributeButton: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 18, borderWidth: 1.5, minHeight: 32 },
  contributeText: { fontSize: 12, fontWeight: "800", letterSpacing: 0.4 },
  mosaicGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  mosaicTileHero: {
    width: "100%",
    height: 180,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#00000010",
  },
  mosaicTileSmall: {
    width: (screenWidth - 40 - 6) / 2,
    height: 120,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#00000010",
  },
  photoImage: { width: "100%", height: "100%" },
  emptyPhotos: { fontSize: 13, lineHeight: 18 },
  confidenceCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  confidenceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  confidenceStat: { alignItems: "center", gap: 4 },
  confidenceValue: { fontSize: 22, fontWeight: "800" },
  confidenceLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  confidenceDivider: { width: 1, height: 40, backgroundColor: "rgba(0,0,0,0.08)" },
});
