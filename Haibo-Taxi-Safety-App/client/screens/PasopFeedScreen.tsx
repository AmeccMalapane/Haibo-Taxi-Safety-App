import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { ThemedText } from "@/components/ThemedText";
import { SafeTripProgressBar } from "@/components/SafeTripProgressBar";
import { Spacing, BrandColors, BorderRadius, Typography } from "@/constants/theme";
import { getDeviceId } from "@/lib/deviceId";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import {
  PASOP_CATEGORIES,
  PASOP_CATEGORY_LIST,
  PasopCategory,
  PasopReport,
  getMyPetitions,
  getPasopReports,
  getReportAgeLabel,
  getReportsNearby,
  haversineKm,
  isReportActive,
  petitionPasopReport,
  recordMyPetition,
  SafetyCoord,
} from "@/data/pasopReports";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const SAFETY_RADIUS_KM = 5;

export default function PasopFeedScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const reducedMotion = useReducedMotion();

  const [reports, setReports] = useState<PasopReport[]>([]);
  const [petitions, setPetitions] = useState<string[]>([]);
  const [filter, setFilter] = useState<PasopCategory | "all">("all");
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState<SafetyCoord | null>(null);
  const [petitioningId, setPetitioningId] = useState<string | null>(null);

  const cardSurface = isDark ? theme.surface : "#FFFFFF";

  const loadAll = useCallback(async () => {
    const [r, p] = await Promise.all([getPasopReports(), getMyPetitions()]);
    setReports(r);
    setPetitions(p);
  }, []);

  const captureLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setUserLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    } catch {
      // location is optional — we still show all active reports without it
    }
  }, []);

  useEffect(() => {
    captureLocation();
  }, [captureLocation]);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadAll(), captureLocation()]);
    setRefreshing(false);
  }, [loadAll, captureLocation]);

  const activeReports = useMemo(
    () =>
      reports
        .filter(isReportActive)
        .sort((a, b) => b.createdAt - a.createdAt),
    [reports]
  );

  const filteredReports = useMemo(() => {
    if (filter === "all") return activeReports;
    return activeReports.filter((r) => r.category === filter);
  }, [activeReports, filter]);

  /**
   * Build a tiny "polyline" from the user's current location for the STPB.
   * In a real trip, this would be the snapped Mapbox Directions polyline;
   * for the standalone "your safety zone" widget we sample a 5km box around
   * the user so the bar shows real Pasop density.
   */
  const safetyZonePolyline = useMemo<SafetyCoord[]>(() => {
    if (!userLocation) return [];
    // ~0.045 deg ≈ 5km — sample 9 points across the box for STPB segments
    const step = 0.011;
    const offsets = [-2, -1, 0, 1, 2];
    return offsets.map((o) => ({
      latitude: userLocation.latitude + o * step,
      longitude: userLocation.longitude + o * step,
    }));
  }, [userLocation]);

  const nearbyForSTPB = useMemo(() => {
    if (!userLocation) return activeReports;
    return getReportsNearby(activeReports, userLocation, SAFETY_RADIUS_KM);
  }, [activeReports, userLocation]);

  const handlePetition = useCallback(
    async (report: PasopReport) => {
      if (petitions.includes(report.id)) return;
      setPetitioningId(report.id);
      try {
        const reporterId = user?.id || (await getDeviceId());
        const updated = await petitionPasopReport(report.id, reporterId);
        if (updated) {
          setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
          await recordMyPetition(report.id);
          setPetitions((prev) => [...prev, report.id]);
          if (Platform.OS !== "web") {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        }
      } finally {
        setPetitioningId(null);
      }
    },
    [petitions, user]
  );

  const handleSelectFilter = useCallback((value: PasopCategory | "all") => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync();
    }
    setFilter(value);
  }, []);

  const handleNewReport = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    navigation.navigate("PasopReport");
  }, [navigation]);

  const renderReport = (report: PasopReport, index: number) => {
    const cat = PASOP_CATEGORIES[report.category];
    const ageLabel = getReportAgeLabel(report);
    const distance = userLocation
      ? haversineKm(
          { latitude: report.latitude, longitude: report.longitude },
          userLocation
        )
      : null;
    const petitioned = petitions.includes(report.id);
    const isPetitioning = petitioningId === report.id;

    return (
      <Animated.View
        key={report.id}
        entering={reducedMotion ? undefined : FadeInDown.delay(index * 40).duration(400)}
        style={[styles.reportCard, { backgroundColor: cardSurface }]}
      >
        <View style={styles.reportHeader}>
          <View style={[styles.categoryIconWrap, { backgroundColor: `${cat.color}15` }]}>
            <Feather name={cat.icon} size={18} color={cat.color} />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText style={[styles.reportCategory, { color: cat.color }]}>
              {cat.label}
            </ThemedText>
            <View style={styles.reportMetaRow}>
              <Feather name="clock" size={12} color={BrandColors.gray[600]} />
              <ThemedText style={styles.reportMeta}>{ageLabel}</ThemedText>
              {distance !== null ? (
                <>
                  <ThemedText style={styles.reportMetaSep}>·</ThemedText>
                  <Feather name="map-pin" size={12} color={BrandColors.gray[600]} />
                  <ThemedText style={styles.reportMeta}>
                    {distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`}
                  </ThemedText>
                </>
              ) : null}
            </View>
          </View>
        </View>

        {report.description ? (
          <ThemedText style={styles.reportDescription}>{report.description}</ThemedText>
        ) : null}

        <View style={styles.reportFooter}>
          <View style={styles.petitionCount}>
            <Feather name="users" size={12} color={BrandColors.gray[600]} />
            <ThemedText style={styles.petitionCountText}>
              {report.petitionCount} confirm{report.petitionCount === 1 ? "" : "s"}
            </ThemedText>
          </View>
          <Pressable
            onPress={() => handlePetition(report)}
            disabled={petitioned || isPetitioning}
            accessibilityRole="button"
            accessibilityLabel={
              petitioned
                ? `Confirmed ${cat.label} hazard still there`
                : `Confirm ${cat.label} hazard still there`
            }
            accessibilityState={{ disabled: petitioned || isPetitioning, selected: petitioned }}
            style={[
              styles.petitionButton,
              petitioned && {
                backgroundColor: BrandColors.status.success + "15",
                borderColor: BrandColors.status.success,
              },
            ]}
          >
            <Feather
              name={petitioned ? "check-circle" : "thumbs-up"}
              size={12}
              color={petitioned ? BrandColors.status.success : BrandColors.primary.gradientStart}
            />
            <ThemedText
              style={[
                styles.petitionButtonText,
                petitioned && { color: BrandColors.status.success },
              ]}
            >
              {petitioned ? "Confirmed" : "Still there?"}
            </ThemedText>
          </Pressable>
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={BrandColors.primary.gradientStart}
            colors={[BrandColors.primary.gradientStart]}
          />
        }
      >
        <LinearGradient
          colors={BrandColors.gradient.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + Spacing.md }]}
        >
          <View style={styles.heroTopRow}>
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
              <Feather name="alert-triangle" size={16} color="#FFFFFF" />
              <ThemedText style={styles.heroBadgeText}>Pasop</ThemedText>
            </View>
            <View style={styles.heroSpacer} />
          </View>
          <ThemedText style={styles.heroTitle}>Watch out, Mzansi.</ThemedText>
          <ThemedText style={styles.heroSubtitle}>
            {activeReports.length} active hazard{activeReports.length === 1 ? "" : "s"}
            {userLocation ? ` near you` : " in the network"}
          </ThemedText>
        </LinearGradient>

        <View style={styles.content}>
          <Animated.View entering={reducedMotion ? undefined : FadeInDown.duration(400)}>
            <SafeTripProgressBar
              polyline={safetyZonePolyline}
              reports={nearbyForSTPB}
              segmentCount={5}
              radiusKm={1.5}
              variant="expanded"
              cardSurface={cardSurface}
              title="Your safety zone"
              subtitle={
                userLocation
                  ? `Live safety across ${SAFETY_RADIUS_KM}km around you`
                  : "Enable location to see nearby safety"
              }
              emptyText="Enable GPS so we can score the area around you."
            />
          </Animated.View>

          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.delay(80).duration(400)}
            style={styles.section}
          >
            <ThemedText style={styles.sectionLabel}>Filter by hazard</ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              <FilterChip
                active={filter === "all"}
                color={BrandColors.primary.gradientStart}
                icon="layers"
                label="All"
                count={activeReports.length}
                cardSurface={cardSurface}
                onPress={() => handleSelectFilter("all")}
              />
              {PASOP_CATEGORY_LIST.map((cat) => {
                const count = activeReports.filter((r) => r.category === cat.id).length;
                return (
                  <FilterChip
                    key={cat.id}
                    active={filter === cat.id}
                    color={cat.color}
                    icon={cat.icon}
                    label={cat.shortLabel}
                    count={count}
                    cardSurface={cardSurface}
                    onPress={() => handleSelectFilter(cat.id)}
                  />
                );
              })}
            </ScrollView>
          </Animated.View>

          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <ThemedText style={styles.sectionLabel}>
                Recent reports ({filteredReports.length})
              </ThemedText>
            </View>

            {filteredReports.length > 0 ? (
              filteredReports.map((report, i) => renderReport(report, i))
            ) : (
              <Animated.View
                entering={reducedMotion ? undefined : FadeInDown.duration(400)}
                style={[styles.emptyCard, { backgroundColor: cardSurface }]}
              >
                <View style={styles.emptyIconWrap}>
                  <Feather
                    name="check-circle"
                    size={28}
                    color={BrandColors.status.success}
                  />
                </View>
                <ThemedText style={styles.emptyTitle}>
                  {filter === "all" ? "All clear" : "Nothing reported"}
                </ThemedText>
                <ThemedText style={styles.emptySubtitle}>
                  {filter === "all"
                    ? "No active hazards in the network. Stay safe out there."
                    : "Be the first to report this kind of hazard."}
                </ThemedText>
              </Animated.View>
            )}
          </View>
        </View>
      </ScrollView>

      <Pressable
        style={[styles.fab, { bottom: insets.bottom + Spacing.lg }]}
        onPress={handleNewReport}
        accessibilityRole="button"
        accessibilityLabel="Report a hazard"
      >
        <LinearGradient
          colors={BrandColors.gradient.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabInner}
        >
          <Feather name="plus" size={22} color="#FFFFFF" />
          <ThemedText style={styles.fabText}>Report</ThemedText>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

interface FilterChipProps {
  active: boolean;
  color: string;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  count: number;
  cardSurface: string;
  onPress: () => void;
}

function FilterChip({ active, color, icon, label, count, cardSurface, onPress }: FilterChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Filter: ${label}`}
      accessibilityState={{ selected: active }}
      style={[
        styles.filterChip,
        {
          backgroundColor: active ? color : cardSurface,
          borderColor: active ? color : BrandColors.gray[200],
        },
      ]}
    >
      <Feather name={icon} size={12} color={active ? "#FFFFFF" : color} />
      <ThemedText
        style={[
          styles.filterChipText,
          { color: active ? "#FFFFFF" : BrandColors.gray[700] },
        ]}
      >
        {label}
      </ThemedText>
      {count > 0 ? (
        <View
          style={[
            styles.filterCountBubble,
            { backgroundColor: active ? "rgba(255,255,255,0.25)" : `${color}1F` },
          ]}
        >
          <ThemedText
            style={[
              styles.filterCountText,
              { color: active ? "#FFFFFF" : color },
            ]}
          >
            {count}
          </ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  hero: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing["3xl"],
    borderBottomLeftRadius: BorderRadius["2xl"],
    borderBottomRightRadius: BorderRadius["2xl"],
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  glassButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.22)",
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
    backgroundColor: "rgba(255, 255, 255, 0.22)",
  },
  heroBadgeText: {
    ...Typography.label,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  heroSpacer: {
    width: 40,
  },
  heroTitle: {
    ...Typography.h1,
    color: "#FFFFFF",
  },
  heroSubtitle: {
    ...Typography.body,
    color: "rgba(255, 255, 255, 0.9)",
    marginTop: Spacing.xs,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    marginTop: -Spacing["2xl"],
  },
  section: {
    marginTop: Spacing.xl,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  sectionLabel: {
    ...Typography.label,
    color: BrandColors.gray[700],
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: Spacing.md,
    fontWeight: "700",
  },
  filterRow: {
    gap: Spacing.sm,
    paddingRight: Spacing.lg,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  filterChipText: {
    ...Typography.label,
    fontWeight: "700",
  },
  filterCountBubble: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: BorderRadius.full,
    minWidth: 18,
    alignItems: "center",
  },
  filterCountText: {
    ...Typography.label,
    fontSize: 10,
    fontWeight: "800",
  },
  reportCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  reportHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  categoryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  reportCategory: {
    ...Typography.body,
    fontWeight: "800",
  },
  reportMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  reportMeta: {
    ...Typography.label,
    color: BrandColors.gray[600],
  },
  reportMetaSep: {
    ...Typography.label,
    color: BrandColors.gray[400],
    marginHorizontal: 2,
  },
  reportDescription: {
    ...Typography.small,
    color: BrandColors.gray[700],
    lineHeight: 18,
  },
  reportFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BrandColors.gray[200],
  },
  petitionCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  petitionCountText: {
    ...Typography.label,
    color: BrandColors.gray[600],
    fontWeight: "700",
  },
  petitionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: BrandColors.primary.gradientStart + "12",
    borderWidth: 1,
    borderColor: BrandColors.primary.gradientStart + "33",
  },
  petitionButtonText: {
    ...Typography.label,
    fontWeight: "800",
    color: BrandColors.primary.gradientStart,
  },
  emptyCard: {
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: BrandColors.status.success + "12",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    ...Typography.h4,
    fontWeight: "800",
  },
  emptySubtitle: {
    ...Typography.small,
    color: BrandColors.gray[600],
    marginTop: 4,
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    right: Spacing.lg,
    borderRadius: BorderRadius.full,
    overflow: "hidden",
    shadowColor: BrandColors.primary.gradientStart,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
  fabInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    borderRadius: BorderRadius.full,
  },
  fabText: {
    ...Typography.body,
    color: "#FFFFFF",
    fontWeight: "800",
  },
});
