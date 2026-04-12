import React, { useState, useEffect } from "react";
import { View, ScrollView, Pressable, StyleSheet, Platform, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { getEmergencyContacts, saveActiveTrip, generateId } from "@/lib/storage";
import { EmergencyContact, TripShare } from "@/lib/types";

export default function TripShareScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation();

  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    (async () => {
      const savedContacts = await getEmergencyContacts();
      setContacts(savedContacts);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setLocation(loc);
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
      const message = `I'm sharing my taxi trip with you. Track my journey here: https://maps.google.com/?q=${location.coords.latitude},${location.coords.longitude}`;

      for (const contact of selectedContactDetails) {
        try {
          await Linking.openURL(
            `sms:${contact.phone}?body=${encodeURIComponent(message)}`
          );
        } catch {
          console.log("Could not open SMS");
        }
      }
    }

    setTimeout(() => {
      navigation.goBack();
    }, 1500);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: Spacing.lg,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
    >
      <View style={[styles.infoCard, { backgroundColor: theme.backgroundDefault }]}>
        <View style={styles.infoIcon}>
          <Feather name="share-2" size={24} color={BrandColors.primary.blue} />
        </View>
        <View style={styles.infoContent}>
          <ThemedText style={styles.infoTitle}>Share Your Trip</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            Your selected contacts will receive your live location during your
            journey. They can track you in real-time.
          </ThemedText>
        </View>
      </View>

      {location ? (
        <View style={[styles.locationCard, { backgroundColor: theme.backgroundDefault }]}>
          <Feather name="map-pin" size={18} color={BrandColors.primary.green} />
          <View style={styles.locationInfo}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Current Location
            </ThemedText>
            <ThemedText style={styles.locationText}>
              {location.coords.latitude.toFixed(4)}, {location.coords.longitude.toFixed(4)}
            </ThemedText>
          </View>
          <View style={styles.locationStatus}>
            <View style={styles.statusDot} />
            <ThemedText type="small" style={{ color: BrandColors.primary.green }}>
              GPS Active
            </ThemedText>
          </View>
        </View>
      ) : (
        <View style={[styles.locationCard, { backgroundColor: theme.backgroundDefault }]}>
          <Feather name="map-pin" size={18} color={BrandColors.secondary.orange} />
          <ThemedText style={{ color: theme.textSecondary, flex: 1 }}>
            Getting your location...
          </ThemedText>
        </View>
      )}

      <View style={styles.contactsSection}>
        <ThemedText style={styles.sectionTitle}>Select Contacts to Notify</ThemedText>

        {contacts.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.backgroundDefault }]}>
            <Feather name="users" size={32} color={theme.textSecondary} />
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              No emergency contacts saved
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center" }}>
              Add emergency contacts in your profile to share your trip with them.
            </ThemedText>
          </View>
        ) : (
          contacts.map((contact) => {
            const isSelected = selectedContacts.includes(contact.id);
            return (
              <Pressable
                key={contact.id}
                style={[
                  styles.contactCard,
                  {
                    backgroundColor: theme.backgroundDefault,
                    borderColor: isSelected
                      ? BrandColors.primary.blue
                      : "transparent",
                  },
                ]}
                onPress={() => toggleContact(contact.id)}
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      backgroundColor: isSelected
                        ? BrandColors.primary.blue
                        : "transparent",
                      borderColor: isSelected
                        ? BrandColors.primary.blue
                        : theme.border,
                    },
                  ]}
                >
                  {isSelected ? (
                    <Feather name="check" size={14} color="#FFFFFF" />
                  ) : null}
                </View>
                <View style={styles.contactInfo}>
                  <ThemedText style={styles.contactName}>{contact.name}</ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    {contact.relationship} - {contact.phone}
                  </ThemedText>
                </View>
              </Pressable>
            );
          })
        )}
      </View>

      {contacts.length > 0 ? (
        <View style={styles.buttonContainer}>
          {isSharing ? (
            <View style={styles.sharingIndicator}>
              <Feather name="check-circle" size={24} color={BrandColors.primary.green} />
              <ThemedText style={[styles.sharingText, { color: BrandColors.primary.green }]}>
                Trip sharing started!
              </ThemedText>
            </View>
          ) : (
            <Button
              onPress={handleStartSharing}
              disabled={selectedContacts.length === 0}
            >
              Start Sharing ({selectedContacts.length} contact
              {selectedContacts.length !== 1 ? "s" : ""})
            </Button>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  infoCard: {
    flexDirection: "row",
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.lg,
  },
  infoIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(25, 118, 210, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  locationCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  locationInfo: {
    flex: 1,
  },
  locationText: {
    fontWeight: "500",
  },
  locationStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BrandColors.primary.green,
  },
  contactsSection: {},
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  emptyCard: {
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
  },
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
    borderWidth: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontWeight: "600",
    marginBottom: 2,
  },
  buttonContainer: {
    marginTop: Spacing.xl,
  },
  sharingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  sharingText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
