/**
 * RankDetailPanel — Floating bottom panel showing taxi rank details.
 * Shows capacity indicator, wait time, route count, and fare info.
 * Appears when a transit rank marker is tapped on the Mapbox map.
 */
import React from "react";
import { View, StyleSheet, Pressable, Animated } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";
import type { MapboxTaxiRank, RankStatus } from "@/data/mapbox_transit_data";
import { STATUS_CONFIG, ROUTES } from "@/data/mapbox_transit_data";

interface RankDetailPanelProps {
  rank: MapboxTaxiRank;
  onClose: () => void;
  onViewRoutes?: () => void;
  onNavigate?: () => void;
}

const getCapacityColor = (capacity: number): string => {
  if (capacity >= 75) return BrandColors.status.emergency;
  if (capacity >= 50) return BrandColors.status.warning;
  return BrandColors.status.success;
};

const getCapacityLabel = (capacity: number): string => {
  if (capacity >= 75) return "Very Busy";
  if (capacity >= 50) return "Moderate";
  return "Quiet";
};

export function RankDetailPanel({ rank, onClose, onViewRoutes, onNavigate }: RankDetailPanelProps) {
  const { theme, isDark } = useTheme();
  const statusConfig = STATUS_CONFIG[rank.status];

  // Find routes connected to this rank
  const connectedRoutes = ROUTES.filter(
    (r) => r.from === rank.id || r.to === rank.id
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      {/* Handle */}
      <View style={styles.handleBar}>
        <View style={[styles.handle, { backgroundColor: BrandColors.gray[400] }]} />
      </View>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
          <View style={styles.headerText}>
            <ThemedText type="h4" style={styles.rankName}>
              {rank.name}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {rank.description}
            </ThemedText>
          </View>
        </View>
        <Pressable onPress={onClose} style={styles.closeButton}>
          <Feather name="x" size={20} color={theme.textSecondary} />
        </Pressable>
      </View>

      {/* Status Badge */}
      <View style={[styles.statusBadge, { backgroundColor: `${statusConfig.color}15` }]}>
        <View style={[styles.statusIndicator, { backgroundColor: statusConfig.color }]} />
        <ThemedText style={[styles.statusText, { color: statusConfig.color }]}>
          {statusConfig.label}
        </ThemedText>
        <ThemedText style={[styles.statusSub, { color: theme.textSecondary }]}>
          • {rank.waitTime} wait
        </ThemedText>
      </View>

      {/* Metrics Grid */}
      <View style={styles.metricsGrid}>
        {/* Capacity */}
        <View style={[styles.metricCard, { backgroundColor: isDark ? theme.backgroundSecondary : "#F8F9FA" }]}>
          <View style={styles.metricHeader}>
            <Feather name="users" size={16} color={getCapacityColor(rank.capacity)} />
            <ThemedText type="label" style={{ color: theme.textSecondary }}>
              CAPACITY
            </ThemedText>
          </View>
          <View style={styles.capacityBarContainer}>
            <View style={[styles.capacityBarBg, { backgroundColor: isDark ? theme.backgroundTertiary : "#E0E0E0" }]}>
              <View
                style={[
                  styles.capacityBarFill,
                  {
                    width: `${rank.capacity}%`,
                    backgroundColor: getCapacityColor(rank.capacity),
                  },
                ]}
              />
            </View>
            <ThemedText style={[styles.capacityValue, { color: getCapacityColor(rank.capacity) }]}>
              {rank.capacity}%
            </ThemedText>
          </View>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {getCapacityLabel(rank.capacity)}
          </ThemedText>
        </View>

        {/* Wait Time */}
        <View style={[styles.metricCard, { backgroundColor: isDark ? theme.backgroundSecondary : "#F8F9FA" }]}>
          <View style={styles.metricHeader}>
            <Feather name="clock" size={16} color={BrandColors.primary.blue} />
            <ThemedText type="label" style={{ color: theme.textSecondary }}>
              WAIT TIME
            </ThemedText>
          </View>
          <ThemedText type="h3" style={{ color: BrandColors.primary.blue }}>
            {rank.waitTime}
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            Average
          </ThemedText>
        </View>

        {/* Routes */}
        <View style={[styles.metricCard, { backgroundColor: isDark ? theme.backgroundSecondary : "#F8F9FA" }]}>
          <View style={styles.metricHeader}>
            <Feather name="git-branch" size={16} color={BrandColors.secondary.purple} />
            <ThemedText type="label" style={{ color: theme.textSecondary }}>
              ROUTES
            </ThemedText>
          </View>
          <ThemedText type="h3" style={{ color: BrandColors.secondary.purple }}>
            {rank.routes}
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            Active routes
          </ThemedText>
        </View>
      </View>

      {/* Connected Routes */}
      {connectedRoutes.length > 0 && (
        <View style={styles.routesSection}>
          <ThemedText type="label" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
            CONNECTED ROUTES
          </ThemedText>
          {connectedRoutes.map((route) => (
            <View
              key={route.id}
              style={[styles.routeChip, { backgroundColor: `${route.color}15` }]}
            >
              <View style={[styles.routeColorDot, { backgroundColor: route.color }]} />
              <ThemedText style={[styles.routeChipText, { color: route.color }]} numberOfLines={1}>
                {route.from === rank.id ? `→ ${route.toName}` : `← ${route.fromName}`}
              </ThemedText>
              <ThemedText style={[styles.routeFare, { color: route.color }]}>
                {route.fare}
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {route.duration}
              </ThemedText>
            </View>
          ))}
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actions}>
        <Pressable
          style={[styles.actionButton, { backgroundColor: BrandColors.primary.red }]}
          onPress={onNavigate}
        >
          <Feather name="navigation" size={18} color="#FFFFFF" />
          <ThemedText style={styles.actionButtonText}>Navigate</ThemedText>
        </Pressable>
        <Pressable
          style={[styles.actionButton, styles.actionButtonOutline, { borderColor: theme.border }]}
          onPress={onViewRoutes}
        >
          <Feather name="map" size={18} color={theme.text} />
          <ThemedText style={[styles.actionButtonText, { color: theme.text }]}>
            View Routes
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing["3xl"],
    elevation: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  handleBar: {
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    flex: 1,
    gap: Spacing.md,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 6,
  },
  headerText: {
    flex: 1,
  },
  rankName: {
    marginBottom: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "700",
  },
  statusSub: {
    fontSize: 13,
  },
  metricsGrid: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  metricCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  metricHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  capacityBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  capacityBarBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  capacityBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  capacityValue: {
    fontSize: 14,
    fontWeight: "800",
  },
  routesSection: {
    marginBottom: Spacing.lg,
  },
  routeChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xs,
    marginBottom: 6,
    gap: Spacing.sm,
  },
  routeColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  routeChipText: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  routeFare: {
    fontSize: 14,
    fontWeight: "800",
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
  },
  actionButtonOutline: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
