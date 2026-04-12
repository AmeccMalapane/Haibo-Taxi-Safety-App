import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  FadeIn,
  FadeInDown,
} from "react-native-reanimated";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, BrandColors } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

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

const BADGE_INFO = {
  "fare-detective": { icon: "dollar-sign", label: "Fare Detective", color: "#4CAF50" },
  "stop-spotter": { icon: "map-pin", label: "Stop Spotter", color: "#2196F3" },
  "direction-hero": { icon: "camera", label: "Direction Hero", color: "#FF9800" },
};

export default function CityExplorerScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<SurveyStep>("welcome");
  const [fareAmount, setFareAmount] = useState("");
  const [fareResponse, setFareResponse] = useState<"known" | "guessed" | "new_route" | null>(null);
  const [stopName, setStopName] = useState("");
  const [stopTip, setStopTip] = useState("");
  const [stopLandmark, setStopLandmark] = useState("");
  const [bestTime, setBestTime] = useState<"morning" | "afternoon" | "evening" | null>(null);
  const [photoDescription, setPhotoDescription] = useState("");
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [newBadges, setNewBadges] = useState<string[]>([]);
  
  const pulseAnim = useSharedValue(1);
  const progressAnim = useSharedValue(0);

  useEffect(() => {
    const getDeviceId = async () => {
      let id = await AsyncStorage.getItem("deviceId");
      if (!id) {
        id = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await AsyncStorage.setItem("deviceId", id);
      }
      setDeviceId(id);
    };
    getDeviceId();

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

  const { data: fareQuestion } = useQuery<FareQuestion>({
    queryKey: ["/api/explorer/fare-question"],
    enabled: currentStep === "fare",
  });

  const fareMutation = useMutation({
    mutationFn: async (data: { fareAmount?: number; responseType: string }) => {
      const response = await apiRequest("POST", "/api/explorer/fare-survey", {
        deviceId,
        originName: fareQuestion?.origin || "Unknown",
        destinationName: fareQuestion?.destination || "Unknown",
        fareAmount: data.fareAmount,
        responseType: data.responseType,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setEarnedPoints((prev) => prev + (data.pointsEarned || 10));
      queryClient.invalidateQueries({ queryKey: [`/api/explorer/progress/${deviceId}`] });
      triggerHaptic();
      setCurrentStep("stop");
    },
  });

  const stopMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/explorer/stop", {
        deviceId,
        stopName,
        latitude: -26.2041 + (Math.random() * 0.1 - 0.05),
        longitude: 28.0473 + (Math.random() * 0.1 - 0.05),
        tip: stopTip,
        landmark: stopLandmark,
        bestTime,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setEarnedPoints((prev) => prev + (data.pointsEarned || 30));
      queryClient.invalidateQueries({ queryKey: [`/api/explorer/progress/${deviceId}`] });
      triggerHaptic();
      setCurrentStep("photo");
    },
  });

  const photoMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/explorer/photo", {
        deviceId,
        description: photoDescription,
        landmark: stopLandmark,
        bestTime,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setEarnedPoints((prev) => prev + (data.pointsEarned || 20));
      queryClient.invalidateQueries({ queryKey: [`/api/explorer/progress/${deviceId}`] });
      triggerHaptic();
      checkForNewBadges();
      setCurrentStep("complete");
    },
  });

  const checkForNewBadges = () => {
    const badges: string[] = [];
    if ((progress?.faresVerified || 0) === 0) badges.push("fare-detective");
    if ((progress?.stopsAdded || 0) === 0) badges.push("stop-spotter");
    if ((progress?.photosUploaded || 0) === 0) badges.push("direction-hero");
    setNewBadges(badges);
  };

  const triggerHaptic = async () => {
    if (Platform.OS !== "web") {
      try {
        const Haptics = await import("expo-haptics");
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    }
  };

  const handleSkipStop = () => {
    setCurrentStep("photo");
  };

  const handleSkipPhoto = () => {
    checkForNewBadges();
    setCurrentStep("complete");
  };

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  const getProgressPercent = () => {
    switch (currentStep) {
      case "welcome": return 0;
      case "fare": return 33;
      case "stop": return 66;
      case "photo": return 85;
      case "complete": return 100;
      default: return 0;
    }
  };

  const renderWelcome = () => (
    <Animated.View entering={FadeInDown.duration(500)} style={styles.stepContainer}>
      <View style={[styles.heroCard, { backgroundColor: BrandColors.secondary.orange }]}>
        <Animated.View style={[styles.iconCircle, pulseStyle]}>
          <Feather name="map" size={48} color="#FFFFFF" />
        </Animated.View>
        <ThemedText style={styles.heroTitle}>Welcome, Explorer!</ThemedText>
        <ThemedText style={styles.heroSubtitle}>
          Help build the safest, smartest taxi network in the city. Every answer helps a fellow traveler!
        </ThemedText>
      </View>

      <View style={[styles.infoCard, { backgroundColor: theme.backgroundSecondary }]}>
        <View style={styles.infoRow}>
          <View style={[styles.badge, { backgroundColor: "#4CAF50" }]}>
            <Feather name="star" size={16} color="#FFFFFF" />
          </View>
          <View style={styles.infoText}>
            <ThemedText style={styles.infoLabel}>Your Points</ThemedText>
            <ThemedText style={styles.infoValue}>{progress?.totalPoints || 0}</ThemedText>
          </View>
        </View>
        <View style={styles.infoRow}>
          <View style={[styles.badge, { backgroundColor: "#2196F3" }]}>
            <Feather name="award" size={16} color="#FFFFFF" />
          </View>
          <View style={styles.infoText}>
            <ThemedText style={styles.infoLabel}>Badges Earned</ThemedText>
            <ThemedText style={styles.infoValue}>{progress?.badges?.length || 0}/3</ThemedText>
          </View>
        </View>
        <View style={styles.infoRow}>
          <View style={[styles.badge, { backgroundColor: "#FF9800" }]}>
            <Feather name="trending-up" size={16} color="#FFFFFF" />
          </View>
          <View style={styles.infoText}>
            <ThemedText style={styles.infoLabel}>Level</ThemedText>
            <ThemedText style={styles.infoValue}>{progress?.currentLevel || 1}</ThemedText>
          </View>
        </View>
      </View>

      <View style={styles.rewardsPreview}>
        <ThemedText style={styles.rewardsTitle}>What you can earn:</ThemedText>
        <View style={styles.rewardItem}>
          <Feather name="gift" size={18} color={BrandColors.secondary.orange} />
          <ThemedText style={styles.rewardText}>Entry into Weekly Haibo Raffle</ThemedText>
        </View>
        <View style={styles.rewardItem}>
          <Feather name="bar-chart-2" size={18} color={BrandColors.primary.blue} />
          <ThemedText style={styles.rewardText}>Compare your fares with others</ThemedText>
        </View>
        <View style={styles.rewardItem}>
          <Feather name="award" size={18} color={BrandColors.primary.green} />
          <ThemedText style={styles.rewardText}>Climb the City Explorer Leaderboard</ThemedText>
        </View>
      </View>

      <Pressable
        style={[styles.primaryButton, { backgroundColor: BrandColors.secondary.orange }]}
        onPress={() => setCurrentStep("fare")}
      >
        <ThemedText style={styles.primaryButtonText}>Start Challenge</ThemedText>
        <Feather name="arrow-right" size={20} color="#FFFFFF" />
      </Pressable>
    </Animated.View>
  );

  const renderFareStep = () => (
    <Animated.View entering={FadeInDown.duration(500)} style={styles.stepContainer}>
      <View style={styles.levelHeader}>
        <View style={[styles.levelBadge, { backgroundColor: "#4CAF50" }]}>
          <ThemedText style={styles.levelNumber}>1</ThemedText>
        </View>
        <View>
          <ThemedText style={styles.levelTitle}>Fare Detective</ThemedText>
          <ThemedText style={[styles.levelSubtitle, { color: theme.textSecondary }]}>
            Quick & easy - earn your first badge!
          </ThemedText>
        </View>
      </View>

      <View style={[styles.questionCard, { backgroundColor: theme.backgroundSecondary }]}>
        <ThemedText style={styles.questionLabel}>Quick Fare Check</ThemedText>
        <ThemedText style={styles.questionText}>
          If you were taking a taxi from:
        </ThemedText>
        <View style={[styles.routeBox, { backgroundColor: theme.backgroundDefault }]}>
          <Feather name="map-pin" size={16} color={BrandColors.secondary.orange} />
          <ThemedText style={styles.routeText}>{fareQuestion?.origin || "Loading..."}</ThemedText>
        </View>
        <ThemedText style={styles.questionText}>to:</ThemedText>
        <View style={[styles.routeBox, { backgroundColor: theme.backgroundDefault }]}>
          <Feather name="navigation" size={16} color={BrandColors.primary.blue} />
          <ThemedText style={styles.routeText}>{fareQuestion?.destination || "Loading..."}</ThemedText>
        </View>
        <ThemedText style={[styles.hint, { color: theme.textSecondary }]}>
          Hint: {fareQuestion?.hint || ""}
        </ThemedText>
      </View>

      <View style={styles.optionsContainer}>
        <Pressable
          style={[
            styles.optionButton,
            { backgroundColor: theme.backgroundSecondary },
            fareResponse === "known" && { borderColor: BrandColors.primary.green, borderWidth: 2 },
          ]}
          onPress={() => setFareResponse("known")}
        >
          <Feather name="check-circle" size={24} color={BrandColors.primary.green} />
          <ThemedText style={styles.optionText}>Yes, I know the fare</ThemedText>
        </Pressable>

        {fareResponse === "known" && (
          <View style={styles.fareInput}>
            <ThemedText style={styles.fareLabel}>Approximate fare (R):</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text }]}
              value={fareAmount}
              onChangeText={setFareAmount}
              keyboardType="numeric"
              placeholder="e.g., 50"
              placeholderTextColor={theme.textSecondary}
            />
          </View>
        )}

        <Pressable
          style={[
            styles.optionButton,
            { backgroundColor: theme.backgroundSecondary },
            fareResponse === "guessed" && { borderColor: BrandColors.secondary.orange, borderWidth: 2 },
          ]}
          onPress={() => setFareResponse("guessed")}
        >
          <Feather name="help-circle" size={24} color={BrandColors.secondary.orange} />
          <ThemedText style={styles.optionText}>No, but I can guess!</ThemedText>
        </Pressable>

        <Pressable
          style={[
            styles.optionButton,
            { backgroundColor: theme.backgroundSecondary },
            fareResponse === "new_route" && { borderColor: BrandColors.primary.blue, borderWidth: 2 },
          ]}
          onPress={() => setFareResponse("new_route")}
        >
          <Feather name="plus-circle" size={24} color={BrandColors.primary.blue} />
          <ThemedText style={styles.optionText}>This route is new to me</ThemedText>
        </Pressable>
      </View>

      <View style={styles.pointsIndicator}>
        <Feather name="zap" size={16} color={BrandColors.secondary.orange} />
        <ThemedText style={[styles.pointsText, { color: BrandColors.secondary.orange }]}>
          +10 points for answering
        </ThemedText>
      </View>

      <Pressable
        style={[
          styles.primaryButton,
          { backgroundColor: fareResponse ? BrandColors.secondary.orange : theme.textSecondary },
        ]}
        onPress={() => {
          if (fareResponse) {
            fareMutation.mutate({
              fareAmount: fareAmount ? parseFloat(fareAmount) : undefined,
              responseType: fareResponse,
            });
          }
        }}
        disabled={!fareResponse || fareMutation.isPending}
      >
        {fareMutation.isPending ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <ThemedText style={styles.primaryButtonText}>Continue</ThemedText>
            <Feather name="arrow-right" size={20} color="#FFFFFF" />
          </>
        )}
      </Pressable>
    </Animated.View>
  );

  const renderStopStep = () => (
    <Animated.View entering={FadeInDown.duration(500)} style={styles.stepContainer}>
      <View style={styles.levelHeader}>
        <View style={[styles.levelBadge, { backgroundColor: "#2196F3" }]}>
          <ThemedText style={styles.levelNumber}>2</ThemedText>
        </View>
        <View>
          <ThemedText style={styles.levelTitle}>Stop Spotter</ThemedText>
          <ThemedText style={[styles.levelSubtitle, { color: theme.textSecondary }]}>
            Help us map missing stops!
          </ThemedText>
        </View>
      </View>

      <View style={[styles.questionCard, { backgroundColor: theme.backgroundSecondary }]}>
        <ThemedText style={styles.questionLabel}>Missing Stop Scout</ThemedText>
        <ThemedText style={styles.questionText}>
          Is there a taxi stop or pickup spot near you that's NOT on our map?
        </ThemedText>
      </View>

      <View style={styles.inputGroup}>
        <ThemedText style={styles.inputLabel}>Name this stop:</ThemedText>
        <TextInput
          style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
          value={stopName}
          onChangeText={setStopName}
          placeholder="e.g., Corner of Main and Oak"
          placeholderTextColor={theme.textSecondary}
        />
      </View>

      <View style={styles.inputGroup}>
        <ThemedText style={styles.inputLabel}>Quick tip for travelers:</ThemedText>
        <TextInput
          style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
          value={stopTip}
          onChangeText={setStopTip}
          placeholder="e.g., Only taxis after 5 PM"
          placeholderTextColor={theme.textSecondary}
        />
      </View>

      <View style={styles.inputGroup}>
        <ThemedText style={styles.inputLabel}>Nearby landmark:</ThemedText>
        <TextInput
          style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
          value={stopLandmark}
          onChangeText={setStopLandmark}
          placeholder="e.g., Next to KFC"
          placeholderTextColor={theme.textSecondary}
        />
      </View>

      <View style={styles.inputGroup}>
        <ThemedText style={styles.inputLabel}>Best time to find taxis:</ThemedText>
        <View style={styles.timeOptions}>
          {(["morning", "afternoon", "evening"] as const).map((time) => (
            <Pressable
              key={time}
              style={[
                styles.timeOption,
                { backgroundColor: theme.backgroundSecondary },
                bestTime === time && { borderColor: BrandColors.primary.blue, borderWidth: 2 },
              ]}
              onPress={() => setBestTime(time)}
            >
              <Feather
                name={time === "morning" ? "sunrise" : time === "afternoon" ? "sun" : "sunset"}
                size={20}
                color={bestTime === time ? BrandColors.primary.blue : theme.text}
              />
              <ThemedText style={styles.timeText}>
                {time.charAt(0).toUpperCase() + time.slice(1)}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.pointsIndicator}>
        <Feather name="zap" size={16} color={BrandColors.secondary.orange} />
        <ThemedText style={[styles.pointsText, { color: BrandColors.secondary.orange }]}>
          +30 points for adding a stop
        </ThemedText>
      </View>

      <View style={styles.buttonRow}>
        <Pressable
          style={[styles.secondaryButton, { borderColor: theme.border }]}
          onPress={handleSkipStop}
        >
          <ThemedText style={styles.secondaryButtonText}>Skip</ThemedText>
        </Pressable>
        <Pressable
          style={[
            styles.primaryButton,
            styles.flexButton,
            { backgroundColor: stopName ? BrandColors.secondary.orange : theme.textSecondary },
          ]}
          onPress={() => stopMutation.mutate()}
          disabled={!stopName || stopMutation.isPending}
        >
          {stopMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <ThemedText style={styles.primaryButtonText}>Add Stop</ThemedText>
              <Feather name="map-pin" size={20} color="#FFFFFF" />
            </>
          )}
        </Pressable>
      </View>
    </Animated.View>
  );

  const renderPhotoStep = () => (
    <Animated.View entering={FadeInDown.duration(500)} style={styles.stepContainer}>
      <View style={styles.levelHeader}>
        <View style={[styles.levelBadge, { backgroundColor: "#FF9800" }]}>
          <ThemedText style={styles.levelNumber}>3</ThemedText>
        </View>
        <View>
          <ThemedText style={styles.levelTitle}>Direction Hero</ThemedText>
          <ThemedText style={[styles.levelSubtitle, { color: theme.textSecondary }]}>
            Add photos & details to level up!
          </ThemedText>
        </View>
      </View>

      <View style={[styles.questionCard, { backgroundColor: theme.backgroundSecondary }]}>
        <ThemedText style={styles.questionLabel}>Picture Patrol</ThemedText>
        <ThemedText style={styles.questionText}>
          Can you snap a quick photo of a taxi rank or stop near you? This helps travelers recognize the spot!
        </ThemedText>
      </View>

      <Pressable
        style={[styles.photoUploadArea, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
        onPress={() => {
          Alert.alert(
            "Photo Upload",
            "Photo upload coming soon! For now, add a description instead.",
            [{ text: "OK" }]
          );
        }}
      >
        <Feather name="camera" size={48} color={theme.textSecondary} />
        <ThemedText style={[styles.photoUploadText, { color: theme.textSecondary }]}>
          Tap to upload photo
        </ThemedText>
        <ThemedText style={[styles.photoUploadHint, { color: theme.textSecondary }]}>
          (Coming soon)
        </ThemedText>
      </Pressable>

      <View style={styles.inputGroup}>
        <ThemedText style={styles.inputLabel}>Or describe the location:</ThemedText>
        <TextInput
          style={[
            styles.input,
            styles.multilineInput,
            { backgroundColor: theme.backgroundSecondary, color: theme.text },
          ]}
          value={photoDescription}
          onChangeText={setPhotoDescription}
          placeholder="e.g., Large rank with blue roof, next to the mall entrance..."
          placeholderTextColor={theme.textSecondary}
          multiline
          numberOfLines={3}
        />
      </View>

      <View style={styles.pointsIndicator}>
        <Feather name="zap" size={16} color={BrandColors.secondary.orange} />
        <ThemedText style={[styles.pointsText, { color: BrandColors.secondary.orange }]}>
          +40 for photo, +20 for description
        </ThemedText>
      </View>

      <View style={styles.buttonRow}>
        <Pressable
          style={[styles.secondaryButton, { borderColor: theme.border }]}
          onPress={handleSkipPhoto}
        >
          <ThemedText style={styles.secondaryButtonText}>Skip</ThemedText>
        </Pressable>
        <Pressable
          style={[
            styles.primaryButton,
            styles.flexButton,
            { backgroundColor: photoDescription ? BrandColors.secondary.orange : theme.textSecondary },
          ]}
          onPress={() => photoMutation.mutate()}
          disabled={!photoDescription || photoMutation.isPending}
        >
          {photoMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <ThemedText style={styles.primaryButtonText}>Submit</ThemedText>
              <Feather name="check" size={20} color="#FFFFFF" />
            </>
          )}
        </Pressable>
      </View>
    </Animated.View>
  );

  const renderComplete = () => (
    <Animated.View entering={FadeInDown.duration(500)} style={styles.stepContainer}>
      <View style={[styles.successCard, { backgroundColor: BrandColors.primary.green }]}>
        <View style={styles.celebrationIcon}>
          <Feather name="award" size={64} color="#FFFFFF" />
        </View>
        <ThemedText style={styles.successTitle}>Level Up Complete!</ThemedText>
        <ThemedText style={styles.successSubtitle}>
          You've earned {earnedPoints} points today!
        </ThemedText>
      </View>

      {newBadges.length > 0 && (
        <View style={[styles.badgesEarned, { backgroundColor: theme.backgroundSecondary }]}>
          <ThemedText style={styles.badgesTitle}>New Badges Earned:</ThemedText>
          <View style={styles.badgesList}>
            {newBadges.map((badge) => {
              const info = BADGE_INFO[badge as keyof typeof BADGE_INFO];
              return (
                <View key={badge} style={[styles.badgeItem, { backgroundColor: info?.color || theme.backgroundDefault }]}>
                  <Feather name={info?.icon as any || "award"} size={24} color="#FFFFFF" />
                  <ThemedText style={styles.badgeLabel}>{info?.label || badge}</ThemedText>
                </View>
              );
            })}
          </View>
        </View>
      )}

      <View style={[styles.rewardsEarned, { backgroundColor: theme.backgroundSecondary }]}>
        <ThemedText style={styles.rewardsEarnedTitle}>Your Rewards:</ThemedText>
        <View style={styles.rewardItem}>
          <Feather name="check-circle" size={18} color={BrandColors.primary.green} />
          <ThemedText style={styles.rewardText}>Entry into Weekly Haibo Raffle</ThemedText>
        </View>
        <View style={styles.rewardItem}>
          <Feather name="check-circle" size={18} color={BrandColors.primary.green} />
          <ThemedText style={styles.rewardText}>See how your fares compare</ThemedText>
        </View>
        <View style={styles.rewardItem}>
          <Feather name="check-circle" size={18} color={BrandColors.primary.green} />
          <ThemedText style={styles.rewardText}>Climb the City Explorer Leaderboard</ThemedText>
        </View>
      </View>

      <View style={styles.totalPoints}>
        <ThemedText style={styles.totalPointsLabel}>Total Points</ThemedText>
        <ThemedText style={[styles.totalPointsValue, { color: BrandColors.secondary.orange }]}>
          {(progress?.totalPoints || 0) + earnedPoints}
        </ThemedText>
      </View>

      <Pressable
        style={[styles.primaryButton, { backgroundColor: BrandColors.secondary.orange }]}
        onPress={() => {
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
          queryClient.invalidateQueries({ queryKey: [`/api/explorer/progress/${deviceId}`] });
        }}
      >
        <ThemedText style={styles.primaryButtonText}>Start Another Challenge</ThemedText>
        <Feather name="refresh-cw" size={20} color="#FFFFFF" />
      </Pressable>
    </Animated.View>
  );

  if (!deviceId || progressLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BrandColors.secondary.orange} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.progressBar, { backgroundColor: theme.backgroundSecondary }]}>
        <View
          style={[
            styles.progressFill,
            { width: `${getProgressPercent()}%`, backgroundColor: BrandColors.secondary.orange },
          ]}
        />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {currentStep === "welcome" && renderWelcome()}
        {currentStep === "fare" && renderFareStep()}
        {currentStep === "stop" && renderStopStep()}
        {currentStep === "photo" && renderPhotoStep()}
        {currentStep === "complete" && renderComplete()}
      </ScrollView>
    </ThemedView>
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
  progressBar: {
    height: 4,
    width: "100%",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
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
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
  },
  heroSubtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
    lineHeight: 22,
  },
  infoCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
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
    fontSize: 14,
    opacity: 0.7,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: "600",
  },
  rewardsPreview: {
    gap: Spacing.sm,
  },
  rewardsTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  rewardItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  rewardText: {
    fontSize: 14,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
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
    justifyContent: "center",
    alignItems: "center",
  },
  levelNumber: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },
  levelTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  levelSubtitle: {
    fontSize: 14,
  },
  questionCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  questionLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  questionText: {
    fontSize: 14,
  },
  routeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  routeText: {
    fontSize: 16,
    fontWeight: "500",
  },
  hint: {
    fontSize: 12,
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
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: "transparent",
  },
  optionText: {
    fontSize: 16,
  },
  fareInput: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
  },
  fareLabel: {
    fontSize: 14,
  },
  input: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    fontSize: 16,
  },
  multilineInput: {
    height: 80,
    textAlignVertical: "top",
  },
  pointsIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
  },
  pointsText: {
    fontSize: 14,
    fontWeight: "500",
  },
  inputGroup: {
    gap: Spacing.xs,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  timeOptions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  timeOption: {
    flex: 1,
    alignItems: "center",
    gap: Spacing.xs,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: "transparent",
  },
  timeText: {
    fontSize: 12,
  },
  buttonRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  secondaryButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
  flexButton: {
    flex: 2,
  },
  photoUploadArea: {
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderStyle: "dashed",
    gap: Spacing.sm,
  },
  photoUploadText: {
    fontSize: 16,
  },
  photoUploadHint: {
    fontSize: 12,
  },
  successCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: "center",
    gap: Spacing.md,
  },
  celebrationIcon: {
    marginBottom: Spacing.md,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  successSubtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.9)",
  },
  badgesEarned: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  badgesTitle: {
    fontSize: 16,
    fontWeight: "600",
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
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  badgeLabel: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
  },
  rewardsEarned: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  rewardsEarnedTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  totalPoints: {
    alignItems: "center",
    gap: Spacing.xs,
  },
  totalPointsLabel: {
    fontSize: 14,
    opacity: 0.7,
  },
  totalPointsValue: {
    fontSize: 48,
    fontWeight: "700",
  },
});
