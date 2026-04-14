import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  FadeInDown,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";

import { ThemedText } from "@/components/ThemedText";
import { GradientButton } from "@/components/GradientButton";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { Spacing, BorderRadius, BrandColors, Typography } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { getDeviceId } from "@/lib/deviceId";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface ExplorerProgress {
  id: string;
  deviceId: string;
  totalPoints: number;
  currentLevel: number;
  surveysCompleted: number;
  faresVerified: number;
  stopsAdded: number;
  photosUploaded: number;
  badges: string[];
  hasNewRewards: boolean;
  weeklyRaffleEntries: number;
  streak: number;
}

interface FareQuestion {
  origin: string;
  destination: string;
  hint: string;
}

type SurveyStep = "welcome" | "fare" | "stop" | "photo" | "complete";

const BADGE_INFO: Record<
  string,
  { icon: keyof typeof Feather.glyphMap; label: string; color: string }
> = {
  "fare-detective": {
    icon: "dollar-sign",
    label: "Fare Detective",
    color: BrandColors.status.success,
  },
  "stop-spotter": {
    icon: "map-pin",
    label: "Stop Spotter",
    color: BrandColors.primary.gradientStart,
  },
  "direction-hero": {
    icon: "camera",
    label: "Direction Hero",
    color: BrandColors.secondary.orange,
  },
};

function fireSuccessHaptic() {
  if (Platform.OS !== "web") {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }
}

function fireSelectionHaptic() {
  if (Platform.OS !== "web") {
    Haptics.selectionAsync();
  }
}

