import React, { useState } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
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
import { RootStackParamList } from "@/navigation/RootStackNavigator";

// OwnerOnboardingScreen — collects the minimum an owner needs to start
// receiving driver settlements: company name + payout bank details.
//
// Design: rose gradient hero with a briefcase badge (same brand language
// as ProfileSetupScreen / VendorOnboardingScreen), accent band set to
// teal to signal this is the "owner" flow (matches the role tile color
// on the previous screen). KYC + VAT fields are optional at first pass
// — an owner can register + start issuing driver invites before the
// paperwork clears; withdrawals block server-side until kycStatus is
// 'verified'.

type OwnerProfile = {
  id: string;
  userId: string;
  companyName: string | null;
  bankCode: string | null;
  accountNumber: string | null;
  accountName: string | null;
  kycStatus: string | null;
};

export default function OwnerOnboardingScreen() {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [companyName, setCompanyName] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [companyRegNumber, setCompanyRegNumber] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Focus bookkeeping for the 1.5px rose focus borders. A single array
  // of boolean flags was rejected for clarity — named setters read cleaner
  // when we have six separate inputs.
  const [companyFocused, setCompanyFocused] = useState(false);
  const [bankFocused, setBankFocused] = useState(false);
  const [accNumFocused, setAccNumFocused] = useState(false);
  const [accNameFocused, setAccNameFocused] = useState(false);
  const [regFocused, setRegFocused] = useState(false);
  const [vatFocused, setVatFocused] = useState(false);

  const accent = BrandColors.accent.teal;

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      const payload: Record<string, string | undefined> = {};
      if (companyName.trim()) payload.companyName = companyName.trim();
      if (bankCode.trim()) payload.bankCode = bankCode.trim();
      if (accountNumber.trim()) payload.accountNumber = accountNumber.trim();
      if (accountName.trim()) payload.accountName = accountName.trim();
      if (companyRegNumber.trim()) payload.companyRegNumber = companyRegNumber.trim();
      if (vatNumber.trim()) payload.vatNumber = vatNumber.trim();

      await apiRequest("/api/owner/profile", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (Platform.OS !== "web") {
        const Haptics = require("expo-haptics");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // First-time owners land on the invitations screen so they can
      // immediately generate a code for their first driver. Returning
      // owners (editing their profile) just pop back to wherever they
      // came from — Phase E will refine this based on tab navigation.
      navigation.reset({
        index: 0,
        routes: [{ name: "OwnerInvitations" as any }],
      });
    } catch (err: any) {
      Alert.alert(
        "Couldn't save owner profile",
        err?.message || "Please check your details and try again.",
      );
      setIsSaving(false);
    }
  };

  const skipForNow = () => {
    // Skipping is allowed so an owner can explore the app without
    // committing bank details. They'll hit a blocker the moment they
    // try to withdraw — the dashboard will prompt them back here.
    navigation.reset({
      index: 0,
      routes: [{ name: "MainTabs" }],
    });
  };

  const canSubmit = !isSaving && companyName.trim().length > 0;

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
      <LinearGradient
        colors={BrandColors.gradient.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradientBand, { paddingTop: insets.top + Spacing["2xl"] }]}
      >
        <Animated.View
          entering={reducedMotion ? undefined : FadeIn.duration(400)}
          style={styles.badgeWrap}
        >
          <View style={styles.badge}>
            <Feather name="briefcase" size={44} color={accent} />
          </View>
        </Animated.View>
        <Animated.View
          entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(150)}
          style={styles.heroText}
        >
          <ThemedText style={styles.title}>Set up your fleet</ThemedText>
          <ThemedText style={styles.subtitle}>
            A few details so we can route your drivers' earnings to the
            right account. You can finish this later — nothing is locked
            until a driver actually settles funds.
          </ThemedText>
        </Animated.View>
      </LinearGradient>

      <KeyboardAwareScrollViewCompat
        style={styles.scroll}
        contentContainerStyle={[
          styles.formContainer,
          { paddingBottom: insets.bottom + Spacing["2xl"] },
        ]}
      >
        <Animated.View
          entering={reducedMotion ? undefined : FadeInUp.duration(500).delay(300)}
          style={[styles.formCard, { backgroundColor: theme.backgroundRoot }]}
        >
          <SectionLabel theme={theme}>COMPANY</SectionLabel>

          <FieldGroup label="Company name">
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundDefault,
                  color: theme.text,
                  borderColor: companyFocused ? accent : theme.border,
                },
              ]}
              placeholder="e.g., Mapula Taxi Co."
              placeholderTextColor={theme.textSecondary}
              value={companyName}
              onChangeText={setCompanyName}
              onFocus={() => setCompanyFocused(true)}
              onBlur={() => setCompanyFocused(false)}
              maxLength={80}
            />
          </FieldGroup>

          <View style={styles.row}>
            <FieldGroup label="CK number (optional)" flex>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundDefault,
                    color: theme.text,
                    borderColor: regFocused ? accent : theme.border,
                  },
                ]}
                placeholder="K2023/123456/07"
                placeholderTextColor={theme.textSecondary}
                value={companyRegNumber}
                onChangeText={setCompanyRegNumber}
                onFocus={() => setRegFocused(true)}
                onBlur={() => setRegFocused(false)}
                maxLength={40}
                autoCapitalize="characters"
              />
            </FieldGroup>
            <FieldGroup label="VAT (optional)" flex>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundDefault,
                    color: theme.text,
                    borderColor: vatFocused ? accent : theme.border,
                  },
                ]}
                placeholder="4123456789"
                placeholderTextColor={theme.textSecondary}
                value={vatNumber}
                onChangeText={setVatNumber}
                onFocus={() => setVatFocused(true)}
                onBlur={() => setVatFocused(false)}
                keyboardType="number-pad"
                maxLength={15}
              />
            </FieldGroup>
          </View>

          <SectionLabel theme={theme}>PAYOUT BANK</SectionLabel>
          <ThemedText style={[styles.sectionHint, { color: theme.textSecondary }]}>
            Where driver settlements and your own withdrawals will land.
            You can skip this now — withdrawals will prompt for it later.
          </ThemedText>

          <FieldGroup label="Bank code">
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundDefault,
                  color: theme.text,
                  borderColor: bankFocused ? accent : theme.border,
                },
              ]}
              placeholder="e.g., 051001 (FNB)"
              placeholderTextColor={theme.textSecondary}
              value={bankCode}
              onChangeText={(v) => setBankCode(v.replace(/\D/g, ""))}
              onFocus={() => setBankFocused(true)}
              onBlur={() => setBankFocused(false)}
              keyboardType="number-pad"
              maxLength={10}
            />
          </FieldGroup>

          <FieldGroup label="Account number">
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundDefault,
                  color: theme.text,
                  borderColor: accNumFocused ? accent : theme.border,
                },
              ]}
              placeholder="62XXXXXXXXX"
              placeholderTextColor={theme.textSecondary}
              value={accountNumber}
              onChangeText={(v) => setAccountNumber(v.replace(/\D/g, ""))}
              onFocus={() => setAccNumFocused(true)}
              onBlur={() => setAccNumFocused(false)}
              keyboardType="number-pad"
              maxLength={20}
            />
          </FieldGroup>

          <FieldGroup label="Account holder name">
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundDefault,
                  color: theme.text,
                  borderColor: accNameFocused ? accent : theme.border,
                },
              ]}
              placeholder="As it appears on the bank account"
              placeholderTextColor={theme.textSecondary}
              value={accountName}
              onChangeText={setAccountName}
              onFocus={() => setAccNameFocused(true)}
              onBlur={() => setAccNameFocused(false)}
              maxLength={80}
            />
          </FieldGroup>

          <View style={styles.ctaWrap}>
            <GradientButton
              onPress={handleSave}
              disabled={!canSubmit}
              size="large"
              icon={isSaving ? undefined : "arrow-right"}
              iconPosition="right"
            >
              {isSaving ? "Saving..." : "Continue to invitations"}
            </GradientButton>
          </View>

          <Pressable
            onPress={skipForNow}
            disabled={isSaving}
            style={styles.skipWrap}
            accessibilityRole="button"
            accessibilityLabel="Skip for now"
          >
            <ThemedText style={[styles.skipText, { color: theme.textSecondary }]}>
              Skip — set this up later
            </ThemedText>
          </Pressable>
        </Animated.View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function SectionLabel({
  children,
  theme,
}: {
  children: React.ReactNode;
  theme: any;
}) {
  return (
    <ThemedText
      style={[
        styles.sectionLabel,
        { color: theme?.textSecondary || BrandColors.gray[600] },
      ]}
    >
      {children}
    </ThemedText>
  );
}

