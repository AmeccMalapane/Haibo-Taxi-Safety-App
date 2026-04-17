import React, { useState } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
  Share,
  FlatList,
  Image,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";

import { useTheme } from "@/hooks/useTheme";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  Spacing,
  BrandColors,
  BorderRadius,
  Typography,
} from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { GradientButton } from "@/components/GradientButton";
import { SkeletonBlock } from "@/components/Skeleton";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { getCurrentToken } from "@/contexts/AuthContext";
import { createInviteDriverLink } from "@/lib/deepLinks";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

// OwnerInvitationsScreen — the owner's "invite a driver" hub.
//
// Core workflow:
//   1. Owner taps "Generate new code" → server returns HBO-XXXXXX
//   2. Owner copies / shares it to the driver (WhatsApp, SMS, paper)
//   3. Driver enters the code on ProfileSetup → linked atomically
//   4. Invitation flips to 'used', shown with redeemer info here
//
// Status pills mirror the driver_owner_invitations enum:
//   pending  → teal (live, shareable)
//   used     → green (redeemed, driver linked)
//   revoked  → gray (owner cancelled)
//   expired  → gray (passed expiresAt before redemption)

interface Invitation {
  id: string;
  code: string;
  label: string | null;
  status: "pending" | "used" | "revoked" | "expired";
  expiresAt: string | null;
  usedAt: string | null;
  usedByUserId: string | null;
  revokedAt: string | null;
  createdAt: string | null;
  usedByDisplayName: string | null;
  usedByPhone: string | null;
}

type StatusTint = {
  bg: string;
  fg: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
};

const STATUS_META: Record<Invitation["status"], StatusTint> = {
  pending: {
    bg: BrandColors.accent.teal + "20",
    fg: BrandColors.accent.teal,
    label: "Live",
    icon: "clock",
  },
  used: {
    bg: BrandColors.status.success + "20",
    fg: BrandColors.status.success,
    label: "Redeemed",
    icon: "check-circle",
  },
  revoked: {
    bg: BrandColors.gray[400] + "30",
    fg: BrandColors.gray[600],
    label: "Revoked",
    icon: "x-circle",
  },
  expired: {
    bg: BrandColors.gray[400] + "30",
    fg: BrandColors.gray[600],
    label: "Expired",
    icon: "slash",
  },
};

