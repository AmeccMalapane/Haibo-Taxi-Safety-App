import React, { useState, useEffect } from "react";
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/hooks/useTheme";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { Spacing, BrandColors, BorderRadius, Typography } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { GradientButton } from "@/components/GradientButton";
import { getEmergencyContacts, saveActiveTrip, generateId } from "@/lib/storage";
import { EmergencyContact, TripShare } from "@/lib/types";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function TripShareScreen() {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();

  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isLoadingContacts, setIsLoadingContacts] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const savedContacts = await getEmergencyContacts();
        setContacts(savedContacts);
      } finally {
        setIsLoadingContacts(false);
      }

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setLocation(loc);
        }
      } catch {
        // silent — GPS is optional at this stage
      }
    })();
  }, []);

  const toggleContact = (contactId: string) => {
    Haptics.selectionAsync();
    setSelectedContacts((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleStartSharing = async () => {
    if (selectedContacts.length === 0) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsSharing(true);

    const trip: TripShare = {
      id: generateId(),
      isActive: true,
      startTime: new Date().toISOString(),
      sharedWithContactIds: selectedContacts,
      currentLocation: location
        ? {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          }
        : undefined,
    };

    await saveActiveTrip(trip);

    const selectedContactDetails = contacts.filter((c) =>
      selectedContacts.includes(c.id)
    );

    if (location && Platform.OS !== "web") {
      const message = `I'm sharing my taxi trip with you. Track my journey: https://maps.google.com/?q=${location.coords.latitude},${location.coords.longitude}`;
      for (const contact of selectedContactDetails) {
        try {
          await Linking.openURL(
            `sms:${contact.phone}?body=${encodeURIComponent(message)}`
          );
        } catch {
          // silent — SMS app may be unavailable
        }
      }
    }

    setTimeout(() => {
      navigation.goBack();
    }, 1500);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <LinearGradient
        colors={BrandColors.gradient.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + Spacing.md }]}
      >
        <View style={styles.heroTopRow}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.heroCloseButton}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Feather name="x" size={22} color="#FFFFFF" />
          </Pressable>
          <View style={styles.heroBadge}>
            <Feather name="share-2" size={16} color="#FFFFFF" />
            <ThemedText style={styles.heroBadgeText}>Trip share</ThemedText>
          </View>
          <View style={styles.heroSpacer} />
        </View>
        <ThemedText style={styles.heroTitle}>Ride with backup.</ThemedText>
        <ThemedText style={styles.heroSubtitle}>
          Your chosen people track your live location until you arrive.
        </ThemedText>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing["3xl"] },
        ]}
      >
        <Animated.View entering={reducedMotion ? undefined : FadeInDown.duration(400)} style={styles.locationCard}>
          <View
            style={[
              styles.locationIconWrap,
              {
                backgroundColor: location
                  ? BrandColors.status.success + "15"
                  : BrandColors.gray[100],
              },
            ]}
          >
            <Feather
              name="map-pin"
              size={18}
              color={location ? BrandColors.status.success : BrandColors.gray[600]}
            />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.locationLabel}>Current location</ThemedText>
            {location ? (
              <ThemedText style={styles.locationValue}>
                {location.coords.latitude.toFixed(4)}, {location.coords.longitude.toFixed(4)}
              </ThemedText>
            ) : (
              <ThemedText style={styles.locationMuted}>Getting your location...</ThemedText>
            )}
          </View>
          {location ? (
            <View style={styles.gpsPill}>
              <View style={styles.statusDot} />
              <ThemedText style={styles.gpsPillText}>GPS</ThemedText>
            </View>
          ) : null}
        </Animated.View>

        <Animated.View entering={reducedMotion ? undefined : FadeInDown.delay(80).duration(400)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionLabel}>Who should track you?</ThemedText>
            {contacts.length > 0 ? (
              <ThemedText style={styles.countPill}>
                {selectedContacts.length}/{contacts.length}
              </ThemedText>
            ) : null}
          </View>

          {isLoadingContacts ? (
            <View style={styles.emptyCard}>
              <ThemedText style={styles.emptyText}>Loading contacts...</ThemedText>
            </View>
          ) : contacts.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <Feather name="users" size={24} color={BrandColors.primary.gradientStart} />
              </View>
              <ThemedText style={styles.emptyTitle}>No emergency contacts yet</ThemedText>
              <ThemedText style={styles.emptySubtitle}>
                Add the people you trust so they can track your ride when you need them.
              </ThemedText>
              <Pressable
                style={styles.emptyCta}
                onPress={() => navigation.navigate("EmergencyContacts")}
              >
                <Feather name="user-plus" size={16} color={BrandColors.primary.gradientStart} />
                <ThemedText style={styles.emptyCtaText}>Add contact</ThemedText>
              </Pressable>
            </View>
          ) : (
            contacts.map((contact, index) => {
              const isSelected = selectedContacts.includes(contact.id);
              return (
                <Animated.View
                  key={contact.id}
                  entering={reducedMotion ? undefined : FadeInDown.delay(120 + index * 40).duration(400)}
                >
                  <Pressable
                    onPress={() => toggleContact(contact.id)}
                    style={[
                      styles.contactCard,
                      isSelected && styles.contactCardActive,
                    ]}
                  >
                    <View style={styles.contactAvatar}>
                      <ThemedText style={styles.contactInitials}>
                        {getInitials(contact.name)}
                      </ThemedText>
                    </View>
                    <View style={styles.contactInfo}>
                      <ThemedText style={styles.contactName}>{contact.name}</ThemedText>
                      <ThemedText style={styles.contactMeta}>
                        {contact.relationship} · {contact.phone}
                      </ThemedText>
                    </View>
                    <View
                      style={[
                        styles.checkbox,
                        isSelected && styles.checkboxActive,
                      ]}
                    >
                      {isSelected ? (
                        <Feather name="check" size={16} color="#FFFFFF" />
                      ) : null}
                    </View>
                  </Pressable>
                </Animated.View>
              );
            })
          )}
        </Animated.View>

        {contacts.length > 0 ? (
          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.delay(200).duration(400)}
            style={styles.ctaWrap}
          >
            {isSharing ? (
              <View style={styles.sharingIndicator}>
                <View style={styles.sharingDot} />
                <ThemedText style={styles.sharingText}>Trip sharing started!</ThemedText>
              </View>
            ) : (
              <>
                <GradientButton
                  onPress={handleStartSharing}
                  disabled={selectedContacts.length === 0}
                  icon="share-2"
                >
                  {selectedContacts.length === 0
                    ? "Select at least one contact"
                    : `Start sharing with ${selectedContacts.length} ${selectedContacts.length === 1 ? "contact" : "contacts"}`}
                </GradientButton>
                <ThemedText style={styles.footerNote}>
                  Selected contacts get an SMS with a live map link.
                </ThemedText>
              </>
            )}
          </Animated.View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  hero: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing["3xl"],
    borderBottomLeftRadius: BorderRadius["2xl"],
    borderBottomRightRadius: BorderRadius["2xl"],
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  heroCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  heroBadgeText: {
    ...Typography.label,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  heroSpacer: {
    width: 40,
  },
  heroTitle: {
    ...Typography.h1,
    color: "#FFFFFF",
  },
  heroSubtitle: {
    ...Typography.body,
    color: "rgba(255, 255, 255, 0.9)",
    marginTop: Spacing.xs,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    marginTop: -Spacing["2xl"],
  },
  locationCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    backgroundColor: "#FFFFFF",
    borderRadius: BorderRadius.md,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  locationIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  locationLabel: {
    ...Typography.small,
    color: BrandColors.gray[600],
  },
  locationValue: {
    ...Typography.body,
    fontWeight: "700",
    color: BrandColors.gray[900],
    fontVariant: ["tabular-nums"],
  },
  locationMuted: {
    ...Typography.body,
    color: BrandColors.gray[500],
  },
  gpsPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: BrandColors.status.success + "15",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BrandColors.status.success,
  },
  gpsPillText: {
    ...Typography.label,
    fontWeight: "700",
    color: BrandColors.status.success,
  },
  section: {
    marginTop: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  sectionLabel: {
    ...Typography.label,
    color: BrandColors.gray[700],
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  countPill: {
    ...Typography.label,
    fontWeight: "700",
    color: BrandColors.primary.gradientStart,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    backgroundColor: BrandColors.primary.gradientStart + "12",
    overflow: "hidden",
  },
  emptyCard: {
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.md,
    backgroundColor: "#FFFFFF",
    gap: Spacing.sm,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: BrandColors.primary.gradientStart + "12",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    ...Typography.h4,
    color: BrandColors.gray[900],
  },
  emptySubtitle: {
    ...Typography.small,
    color: BrandColors.gray[600],
    textAlign: "center",
    paddingHorizontal: Spacing.md,
  },
  emptyText: {
    ...Typography.body,
    color: BrandColors.gray[600],
  },
  emptyCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: BrandColors.primary.gradientStart + "12",
    borderWidth: 1,
    borderColor: BrandColors.primary.gradientStart + "33",
  },
  emptyCtaText: {
    ...Typography.small,
    fontWeight: "700",
    color: BrandColors.primary.gradientStart,
  },
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    backgroundColor: "#FFFFFF",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.gray[200],
    marginBottom: Spacing.sm,
  },
  contactCardActive: {
    borderColor: BrandColors.primary.gradientStart,
    backgroundColor: BrandColors.primary.gradientStart + "08",
  },
  contactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BrandColors.primary.gradientStart + "12",
    alignItems: "center",
    justifyContent: "center",
  },
  contactInitials: {
    ...Typography.body,
    fontWeight: "700",
    color: BrandColors.primary.gradientStart,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    ...Typography.body,
    fontWeight: "700",
    color: BrandColors.gray[900],
  },
  contactMeta: {
    ...Typography.small,
    color: BrandColors.gray[600],
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: BrandColors.gray[300],
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: {
    backgroundColor: BrandColors.primary.gradientStart,
    borderColor: BrandColors.primary.gradientStart,
  },
  ctaWrap: {
    marginTop: Spacing.xl,
  },
  footerNote: {
    ...Typography.small,
    color: BrandColors.gray[600],
    textAlign: "center",
    marginTop: Spacing.md,
  },
  sharingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    backgroundColor: BrandColors.status.success + "12",
    borderRadius: BorderRadius.md,
  },
  sharingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: BrandColors.status.success,
  },
  sharingText: {
    ...Typography.body,
    fontWeight: "700",
    color: BrandColors.status.success,
  },
});
