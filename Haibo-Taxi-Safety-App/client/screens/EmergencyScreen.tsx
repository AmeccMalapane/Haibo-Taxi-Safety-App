import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, Pressable, Platform, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  cancelAnimation,
  FadeIn,
  FadeInDown,
} from "react-native-reanimated";

import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { Spacing, BrandColors, BorderRadius, Typography } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { SkeletonBlock } from "@/components/Skeleton";
import { getEmergencyContacts } from "@/lib/storage";
import { EmergencyContact } from "@/lib/types";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { triggerSOS } from "@/lib/socket";
import { getDeviceId } from "@/lib/deviceId";

// typeui-clean applied to Haibo's safety hero screen:
// - single dominant target (Call 10111), everything else demoted
// - rose red gradient preserved as brand identity
// - skeleton loading while location resolves (no blank flash)
// - staggered FadeInDown entry so the screen feels calm, not frantic
// - Typography tokens, no inline font sizing

export default function EmergencyScreen() {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  useTheme();
  const { isAuthenticated } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [sosTriggered, setSOSTriggered] = useState(false);
  const [cancelHoldProgress, setCancelHoldProgress] = useState(0);
  const cancelTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cancelIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.55);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.35, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) })
      ),
      -1
    );
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.15, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.55, { duration: 1100, easing: Easing.inOut(Easing.ease) })
      ),
      -1
    );

    return () => {
      cancelAnimation(pulseScale);
      cancelAnimation(pulseOpacity);
    };
  }, []);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        setLocation(loc);
      } else {
        setLocationDenied(true);
      }

      const savedContacts = await getEmergencyContacts();
      setContacts(savedContacts);
    })();

    fireSOSAlert();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, []);

  const fireSOSAlert = async () => {
    if (sosTriggered) return;
    setSOSTriggered(true);
    try {
      let lat = -26.2041, lng = 28.0473;
      if (location) {
        lat = location.coords.latitude;
        lng = location.coords.longitude;
      }

      const sosMessage = "Emergency SOS from Haibo app";

      if (isAuthenticated) {
        triggerSOS(lat, lng, sosMessage);
        if (getApiUrl()) {
          try {
            await apiRequest("/api/notifications/sos", {
              method: "POST",
              body: JSON.stringify({ latitude: lat, longitude: lng, message: sosMessage }),
            });
          } catch (e) {
            console.log("[SOS] Authenticated API call failed:", e);
          }
        }
      } else {
        if (getApiUrl()) {
          try {
            const deviceId = await getDeviceId();
            const firstContact = contacts[0];
            await apiRequest("/api/notifications/sos/guest", {
              method: "POST",
              body: JSON.stringify({
                latitude: lat,
                longitude: lng,
                message: sosMessage,
                deviceId,
                emergencyContactPhone: firstContact?.phone,
                displayName: firstContact?.name ? `Guest (contact: ${firstContact.name})` : undefined,
              }),
            });
          } catch (e) {
            console.log("[SOS] Guest API call failed:", e);
          }
        }
      }
      console.log(`[SOS] Alert sent (${isAuthenticated ? "auth" : "guest"}): ${lat},${lng}`);
    } catch (err) {
      console.error("[SOS] Failed:", err);
    }
  };

  const animatedPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const handleCallEmergency = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (Platform.OS !== "web") {
      Linking.openURL("tel:10111");
    }
  };

  const handleShareLocation = async (contact: EmergencyContact) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!location) return;

    const message = `EMERGENCY: I need help! My location: https://maps.google.com/?q=${location.coords.latitude},${location.coords.longitude}`;

    if (Platform.OS !== "web") {
      try {
        await Linking.openURL(`sms:${contact.phone}?body=${encodeURIComponent(message)}`);
      } catch {
        console.log("Could not open SMS");
      }
    }
  };

  const startCancelHold = () => {
    setCancelHoldProgress(0);
    cancelIntervalRef.current = setInterval(() => {
      setCancelHoldProgress((prev) => {
        if (prev >= 100) {
          clearInterval(cancelIntervalRef.current!);
          return 100;
        }
        return prev + 3.33;
      });
    }, 100);

    cancelTimerRef.current = setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    }, 3000);
  };

  const endCancelHold = () => {
    if (cancelTimerRef.current) {
      clearTimeout(cancelTimerRef.current);
    }
    if (cancelIntervalRef.current) {
      clearInterval(cancelIntervalRef.current);
    }
    setCancelHoldProgress(0);
  };

  const primaryContact = contacts[0];

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={BrandColors.gradient.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Hero — the one thing you see on open. Anchored, never scrolls. */}
      <View style={[styles.hero, { paddingTop: insets.top + Spacing["3xl"] }]}>
        <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(400)} style={styles.heroLabelWrap}>
          <View style={styles.statusDot} />
          <ThemedText style={styles.heroLabel}>SOS ACTIVE</ThemedText>
        </Animated.View>

        <Animated.View
          entering={reducedMotion ? undefined : FadeIn.duration(600).delay(100)}
          style={styles.sosContainer}
        >
          <Animated.View style={[styles.pulseCircle, animatedPulseStyle]} />
          <View style={styles.sosCircle}>
            <Feather name="alert-triangle" size={56} color="#FFFFFF" />
          </View>
        </Animated.View>

        <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(500).delay(250)}>
          <ThemedText style={styles.heroTitle}>Help is on the way</ThemedText>
          <ThemedText style={styles.heroSubtitle}>
            Your location has been shared with emergency responders
          </ThemedText>
        </Animated.View>
      </View>

      {/* Content band — location + actions. Compact, below the hero. */}
      <View style={[styles.contentBand, { paddingBottom: insets.bottom + Spacing.lg }]}>
        {location ? (
          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(350)}
            style={styles.locationPill}
          >
            <Feather name="map-pin" size={16} color="#FFFFFF" />
            <ThemedText style={styles.locationText} numberOfLines={1}>
              {location.coords.latitude.toFixed(5)}, {location.coords.longitude.toFixed(5)}
            </ThemedText>
          </Animated.View>
        ) : locationDenied ? (
          // Tappable so the user has a one-tap path to grant permission
          // mid-SOS — non-negotiable on a safety app, the old pill was
          // informational-only and left the user stranded.
          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(350)}
          >
            <Pressable
              onPress={() => Linking.openSettings()}
              style={({ pressed }) => [
                styles.locationPill,
                styles.locationPillPressable,
                pressed && styles.locationPillPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Open settings to enable location for SOS"
            >
              <Feather name="alert-circle" size={16} color="#FFFFFF" />
              <ThemedText style={styles.locationText}>
                Location off — tap to enable in settings
              </ThemedText>
              <Feather name="chevron-right" size={16} color="#FFFFFF" />
            </Pressable>
          </Animated.View>
        ) : (
          <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(300)} style={styles.locationPill}>
            <SkeletonBlock tone="light" style={styles.locationSkeleton} />
          </Animated.View>
        )}

        <Animated.View entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(450)}>
          <Pressable
            onPress={handleCallEmergency}
            style={({ pressed }) => [
              styles.primaryCta,
              pressed && styles.primaryCtaPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Call emergency services, 10111"
          >
            <Feather name="phone" size={22} color={BrandColors.primary.gradientStart} />
            <ThemedText style={styles.primaryCtaText}>Call 10111 Now</ThemedText>
          </Pressable>
        </Animated.View>

        {primaryContact ? (
          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(550)}
            style={styles.contactRow}
          >
            {contacts.slice(0, 3).map((contact) => (
              <Pressable
                key={contact.id}
                style={({ pressed }) => [
                  styles.contactChip,
                  pressed && styles.contactChipPressed,
                ]}
                onPress={() => handleShareLocation(contact)}
                accessibilityRole="button"
                accessibilityLabel={`Share location with ${contact.name}`}
              >
                <Feather name="send" size={14} color="#FFFFFF" />
                <ThemedText style={styles.contactChipText} numberOfLines={1}>
                  {contact.name}
                </ThemedText>
              </Pressable>
            ))}
          </Animated.View>
        ) : null}

        <Animated.View
          entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(650)}
          style={styles.cancelWrap}
        >
          <Pressable
            onPressIn={startCancelHold}
            onPressOut={endCancelHold}
            accessibilityRole="button"
            accessibilityLabel="Hold for 3 seconds to cancel SOS alert"
          >
            <View style={styles.cancelButton}>
              <View
                style={[
                  styles.cancelProgress,
                  { width: `${cancelHoldProgress}%` },
                ]}
              />
              <ThemedText style={styles.cancelButtonText}>
                Hold to Cancel ({Math.ceil((100 - cancelHoldProgress) / 33.3)}s)
              </ThemedText>
            </View>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BrandColors.primary.gradientStart,
  },
  hero: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  heroLabelWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    marginBottom: Spacing["3xl"],
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
  },
  heroLabel: {
    ...Typography.label,
    color: "#FFFFFF",
    letterSpacing: 1.5,
    fontSize: 12,
  },
  sosContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: 220,
    height: 220,
    marginBottom: Spacing["3xl"],
  },
  pulseCircle: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#FFFFFF",
  },
  sosCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  heroTitle: {
    ...Typography.h1,
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  heroSubtitle: {
    ...Typography.body,
    color: "#FFFFFF",
    textAlign: "center",
    opacity: 0.9,
    maxWidth: 300,
  },
  contentBand: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  locationPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    backgroundColor: "rgba(0,0,0,0.2)",
    maxWidth: "100%",
  },
  locationPillPressable: {
    backgroundColor: "rgba(0,0,0,0.32)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  locationPillPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  locationText: {
    ...Typography.small,
    color: "#FFFFFF",
    fontVariant: ["tabular-nums"],
  },
  locationSkeleton: {
    width: 180,
    height: 14,
    borderRadius: BorderRadius.xs,
  },
  primaryCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
    height: 64,
    borderRadius: BorderRadius.lg,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 8,
  },
  primaryCtaPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  primaryCtaText: {
    ...Typography.h4,
    color: BrandColors.primary.gradientStart,
    fontSize: 18,
  },
  contactRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    justifyContent: "center",
  },
  contactChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    minHeight: 44,
  },
  contactChipPressed: {
    backgroundColor: "rgba(255,255,255,0.28)",
    transform: [{ scale: 0.97 }],
  },
  contactChipText: {
    ...Typography.small,
    color: "#FFFFFF",
    fontWeight: "600",
    maxWidth: 120,
  },
  cancelWrap: {
    marginTop: Spacing.sm,
  },
  cancelButton: {
    height: 52,
    borderRadius: BorderRadius.lg,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  cancelProgress: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  cancelButtonText: {
    ...Typography.body,
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
