import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, Pressable, Platform, Linking, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
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
} from "react-native-reanimated";

import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { getEmergencyContacts } from "@/lib/storage";
import { EmergencyContact } from "@/lib/types";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { triggerSOS } from "@/lib/socket";
import { getDeviceId } from "@/lib/deviceId";

export default function EmergencyScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { isAuthenticated } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [sosTriggered, setSOSTriggered] = useState(false);
  const [cancelHoldProgress, setCancelHoldProgress] = useState(0);
  const cancelTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cancelIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.6);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.3, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1
    );
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.2, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.6, { duration: 1000, easing: Easing.inOut(Easing.ease) })
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
      }

      const savedContacts = await getEmergencyContacts();
      setContacts(savedContacts);
    })();

    // Trigger SOS on screen open
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
        // Authenticated path: real-time WebSocket + authenticated REST.
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
        // Guest path: no Socket.IO (requires token), hit the public REST endpoint
        // so admins still get notified and the event is audited.
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

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: BrandColors.status.emergency,
        },
      ]}
    >
      <ScrollView 
        contentContainerStyle={{
          paddingTop: insets.top + Spacing.xl,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Feather name="alert-triangle" size={32} color="#FFFFFF" />
          <ThemedText style={styles.headerTitle}>SOS ACTIVE</ThemedText>
          <ThemedText style={styles.headerSubtitle}>
            Help is being notified
          </ThemedText>
        </View>

        <View style={styles.sosContainer}>
          <Animated.View style={[styles.pulseCircle, animatedPulseStyle]} />
          <View style={styles.sosCircle}>
            <Feather name="alert-triangle" size={64} color="#FFFFFF" />
          </View>
        </View>

        {location ? (
          <View style={styles.locationCard}>
            <Feather name="map-pin" size={20} color="#FFFFFF" />
            <View style={styles.locationInfo}>
              <ThemedText style={styles.locationLabel}>Your Location</ThemedText>
              <ThemedText style={styles.locationCoords}>
                {location.coords.latitude.toFixed(6)}, {location.coords.longitude.toFixed(6)}
              </ThemedText>
            </View>
          </View>
        ) : null}

        <View style={styles.quickLinksRow}>
          <Pressable 
            style={styles.quickLinkCard} 
            onPress={() => navigation.navigate("EmergencyServices")}
          >
            <Feather name="phone-call" size={24} color="#FFFFFF" />
            <ThemedText style={styles.quickLinkLabel}>Services</ThemedText>
          </Pressable>
          <Pressable 
            style={styles.quickLinkCard} 
            onPress={() => navigation.navigate("SafetyDirectory")}
          >
            <Feather name="book-open" size={24} color="#FFFFFF" />
            <ThemedText style={styles.quickLinkLabel}>Directory</ThemedText>
          </Pressable>
        </View>

        <View style={styles.actionsContainer}>
          <Pressable style={styles.emergencyCallButton} onPress={handleCallEmergency}>
            <Feather name="phone" size={24} color={BrandColors.status.emergency} />
            <ThemedText style={styles.emergencyCallText}>Call Emergency (10111)</ThemedText>
          </Pressable>

          {contacts.length > 0 ? (
            <View style={styles.contactsSection}>
              <ThemedText style={styles.contactsTitle}>Alert Emergency Contacts</ThemedText>
              {contacts.slice(0, 3).map((contact) => (
                <Pressable
                  key={contact.id}
                  style={styles.contactButton}
                  onPress={() => handleShareLocation(contact)}
                >
                  <View style={styles.contactInfo}>
                    <ThemedText style={styles.contactName}>{contact.name}</ThemedText>
                    <ThemedText style={styles.contactRelation}>{contact.relationship}</ThemedText>
                  </View>
                  <Feather name="send" size={20} color="#FFFFFF" />
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.noContactsCard}>
              <Feather name="users" size={24} color="rgba(255,255,255,0.7)" />
              <ThemedText style={styles.noContactsText}>
                No emergency contacts set up. Add contacts in your profile.
              </ThemedText>
            </View>
          )}
        </View>

        <Pressable
          style={styles.cancelButtonContainer}
          onPressIn={startCancelHold}
          onPressOut={endCancelHold}
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: Spacing.md,
  },
  headerSubtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.8)",
    marginTop: Spacing.xs,
  },
  sosContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: Spacing["3xl"],
  },
  pulseCircle: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "#FFFFFF",
  },
  sosCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "#FFFFFF",
  },
  locationCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.lg,
  },
  locationInfo: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  locationCoords: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "500",
  },
  quickLinksRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  quickLinkCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  quickLinkLabel: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  actionsContainer: {
    flex: 1,
  },
  emergencyCallButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
  },
  emergencyCallText: {
    fontSize: 18,
    fontWeight: "700",
    color: BrandColors.status.emergency,
  },
  contactsSection: {
    marginTop: Spacing.xl,
  },
  contactsTitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: Spacing.md,
  },
  contactButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  contactRelation: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
  },
  noContactsCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.xl,
    gap: Spacing.md,
  },
  noContactsText: {
    flex: 1,
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
  },
  cancelButtonContainer: {
    marginTop: Spacing.lg,
  },
  cancelButton: {
    height: 56,
    borderRadius: BorderRadius.sm,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  cancelProgress: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
