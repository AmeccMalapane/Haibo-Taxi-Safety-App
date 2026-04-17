import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Alert,
  Image,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import * as ImagePicker from "expo-image-picker";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useAuth } from "@/hooks/useAuth";
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
import { apiRequest } from "@/lib/query-client";
import { uploadFromUri } from "@/lib/uploads";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

// KYCUploadScreen — single screen handling both owner and vendor KYC.
// The role param decides: (a) which accent colour to use, (b) which
// endpoint to POST the doc URLs to, (c) whether the company-reg doc
// slot is labelled as "CK document" (owners) or "business papers"
// (vendors).
//
// Three document slots: ID (required), proof of address (optional),
// company registration / business docs (optional). Each slot is an
// independent upload — partial submits are allowed so a user can add
// the ID today and return with the harder-to-find papers later.

type KYCRole = "owner" | "vendor";

interface KYCUploadParams {
  role: KYCRole;
}

const ACCENT_BY_ROLE: Record<KYCRole, string> = {
  owner: BrandColors.accent.teal,
  vendor: BrandColors.accent.fuchsia,
};

const COMPANY_DOC_LABEL: Record<KYCRole, string> = {
  owner: "Company registration (CK)",
  vendor: "Business papers or permit",
};

const HEADING_BY_ROLE: Record<KYCRole, string> = {
  owner: "Verify your fleet",
  vendor: "Verify your business",
};

const SUBTITLE_BY_ROLE: Record<KYCRole, string> = {
  owner: "We need these so driver settlements can leave your wallet and land in your bank.",
  vendor: "We need these so your withdrawals can leave your wallet and land in your bank.",
};

