import React, { useMemo } from "react";
import { View, ScrollView, StyleSheet, Linking, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, RouteProp, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/hooks/useTheme";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { Spacing, BrandColors, BorderRadius, Typography } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { GradientButton } from "@/components/GradientButton";
import { RouteMapView } from "@/components/RouteMapView";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { getTaxiRouteById } from "@/lib/localData";

type RouteDetailRouteProp = RouteProp<{ RouteDetail: { routeId: string } }, "RouteDetail">;

const ROUTE_TYPE_LABELS: Record<string, string> = {
  local: "Local route",
  regional: "Regional route",
  intercity: "Long distance",
};

const MAP_HEIGHT = 280;

export default function RouteDetailScreen() {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const routeParam = useRoute<RouteDetailRouteProp>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const taxiRoute = useMemo(
    () => getTaxiRouteById(routeParam.params.routeId),
    [routeParam.params.routeId]
  );

  const handleReportIssue = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    navigation.navigate("Report");
  };

  const handleOpenMaps = async () => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync();
    }
    if (taxiRoute?.googleMapsLink) {
      await Linking.openURL(taxiRoute.googleMapsLink);
    } else if (taxiRoute?.originCoords && taxiRoute?.destinationCoords) {
      const url = `https://www.google.com/maps/dir/${taxiRoute.originCoords.latitude},${taxiRoute.originCoords.longitude}/${taxiRoute.destinationCoords.latitude},${taxiRoute.destinationCoords.longitude}`;
      await Linking.openURL(url);
    }
  };

  const mapRegion = useMemo(() => {
    if (!taxiRoute?.originCoords || !taxiRoute?.destinationCoords) return null;

    const minLat = Math.min(taxiRoute.originCoords.latitude, taxiRoute.destinationCoords.latitude);
    const maxLat = Math.max(taxiRoute.originCoords.latitude, taxiRoute.destinationCoords.latitude);
    const minLng = Math.min(taxiRoute.originCoords.longitude, taxiRoute.destinationCoords.longitude);
    const maxLng = Math.max(taxiRoute.originCoords.longitude, taxiRoute.destinationCoords.longitude);

    const latDelta = (maxLat - minLat) * 1.5 || 0.02;
    const lngDelta = (maxLng - minLng) * 1.5 || 0.02;

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(latDelta, 0.02),
      longitudeDelta: Math.max(lngDelta, 0.02),
    };
  }, [taxiRoute]);

  if (!taxiRoute) {
    return (
      <View
        style={[
          styles.container,
          styles.centered,
          { backgroundColor: theme.backgroundDefault, paddingTop: insets.top + Spacing.lg },
        ]}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          style={[styles.backButtonStandalone, { top: insets.top + Spacing.md }]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Feather name="arrow-left" size={20} color={BrandColors.gray[700]} />
        </Pressable>
        <Feather name="alert-circle" size={48} color={BrandColors.gray[600]} />
        <ThemedText style={styles.notFoundTitle}>Route not found</ThemedText>
        <ThemedText style={styles.notFoundSubtitle}>
          We couldn't load this route. It may have been removed.
        </ThemedText>
        <View style={{ marginTop: Spacing.lg, alignSelf: "stretch", paddingHorizontal: Spacing.lg }}>
          <GradientButton onPress={() => navigation.goBack()} icon="arrow-left">
            Go back
          </GradientButton>
        </View>
      </View>
    );
  }

  const cardSurface = isDark ? theme.surface : "#FFFFFF";
  const hasMap = Boolean(mapRegion && taxiRoute.originCoords && taxiRoute.destinationCoords);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + Spacing["3xl"],
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mapContainer}>
          {hasMap ? (
            <RouteMapView
              originCoords={taxiRoute.originCoords!}
              destinationCoords={taxiRoute.destinationCoords!}
              routeCoords={taxiRoute.routeCoords}
              originTitle={taxiRoute.origin}
              destinationTitle={taxiRoute.destination}
              region={mapRegion!}
            />
          ) : (
            <View
              style={[
                styles.mapFallback,
                { backgroundColor: isDark ? "#1a1a2e" : BrandColors.gray[100] },
              ]}
            >
              <Feather name="map" size={40} color={BrandColors.gray[600]} />
              <ThemedText style={styles.mapFallbackText}>Map preview not available</ThemedText>
              {taxiRoute.googleMapsLink ? (
                <Pressable onPress={handleOpenMaps} style={styles.mapLink}>
                  <Feather
                    name="external-link"
                    size={16}
                    color={BrandColors.primary.gradientStart}
                  />
                  <ThemedText style={styles.mapLinkText}>Open in Google Maps</ThemedText>
                </Pressable>
              ) : null}
            </View>
          )}

          <LinearGradient
            colors={["rgba(0,0,0,0.55)", "rgba(0,0,0,0)"]}
            style={[styles.topBarGradient, { paddingTop: insets.top + Spacing.sm }]}
          >
            <Pressable
              onPress={() => navigation.goBack()}
              style={styles.glassButton}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Feather name="arrow-left" size={20} color="#FFFFFF" />
            </Pressable>
            <View style={styles.heroBadge}>
              <Feather name="navigation" size={12} color="#FFFFFF" />
              <ThemedText style={styles.heroBadgeText}>
                {ROUTE_TYPE_LABELS[taxiRoute.routeType] || "Route"}
              </ThemedText>
            </View>
          </LinearGradient>

          <View style={[styles.routeOverlay, { backgroundColor: cardSurface }]}>
            <View style={styles.routeLabel}>
              <View style={[styles.dot, { backgroundColor: BrandColors.primary.gradientStart }]} />
              <ThemedText style={styles.routeLabelText} numberOfLines={1}>
                {taxiRoute.origin}
              </ThemedText>
            </View>
            <Feather
              name="arrow-right"
              size={16}
              color={BrandColors.gray[600]}
              style={{ marginHorizontal: Spacing.sm }}
            />
            <View style={styles.routeLabel}>
              <View style={[styles.dot, { backgroundColor: BrandColors.primary.gradientEnd }]} />
              <ThemedText style={styles.routeLabelText} numberOfLines={1}>
                {taxiRoute.destination}
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.duration(400)}
            style={styles.statsRow}
          >
            <View style={[styles.statCard, { backgroundColor: cardSurface }]}>
              <View style={styles.statIconWrap}>
                <Feather
                  name="credit-card"
                  size={18}
                  color={BrandColors.primary.gradientStart}
                />
              </View>
              <ThemedText style={styles.statValue}>
                {taxiRoute.fare ? `R${taxiRoute.fare}` : "—"}
              </ThemedText>
              <ThemedText style={styles.statLabel}>Estimated fare</ThemedText>
            </View>
            <View style={[styles.statCard, { backgroundColor: cardSurface }]}>
              <View style={styles.statIconWrap}>
                <Feather
                  name="clock"
                  size={18}
                  color={BrandColors.primary.gradientStart}
                />
              </View>
              <ThemedText style={styles.statValue}>
                {taxiRoute.estimatedTime || "—"}
              </ThemedText>
              <ThemedText style={styles.statLabel}>Travel time</ThemedText>
            </View>
          </Animated.View>

          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.delay(80).duration(400)}
            style={styles.section}
          >
            <ThemedText style={styles.sectionLabel}>Route info</ThemedText>
            <View style={[styles.detailsCard, { backgroundColor: cardSurface }]}>
              {taxiRoute.routeNumber ? (
                <View style={styles.detailItem}>
                  <View style={styles.detailKey}>
                    <Feather name="hash" size={16} color={BrandColors.gray[600]} />
                    <ThemedText style={styles.detailKeyText}>Route number</ThemedText>
                  </View>
                  <ThemedText style={styles.detailValue}>
                    {taxiRoute.routeNumber}
                  </ThemedText>
                </View>
              ) : null}
              <View style={styles.detailItem}>
                <View style={styles.detailKey}>
                  <Feather name="map" size={16} color={BrandColors.gray[600]} />
                  <ThemedText style={styles.detailKeyText}>Type</ThemedText>
                </View>
                <ThemedText style={styles.detailValue}>
                  {ROUTE_TYPE_LABELS[taxiRoute.routeType] || "Standard"}
                </ThemedText>
              </View>
              {taxiRoute.googleMapsLink ? (
                <Pressable onPress={handleOpenMaps} style={styles.detailItem}>
                  <View style={styles.detailKey}>
                    <Feather
                      name="external-link"
                      size={16}
                      color={BrandColors.primary.gradientStart}
                    />
                    <ThemedText
                      style={[
                        styles.detailKeyText,
                        { color: BrandColors.primary.gradientStart, fontWeight: "700" },
                      ]}
                    >
                      Open in Google Maps
                    </ThemedText>
                  </View>
                  <Feather
                    name="chevron-right"
                    size={16}
                    color={BrandColors.primary.gradientStart}
                  />
                </Pressable>
              ) : null}
            </View>
          </Animated.View>

          <Animated.View entering={reducedMotion ? undefined : FadeInDown.delay(160).duration(400)}>
            <GradientButton
              onPress={handleReportIssue}
              icon="flag"
              variant="outline"
            >
              Report an issue
            </GradientButton>
            <ThemedText style={styles.footerNote}>
              Spotted incorrect info or a safety concern? Let us know.
            </ThemedText>
          </Animated.View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonStandalone: {
    position: "absolute",
    left: Spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BrandColors.gray[100],
    alignItems: "center",
    justifyContent: "center",
  },
  notFoundTitle: {
    ...Typography.h3,
    marginTop: Spacing.md,
  },
  notFoundSubtitle: {
    ...Typography.small,
    color: BrandColors.gray[600],
    marginTop: Spacing.xs,
    textAlign: "center",
    paddingHorizontal: Spacing.lg,
  },
  mapContainer: {
    height: MAP_HEIGHT,
    position: "relative",
  },
  mapFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  mapFallbackText: {
    ...Typography.small,
    color: BrandColors.gray[600],
    marginTop: Spacing.sm,
  },
  mapLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: Spacing.md,
  },
  mapLinkText: {
    ...Typography.small,
    fontWeight: "700",
    color: BrandColors.primary.gradientStart,
  },
  topBarGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  glassButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  heroBadgeText: {
    ...Typography.label,
    color: "#FFFFFF",
    fontWeight: "700",
    textTransform: "capitalize",
  },
  routeOverlay: {
    position: "absolute",
    bottom: Spacing.md,
    left: Spacing.md,
    right: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  routeLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  routeLabelText: {
    ...Typography.small,
    fontWeight: "700",
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "flex-start",
    gap: 6,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BrandColors.primary.gradientStart + "15",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  statValue: {
    ...Typography.h3,
    fontWeight: "800",
  },
  statLabel: {
    ...Typography.label,
    color: BrandColors.gray[600],
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionLabel: {
    ...Typography.label,
    color: BrandColors.gray[700],
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: Spacing.md,
    fontWeight: "700",
  },
  detailsCard: {
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  detailItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BrandColors.gray[200],
  },
  detailKey: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  detailKeyText: {
    ...Typography.small,
    color: BrandColors.gray[600],
  },
  detailValue: {
    ...Typography.small,
    fontWeight: "700",
  },
  footerNote: {
    ...Typography.small,
    color: BrandColors.gray[600],
    textAlign: "center",
    marginTop: Spacing.md,
  },
});
