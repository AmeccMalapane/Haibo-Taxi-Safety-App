import React, { useState, useRef } from "react";
import {
  StyleSheet,
  View,
  FlatList,
  Dimensions,
  Pressable,
  ViewToken,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import type { SvgProps } from "react-native-svg";

import { useTheme } from "@/hooks/useTheme";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useLanguage } from "@/hooks/useLanguage";
import { Spacing, BrandColors, BorderRadius, Typography } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { GradientButton } from "@/components/GradientButton";

const PRIVACY_URL = "https://app.haibo.africa/privacy";
const TERMS_URL = "https://app.haibo.africa/terms";

import SosIllustration from "@/assets/svg/SOS.svg";
import TaxiStopIllustration from "@/assets/svg/TXISTOP.svg";
import CommunityIllustration from "@/assets/svg/COMMUNITY.svg";
import FindRanksIllustration from "@/assets/svg/FINDRNKS.svg";

// typeui-clean applied to onboarding — rose gradient hero stage with the
// brand SVG illustrations, white floating content card with title +
// description, anchored pagination + GradientButton CTA.
//
// Drops the old role-selection + driver registration step entirely:
// App.tsx's handleOnboardingComplete takes no args and silently throws
// away the role/driverData, so that whole flow was dead code from a
// feature that never landed. Profile + role are now captured in
// ProfileSetupScreen.

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface OnboardingSlide {
  id: string;
  titleKey: string;
  descKey: string;
  Illustration: React.FC<SvgProps>;
}

const SLIDES: OnboardingSlide[] = [
  {
    id: "1",
    titleKey: "onboarding.safetyFirst",
    descKey: "onboarding.safetyDesc",
    Illustration: SosIllustration,
  },
  {
    id: "2",
    titleKey: "onboarding.findRanks",
    descKey: "onboarding.findRanksDesc",
    Illustration: TaxiStopIllustration,
  },
  {
    id: "3",
    titleKey: "onboarding.community",
    descKey: "onboarding.communityDesc",
    Illustration: CommunityIllustration,
  },
  {
    id: "4",
    titleKey: "onboarding.smartPay",
    descKey: "onboarding.smartPayDesc",
    Illustration: FindRanksIllustration,
  },
];

