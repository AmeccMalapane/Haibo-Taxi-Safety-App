import React, { useMemo } from "react";
import { View, ScrollView, StyleSheet, Linking, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, RouteProp, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { RouteMapView } from "@/components/RouteMapView";
import { ContributeButton } from "@/components/ContributeButton";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { TaxiRoute } from "@/lib/types";
import { getTaxiRouteById } from "@/lib/localData";

const triggerHaptic = async () => {
  try {
    const Haptics = await import("expo-haptics");
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {}
};

type RouteDetailRouteProp = RouteProp<{ RouteDetail: { routeId: string } }, "RouteDetail">;

const ROUTE_TYPE_LABELS: Record<string, string> = {
  local: "Local Route",
  regional: "Regional Route",
  intercity: "Long Distance",
};

const getSafetyColor = (score: number | undefined) => {
  if (!score) return BrandColors.gray[400];
  if (score >= 4) return BrandColors.primary.green;
  if (score >= 3) return BrandColors.secondary.orange;
  return "#E74C3C";
};

const getRiskColor = (risk: string | undefined) => {
  switch (risk?.toLowerCase()) {
    case "low":
      return BrandColors.primary.green;
    case "medium":
      return BrandColors.secondary.orange;
    case "high":
      return "#E74C3C";
    case "critical":
      return "#9C27B0";
    default:
      return BrandColors.gray[400];
  }
};

export default function RouteDetailScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const route = useRoute<RouteDetailRouteProp>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const taxiRoute = useMemo(
    () => getTaxiRouteById(route.params.routeId),
    [route.params.routeId]
  );

  const handleReportIssue = () => {
    triggerHaptic();
    navigation.navigate("Report");
  };

  const handleOpenMaps = async () => {
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
      <View style={[styles.container, styles.centered, { backgroundColor: theme.backgroundRoot }]}>
        <Feather name="alert-circle" size={48} color={theme.textSecondary} />
        <ThemedText style={{ marginTop: Spacing.md }}>Route not found</ThemedText>
        <Button onPress={() => navigation.goBack()} style={{ marginTop: Spacing.lg }}>
          Go Back
        </Button>
      </View>
    );
  }

  const safetyColor = getSafetyColor(taxiRoute.safetyScore);
  const riskColor = getRiskColor(taxiRoute.riskLevel);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
    >
      <View style={styles.mapContainer}>
        {mapRegion && taxiRoute.originCoords && taxiRoute.destinationCoords ? (
          <RouteMapView
            originCoords={taxiRoute.originCoords}
            destinationCoords={taxiRoute.destinationCoords}
            routeCoords={taxiRoute.routeCoords}
            originTitle={taxiRoute.origin}
            destinationTitle={taxiRoute.destination}
            region={mapRegion}
          />
        ) : (
          <View style={[styles.mapFallback, { backgroundColor: theme.backgroundDefault }]}>
            <Feather name="map" size={40} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
              Map preview not available
            </ThemedText>
            {taxiRoute.googleMapsLink ? (
              <Pressable onPress={handleOpenMaps} style={styles.mapLink}>
                <Feather name="external-link" size={14} color={BrandColors.primary.blue} />
                <ThemedText style={[styles.mapLinkText, { color: BrandColors.primary.blue }]}>
                  Open in Google Maps
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        )}
        <View style={[styles.routeOverlay, { backgroundColor: theme.surface }]}>
          <View style={styles.routeLabel}>
            <View style={[styles.dot, { backgroundColor: BrandColors.primary.blue }]} />
            <ThemedText style={styles.routeLabelText}>{taxiRoute.origin}</ThemedText>
          </View>
          <Feather name="arrow-right" size={16} color={theme.textSecondary} />
          <View style={styles.routeLabel}>
            <View style={[styles.dot, { backgroundColor: BrandColors.primary.green }]} />
            <ThemedText style={styles.routeLabelText}>{taxiRoute.destination}</ThemedText>
          </View>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault }]}>
          <Feather name="credit-card" size={24} color={BrandColors.primary.green} />
          <ThemedText style={styles.statValue}>
            {taxiRoute.fare ? `R${taxiRoute.fare}` : "—"}
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            Estimated Fare
          </ThemedText>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault }]}>
          <Feather name="clock" size={24} color={BrandColors.primary.blue} />
          <ThemedText style={styles.statValue}>
            {taxiRoute.estimatedTime || "—"}
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            Travel Time
          </ThemedText>
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Details</ThemedText>
        <View style={styles.detailsList}>
          {taxiRoute.routeNumber && (
            <View style={styles.detailItem}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>Route #</ThemedText>
              <ThemedText style={styles.detailValue}>{taxiRoute.routeNumber}</ThemedText>
            </View>
          )}
          <View style={styles.detailItem}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>Type</ThemedText>
            <ThemedText style={styles.detailValue}>{ROUTE_TYPE_LABELS[taxiRoute.routeType] || "Standard"}</ThemedText>
          </View>
        </View>
      </View>

      <Button
        title="Report an Issue"
        onPress={handleReportIssue}
        style={{ marginTop: Spacing.xl, backgroundColor: BrandColors.primary.red }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: "center", justifyContent: "center" },
  mapContainer: {
    height: 250,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    marginVertical: Spacing.lg,
    position: "relative",
  },
  mapFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  mapLink: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: Spacing.md },
  mapLinkText: { fontSize: 14, fontWeight: "600" },
  routeOverlay: {
    position: "absolute",
    bottom: Spacing.md,
    left: Spacing.md,
    right: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 4,
  },
  routeLabel: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  routeLabelText: { fontSize: 13, fontWeight: "700" },
  statsRow: { flexDirection: "row", gap: Spacing.md, marginBottom: Spacing.md },
  statCard: { flex: 1, padding: Spacing.md, borderRadius: BorderRadius.md, alignItems: "center", gap: 4 },
  statValue: { fontSize: 18, fontWeight: "800" },
  section: { marginTop: Spacing.lg },
  sectionTitle: { fontSize: 14, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, color: BrandColors.primary.blue, marginBottom: Spacing.md },
  detailsList: { gap: Spacing.sm },
  detailItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  detailValue: { fontWeight: "600" },
});