function FieldGroup({
  label,
  children,
  flex,
}: {
  label: string;
  children: React.ReactNode;
  flex?: boolean;
}) {
  return (
    <View style={[styles.fieldGroup, flex ? { flex: 1 } : undefined]}>
      <ThemedText style={styles.fieldLabel}>{label}</ThemedText>
      {children}
    </View>
  );
}

const HERO_HEIGHT = 300;

const styles = StyleSheet.create({
  root: { flex: 1 },
  gradientBand: {
    height: HERO_HEIGHT,
    paddingHorizontal: Spacing.xl,
    alignItems: "center",
  },
  badgeWrap: { marginBottom: Spacing.lg },
  badge: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  heroText: { alignItems: "center" },
  title: {
    ...Typography.h1,
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.body,
    color: "#FFFFFF",
    textAlign: "center",
    opacity: 0.92,
    maxWidth: 360,
  },
  scroll: { flex: 1, marginTop: -Spacing["2xl"] },
  formContainer: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
  },
  formCard: {
    borderTopLeftRadius: BorderRadius["2xl"],
    borderTopRightRadius: BorderRadius["2xl"],
    padding: Spacing.xl,
    paddingTop: Spacing["2xl"],
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  sectionLabel: {
    ...Typography.label,
    letterSpacing: 1.2,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  sectionHint: {
    ...Typography.small,
    fontSize: 12,
    marginBottom: Spacing.md,
    marginTop: -Spacing.xs,
  },
  fieldGroup: { marginBottom: Spacing.md },
  fieldLabel: {
    ...Typography.label,
    fontSize: 11,
    marginBottom: 6,
    opacity: 0.85,
  },
  input: {
    height: 52,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
    borderWidth: 1.5,
  },
  row: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  ctaWrap: { marginTop: Spacing.xl },
  skipWrap: {
    marginTop: Spacing.lg,
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  skipText: { ...Typography.small, fontWeight: "600" },
});