interface OnboardingScreenProps {
  onComplete: () => void;
}

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);
  // Consent gate — shown after the marketing slides finish. Non-dismissable:
  // the only way past is to tick the box. Captures POPIA §11 consent +
  // doubles as the privacy/terms acceptance Play Store requires.
  const [consentStep, setConsentStep] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const flatListRef = useRef<FlatList<OnboardingSlide>>(null);

  const handleNext = () => {
    Haptics.selectionAsync();
    if (currentIndex < SLIDES.length - 1) {
      const nextIndex = currentIndex + 1;
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setCurrentIndex(nextIndex);
    } else {
      setConsentStep(true);
    }
  };

  const handleSkip = () => {
    Haptics.selectionAsync();
    // Skip jumps past the marketing slides straight to the consent gate,
    // but cannot bypass consent itself.
    setConsentStep(true);
  };

  const handleAcceptAndContinue = () => {
    if (!consentAccepted) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onComplete();
  };

  const openPrivacy = () => {
    WebBrowser.openBrowserAsync(PRIVACY_URL).catch(() => {});
  };

  const openTerms = () => {
    WebBrowser.openBrowserAsync(TERMS_URL).catch(() => {});
  };

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setCurrentIndex(viewableItems[0].index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const renderSlide = ({ item }: { item: OnboardingSlide }) => {
    const Illustration = item.Illustration;
    return (
      <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
        <View
          style={[
            styles.illustrationStage,
            { paddingTop: insets.top + Spacing["3xl"] + Spacing.lg },
          ]}
        >
          <Illustration width={ILLUSTRATION_SIZE} height={ILLUSTRATION_SIZE} />
        </View>
        <View
          style={[
            styles.textCard,
            { backgroundColor: theme.backgroundRoot },
          ]}
        >
          <ThemedText style={styles.slideTitle}>{t(item.titleKey)}</ThemedText>
          <ThemedText
            style={[styles.slideDescription, { color: theme.textSecondary }]}
          >
            {t(item.descKey)}
          </ThemedText>
        </View>
      </View>
    );
  };

  const isLastSlide = currentIndex === SLIDES.length - 1;

  if (consentStep) {
    return (
      <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
        <LinearGradient
          colors={BrandColors.gradient.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gradientStage, { height: HERO_HEIGHT + insets.top }]}
        />

        <Animated.View
          entering={reducedMotion ? undefined : FadeIn.duration(300)}
          style={[
            styles.consentHero,
            { paddingTop: insets.top + Spacing["3xl"] + Spacing.lg },
          ]}
        >
          <View style={styles.consentIconWrap}>
            <Feather name="shield" size={56} color="#FFFFFF" />
          </View>
          <ThemedText style={styles.consentEyebrow}>{t("onboarding.oneQuickThing")}</ThemedText>
        </Animated.View>

        <View
          style={[
            styles.consentCard,
            { backgroundColor: theme.backgroundRoot },
          ]}
        >
          <ScrollView
            contentContainerStyle={styles.consentCardInner}
            showsVerticalScrollIndicator={false}
          >
            <ThemedText style={styles.consentTitle}>
              {t("onboarding.privacyTitle")}
            </ThemedText>
            <ThemedText
              style={[styles.consentBody, { color: theme.textSecondary }]}
            >
              {t("onboarding.privacyDesc")}
            </ThemedText>

            <View style={styles.consentLinkRow}>
              <Pressable
                onPress={openPrivacy}
                accessibilityRole="link"
                accessibilityLabel="Open privacy policy"
                style={styles.consentLinkChip}
              >
                <ThemedText style={styles.consentLinkText}>
                  {t("onboarding.privacyPolicy")}
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={openTerms}
                accessibilityRole="link"
                accessibilityLabel={t("onboarding.termsOfService")}
                style={styles.consentLinkChip}
              >
                <ThemedText style={styles.consentLinkText}>
                  {t("onboarding.termsOfService")}
                </ThemedText>
              </Pressable>
            </View>

            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setConsentAccepted((v) => !v);
              }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: consentAccepted }}
              accessibilityLabel="I accept the privacy policy and terms of service"
              style={styles.consentCheckRow}
            >
              <View
                style={[
                  styles.consentCheckbox,
                  {
                    borderColor: consentAccepted
                      ? BrandColors.primary.gradientStart
                      : theme.border,
                    backgroundColor: consentAccepted
                      ? BrandColors.primary.gradientStart
                      : "transparent",
                  },
                ]}
              >
                {consentAccepted ? (
                  <Feather name="check" size={16} color="#FFFFFF" />
                ) : null}
              </View>
              <ThemedText
                style={[
                  styles.consentCheckLabel,
                  { color: theme.text },
                ]}
              >
                {t("onboarding.acceptTerms")}
              </ThemedText>
            </Pressable>
          </ScrollView>

          <View
            style={[
              styles.consentFooter,
              { paddingBottom: insets.bottom + Spacing.xl },
            ]}
          >
            <GradientButton
              onPress={handleAcceptAndContinue}
              size="large"
              disabled={!consentAccepted}
              icon="check"
              iconPosition="right"
            >
              {t("onboarding.getStarted")}
            </GradientButton>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
      {/* Rose gradient stage — anchored hero band that the illustrations sit on */}
      <LinearGradient
        colors={BrandColors.gradient.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.gradientStage,
          { height: HERO_HEIGHT + insets.top },
        ]}
      />

      {/* Skip button overlays the gradient (top-right) — outside the carousel
          so it doesn't swipe away with the slides */}
      <Animated.View
        entering={reducedMotion ? undefined : FadeIn.duration(300)}
        style={[styles.skipRow, { top: insets.top + Spacing.md }]}
      >
        <Pressable
          onPress={handleSkip}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Skip onboarding"
        >
          <ThemedText style={styles.skipText}>{t("common.skip").toUpperCase()}</ThemedText>
        </Pressable>
      </Animated.View>

      {/* Carousel — slides float on top of the gradient + spill onto the white card */}
      <View style={styles.carouselWrap}>
        <FlatList
          ref={flatListRef}
          data={SLIDES}
          renderItem={renderSlide}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          bounces={false}
        />
      </View>

      {/* Anchored footer — pagination + CTA */}
      <Animated.View
        entering={reducedMotion ? undefined : FadeInUp.duration(500).delay(200)}
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + Spacing.xl,
            backgroundColor: theme.backgroundRoot,
          },
        ]}
      >
        <View style={styles.pagination}>
          {SLIDES.map((_, index) => {
            const active = index === currentIndex;
            return (
              <View
                key={index}
                style={[
                  styles.dot,
                  {
                    backgroundColor: active
                      ? BrandColors.primary.gradientStart
                      : theme.border,
                    width: active ? 24 : 8,
                  },
                ]}
              />
            );
          })}
        </View>

        <Animated.View entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(300)}>
          <GradientButton
            onPress={handleNext}
            size="large"
            icon={isLastSlide ? "check" : "arrow-right"}
            iconPosition="right"
          >
            {isLastSlide ? t("onboarding.getStarted") : t("common.next")}
          </GradientButton>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const HERO_HEIGHT = 320;
const ILLUSTRATION_SIZE = 220;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  gradientStage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  skipRow: {
    position: "absolute",
    right: Spacing.xl,
    zIndex: 10,
  },
  skipText: {
    ...Typography.label,
    color: "#FFFFFF",
    letterSpacing: 1.5,
    fontSize: 13,
    fontWeight: "700",
  },
  carouselWrap: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: "center",
  },
  illustrationStage: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: Spacing.xl,
  },
  textCard: {
    flex: 1,
    alignSelf: "stretch",
    marginTop: -Spacing["2xl"],
    borderTopLeftRadius: BorderRadius["2xl"],
    borderTopRightRadius: BorderRadius["2xl"],
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing["3xl"],
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  slideTitle: {
    ...Typography.h1,
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  slideDescription: {
    ...Typography.body,
    textAlign: "center",
    maxWidth: 320,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  consentHero: {
    alignItems: "center",
    paddingBottom: Spacing.xl,
  },
  consentIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.32)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  consentEyebrow: {
    ...Typography.label,
    color: "#FFFFFF",
    letterSpacing: 2,
    fontSize: 12,
    fontWeight: "700",
  },
  consentCard: {
    flex: 1,
    alignSelf: "stretch",
    marginTop: -Spacing["2xl"],
    borderTopLeftRadius: BorderRadius["2xl"],
    borderTopRightRadius: BorderRadius["2xl"],
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  consentCardInner: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing["3xl"],
    paddingBottom: Spacing.xl,
  },
  consentTitle: {
    ...Typography.h1,
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  consentBody: {
    ...Typography.body,
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  consentLinkRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  consentLinkChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: BrandColors.primary.gradientStart,
  },
  consentLinkText: {
    ...Typography.label,
    color: BrandColors.primary.gradientStart,
    fontSize: 13,
    fontWeight: "600",
  },
  consentCheckRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: "rgba(200, 30, 94, 0.04)",
  },
  consentCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  consentCheckLabel: {
    ...Typography.body,
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  consentFooter: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
});
