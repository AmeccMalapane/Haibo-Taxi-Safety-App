import React, { useState, useRef } from "react";
import {
  StyleSheet,
  View,
  FlatList,
  Dimensions,
  Pressable,
  ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import type { SvgProps } from "react-native-svg";

import { useTheme } from "@/hooks/useTheme";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { Spacing, BrandColors, BorderRadius, Typography } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { GradientButton } from "@/components/GradientButton";

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
  title: string;
  description: string;
  Illustration: React.FC<SvgProps>;
}

const SLIDES: OnboardingSlide[] = [
  {
    id: "1",
    title: "Safety first",
    description:
      "One-tap SOS and live location sharing keep you covered on every ride.",
    Illustration: SosIllustration,
  },
  {
    id: "2",
    title: "Find every rank",
    description:
      "Discover taxi ranks and routes across South Africa with real-time updates.",
    Illustration: TaxiStopIllustration,
  },
  {
    id: "3",
    title: "Built by your community",
    description:
      "Share rides, lost-and-found, and safety alerts with commuters near you.",
    Illustration: CommunityIllustration,
  },
  {
    id: "4",
    title: "Pay the smart way",
    description:
      "Cashless payments to drivers and ranks — fast, secure, and tracked.",
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList<OnboardingSlide>>(null);

  const handleNext = () => {
    Haptics.selectionAsync();
    if (currentIndex < SLIDES.length - 1) {
      const nextIndex = currentIndex + 1;
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setCurrentIndex(nextIndex);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onComplete();
    }
  };

  const handleSkip = () => {
    Haptics.selectionAsync();
    onComplete();
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
          <ThemedText style={styles.slideTitle}>{item.title}</ThemedText>
          <ThemedText
            style={[styles.slideDescription, { color: theme.textSecondary }]}
          >
            {item.description}
          </ThemedText>
        </View>
      </View>
    );
  };

  const isLastSlide = currentIndex === SLIDES.length - 1;

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
          <ThemedText style={styles.skipText}>SKIP</ThemedText>
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
            {isLastSlide ? "Get started" : "Next"}
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
});
