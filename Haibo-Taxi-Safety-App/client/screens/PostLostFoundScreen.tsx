import React, { useState } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { apiRequest } from "@/lib/query-client";
import { getDeviceId } from "@/lib/deviceId";

type ItemType = "lost" | "found";
type CategoryType = "phone" | "wallet" | "bag" | "document" | "keys" | "other";

const CATEGORIES: { value: CategoryType; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { value: "phone", label: "Phone", icon: "smartphone" },
  { value: "wallet", label: "Wallet", icon: "credit-card" },
  { value: "bag", label: "Bag", icon: "shopping-bag" },
  { value: "document", label: "Documents", icon: "file-text" },
  { value: "keys", label: "Keys", icon: "key" },
  { value: "other", label: "Other", icon: "package" },
];

export default function PostLostFoundScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation();
  const queryClient = useQueryClient();

  const [type, setType] = useState<ItemType>("lost");
  const [category, setCategory] = useState<CategoryType>("phone");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [routeOrigin, setRouteOrigin] = useState("");
  const [routeDestination, setRouteDestination] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [reward, setReward] = useState("");

  const isValid = title.trim().length > 0 && description.trim().length > 10 && contactName.trim() && contactPhone.trim().length >= 10;

  const postMutation = useMutation({
    mutationFn: async () => {
      const deviceId = await getDeviceId();
      const response = await apiRequest("POST", "/api/lost-found", {
        type,
        category,
        title: title.trim(),
        description: description.trim(),
        routeOrigin: routeOrigin.trim() || undefined,
        routeDestination: routeDestination.trim() || undefined,
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim(),
        reward: reward ? parseFloat(reward) : undefined,
        deviceId,
      });
      return response.json();
    },
    onSuccess: () => {
      if (Platform.OS !== "web") {
        const Haptics = require("expo-haptics");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/lost-found"] });
      Alert.alert(
        "Posted Successfully!",
        `Your ${type} item has been posted. People in the community will be able to see it.`,
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    },
    onError: (error: Error) => {
      Alert.alert("Error", error.message || "Failed to post item.");
    },
  });

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: Spacing.lg,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
    >
      <View style={styles.section}>
        <ThemedText style={styles.label}>Item Status</ThemedText>
        <View style={styles.typeRow}>
          <Pressable
            style={[
              styles.typeButton,
              {
                backgroundColor:
                  type === "lost" ? BrandColors.primary.red + "15" : theme.backgroundDefault,
                borderColor: type === "lost" ? BrandColors.primary.red : theme.border,
              },
            ]}
            onPress={() => setType("lost")}
          >
            <Feather
              name="search"
              size={24}
              color={type === "lost" ? BrandColors.primary.red : theme.textSecondary}
            />
            <ThemedText
              style={[styles.typeText, { color: type === "lost" ? BrandColors.primary.red : theme.text }]}
            >
              I Lost Something
            </ThemedText>
          </Pressable>
          <Pressable
            style={[
              styles.typeButton,
              {
                backgroundColor:
                  type === "found" ? BrandColors.primary.green + "15" : theme.backgroundDefault,
                borderColor: type === "found" ? BrandColors.primary.green : theme.border,
              },
            ]}
            onPress={() => setType("found")}
          >
            <Feather
              name="check-circle"
              size={24}
              color={type === "found" ? BrandColors.primary.green : theme.textSecondary}
            />
            <ThemedText
              style={[
                styles.typeText,
                { color: type === "found" ? BrandColors.primary.green : theme.text },
              ]}
            >
              I Found Something
            </ThemedText>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.label}>Category</ThemedText>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat.value}
              style={[
                styles.categoryButton,
                {
                  backgroundColor:
                    category === cat.value
                      ? BrandColors.primary.blue + "15"
                      : theme.backgroundDefault,
                  borderColor:
                    category === cat.value ? BrandColors.primary.blue : theme.border,
                },
              ]}
              onPress={() => setCategory(cat.value)}
            >
              <Feather
                name={cat.icon}
                size={20}
                color={category === cat.value ? BrandColors.primary.blue : theme.textSecondary}
              />
              <ThemedText
                style={[
                  styles.categoryText,
                  { color: category === cat.value ? BrandColors.primary.blue : theme.text },
                ]}
              >
                {cat.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.label}>Title *</ThemedText>
        <TextInput
          style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
          placeholder={type === "lost" ? "e.g., Black Samsung Galaxy S24" : "e.g., Found wallet on Rea Vaya"}
          placeholderTextColor={theme.textSecondary}
          value={title}
          onChangeText={setTitle}
          maxLength={100}
        />
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.label}>Description *</ThemedText>
        <TextInput
          style={[styles.textArea, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
          placeholder="Describe the item in detail (color, size, distinguishing features, where you lost/found it)..."
          placeholderTextColor={theme.textSecondary}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
        <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
          Minimum 10 characters ({description.trim().length}/10)
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.label}>Route (Optional)</ThemedText>
        <View style={styles.routeRow}>
          <TextInput
            style={[styles.input, styles.routeInput, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
            placeholder="From"
            placeholderTextColor={theme.textSecondary}
            value={routeOrigin}
            onChangeText={setRouteOrigin}
          />
          <Feather name="arrow-right" size={20} color={theme.textSecondary} />
          <TextInput
            style={[styles.input, styles.routeInput, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
            placeholder="To"
            placeholderTextColor={theme.textSecondary}
            value={routeDestination}
            onChangeText={setRouteDestination}
          />
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.label}>Your Contact Info *</ThemedText>
        <TextInput
          style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border, marginBottom: Spacing.sm }]}
          placeholder="Your Name"
          placeholderTextColor={theme.textSecondary}
          value={contactName}
          onChangeText={setContactName}
        />
        <TextInput
          style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
          placeholder="Phone Number"
          placeholderTextColor={theme.textSecondary}
          value={contactPhone}
          onChangeText={(text) => setContactPhone(text.replace(/\D/g, ""))}
          keyboardType="phone-pad"
          maxLength={15}
        />
      </View>

      {type === "lost" ? (
        <View style={styles.section}>
          <ThemedText style={styles.label}>Reward (Optional)</ThemedText>
          <View style={[styles.rewardInput, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            <ThemedText style={{ fontSize: 18 }}>R</ThemedText>
            <TextInput
              style={[styles.rewardInputField, { color: theme.text }]}
              placeholder="0"
              placeholderTextColor={theme.textSecondary}
              value={reward}
              onChangeText={(text) => setReward(text.replace(/[^0-9]/g, ""))}
              keyboardType="numeric"
            />
          </View>
          <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
            Offering a reward increases the chance of getting your item back
          </ThemedText>
        </View>
      ) : null}

      <Button onPress={() => postMutation.mutate()} disabled={!isValid || postMutation.isPending}>
        {postMutation.isPending ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <ThemedText style={styles.buttonText}>Posting...</ThemedText>
          </View>
        ) : (
          `Post ${type === "lost" ? "Lost" : "Found"} Item`
        )}
      </Button>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  typeRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  typeButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    alignItems: "center",
    gap: Spacing.sm,
  },
  typeText: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  categoryButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: "500",
  },
  input: {
    height: 48,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
    borderWidth: 1,
  },
  textArea: {
    minHeight: 100,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    fontSize: 16,
    borderWidth: 1,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  routeInput: {
    flex: 1,
  },
  rewardInput: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  rewardInputField: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
