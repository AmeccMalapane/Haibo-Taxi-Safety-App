import React, { useCallback, useMemo } from "react";
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
} from "react-native-reanimated";

import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { ThemedText } from "@/components/ThemedText";
import { ROLE_META } from "@/constants/roles";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";

// Bottom-sheet persona picker. Reusable from any dashboard header —
// Settings has its own inline picker (deliberate preferences screen
// UX) and isn't rendered via this sheet.
//
// Only surfaces roles the current user is eligible for (user.availableRoles)
// and skips admin, which never belongs on mobile tab layouts.

interface RoleSwitcherSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Fired after the active role has been updated (post-persist). */
  onSwitched?: (role: string) => void;
}

export function RoleSwitcherSheet({
  visible,
  onClose,
  onSwitched,
}: RoleSwitcherSheetProps) {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { user, activeRole, setActiveRole } = useAuth();

  const available = user?.availableRoles ?? (user?.role ? [user.role] : []);
  const current = activeRole || user?.role || "commuter";

  // Strip admin + any role we don't have metadata for so the sheet
  // never renders a "raw string" chip. Preserves insertion order so
  // the UI stays stable.
  const renderable = useMemo(
    () => available.filter((r) => r !== "admin" && ROLE_META[r]),
    [available],
  );

  const triggerHaptic = async (
    type: "selection" | "success" = "selection",
  ) => {
    if (Platform.OS === "web") return;
    try {
      const Haptics = await import("expo-haptics");
      if (type === "success") {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
      } else {
        await Haptics.selectionAsync();
      }
    } catch {}
  };

  const handleSelect = useCallback(
    async (role: string) => {
      if (role === current) {
        onClose();
        return;
      }
      await triggerHaptic("success");
      await setActiveRole(role);
      onSwitched?.(role);
      onClose();
    },
    [current, onClose, onSwitched, setActiveRole],
  );

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View
        entering={reducedMotion ? undefined : FadeIn.duration(180)}
        exiting={reducedMotion ? undefined : FadeOut.duration(140)}
        style={styles.backdrop}
      >
        <Pressable
          style={styles.backdropTouch}
          onPress={onClose}
          accessibilityLabel="Close role switcher"
        />

        <Animated.View
          entering={reducedMotion ? undefined : FadeInDown.duration(260)}
          style={[
            styles.sheet,
            {
              backgroundColor: theme.backgroundRoot,
              paddingBottom: insets.bottom + Spacing.lg,
            },
          ]}
        >
          <View style={styles.handle} />

          <ThemedText style={styles.title}>Switch role</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Choose the Haibo lens you want to use.
          </ThemedText>

          <View style={{ height: Spacing.md }} />

          {renderable.map((role) => {
            const meta = ROLE_META[role];
            const isActive = current === role;
            return (
              <Pressable
                key={role}
                onPress={() => handleSelect(role)}
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: isActive
                      ? meta.accent + "12"
                      : theme.surface,
                    borderColor: isActive ? meta.accent : theme.border,
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Switch to ${meta.label}`}
                accessibilityState={{ selected: isActive }}
              >
                <View
                  style={[
                    styles.rowIcon,
                    { backgroundColor: meta.accent + "18" },
                  ]}
                >
                  <Feather name={meta.icon} size={18} color={meta.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText
                    style={[
                      styles.rowLabel,
                      isActive && { color: meta.accent },
                    ]}
                  >
                    {meta.label}
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.rowHint,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {meta.hint}
                  </ThemedText>
                </View>
                {isActive ? (
                  <Feather name="check-circle" size={20} color={meta.accent} />
                ) : (
                  <Feather
                    name="chevron-right"
                    size={18}
                    color={theme.textSecondary}
                  />
                )}
              </Pressable>
            );
          })}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  backdropTouch: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius: BorderRadius["2xl"],
    borderTopRightRadius: BorderRadius["2xl"],
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: 2,
    // Neutral drag handle colour — matches the iOS sheet handle at 40%
    // opacity on both light and dark backgrounds.
    backgroundColor: "#C7CDD3",
    marginBottom: Spacing.md,
    opacity: 0.6,
  },
  title: {
    ...Typography.h3,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  subtitle: {
    ...Typography.small,
    marginTop: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: {
    ...Typography.body,
    fontWeight: "700",
  },
  rowHint: {
    ...Typography.small,
    fontSize: 12,
    marginTop: 2,
  },
});