export default function KYCUploadScreen() {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { refreshUser } = useAuth();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "KYCUpload">>();

  const role = (route.params?.role ?? "owner") as KYCRole;
  const accent = ACCENT_BY_ROLE[role];

  const [idDocumentUrl, setIdDocumentUrl] = useState<string>("");
  const [proofOfAddressUrl, setProofOfAddressUrl] = useState<string>("");
  const [companyRegDocUrl, setCompanyRegDocUrl] = useState<string>("");

  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const triggerHaptic = async (
    type: "selection" | "success" | "error" = "selection",
  ) => {
    if (Platform.OS === "web") return;
    try {
      const Haptics = await import("expo-haptics");
      if (type === "success") {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
      } else if (type === "error") {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Error,
        );
      } else {
        await Haptics.selectionAsync();
      }
    } catch {}
  };

  const pickAndUpload = async (
    key: "id" | "address" | "company",
    setter: (url: string) => void,
  ) => {
    if (uploadingKey) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Permission needed",
          "Haibo needs photo library access to pick a document.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.85,
      });
      if (result.canceled || !result.assets[0]) return;

      triggerHaptic("selection");
      setUploadingKey(key);
      const uploaded = await uploadFromUri(result.assets[0].uri, {
        folder: `kyc-${role}`,
        name: result.assets[0].fileName || undefined,
      });
      setter(uploaded.url);
      triggerHaptic("success");
    } catch (err: any) {
      triggerHaptic("error");
      Alert.alert(
        "Upload failed",
        err?.message || "Please try again on a better connection.",
      );
    } finally {
      setUploadingKey(null);
    }
  };

  const handleSubmit = async () => {
    if (!idDocumentUrl) {
      triggerHaptic("error");
      Alert.alert(
        "ID is required",
        "At minimum, upload a photo of your government ID or passport.",
      );
      return;
    }
    setIsSubmitting(true);
    const endpoint =
      role === "owner"
        ? "/api/owner/profile/kyc"
        : "/api/vendor-profile/me/kyc";
    try {
      await apiRequest(endpoint, {
        method: "POST",
        body: JSON.stringify({
          idDocumentUrl,
          proofOfAddressUrl: proofOfAddressUrl || undefined,
          companyRegDocUrl: companyRegDocUrl || undefined,
        }),
      });
      triggerHaptic("success");
      await refreshUser();
      Alert.alert(
        "Submitted for review",
        "Your documents are with our team. Verification usually takes 1–2 business days — you'll get a notification either way.",
        [{ text: "OK", onPress: () => navigation.goBack() }],
      );
    } catch (err: any) {
      triggerHaptic("error");
      Alert.alert(
        "Couldn't submit",
        err?.message || "Please check your connection and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
      <LinearGradient
        colors={BrandColors.gradient.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + Spacing.lg }]}
      >
        <Animated.View
          entering={reducedMotion ? undefined : FadeIn.duration(300)}
        >
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Feather name="arrow-left" size={22} color="#FFFFFF" />
          </Pressable>
        </Animated.View>

        <Animated.View
          entering={reducedMotion ? undefined : FadeIn.duration(400).delay(100)}
          style={styles.heroBadgeWrap}
        >
          <View style={[styles.heroBadge, { borderColor: accent }]}>
            <Feather name="shield" size={32} color={accent} />
          </View>
        </Animated.View>

        <Animated.View
          entering={
            reducedMotion ? undefined : FadeInDown.duration(500).delay(150)
          }
          style={styles.heroText}
        >
          <ThemedText style={styles.heroTitle}>
            {HEADING_BY_ROLE[role]}
          </ThemedText>
          <ThemedText style={styles.heroSubtitle}>
            {SUBTITLE_BY_ROLE[role]}
          </ThemedText>
        </Animated.View>
      </LinearGradient>

      <Animated.View
        entering={reducedMotion ? undefined : FadeInUp.duration(500).delay(200)}
        style={[
          styles.contentCard,
          { backgroundColor: theme.backgroundRoot },
        ]}
      >
        <KeyboardAwareScrollViewCompat
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: Spacing.lg,
            paddingTop: Spacing["2xl"],
            paddingBottom: insets.bottom + Spacing["3xl"],
          }}
          keyboardShouldPersistTaps="handled"
        >
          <DocumentSlot
            icon="credit-card"
            label="Government ID"
            hint="Required · SA ID book, smart card, or passport"
            url={idDocumentUrl}
            uploading={uploadingKey === "id"}
            onPick={() => pickAndUpload("id", setIdDocumentUrl)}
            accent={accent}
            theme={theme}
            required
          />

          <View style={{ height: Spacing.md }} />

          <DocumentSlot
            icon="home"
            label="Proof of address"
            hint="Optional · utility bill, bank letter, or lease (≤ 3 months old)"
            url={proofOfAddressUrl}
            uploading={uploadingKey === "address"}
            onPick={() => pickAndUpload("address", setProofOfAddressUrl)}
            accent={accent}
            theme={theme}
          />

          <View style={{ height: Spacing.md }} />

          <DocumentSlot
            icon="file-text"
            label={COMPANY_DOC_LABEL[role]}
            hint="Optional · CIPC certificate, permit, or trading licence"
            url={companyRegDocUrl}
            uploading={uploadingKey === "company"}
            onPick={() => pickAndUpload("company", setCompanyRegDocUrl)}
            accent={accent}
            theme={theme}
          />

          <View
            style={[
              styles.noteCard,
              { backgroundColor: accent + "10", borderColor: accent + "40" },
            ]}
          >
            <Feather name="info" size={16} color={accent} />
            <ThemedText style={[styles.noteText, { color: theme.textSecondary }]}>
              Your documents are stored privately and only reviewed by Haibo's
              compliance team. We verify within 1–2 business days.
            </ThemedText>
          </View>

          <View style={{ height: Spacing.xl }} />

          <GradientButton
            onPress={handleSubmit}
            disabled={!idDocumentUrl || isSubmitting || uploadingKey !== null}
            icon={isSubmitting ? undefined : "upload-cloud"}
          >
            {isSubmitting ? "Submitting…" : "Submit for verification"}
          </GradientButton>
        </KeyboardAwareScrollViewCompat>
      </Animated.View>
    </View>
  );
}

