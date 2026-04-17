import React, { useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";

import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { RoleSwitcherSheet } from "@/components/RoleSwitcherSheet";
import { getRoleMeta } from "@/constants/roles";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";

// Compact current-role chip with a switch affordance. Only renders for
// users eligible for more than one role — solo commuters/drivers don't
// see anything, so the chip stays out of their way.
//
// Tap opens the RoleSwitcherSheet. After a successful switch, the
// dashboard container (MainTabNavigator) remounts itself via its key,
// so the chip doesn't need to trigger navigation — just close the sheet.

interface RoleChipProps {
  /** Optional override for the chip's accent color. Defaults to the
   *  active role's accent from ROLE_META. Useful when the chip sits
   *  on a coloured dashboard header and needs to match. */
  accent?: string;
  /** Show only the icon (no label). Useful in tight headers. */
  compact?: boolean;
}

export function RoleChip({ accent, compact = false }: RoleChipProps) {
  const { theme } = useTheme();
  const { user, activeRole } = useAuth();
  const [sheetOpen, setSheetOpen] = useState(false);

  const current = activeRole || user?.role || "commuter";
  const meta = getRoleMeta(current);
  const available = user?.availableRoles ?? (user?.role ? [user.role] : []);

  // Render nothing for single-role users — the chip would just tease
  // them with a choice they can't make. Also skip when there's no user
  // context (guest mode).
  if (!user || available.length < 2) return null;

  const tint = accent || meta.accent;

  return (
    <View>
      <Pressable
        onPress={() => setSheetOpen(true)}
        style={({ pressed }) => [
          styles.chip,
          {
            backgroundColor: theme.surface,
            borderColor: tint + "66",
            opacity: pressed ? 0.85 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Switch role — currently ${meta.label}`}
        hitSlop={6}
      >
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: tint + "22" },
          ]}
        >
          <Feather name={meta.icon} size={12} color={tint} />
        </View>
        {compact ? null : (
          <ThemedText style={[styles.label, { color: theme.text }]}>
            {meta.shortLabel}
          </ThemedText>
        )}
        <Feather name="chevron-down" size={12} color={tint} />
      </Pressable>

      <RoleSwitcherSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  iconWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    ...Typography.label,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
});
