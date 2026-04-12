import React, { useState, useEffect } from "react";
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
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type AvatarType = "commuter" | "driver" | "operator";

const AVATAR_OPTIONS: { type: AvatarType; icon: keyof typeof Feather.glyphMap; label: string; color: string }[] = [
  { type: "commuter", icon: "user", label: "Commuter", color: BrandColors.primary.blue },
  { type: "driver", icon: "truck", label: "Driver", color: BrandColors.primary.green },
  { type: "operator", icon: "briefcase", label: "Operator", color: "#7B1FA2" },
];

export default function ProfileSetupScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [userId, setUserId] = useState<string>("");
  const [displayName, setDisplayName] = useState("");
  const [avatarType, setAvatarType] = useState<AvatarType>("commuter");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [referralCode, setReferralCode] = useState("");

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userStr = await AsyncStorage.getItem("@haibo_user");
      if (userStr) {
        const user = JSON.parse(userStr);
        setUserId(user.id);
      }
    } catch (error) {
      console.log("Error loading user:", error);
    }
  };

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PUT", "/api/auth/profile", {
        userId,
        displayName: displayName.trim(),
        avatarType,
        emergencyContactName: emergencyName.trim() || undefined,
        emergencyContactPhone: emergencyPhone.trim() || undefined,
      });
      return response.json();
    },
    onSuccess: async (data) => {
      await AsyncStorage.setItem("@haibo_user", JSON.stringify(data.user));
      
      if (referralCode.trim()) {
        applyReferralMutation.mutate();
      } else {
        finishSetup();
      }
    },
    onError: (error: Error) => {
      Alert.alert("Error", error.message || "Failed to update profile.");
    },
  });

  const applyReferralMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/apply-referral", {
        userId,
        referralCode: referralCode.trim().toUpperCase(),
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (Platform.OS !== "web") {
        const Haptics = require("expo-haptics");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert("Welcome Bonus!", data.message, [{ text: "Great!", onPress: finishSetup }]);
    },
    onError: (error: Error) => {
      Alert.alert("Referral Error", error.message || "Invalid referral code.", [{ text: "OK", onPress: finishSetup }]);
    },
  });

  const finishSetup = () => {
    if (Platform.OS !== "web") {
      const Haptics = require("expo-haptics");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    navigation.reset({
      index: 0,
      routes: [{ name: "MainTabs" }],
    });
  };

  const handleSave = () => {
    if (!displayName.trim()) {
      Alert.alert("Name Required", "Please enter your display name.");
      return;
    }
    updateProfileMutation.mutate();
  };

  const isLoading = updateProfileMutation.isPending || applyReferralMutation.isPending;

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: insets.top + Spacing.xl,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
    >
      <View style={styles.header}>
        <ThemedText type="h1" style={styles.title}>
          Set Up Your Profile
        </ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          Tell us a bit about yourself to personalize your experience
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.label}>Who are you?</ThemedText>
        <View style={styles.avatarRow}>
          {AVATAR_OPTIONS.map((option) => (
            <Pressable
              key={option.type}
              style={[
                styles.avatarOption,
                {
                  backgroundColor: avatarType === option.type ? option.color + "15" : theme.backgroundDefault,
                  borderColor: avatarType === option.type ? option.color : theme.border,
                },
              ]}
              onPress={() => {
                if (Platform.OS !== "web") {
                  const Haptics = require("expo-haptics");
                  Haptics.selectionAsync();
                }
                setAvatarType(option.type);
              }}
            >
              <View style={[styles.avatarIcon, { backgroundColor: option.color }]}>
                <Feather name={option.icon} size={24} color="#FFFFFF" />
              </View>
              <ThemedText
                style={[styles.avatarLabel, { color: avatarType === option.type ? option.color : theme.text }]}
              >
                {option.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.label}>Display Name *</ThemedText>
        <TextInput
          style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
          placeholder="e.g., Sipho M"
          placeholderTextColor={theme.textSecondary}
          value={displayName}
          onChangeText={setDisplayName}
          maxLength={30}
        />
      </View>

      <View style={[styles.section, styles.emergencySection]}>
        <View style={styles.sectionHeader}>
          <Feather name="alert-circle" size={18} color={BrandColors.primary.red} />
          <ThemedText style={[styles.label, { marginBottom: 0, marginLeft: Spacing.sm }]}>Emergency Contact</ThemedText>
        </View>
        <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
          This person will be notified if you trigger SOS
        </ThemedText>
        <TextInput
          style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
          placeholder="Contact Name"
          placeholderTextColor={theme.textSecondary}
          value={emergencyName}
          onChangeText={setEmergencyName}
          maxLength={50}
        />
        <TextInput
          style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border, marginTop: Spacing.sm }]}
          placeholder="Contact Phone"
          placeholderTextColor={theme.textSecondary}
          value={emergencyPhone}
          onChangeText={(text) => setEmergencyPhone(text.replace(/\D/g, ""))}
          keyboardType="phone-pad"
          maxLength={15}
        />
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.label}>Referral Code (Optional)</ThemedText>
        <TextInput
          style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
          placeholder="e.g., HAIBOABC123"
          placeholderTextColor={theme.textSecondary}
          value={referralCode}
          onChangeText={(text) => setReferralCode(text.toUpperCase())}
          autoCapitalize="characters"
          maxLength={15}
        />
        <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
          Got a friend's code? Enter it to get R5 in your wallet!
        </ThemedText>
      </View>

      <Button onPress={handleSave} disabled={isLoading} style={styles.button}>
        {isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <ThemedText style={styles.buttonText}>Saving...</ThemedText>
          </View>
        ) : (
          "Complete Setup"
        )}
      </Button>

      <Pressable onPress={finishSetup} disabled={isLoading}>
        <ThemedText style={[styles.skipText, { color: theme.textSecondary }]}>Skip for now</ThemedText>
      </Pressable>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  title: {
    marginBottom: Spacing.sm,
  },
  subtitle: {},
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  avatarRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  avatarOption: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    alignItems: "center",
  },
  avatarIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  avatarLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  input: {
    height: 52,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
    borderWidth: 1,
  },
  emergencySection: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.primary.red + "30",
    backgroundColor: BrandColors.primary.red + "05",
  },
  button: {
    marginBottom: Spacing.md,
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
  skipText: {
    textAlign: "center",
    fontSize: 14,
  },
});
