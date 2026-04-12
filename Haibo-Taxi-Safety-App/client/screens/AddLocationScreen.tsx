import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import type { LocationType, NewLocationData } from "@/lib/types";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type AddLocationRouteProp = RouteProp<RootStackParamList, "AddLocation">;

const locationTypes: { type: LocationType; label: string; icon: keyof typeof Feather.glyphMap; color: string }[] = [
  { type: "rank", label: "Taxi Rank", icon: "home", color: BrandColors.primary.blue },
  { type: "formal_stop", label: "Formal Stop", icon: "map-pin", color: BrandColors.secondary.green },
  { type: "informal_stop", label: "Informal Stop", icon: "navigation", color: BrandColors.secondary.orange },
  { type: "landmark", label: "Landmark", icon: "flag", color: "#9B59B6" },
  { type: "interchange", label: "Interchange", icon: "repeat", color: "#E74C3C" },
];

export default function AddLocationScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<AddLocationRouteProp>();
  const queryClient = useQueryClient();

  const passedCoords = route.params;
  const [name, setName] = useState("");
  const [type, setType] = useState<LocationType>("informal_stop");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState<number | null>(passedCoords?.latitude ?? null);
  const [longitude, setLongitude] = useState<number | null>(passedCoords?.longitude ?? null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [hasPinnedLocation, setHasPinnedLocation] = useState(!!passedCoords?.latitude);

  const mutation = useMutation({
    mutationFn: async (data: NewLocationData) => {
      return apiRequest("/api/map/locations", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/map/locations"] });
      if (Platform.OS !== "web") {
        const Haptics = require("expo-haptics");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert("Success", "Location added successfully! It will be reviewed by the community.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    },
    onError: (error) => {
      Alert.alert("Error", "Failed to add location. Please try again.");
      console.error("Error adding location:", error);
    },
  });

  useEffect(() => {
    if (!hasPinnedLocation) {
      getCurrentLocation();
    }
  }, []);


  const getCurrentLocation = async () => {
    try {
      setIsLoadingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Location permission is needed to add a stop at your current location.");
        return;
      }
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLatitude(location.coords.latitude);
      setLongitude(location.coords.longitude);

      const [reverseGeocode] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      if (reverseGeocode) {
        const addressParts = [
          reverseGeocode.street,
          reverseGeocode.city,
          reverseGeocode.region,
        ].filter(Boolean);
        setAddress(addressParts.join(", "));
      }
    } catch (error) {
      console.error("Error getting location:", error);
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      Alert.alert("Required", "Please enter a name for this location.");
      return;
    }
    if (!latitude || !longitude) {
      Alert.alert("Required", "Location coordinates are required.");
      return;
    }

    mutation.mutate({
      name: name.trim(),
      type,
      latitude,
      longitude,
      address: address.trim() || undefined,
      description: description.trim() || undefined,
    });
  };

  const isFormValid = name.trim().length > 0 && latitude !== null && longitude !== null;

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <ThemedText type="label" style={styles.sectionTitle}>Location Type</ThemedText>
          <View style={styles.typeGrid}>
            {locationTypes.map((item) => (
              <Pressable
                key={item.type}
                style={[
                  styles.typeButton,
                  { backgroundColor: type === item.type ? item.color : theme.backgroundElevated },
                ]}
                onPress={() => setType(item.type)}
              >
                <Feather
                  name={item.icon}
                  size={24}
                  color={type === item.type ? "#FFFFFF" : item.color}
                />
                <ThemedText
                  type="small"
                  style={[
                    styles.typeLabel,
                    { color: type === item.type ? "#FFFFFF" : theme.text },
                  ]}
                >
                  {item.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="label" style={styles.sectionTitle}>Location Details</ThemedText>
          <View style={[styles.inputContainer, { backgroundColor: theme.backgroundElevated }]}>
            <Feather name="map-pin" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="Location name (e.g., Corner Bree & Sauer)"
              placeholderTextColor={theme.textSecondary}
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={[styles.inputContainer, { backgroundColor: theme.backgroundElevated }]}>
            <Feather name="home" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="Address"
              placeholderTextColor={theme.textSecondary}
              value={address}
              onChangeText={setAddress}
            />
          </View>

          <View style={[styles.inputContainer, { backgroundColor: theme.backgroundElevated, minHeight: 80, alignItems: "flex-start" }]}>
            <Feather name="file-text" size={20} color={theme.textSecondary} style={{ marginTop: 4 }} />
            <TextInput
              style={[styles.input, { color: theme.text, height: 70 }]}
              placeholder="Description (landmarks, queue location, etc.)"
              placeholderTextColor={theme.textSecondary}
              value={description}
              onChangeText={setDescription}
              multiline
              textAlignVertical="top"
            />
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="label" style={styles.sectionTitle}>GPS Coordinates</ThemedText>
          <View style={[styles.locationCard, { backgroundColor: theme.backgroundElevated }]}>
            {isLoadingLocation ? (
              <View style={styles.loadingLocation}>
                <ActivityIndicator size="small" color={BrandColors.primary.blue} />
                <ThemedText style={{ marginLeft: Spacing.sm }}>Getting location...</ThemedText>
              </View>
            ) : latitude && longitude ? (
              <View>
                <View style={styles.coordinateRow}>
                  <Feather name="crosshair" size={16} color={BrandColors.secondary.green} />
                  <ThemedText style={{ marginLeft: Spacing.sm }}>
                    {latitude.toFixed(6)}, {longitude.toFixed(6)}
                  </ThemedText>
                </View>
                <Pressable
                  style={[styles.refreshButton, { borderColor: theme.border }]}
                  onPress={getCurrentLocation}
                >
                  <Feather name="refresh-cw" size={14} color={theme.textSecondary} />
                  <ThemedText type="small" style={{ marginLeft: Spacing.xs, color: theme.textSecondary }}>
                    Update Location
                  </ThemedText>
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.getLocationButton} onPress={getCurrentLocation}>
                <Feather name="navigation" size={20} color={BrandColors.primary.blue} />
                <ThemedText style={{ marginLeft: Spacing.sm, color: BrandColors.primary.blue }}>
                  Get Current Location
                </ThemedText>
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.infoBox}>
          <Feather name="info" size={16} color={BrandColors.primary.blue} />
          <ThemedText type="small" style={{ flex: 1, marginLeft: Spacing.sm, color: theme.textSecondary }}>
            Your contribution will be reviewed by the community. Verified stops help other commuters find safe pickup points.
          </ThemedText>
        </View>

        <Pressable
          style={[
            styles.submitButton,
            { backgroundColor: isFormValid ? BrandColors.secondary.green : BrandColors.gray[400] },
          ]}
          onPress={handleSubmit}
          disabled={!isFormValid || mutation.isPending}
        >
          {mutation.isPending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Feather name="check" size={20} color="#FFFFFF" />
              <ThemedText style={styles.submitText}>Submit Location</ThemedText>
            </>
          )}
        </Pressable>
      </KeyboardAwareScrollViewCompat>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl * 2,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  typeButton: {
    flex: 1,
    minWidth: "30%",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
  },
  typeLabel: {
    fontSize: 11,
    textAlign: "center",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  locationCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
  },
  loadingLocation: {
    flexDirection: "row",
    alignItems: "center",
  },
  coordinateRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  getLocationButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  infoBox: {
    flexDirection: "row",
    padding: Spacing.md,
    backgroundColor: "rgba(25, 118, 210, 0.1)",
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xl,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
  },
  submitText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
});