// ─── DocumentSlot ────────────────────────────────────────────────────────
// One upload tile per document. Three visual states:
//   • empty  — dashed border, large icon, "Tap to upload"
//   • uploading — spinner overlay
//   • filled — thumbnail of the upload + "Replace" CTA
function DocumentSlot({
  icon,
  label,
  hint,
  url,
  uploading,
  onPick,
  accent,
  theme,
  required = false,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  hint: string;
  url: string;
  uploading: boolean;
  onPick: () => void;
  accent: string;
  theme: any;
  required?: boolean;
}) {
  const filled = !!url;
  return (
    <View>
      <View style={styles.slotHeaderRow}>
        <Feather name={icon} size={16} color={accent} />
        <ThemedText style={[styles.slotLabel, { color: theme.foreground }]}>
          {label}
        </ThemedText>
        {required ? (
          <View style={[styles.requiredPill, { backgroundColor: accent }]}>
            <ThemedText style={styles.requiredPillText}>REQUIRED</ThemedText>
          </View>
        ) : null}
      </View>
      <ThemedText style={[styles.slotHint, { color: theme.textSecondary }]}>
        {hint}
      </ThemedText>

      <Pressable
        onPress={onPick}
        disabled={uploading}
        style={({ pressed }) => [
          styles.slotTarget,
          {
            borderColor: filled ? accent : theme.border,
            backgroundColor: filled ? accent + "08" : theme.surface,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Upload ${label}`}
      >
        {uploading ? (
          <View style={styles.slotCenter}>
            <ActivityIndicator color={accent} />
            <ThemedText
              style={[styles.slotCenterText, { color: theme.textSecondary }]}
            >
              Uploading…
            </ThemedText>
          </View>
        ) : filled ? (
          <View style={styles.slotFilledRow}>
            <Image source={{ uri: url }} style={styles.slotThumb} />
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.slotFilledLabel, { color: accent }]}>
                Uploaded
              </ThemedText>
              <ThemedText
                style={[
                  styles.slotFilledHint,
                  { color: theme.textSecondary },
                ]}
              >
                Tap to replace
              </ThemedText>
            </View>
            <Feather name="check-circle" size={20} color={accent} />
          </View>
        ) : (
          <View style={styles.slotCenter}>
            <Feather name="upload" size={24} color={accent} />
            <ThemedText
              style={[styles.slotCenterText, { color: theme.foreground }]}
            >
              Tap to upload
            </ThemedText>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  hero: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  backButton: {
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
  heroBadgeWrap: { alignItems: "center", marginBottom: Spacing.lg },
  heroBadge: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  heroText: { alignItems: "center" },
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
    maxWidth: 340,
  },

  contentCard: {
    flex: 1,
    marginTop: -Spacing["2xl"],
    borderTopLeftRadius: BorderRadius["2xl"],
    borderTopRightRadius: BorderRadius["2xl"],
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },

  slotHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: 4,
  },
  slotLabel: {
    ...Typography.body,
    fontWeight: "700",
    flex: 1,
  },
  slotHint: {
    ...Typography.small,
    marginBottom: Spacing.sm,
  },
  requiredPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  requiredPillText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.8,
  },
  slotTarget: {
    minHeight: 110,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderStyle: "dashed",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    justifyContent: "center",
  },
  slotCenter: {
    alignItems: "center",
    gap: Spacing.sm,
  },
  slotCenterText: {
    ...Typography.body,
    fontWeight: "600",
  },
  slotFilledRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  slotThumb: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.md,
  },
  slotFilledLabel: {
    ...Typography.body,
    fontWeight: "700",
  },
  slotFilledHint: {
    ...Typography.small,
    marginTop: 2,
  },

  noteCard: {
    flexDirection: "row",
    gap: Spacing.sm,
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.xl,
  },
  noteText: {
    ...Typography.small,
    flex: 1,
    lineHeight: 18,
  },
});