export default function OwnerInvitationsScreen() {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const qc = useQueryClient();

  const [labelInput, setLabelInput] = useState("");
  const [labelFocused, setLabelFocused] = useState(false);

  const invitationsQ = useQuery<{ data: Invitation[] }>({
    queryKey: ["/api/owner/invitations"],
    queryFn: () => apiRequest("/api/owner/invitations") as Promise<{ data: Invitation[] }>,
  });

  const createMut = useMutation<Invitation, Error, void>({
    mutationFn: () =>
      apiRequest("/api/owner/invitations", {
        method: "POST",
        body: JSON.stringify({
          label: labelInput.trim() || undefined,
          expiresInDays: 30,
        }),
      }) as Promise<Invitation>,
    onSuccess: (row) => {
      setLabelInput("");
      qc.invalidateQueries({ queryKey: ["/api/owner/invitations"] });
      if (Platform.OS !== "web") {
        import("expo-haptics")
          .then((H) =>
            H.notificationAsync(H.NotificationFeedbackType.Success),
          )
          .catch(() => {});
      }
      // Auto-copy the new code so the owner can immediately paste it
      // into WhatsApp. Most owners will do exactly this next anyway.
      Clipboard.setStringAsync(row.code).catch(() => {});
      Alert.alert(
        "Code ready",
        `${row.code} has been copied to your clipboard. Send it to your driver via WhatsApp or SMS.`,
      );
    },
    onError: (err: any) => {
      Alert.alert(
        "Couldn't create code",
        err?.message || "Please try again in a moment.",
      );
    },
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/owner/invitations/${id}/revoke`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/owner/invitations"] });
    },
    onError: (err: any) => {
      Alert.alert("Couldn't revoke", err?.message || "Please try again.");
    },
  });

  const handleCopy = async (code: string) => {
    await Clipboard.setStringAsync(code);
    if (Platform.OS !== "web") {
      import("expo-haptics")
        .then((H) => H.selectionAsync())
        .catch(() => {});
    }
    Alert.alert("Copied", `${code} is on your clipboard.`);
  };

  const handleShare = async (inv: Invitation) => {
    try {
      const link = createInviteDriverLink(inv.code);
      await Share.share({
        // Include both the code (for manual entry) and the smart link
        // (tappable in WhatsApp/SMS — lands the driver on ProfileSetup
        // with the code pre-filled). Drivers can also aim their camera
        // at the QR displayed next to the code in the dashboard.
        message: `Welcome to the fleet. Tap the link or enter this code on Haibo to link your driver profile to me:\n\nCode: ${inv.code}\n${link}\n\n(Expires in 30 days)`,
        title: "Haibo driver invitation",
      });
    } catch {
      // User cancelled — silent, not an error.
    }
  };

  const handleRevoke = (inv: Invitation) => {
    Alert.alert(
      "Revoke invitation?",
      `${inv.code} will no longer be redeemable. This can't be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Revoke",
          style: "destructive",
          onPress: () => revokeMut.mutate(inv.id),
        },
      ],
    );
  };

  const rows = invitationsQ.data?.data || [];
  const pendingCount = rows.filter((r) => r.status === "pending").length;

  const apiBase = getApiUrl();
  const token = getCurrentToken();
  // Append the token as a query param because RN's Image source only
  // accepts headers on some platforms. The endpoint also accepts
  // Authorization: Bearer (via authMiddleware) so in-app fetches can
  // use either — query param works everywhere.
  const qrUrlFor = (invId: string): string | null => {
    if (!apiBase || !token) return null;
    return `${apiBase.replace(/\/$/, "")}/api/owner/invitations/${encodeURIComponent(invId)}/qr.png?token=${encodeURIComponent(token)}`;
  };

  const renderRow = ({ item }: { item: Invitation }) => {
    const meta = STATUS_META[item.status];
    const canRevoke = item.status === "pending";
    const qrSrc = item.status === "pending" ? qrUrlFor(item.id) : null;
    return (
      <View
        style={[
          styles.row,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
          },
        ]}
      >
        <View style={styles.rowHeader}>
          <ThemedText style={styles.code}>{item.code}</ThemedText>
          <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
            <Feather name={meta.icon} size={11} color={meta.fg} />
            <ThemedText style={[styles.statusLabel, { color: meta.fg }]}>
              {meta.label}
            </ThemedText>
          </View>
        </View>

        {item.label ? (
          <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
            {item.label}
          </ThemedText>
        ) : null}

        {qrSrc ? (
          <View style={styles.qrWrap}>
            <Image
              source={{ uri: qrSrc }}
              style={styles.qrImage}
              accessibilityLabel={`Scannable QR code for invitation ${item.code}`}
            />
            <ThemedText style={[styles.qrHint, { color: theme.textSecondary }]}>
              Driver scans with their phone camera to sign up
            </ThemedText>
          </View>
        ) : null}

        {item.status === "used" && item.usedByDisplayName ? (
          <View style={styles.usedByRow}>
            <Feather name="user-check" size={13} color={BrandColors.status.success} />
            <ThemedText style={[styles.usedByText, { color: theme.textSecondary }]}>
              Linked to {item.usedByDisplayName}
              {item.usedAt
                ? ` · ${new Date(item.usedAt).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}`
                : ""}
            </ThemedText>
          </View>
        ) : null}

        {item.status === "pending" ? (
          <View style={styles.actions}>
            <Pressable
              onPress={() => handleCopy(item.code)}
              style={({ pressed }) => [
                styles.actionBtn,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: theme.border,
                },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Copy code ${item.code}`}
            >
              <Feather name="copy" size={14} color={theme.text} />
              <ThemedText style={styles.actionText}>Copy</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => handleShare(item)}
              style={({ pressed }) => [
                styles.actionBtn,
                {
                  backgroundColor: BrandColors.accent.teal + "15",
                  borderColor: BrandColors.accent.teal + "40",
                },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Share code ${item.code}`}
            >
              <Feather name="share-2" size={14} color={BrandColors.accent.teal} />
              <ThemedText
                style={[styles.actionText, { color: BrandColors.accent.teal }]}
              >
                Share
              </ThemedText>
            </Pressable>
            {canRevoke ? (
              <Pressable
                onPress={() => handleRevoke(item)}
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.revokeBtn,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Revoke code ${item.code}`}
              >
                <Feather
                  name="x"
                  size={14}
                  color={BrandColors.status.emergency}
                />
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
      <LinearGradient
        colors={BrandColors.gradient.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + Spacing.md }]}
      >
        <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(300)}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Feather name="arrow-left" size={22} color="#FFFFFF" />
          </Pressable>
        </Animated.View>

        <Animated.View
          entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(100)}
        >
          <ThemedText style={styles.heroTitle}>Driver invitations</ThemedText>
          <ThemedText style={styles.heroSubtitle}>
            Generate a code for each driver you hire. Each code is single-use
            and expires in 30 days.
          </ThemedText>
          <View style={styles.countPill}>
            <ThemedText style={styles.countText}>
              {pendingCount} live · {rows.length} total
            </ThemedText>
          </View>
        </Animated.View>
      </LinearGradient>

      <Animated.View
        entering={reducedMotion ? undefined : FadeInUp.duration(500).delay(200)}
        style={[styles.createCard, { backgroundColor: theme.backgroundRoot }]}
      >
        <ThemedText style={[styles.cardTitle, { color: theme.text }]}>
          Generate a new code
        </ThemedText>
        <ThemedText style={[styles.cardHint, { color: theme.textSecondary }]}>
          An optional label helps you track which code went to whom before
          it's redeemed.
        </ThemedText>
        <TextInput
          style={[
            styles.labelInput,
            {
              backgroundColor: theme.backgroundDefault,
              color: theme.text,
              borderColor: labelFocused
                ? BrandColors.accent.teal
                : theme.border,
            },
          ]}
          placeholder="e.g., Morning shift — Sipho"
          placeholderTextColor={theme.textSecondary}
          value={labelInput}
          onChangeText={setLabelInput}
          onFocus={() => setLabelFocused(true)}
          onBlur={() => setLabelFocused(false)}
          maxLength={60}
        />
        <View style={styles.createCta}>
          <GradientButton
            onPress={() => createMut.mutate()}
            disabled={createMut.isPending}
            size="medium"
            icon="plus"
            iconPosition="right"
          >
            {createMut.isPending ? "Generating..." : "Generate code"}
          </GradientButton>
        </View>
      </Animated.View>

      {invitationsQ.isLoading ? (
        <View style={styles.listPad}>
          {[0, 1, 2].map((i) => (
            <SkeletonBlock
              key={i}
              style={{
                height: 96,
                marginBottom: Spacing.sm,
                borderRadius: BorderRadius.lg,
              }}
            />
          ))}
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather
            name="inbox"
            size={40}
            color={theme.textSecondary}
            style={{ opacity: 0.5 }}
          />
          <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
            No invitations yet
          </ThemedText>
          <ThemedText style={[styles.emptyHint, { color: theme.textSecondary }]}>
            Generate your first code above. Hand it to a driver and they
            can link to your fleet during signup.
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={rows}
          renderItem={renderRow}
          keyExtractor={(r) => r.id}
          contentContainerStyle={[
            styles.listPad,
            { paddingBottom: insets.bottom + Spacing["2xl"] },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={invitationsQ.isFetching && !invitationsQ.isLoading}
              onRefresh={() => invitationsQ.refetch()}
              tintColor={BrandColors.primary.gradientStart}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing["2xl"],
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    marginBottom: Spacing.lg,
  },
  heroTitle: {
    ...Typography.h2,
    color: "#FFFFFF",
    marginBottom: Spacing.xs,
  },
  heroSubtitle: {
    ...Typography.body,
    color: "rgba(255,255,255,0.92)",
    maxWidth: 340,
    marginBottom: Spacing.md,
  },
  countPill: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  countText: {
    ...Typography.label,
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
  },

  createCard: {
    marginHorizontal: Spacing.lg,
    marginTop: -Spacing.xl,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: Spacing.lg,
  },
  cardTitle: {
    ...Typography.h4,
    fontSize: 16,
    marginBottom: 2,
  },
  cardHint: {
    ...Typography.small,
    fontSize: 12,
    marginBottom: Spacing.md,
  },
  labelInput: {
    height: 44,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    fontSize: 14,
    borderWidth: 1.5,
  },
  createCta: {
    marginTop: Spacing.md,
  },

  listPad: {
    paddingHorizontal: Spacing.lg,
  },

  row: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  code: {
    fontFamily: Platform.select({
      ios: "Menlo",
      android: "monospace",
      default: "monospace",
    }),
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.full,
  },
  statusLabel: {
    ...Typography.label,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  label: {
    ...Typography.small,
    fontSize: 12,
    marginBottom: Spacing.xs,
  },
  usedByRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  usedByText: { fontSize: 12 },
  qrWrap: {
    alignItems: "center",
    marginTop: Spacing.md,
  },
  qrImage: {
    width: 160,
    height: 160,
    borderRadius: BorderRadius.md,
    // Subtle matte backdrop so the QR renders crisp regardless of the
    // row's surface colour in light/dark mode.
    backgroundColor: "#FFFFFF",
    padding: Spacing.xs,
  },
  qrHint: {
    ...Typography.small,
    fontSize: 11,
    marginTop: 6,
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  actionText: {
    ...Typography.small,
    fontSize: 12,
    fontWeight: "700",
  },
  revokeBtn: {
    backgroundColor: BrandColors.status.emergency + "10",
    borderColor: BrandColors.status.emergency + "30",
    paddingHorizontal: Spacing.sm,
    marginLeft: "auto",
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing["2xl"],
    gap: Spacing.sm,
  },
  emptyTitle: {
    ...Typography.h4,
    fontSize: 17,
    marginTop: Spacing.md,
  },
  emptyHint: {
    ...Typography.body,
    fontSize: 14,
    textAlign: "center",
    maxWidth: 320,
  },
});
