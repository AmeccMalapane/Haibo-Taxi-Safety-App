import React, { useState, useMemo } from "react";
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  ScrollView,
  Linking,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import { useQuery } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useTaxiHero } from "@/hooks/useTaxiHero";
import {
  Spacing,
  BrandColors,
  BorderRadius,
  Typography,
} from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { getTaxiRoutes } from "@/lib/localData";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import type { TaxiRoute } from "@/lib/types";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// typeui-clean Taxi Fare lookup — reads the existing taxi_routes_fares.json
// data via getTaxiRoutes() (~190 SA routes with origin, destination, fare,
// estimated time, distance) and surfaces it as a fare-finder dashboard:
//
//   1. Rose gradient hero with a calculator badge
//   2. Two-step search: filter by origin, then by destination — the result
//      list updates live based on whichever side has text
//   3. Quick-glance stats strip: total routes, average fare, longest trip
//   4. Result rows show route name, fare, time, and distance with a rose
//      gradient open-in-Maps button when coords are available
//
// This is the first screen built directly from the bundled fare dataset —
// previously the data was loaded by other screens but never surfaced as a
// commuter-facing fare lookup.

export default function TaxiFareScreen() {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const navigation = useNavigation<NavigationProp>();
  const heroImage = useTaxiHero();

  const handleContribute = (route?: TaxiRoute) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    // CityExplorer hosts the fare-survey flow that POSTs to
    // /api/explorer/fare-survey. Navigating there from a missing-fare
    // row gives users a direct path to close the gap instead of
    // leaving them staring at "Price TBD".
    navigation.navigate("CityExplorer");
  };

  const [originQuery, setOriginQuery] = useState("");
  const [destinationQuery, setDestinationQuery] = useState("");
  const [originFocused, setOriginFocused] = useState(false);
  const [destinationFocused, setDestinationFocused] = useState(false);

  // Prefer canonical fares from the DB (admin-editable via command-center)
  // and fall back to the bundled JSON when offline, when the API returns
  // an empty set, or when the request fails. The bundled JSON ships as
  // TaxiRoute[] with the same public shape /api/fares returns, so the
  // downstream filter/stats code doesn't care which source wins.
  const localRoutes = useMemo(() => getTaxiRoutes(), []);
  const faresQ = useQuery({
    queryKey: ["/api/fares", "lookup"],
    queryFn: async () => {
      if (!getApiUrl()) return localRoutes;
      try {
        const res = await apiRequest("/api/fares?limit=500");
        if (res?.data?.length > 0) return res.data as TaxiRoute[];
        return localRoutes;
      } catch {
        return localRoutes;
      }
    },
    staleTime: 5 * 60 * 1000,
    initialData: localRoutes,
  });
  const allRoutes: TaxiRoute[] = faresQ.data || localRoutes;

  const filteredRoutes = useMemo(() => {
    if (!originQuery && !destinationQuery) return allRoutes.slice(0, 50);

    const o = originQuery.trim().toLowerCase();
    const d = destinationQuery.trim().toLowerCase();

    return allRoutes.filter((route) => {
      const matchOrigin = !o || route.origin.toLowerCase().includes(o);
      const matchDest = !d || route.destination.toLowerCase().includes(d);
      return matchOrigin && matchDest;
    });
  }, [allRoutes, originQuery, destinationQuery]);

  const stats = useMemo(() => {
    const withFare = allRoutes.filter((r) => r.fare && r.fare > 0);
    const totalFare = withFare.reduce((sum, r) => sum + (r.fare || 0), 0);
    const avgFare = withFare.length > 0 ? totalFare / withFare.length : 0;
    const longestRoute = allRoutes.reduce(
      (max, r) => ((r.distance || 0) > (max.distance || 0) ? r : max),
      allRoutes[0]
    );
    return {
      total: allRoutes.length,
      avgFare,
      longestKm: longestRoute?.distance || 0,
    };
  }, [allRoutes]);

  const triggerHaptic = () => {
    if (Platform.OS === "web") return;
    try {
      Haptics.selectionAsync();
    } catch {}
  };

  const handleSwap = () => {
    triggerHaptic();
    const tmp = originQuery;
    setOriginQuery(destinationQuery);
    setDestinationQuery(tmp);
  };

  const handleClear = () => {
    triggerHaptic();
    setOriginQuery("");
    setDestinationQuery("");
  };

  const handleOpenMaps = (route: TaxiRoute) => {
    if (route.googleMapsLink) {
      triggerHaptic();
      Linking.openURL(route.googleMapsLink).catch(() => {});
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing["3xl"] + 80 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Rose gradient hero */}
        <LinearGradient
          colors={BrandColors.gradient.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + Spacing.xl }]}
        >
          {/* Rank-on-rose hero banner. Rotates through the bundled SA
              minibus taxi photos (see assets/images/heroes) so the fares
              screen reads as "this is what you'll be in" instead of a
              generic calculator-icon screen. Dark gradient overlay keeps
              the title legible over any photo's mid-tone range. */}
          <Animated.View
            entering={reducedMotion ? undefined : FadeIn.duration(400)}
            style={styles.heroImageWrap}
          >
            <Image
              source={heroImage}
              style={styles.heroImage}
              contentFit="cover"
            />
            <LinearGradient
              colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.45)"]}
              style={styles.heroImageOverlay}
            />
          </Animated.View>

          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(100)}
            style={styles.heroText}
          >
            <ThemedText style={styles.heroTitle}>Taxi fares</ThemedText>
            <ThemedText style={styles.heroSubtitle}>
              Crowdsourced fares for every route across Mzansi.
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
          {/* Search inputs — origin + destination with swap button */}
          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(250)}
            style={styles.searchBlock}
          >
            <View style={styles.inputRow}>
              <Feather name="circle" size={14} color={BrandColors.primary.gradientStart} />
              <TextInput
                style={[
                  styles.routeInput,
                  {
                    backgroundColor: theme.backgroundDefault,
                    color: theme.text,
                    borderColor: originFocused
                      ? BrandColors.primary.gradientStart
                      : theme.border,
                  },
                ]}
                placeholder="From (e.g. Bara, Noord)"
                placeholderTextColor={theme.textSecondary}
                value={originQuery}
                onChangeText={setOriginQuery}
                onFocus={() => setOriginFocused(true)}
                onBlur={() => setOriginFocused(false)}
                returnKeyType="next"
              />
            </View>

            <View style={styles.swapWrap}>
              <Pressable
                onPress={handleSwap}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.swapButton,
                  {
                    backgroundColor: BrandColors.primary.gradientStart + "12",
                    borderColor: BrandColors.primary.gradientStart + "33",
                  },
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Swap origin and destination"
              >
                <Feather
                  name="repeat"
                  size={14}
                  color={BrandColors.primary.gradientStart}
                />
              </Pressable>
            </View>

            <View style={styles.inputRow}>
              <Feather
                name="map-pin"
                size={14}
                color={BrandColors.primary.gradientStart}
              />
              <TextInput
                style={[
                  styles.routeInput,
                  {
                    backgroundColor: theme.backgroundDefault,
                    color: theme.text,
                    borderColor: destinationFocused
                      ? BrandColors.primary.gradientStart
                      : theme.border,
                  },
                ]}
                placeholder="To (e.g. Sandton, Mamelodi)"
                placeholderTextColor={theme.textSecondary}
                value={destinationQuery}
                onChangeText={setDestinationQuery}
                onFocus={() => setDestinationFocused(true)}
                onBlur={() => setDestinationFocused(false)}
                returnKeyType="search"
              />
            </View>

            {(originQuery || destinationQuery) ? (
              <Pressable
                onPress={handleClear}
                hitSlop={8}
                style={styles.clearLink}
                accessibilityRole="button"
              >
                <Feather name="x" size={12} color={theme.textSecondary} />
                <ThemedText
                  style={[styles.clearLinkText, { color: theme.textSecondary }]}
                >
                  Clear
                </ThemedText>
              </Pressable>
            ) : null}
          </Animated.View>

          {/* Stats strip */}
          <Animated.View
            entering={reducedMotion ? undefined : FadeInUp.duration(500).delay(300)}
            style={[
              styles.statsCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <StatCell
              value={String(stats.total)}
              label="Routes"
              theme={theme}
            />
            <View
              style={[styles.statDivider, { backgroundColor: theme.border }]}
            />
            <StatCell
              value={`R${stats.avgFare.toFixed(0)}`}
              label="Avg fare"
              theme={theme}
            />
            <View
              style={[styles.statDivider, { backgroundColor: theme.border }]}
            />
            <StatCell
              value={`${stats.longestKm.toFixed(0)} km`}
              label="Longest"
              theme={theme}
            />
          </Animated.View>

          {/* Results */}
          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(350)}
            style={styles.resultsHeader}
          >
            <ThemedText
              style={[styles.sectionLabel, { color: theme.textSecondary }]}
            >
              {originQuery || destinationQuery ? "MATCHES" : "POPULAR ROUTES"}
            </ThemedText>
            <ThemedText
              style={[styles.resultsCount, { color: theme.textSecondary }]}
            >
              {filteredRoutes.length} route
              {filteredRoutes.length === 1 ? "" : "s"}
            </ThemedText>
          </Animated.View>

          {filteredRoutes.length === 0 ? (
            <Animated.View
              entering={reducedMotion ? undefined : FadeIn.duration(400)}
              style={styles.emptyState}
            >
              <View
                style={[
                  styles.emptyIcon,
                  { backgroundColor: BrandColors.primary.gradientStart + "12" },
                ]}
              >
                <Feather
                  name="search"
                  size={26}
                  color={BrandColors.primary.gradientStart}
                />
              </View>
              <ThemedText style={styles.emptyTitle}>No matching routes</ThemedText>
              <ThemedText
                style={[styles.emptyHint, { color: theme.textSecondary }]}
              >
                Try a different origin or destination, or search for a single side only.
              </ThemedText>
            </Animated.View>
          ) : (
            <View style={styles.resultsList}>
              {filteredRoutes.map((route, index) => (
                <Animated.View
                  key={route.id}
                  entering={reducedMotion ? undefined : FadeInDown.duration(300).delay(
                    Math.min(index * 25, 300)
                  )}
                >
                  <View
                    style={[
                      styles.routeCard,
                      {
                        backgroundColor: theme.surface,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <View style={styles.routeHeader}>
                      <View style={styles.routePath}>
                        <ThemedText style={styles.routeOrigin} numberOfLines={1}>
                          {route.origin}
                        </ThemedText>
                        <View style={styles.routeArrow}>
                          <Feather
                            name="arrow-down"
                            size={12}
                            color={theme.textSecondary}
                          />
                        </View>
                        <ThemedText
                          style={styles.routeDestination}
                          numberOfLines={1}
                        >
                          {route.destination}
                        </ThemedText>
                      </View>
                      {route.fare && route.fare > 0 ? (
                        <View
                          style={[
                            styles.farePill,
                            {
                              backgroundColor:
                                BrandColors.primary.gradientStart + "12",
                            },
                          ]}
                        >
                          <ThemedText
                            style={[
                              styles.fareText,
                              { color: BrandColors.primary.gradientStart },
                            ]}
                          >
                            R{route.fare.toFixed(0)}
                          </ThemedText>
                        </View>
                      ) : (
                        // Missing fare = direct path to contribute one.
                        // Previously rendered a disabled "Price TBD" chip
                        // that dead-ended the user with no way to help
                        // close the gap — bad on a crowdsourced fare app.
                        <Pressable
                          onPress={() => handleContribute(route)}
                          hitSlop={6}
                          accessibilityRole="button"
                          accessibilityLabel={`Contribute fare for ${route.origin} to ${route.destination}`}
                          style={({ pressed }) => [
                            styles.contributePill,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Feather name="plus" size={12} color="#FFFFFF" />
                          <ThemedText style={styles.contributePillText}>
                            Contribute
                          </ThemedText>
                        </Pressable>
                      )}
                    </View>

                    <View
                      style={[
                        styles.routeMeta,
                        { borderTopColor: theme.border },
                      ]}
                    >
                      <View style={styles.metaItem}>
                        <Feather
                          name="clock"
                          size={12}
                          color={theme.textSecondary}
                        />
                        <ThemedText
                          style={[
                            styles.metaText,
                            { color: theme.textSecondary },
                          ]}
                        >
                          {route.estimatedTime}
                        </ThemedText>
                      </View>
                      {route.distance ? (
                        <View style={styles.metaItem}>
                          <Feather
                            name="navigation"
                            size={12}
                            color={theme.textSecondary}
                          />
                          <ThemedText
                            style={[
                              styles.metaText,
                              { color: theme.textSecondary },
                            ]}
                          >
                            {route.distance.toFixed(0)} km
                          </ThemedText>
                        </View>
                      ) : null}
                      {route.googleMapsLink ? (
                        <Pressable
                          onPress={() => handleOpenMaps(route)}
                          hitSlop={6}
                          style={({ pressed }) => [
                            styles.mapsLink,
                            pressed && styles.pressed,
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel="Open in Google Maps"
                        >
                          <Feather
                            name="external-link"
                            size={12}
                            color={BrandColors.primary.gradientStart}
                          />
                          <ThemedText style={styles.mapsLinkText}>
                            Maps
                          </ThemedText>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                </Animated.View>
              ))}
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function StatCell({
  value,
  label,
  theme,
}: {
  value: string;
  label: string;
  theme: any;
}) {
  return (
    <View style={styles.statCell}>
      <ThemedText style={styles.statValue}>{value}</ThemedText>
      <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
        {label}
      </ThemedText>
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
    paddingBottom: Spacing["2xl"],
  },
  heroImageWrap: {
    height: 160,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    marginBottom: Spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 8,
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroImageOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "65%",
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
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing["2xl"],
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },

  // Search block
  searchBlock: {
    marginBottom: Spacing.lg,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  routeInput: {
    flex: 1,
    height: 52,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    borderWidth: 1.5,
  },
  swapWrap: {
    alignItems: "center",
    marginVertical: Spacing.xs,
    paddingLeft: 22,
  },
  swapButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  clearLink: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    gap: 4,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  clearLinkText: {
    ...Typography.label,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
  },

  // Stats
  statsCard: {
    flexDirection: "row",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.xl,
  },
  statCell: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    ...Typography.h4,
    fontVariant: ["tabular-nums"],
  },
  statLabel: {
    ...Typography.label,
    fontSize: 11,
    letterSpacing: 1.2,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    marginVertical: Spacing.xs,
  },

  // Results
  resultsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  sectionLabel: {
    ...Typography.label,
    letterSpacing: 1.4,
    fontSize: 11,
  },
  resultsCount: {
    ...Typography.label,
    fontSize: 11,
  },
  resultsList: {},

  routeCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  routeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  routePath: {
    flex: 1,
  },
  routeOrigin: {
    ...Typography.body,
    fontWeight: "700",
  },
  routeArrow: {
    marginVertical: 2,
  },
  routeDestination: {
    ...Typography.body,
    fontWeight: "700",
  },
  farePill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    minWidth: 60,
    alignItems: "center",
  },
  fareText: {
    ...Typography.body,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  contributePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: BrandColors.primary.gradientStart,
    shadowColor: BrandColors.primary.gradientStart,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  contributePillText: {
    ...Typography.small,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  routeMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    ...Typography.small,
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
  mapsLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: "auto",
  },
  mapsLinkText: {
    ...Typography.label,
    fontSize: 11,
    fontWeight: "700",
    color: BrandColors.primary.gradientStart,
    letterSpacing: 0.6,
  },

  // Empty
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
    paddingHorizontal: Spacing.xl,
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
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
});