export default function CityExplorerScreen() {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();

  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<SurveyStep>("welcome");
  const [fareAmount, setFareAmount] = useState("");
  const [fareResponse, setFareResponse] = useState<
    "known" | "guessed" | "new_route" | null
  >(null);
  const [stopName, setStopName] = useState("");
  const [stopTip, setStopTip] = useState("");
  const [stopLandmark, setStopLandmark] = useState("");
  const [bestTime, setBestTime] = useState<"morning" | "afternoon" | "evening" | null>(
    null
  );
  const [photoDescription, setPhotoDescription] = useState("");
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [newBadges, setNewBadges] = useState<string[]>([]);

  const sessionFlags = useRef({ fare: false, stop: false, photo: false });
  const initialCounts = useRef<{
    faresVerified: number;
    stopsAdded: number;
    photosUploaded: number;
  } | null>(null);

  const pulseAnim = useSharedValue(1);
  const cardSurface = isDark ? theme.surface : "#FFFFFF";

  useEffect(() => {
    getDeviceId().then(setDeviceId).catch(() => setDeviceId(null));

    pulseAnim.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1000 }),
        withTiming(1, { duration: 1000 })
      ),
      -1,
      true
    );
  }, []);

  const { data: progress, isLoading: progressLoading } = useQuery<ExplorerProgress>({
    queryKey: [`/api/explorer/progress/${deviceId}`],
    enabled: !!deviceId,
  });

  useEffect(() => {
    if (progress && initialCounts.current === null) {
      initialCounts.current = {
        faresVerified: progress.faresVerified || 0,
        stopsAdded: progress.stopsAdded || 0,
        photosUploaded: progress.photosUploaded || 0,
      };
    }
  }, [progress]);

  const { data: fareQuestion } = useQuery<FareQuestion>({
    queryKey: ["/api/explorer/fare-question"],
    enabled: currentStep === "fare",
  });

  const fareMutation = useMutation({
    mutationFn: async (data: { fareAmount?: number; responseType: string }) => {
      return apiRequest("/api/explorer/fare-survey", {
        method: "POST",
        body: JSON.stringify({
          deviceId,
          originName: fareQuestion?.origin || "Unknown",
          destinationName: fareQuestion?.destination || "Unknown",
          fareAmount: data.fareAmount,
          responseType: data.responseType,
        }),
      });
    },
    onSuccess: (data: any) => {
      sessionFlags.current.fare = true;
      setEarnedPoints((prev) => prev + (data?.pointsEarned || 10));
      queryClient.invalidateQueries({ queryKey: [`/api/explorer/progress/${deviceId}`] });
      fireSuccessHaptic();
      setCurrentStep("stop");
    },
    onError: () => {
      Alert.alert("Could not save", "Please try again in a moment.");
    },
  });

  const stopMutation = useMutation({
    mutationFn: async () => {
      let coords: { latitude: number; longitude: number } | null = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          coords = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };
        }
      } catch {
        // GPS optional — server accepts null lat/lng for "unknown location"
      }

      return apiRequest("/api/explorer/stop", {
        method: "POST",
        body: JSON.stringify({
          deviceId,
          stopName,
          latitude: coords?.latitude ?? null,
          longitude: coords?.longitude ?? null,
          tip: stopTip,
          landmark: stopLandmark,
          bestTime,
        }),
      });
    },
    onSuccess: (data: any) => {
      sessionFlags.current.stop = true;
      setEarnedPoints((prev) => prev + (data?.pointsEarned || 30));
      queryClient.invalidateQueries({ queryKey: [`/api/explorer/progress/${deviceId}`] });
      fireSuccessHaptic();
      setCurrentStep("photo");
    },
    onError: () => {
      Alert.alert("Could not save", "Please try again in a moment.");
    },
  });

  const photoMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/explorer/photo", {
        method: "POST",
        body: JSON.stringify({
          deviceId,
          description: photoDescription,
          landmark: stopLandmark,
          bestTime,
        }),
      });
    },
    onSuccess: (data: any) => {
      sessionFlags.current.photo = true;
      setEarnedPoints((prev) => prev + (data?.pointsEarned || 20));
      queryClient.invalidateQueries({ queryKey: [`/api/explorer/progress/${deviceId}`] });
      fireSuccessHaptic();
      computeBadges();
      setCurrentStep("complete");
    },
    onError: () => {
      Alert.alert("Could not save", "Please try again in a moment.");
    },
  });

  const computeBadges = () => {
    const initial = initialCounts.current || {
      faresVerified: 0,
      stopsAdded: 0,
      photosUploaded: 0,
    };
    const badges: string[] = [];
    if (sessionFlags.current.fare && initial.faresVerified === 0) {
      badges.push("fare-detective");
    }
    if (sessionFlags.current.stop && initial.stopsAdded === 0) {
      badges.push("stop-spotter");
    }
    if (sessionFlags.current.photo && initial.photosUploaded === 0) {
      badges.push("direction-hero");
    }
    setNewBadges(badges);
  };

  const handleSkipStop = () => {
    fireSelectionHaptic();
    setCurrentStep("photo");
  };

  const handleSkipPhoto = () => {
    fireSelectionHaptic();
    computeBadges();
    setCurrentStep("complete");
  };

  const handleSubmitFare = () => {
    if (!fareResponse) return;
    fareMutation.mutate({
      fareAmount:
        fareResponse === "known" && fareAmount ? parseFloat(fareAmount) : undefined,
      responseType: fareResponse,
    });
  };

  const handleStartOver = () => {
    fireSelectionHaptic();
    setCurrentStep("welcome");
    setEarnedPoints(0);
    setNewBadges([]);
    setFareResponse(null);
    setFareAmount("");
    setStopName("");
    setStopTip("");
    setStopLandmark("");
    setBestTime(null);
    setPhotoDescription("");
    sessionFlags.current = { fare: false, stop: false, photo: false };
    initialCounts.current = progress
      ? {
          faresVerified: progress.faresVerified || 0,
          stopsAdded: progress.stopsAdded || 0,
          photosUploaded: progress.photosUploaded || 0,
        }
      : null;
    queryClient.invalidateQueries({ queryKey: [`/api/explorer/progress/${deviceId}`] });
  };

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  const getProgressPercent = () => {
    switch (currentStep) {
      case "welcome":
        return 0;
      case "fare":
        return 33;
      case "stop":
        return 66;
      case "photo":
        return 85;
      case "complete":
        return 100;
      default:
        return 0;
    }
  };

  const renderWelcome = () => (
    <Animated.View entering={reducedMotion ? undefined : FadeInDown.duration(500)} style={styles.stepContainer}>
      <LinearGradient
        colors={BrandColors.gradient.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <Animated.View style={[styles.iconCircle, pulseStyle]}>
          <Feather name="map" size={48} color="#FFFFFF" />
        </Animated.View>
        <ThemedText style={styles.heroTitle}>Welcome, Explorer!</ThemedText>
        <ThemedText style={styles.heroSubtitle}>
          Help build the safest, smartest taxi network in the city. Every answer helps a
          fellow traveller.
        </ThemedText>
      </LinearGradient>

      <View style={[styles.infoCard, { backgroundColor: cardSurface }]}>
        <View style={styles.infoRow}>
          <View
            style={[
              styles.badge,
              { backgroundColor: BrandColors.primary.gradientStart + "15" },
            ]}
          >
            <Feather name="star" size={16} color={BrandColors.primary.gradientStart} />
          </View>
          <View style={styles.infoText}>
            <ThemedText style={styles.infoLabel}>Your points</ThemedText>
            <ThemedText style={styles.infoValue}>{progress?.totalPoints || 0}</ThemedText>
          </View>
        </View>
        <View style={styles.infoDivider} />
        <View style={styles.infoRow}>
          <View
            style={[
              styles.badge,
              { backgroundColor: BrandColors.primary.gradientStart + "15" },
            ]}
          >
            <Feather name="award" size={16} color={BrandColors.primary.gradientStart} />
          </View>
          <View style={styles.infoText}>
            <ThemedText style={styles.infoLabel}>Badges earned</ThemedText>
            <ThemedText style={styles.infoValue}>
              {progress?.badges?.length || 0}/3
            </ThemedText>
          </View>
        </View>
        <View style={styles.infoDivider} />
        <View style={styles.infoRow}>
          <View
            style={[
              styles.badge,
              { backgroundColor: BrandColors.primary.gradientStart + "15" },
            ]}
          >
            <Feather
              name="trending-up"
              size={16}
              color={BrandColors.primary.gradientStart}
            />
          </View>
          <View style={styles.infoText}>
            <ThemedText style={styles.infoLabel}>Level</ThemedText>
            <ThemedText style={styles.infoValue}>
              {progress?.currentLevel || 1}
            </ThemedText>
          </View>
        </View>
      </View>

      <View style={[styles.rewardsPreview, { backgroundColor: cardSurface }]}>
        <ThemedText style={styles.rewardsTitle}>What you can earn</ThemedText>
        <View style={styles.rewardItem}>
          <Feather name="gift" size={18} color={BrandColors.primary.gradientStart} />
          <ThemedText style={styles.rewardText}>Entry into Weekly Haibo Raffle</ThemedText>
        </View>
        <View style={styles.rewardItem}>
          <Feather
            name="bar-chart-2"
            size={18}
            color={BrandColors.primary.gradientStart}
          />
          <ThemedText style={styles.rewardText}>Compare your fares with others</ThemedText>
        </View>
        <View style={styles.rewardItem}>
          <Feather name="award" size={18} color={BrandColors.primary.gradientStart} />
          <ThemedText style={styles.rewardText}>
            Climb the City Explorer leaderboard
          </ThemedText>
        </View>
      </View>

      <GradientButton
        onPress={() => {
          fireSelectionHaptic();
          setCurrentStep("fare");
        }}
        icon="arrow-right"
        iconPosition="right"
      >
        Start challenge
      </GradientButton>
    </Animated.View>
  );

  const renderFareStep = () => (
    <Animated.View entering={reducedMotion ? undefined : FadeInDown.duration(500)} style={styles.stepContainer}>
      <View style={styles.levelHeader}>
        <View style={styles.levelBadge}>
          <ThemedText style={styles.levelNumber}>1</ThemedText>
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.levelTitle}>Fare Detective</ThemedText>
          <ThemedText style={styles.levelSubtitle}>
            Quick & easy — earn your first badge
          </ThemedText>
        </View>
      </View>

      <View style={[styles.questionCard, { backgroundColor: cardSurface }]}>
        <ThemedText style={styles.questionLabel}>Quick fare check</ThemedText>
        <ThemedText style={styles.questionText}>If you took a taxi from:</ThemedText>
        <View style={[styles.routeBox, { backgroundColor: theme.backgroundDefault }]}>
          <Feather name="map-pin" size={16} color={BrandColors.primary.gradientStart} />
          <ThemedText style={styles.routeText}>
            {fareQuestion?.origin || "Loading..."}
          </ThemedText>
        </View>
        <ThemedText style={styles.questionText}>to:</ThemedText>
        <View style={[styles.routeBox, { backgroundColor: theme.backgroundDefault }]}>
          <Feather name="navigation" size={16} color={BrandColors.primary.gradientStart} />
          <ThemedText style={styles.routeText}>
            {fareQuestion?.destination || "Loading..."}
          </ThemedText>
        </View>
        {fareQuestion?.hint ? (
          <View style={styles.hintRow}>
            <Feather name="info" size={12} color={BrandColors.gray[600]} />
            <ThemedText style={styles.hint}>{fareQuestion.hint}</ThemedText>
          </View>
        ) : null}
      </View>

      <View style={styles.optionsContainer}>
        {(
          [
            { id: "known", icon: "check-circle", label: "Yes, I know the fare" },
            { id: "guessed", icon: "help-circle", label: "No, but I can guess" },
            { id: "new_route", icon: "plus-circle", label: "This route is new to me" },
          ] as const
        ).map((opt) => {
          const selected = fareResponse === opt.id;
          return (
            <Pressable
              key={opt.id}
              style={[
                styles.optionButton,
                {
                  backgroundColor: cardSurface,
                  borderColor: selected
                    ? BrandColors.primary.gradientStart
                    : BrandColors.gray[200],
                },
              ]}
              onPress={() => {
                fireSelectionHaptic();
                setFareResponse(opt.id);
              }}
            >
              <Feather
                name={opt.icon}
                size={22}
                color={
                  selected ? BrandColors.primary.gradientStart : BrandColors.gray[600]
                }
              />
              <ThemedText
                style={[
                  styles.optionText,
                  selected && {
                    color: BrandColors.primary.gradientStart,
                    fontWeight: "700",
                  },
                ]}
              >
                {opt.label}
              </ThemedText>
            </Pressable>
          );
        })}

        {fareResponse === "known" ? (
          <View style={[styles.fareInputCard, { backgroundColor: cardSurface }]}>
            <ThemedText style={styles.fareLabel}>Approximate fare</ThemedText>
            <View
              style={[
                styles.inputWrap,
                { backgroundColor: theme.backgroundDefault },
              ]}
            >
              <ThemedText style={styles.farePrefix}>R</ThemedText>
              <TextInput
                style={[styles.input, { color: theme.text }]}
                value={fareAmount}
                onChangeText={setFareAmount}
                keyboardType="decimal-pad"
                placeholder="50"
                placeholderTextColor={BrandColors.gray[500]}
              />
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.pointsIndicator}>
        <Feather name="zap" size={16} color={BrandColors.primary.gradientStart} />
        <ThemedText style={styles.pointsText}>+10 points for answering</ThemedText>
      </View>

      <GradientButton
        onPress={handleSubmitFare}
        disabled={!fareResponse || fareMutation.isPending}
        icon={fareMutation.isPending ? undefined : "arrow-right"}
        iconPosition="right"
      >
        {fareMutation.isPending ? "Submitting..." : "Continue"}
      </GradientButton>
    </Animated.View>
  );

  const renderStopStep = () => (
    <Animated.View entering={reducedMotion ? undefined : FadeInDown.duration(500)} style={styles.stepContainer}>
      <View style={styles.levelHeader}>
        <View style={styles.levelBadge}>
          <ThemedText style={styles.levelNumber}>2</ThemedText>
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.levelTitle}>Stop Spotter</ThemedText>
          <ThemedText style={styles.levelSubtitle}>Help us map missing stops</ThemedText>
        </View>
      </View>

      <View style={[styles.questionCard, { backgroundColor: cardSurface }]}>
        <ThemedText style={styles.questionLabel}>Missing stop scout</ThemedText>
        <ThemedText style={styles.questionText}>
          Is there a taxi stop or pickup spot near you that's not on our map?
        </ThemedText>
      </View>

      <View style={styles.inputGroup}>
        <ThemedText style={styles.inputLabel}>Name this stop</ThemedText>
        <View style={[styles.inputWrap, { backgroundColor: cardSurface }]}>
          <Feather name="map-pin" size={16} color={BrandColors.gray[600]} />
          <TextInput
            style={[styles.input, { color: theme.text }]}
            value={stopName}
            onChangeText={setStopName}
            placeholder="e.g. Corner of Main and Oak"
            placeholderTextColor={BrandColors.gray[500]}
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <ThemedText style={styles.inputLabel}>Quick tip for travellers</ThemedText>
        <View style={[styles.inputWrap, { backgroundColor: cardSurface }]}>
          <Feather name="message-circle" size={16} color={BrandColors.gray[600]} />
          <TextInput
            style={[styles.input, { color: theme.text }]}
            value={stopTip}
            onChangeText={setStopTip}
            placeholder="e.g. Only taxis after 5 PM"
            placeholderTextColor={BrandColors.gray[500]}
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <ThemedText style={styles.inputLabel}>Nearby landmark</ThemedText>
        <View style={[styles.inputWrap, { backgroundColor: cardSurface }]}>
          <Feather name="flag" size={16} color={BrandColors.gray[600]} />
          <TextInput
            style={[styles.input, { color: theme.text }]}
            value={stopLandmark}
            onChangeText={setStopLandmark}
            placeholder="e.g. Next to KFC"
            placeholderTextColor={BrandColors.gray[500]}
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <ThemedText style={styles.inputLabel}>Best time to find taxis</ThemedText>
        <View style={styles.timeOptions}>
          {(["morning", "afternoon", "evening"] as const).map((time) => {
            const selected = bestTime === time;
            return (
              <Pressable
                key={time}
                style={[
                  styles.timeOption,
                  {
                    backgroundColor: cardSurface,
                    borderColor: selected
                      ? BrandColors.primary.gradientStart
                      : BrandColors.gray[200],
                  },
                  selected && {
                    backgroundColor: BrandColors.primary.gradientStart + "10",
                  },
                ]}
                onPress={() => {
                  fireSelectionHaptic();
                  setBestTime(time);
                }}
              >
                <Feather
                  name={
                    time === "morning"
                      ? "sunrise"
                      : time === "afternoon"
                      ? "sun"
                      : "sunset"
                  }
                  size={20}
                  color={
                    selected
                      ? BrandColors.primary.gradientStart
                      : BrandColors.gray[600]
                  }
                />
                <ThemedText
                  style={[
                    styles.timeText,
                    selected && {
                      color: BrandColors.primary.gradientStart,
                      fontWeight: "700",
                    },
                  ]}
                >
                  {time.charAt(0).toUpperCase() + time.slice(1)}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.pointsIndicator}>
        <Feather name="zap" size={16} color={BrandColors.primary.gradientStart} />
        <ThemedText style={styles.pointsText}>+30 points for adding a stop</ThemedText>
      </View>

      <View style={styles.buttonRow}>
        <Pressable
          style={[
            styles.secondaryButton,
            {
              backgroundColor: cardSurface,
              borderColor: BrandColors.gray[200],
            },
          ]}
          onPress={handleSkipStop}
        >
          <ThemedText style={styles.secondaryButtonText}>Skip</ThemedText>
        </Pressable>
        <View style={{ flex: 2 }}>
          <GradientButton
            onPress={() => stopMutation.mutate()}
            disabled={!stopName || stopMutation.isPending}
            icon={stopMutation.isPending ? undefined : "map-pin"}
            iconPosition="right"
          >
            {stopMutation.isPending ? "Saving..." : "Add stop"}
          </GradientButton>
        </View>
      </View>
    </Animated.View>
  );

  const renderPhotoStep = () => (
    <Animated.View entering={reducedMotion ? undefined : FadeInDown.duration(500)} style={styles.stepContainer}>
      <View style={styles.levelHeader}>
        <View style={styles.levelBadge}>
          <ThemedText style={styles.levelNumber}>3</ThemedText>
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.levelTitle}>Direction Hero</ThemedText>
          <ThemedText style={styles.levelSubtitle}>
            Add details to level up
          </ThemedText>
        </View>
      </View>

      <View style={[styles.questionCard, { backgroundColor: cardSurface }]}>
        <ThemedText style={styles.questionLabel}>Picture patrol</ThemedText>
        <ThemedText style={styles.questionText}>
          Snap a quick photo of a taxi rank or stop near you. This helps travellers
          recognise the spot.
        </ThemedText>
      </View>

      <Pressable
        style={[
          styles.photoUploadArea,
          {
            backgroundColor: BrandColors.primary.gradientStart + "08",
            borderColor: BrandColors.primary.gradientStart + "4D",
          },
        ]}
        onPress={() => {
          Alert.alert(
            "Coming soon",
            "Photo upload is not available yet. For now, add a description below — you'll still earn points."
          );
        }}
      >
        <View style={styles.photoIconWrap}>
          <Feather name="camera" size={28} color={BrandColors.primary.gradientStart} />
        </View>
        <ThemedText style={styles.photoUploadText}>Tap to upload photo</ThemedText>
        <View style={styles.comingSoonPill}>
          <ThemedText style={styles.comingSoonText}>Coming soon</ThemedText>
        </View>
      </Pressable>

      <View style={styles.inputGroup}>
        <ThemedText style={styles.inputLabel}>Or describe the location</ThemedText>
        <TextInput
          style={[
            styles.textArea,
            { backgroundColor: cardSurface, color: theme.text },
          ]}
          value={photoDescription}
          onChangeText={setPhotoDescription}
          placeholder="e.g. Large rank with blue roof, next to the mall entrance..."
          placeholderTextColor={BrandColors.gray[500]}
          multiline
          textAlignVertical="top"
        />
      </View>

      <View style={styles.pointsIndicator}>
        <Feather name="zap" size={16} color={BrandColors.primary.gradientStart} />
        <ThemedText style={styles.pointsText}>
          +20 points for description (+40 once photo upload is live)
        </ThemedText>
      </View>

      <View style={styles.buttonRow}>
        <Pressable
          style={[
            styles.secondaryButton,
            {
              backgroundColor: cardSurface,
              borderColor: BrandColors.gray[200],
            },
          ]}
          onPress={handleSkipPhoto}
        >
          <ThemedText style={styles.secondaryButtonText}>Skip</ThemedText>
        </Pressable>
        <View style={{ flex: 2 }}>
          <GradientButton
            onPress={() => photoMutation.mutate()}
            disabled={!photoDescription || photoMutation.isPending}
            icon={photoMutation.isPending ? undefined : "check"}
            iconPosition="right"
          >
            {photoMutation.isPending ? "Saving..." : "Submit"}
          </GradientButton>
        </View>
      </View>
    </Animated.View>
  );

  const renderComplete = () => (
    <Animated.View entering={reducedMotion ? undefined : FadeInDown.duration(500)} style={styles.stepContainer}>
      <LinearGradient
        colors={[BrandColors.status.success, "#0F8F4F"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.successCard}
      >
        <View style={styles.celebrationIcon}>
          <Feather name="award" size={56} color="#FFFFFF" />
        </View>
        <ThemedText style={styles.successTitle}>Level up complete</ThemedText>
        <ThemedText style={styles.successSubtitle}>
          You've earned {earnedPoints} points today
        </ThemedText>
      </LinearGradient>

      {newBadges.length > 0 ? (
        <View style={[styles.badgesEarned, { backgroundColor: cardSurface }]}>
          <ThemedText style={styles.badgesTitle}>New badges earned</ThemedText>
          <View style={styles.badgesList}>
            {newBadges.map((badge) => {
              const info = BADGE_INFO[badge];
              if (!info) return null;
              return (
                <View
                  key={badge}
                  style={[styles.badgeItem, { backgroundColor: info.color }]}
                >
                  <Feather name={info.icon} size={20} color="#FFFFFF" />
                  <ThemedText style={styles.badgeLabel}>{info.label}</ThemedText>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={[styles.rewardsEarned, { backgroundColor: cardSurface }]}>
        <ThemedText style={styles.rewardsEarnedTitle}>Your rewards</ThemedText>
        <View style={styles.rewardItem}>
          <Feather name="check-circle" size={18} color={BrandColors.status.success} />
          <ThemedText style={styles.rewardText}>Entry into Weekly Haibo Raffle</ThemedText>
        </View>
        <View style={styles.rewardItem}>
          <Feather name="check-circle" size={18} color={BrandColors.status.success} />
          <ThemedText style={styles.rewardText}>See how your fares compare</ThemedText>
        </View>
        <View style={styles.rewardItem}>
          <Feather name="check-circle" size={18} color={BrandColors.status.success} />
          <ThemedText style={styles.rewardText}>
            Climb the City Explorer leaderboard
          </ThemedText>
        </View>
      </View>

      <View style={[styles.totalPoints, { backgroundColor: cardSurface }]}>
        <ThemedText style={styles.totalPointsLabel}>Total points</ThemedText>
        <ThemedText style={styles.totalPointsValue}>
          {(progress?.totalPoints || 0) + earnedPoints}
        </ThemedText>
      </View>

      <GradientButton
        onPress={handleStartOver}
        icon="refresh-cw"
        iconPosition="right"
      >
        Start another challenge
      </GradientButton>
    </Animated.View>
  );

  if (!deviceId || progressLoading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: theme.backgroundDefault },
        ]}
      >
        <ActivityIndicator size="large" color={BrandColors.primary.gradientStart} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={[styles.topBackButton, { backgroundColor: cardSurface }]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Feather name="arrow-left" size={20} color={BrandColors.gray[700]} />
        </Pressable>
        <View style={styles.topProgressTrack}>
          <Animated.View
            style={[
              styles.topProgressFill,
              { width: `${getProgressPercent()}%` },
            ]}
          />
        </View>
        <View style={[styles.pointsPill, { backgroundColor: cardSurface }]}>
          <Feather name="star" size={12} color={BrandColors.primary.gradientStart} />
          <ThemedText style={styles.pointsPillText}>
            {progress?.totalPoints || 0}
          </ThemedText>
        </View>
      </View>

      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
      >
        {currentStep === "welcome" && renderWelcome()}
        {currentStep === "fare" && renderFareStep()}
        {currentStep === "stop" && renderStopStep()}
        {currentStep === "photo" && renderPhotoStep()}
        {currentStep === "complete" && renderComplete()}
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  topBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  topProgressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: BrandColors.gray[200],
    overflow: "hidden",
  },
  topProgressFill: {
    height: "100%",
    backgroundColor: BrandColors.primary.gradientStart,
    borderRadius: 3,
  },
  pointsPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  pointsPillText: {
    ...Typography.label,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  stepContainer: {
    gap: Spacing.lg,
  },
  heroCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: "center",
    gap: Spacing.md,
    shadowColor: BrandColors.primary.gradientStart,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(255,255,255,0.22)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },
  heroTitle: {
    ...Typography.h1,
    color: "#FFFFFF",
    textAlign: "center",
  },
  heroSubtitle: {
    ...Typography.body,
    color: "rgba(255,255,255,0.92)",
    textAlign: "center",
    lineHeight: 22,
  },
  infoCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  infoDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BrandColors.gray[200],
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  infoText: {
    flex: 1,
  },
  infoLabel: {
    ...Typography.label,
    color: BrandColors.gray[600],
  },
  infoValue: {
    ...Typography.h4,
    fontWeight: "800",
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },
  rewardsPreview: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  rewardsTitle: {
    ...Typography.label,
    color: BrandColors.gray[700],
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  rewardItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: 4,
  },
  rewardText: {
    ...Typography.small,
    flex: 1,
  },
  levelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  levelBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: BrandColors.primary.gradientStart,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: BrandColors.primary.gradientStart,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  levelNumber: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },
  levelTitle: {
    ...Typography.h3,
    fontWeight: "800",
  },
  levelSubtitle: {
    ...Typography.small,
    color: BrandColors.gray[600],
  },
  questionCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  questionLabel: {
    ...Typography.label,
    color: BrandColors.gray[700],
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: "700",
  },
  questionText: {
    ...Typography.small,
    color: BrandColors.gray[700],
  },
  routeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  routeText: {
    ...Typography.body,
    fontWeight: "700",
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  hint: {
    ...Typography.label,
    color: BrandColors.gray[500],
    fontStyle: "italic",
  },
  optionsContainer: {
    gap: Spacing.sm,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  optionText: {
    ...Typography.body,
    fontWeight: "600",
    flex: 1,
  },
  fareInputCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: BrandColors.primary.gradientStart + "33",
  },
  fareLabel: {
    ...Typography.label,
    color: BrandColors.gray[700],
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: BrandColors.gray[200],
  },
  input: {
    ...Typography.body,
    flex: 1,
    height: 48,
  },
  textArea: {
    ...Typography.body,
    minHeight: 100,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.gray[200],
  },
  farePrefix: {
    ...Typography.h4,
    fontWeight: "800",
    color: BrandColors.primary.gradientStart,
  },
  pointsIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  pointsText: {
    ...Typography.label,
    fontWeight: "700",
    color: BrandColors.primary.gradientStart,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    ...Typography.small,
    fontWeight: "700",
    color: BrandColors.gray[700],
  },
  timeOptions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  timeOption: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  timeText: {
    ...Typography.label,
    fontWeight: "600",
    color: BrandColors.gray[700],
  },
  buttonRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  secondaryButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  secondaryButtonText: {
    ...Typography.body,
    fontWeight: "700",
    color: BrandColors.gray[700],
  },
  photoUploadArea: {
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderStyle: "dashed",
    gap: Spacing.sm,
  },
  photoIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: BrandColors.primary.gradientStart + "15",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  photoUploadText: {
    ...Typography.body,
    fontWeight: "700",
    color: BrandColors.primary.gradientStart,
  },
  comingSoonPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: BrandColors.gray[200],
  },
  comingSoonText: {
    ...Typography.label,
    fontWeight: "700",
    color: BrandColors.gray[600],
    textTransform: "uppercase",
  },
  successCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: "center",
    gap: Spacing.md,
    shadowColor: BrandColors.status.success,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  celebrationIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
    marginBottom: Spacing.sm,
  },
  successTitle: {
    ...Typography.h1,
    color: "#FFFFFF",
    textAlign: "center",
  },
  successSubtitle: {
    ...Typography.body,
    color: "rgba(255,255,255,0.92)",
    textAlign: "center",
  },
  badgesEarned: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  badgesTitle: {
    ...Typography.label,
    color: BrandColors.gray[700],
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: "700",
  },
  badgesList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  badgeItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  badgeLabel: {
    color: "#FFFFFF",
    ...Typography.small,
    fontWeight: "800",
  },
  rewardsEarned: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  rewardsEarnedTitle: {
    ...Typography.label,
    color: BrandColors.gray[700],
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  totalPoints: {
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  totalPointsLabel: {
    ...Typography.label,
    color: BrandColors.gray[600],
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: "700",
  },
  totalPointsValue: {
    fontSize: 48,
    fontWeight: "800",
    color: BrandColors.primary.gradientStart,
    marginTop: 4,
    fontVariant: ["tabular-nums"],
  },
});
