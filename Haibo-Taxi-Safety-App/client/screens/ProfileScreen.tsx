import React, { useState, useCallback } from "react";
import { View, ScrollView, Pressable, StyleSheet, Alert, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { UserProfile, EmergencyContact } from "@/lib/types";
import {
  getUserProfile,
  saveUserProfile,
  getEmergencyContacts,
  generateId,
} from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

const AVATAR_COLORS = [
  BrandColors.secondary.orange,
  BrandColors.primary.blue,
  BrandColors.secondary.purple,
];

const USER_TYPE_ICONS: Record<string, string> = {
  commuter: "user",
  driver: "truck",
  operator: "briefcase",
};

const triggerHaptic = async () => {
  try {
    const Haptics = await import("expo-haptics");
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {}
};

const triggerHapticMedium = async () => {
  try {
    const Haptics = await import("expo-haptics");
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {}
};

const triggerHapticSuccess = async () => {
  try {
    const Haptics = await import("expo-haptics");
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {}
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);

  const loadData = useCallback(async () => {
    const savedProfile = await getUserProfile();
    const contacts = await getEmergencyContacts();

    if (!savedProfile) {
      const defaultProfile: UserProfile = {
        id: generateId(),
        name: "Guest User",
        phone: "",
        userType: "commuter",
        avatarType: 0,
        isVerified: false,
      };
      await saveUserProfile(defaultProfile);
      setProfile(defaultProfile);
    } else {
      setProfile(savedProfile);
    }

    setEmergencyContacts(contacts);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleEditProfile = () => {
    triggerHaptic();
    if (Platform.OS === "ios") {
      Alert.prompt(
        "Edit Name",
        "Enter your name",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Save",
            onPress: async (name) => {
              if (name && profile) {
                const updatedProfile = { ...profile, name };
                await saveUserProfile(updatedProfile);
                setProfile(updatedProfile);
                triggerHapticSuccess();
              }
            },
          },
        ],
        "plain-text",
        profile?.name
      );
    } else {
      Alert.alert("Edit Name", "Name editing is available on iOS");
    }
  };

  const handleEmergencyContacts = () => {
    triggerHaptic();
    navigation.navigate("EmergencyContacts");
  };

  const handlePayment = () => {
    triggerHaptic();
    navigation.navigate("Payment");
  };

  const handleUserTypeChange = async () => {
    if (!profile) return;

    triggerHapticMedium();

    Alert.alert(
      "Select User Type",
      "Choose how you use Haibo Taxi",
      [
        {
          text: "Commuter",
          onPress: async () => {
            const updated = { ...profile, userType: "commuter" as const, avatarType: 0 };
            await saveUserProfile(updated);
            setProfile(updated);
          },
        },
        {
          text: "Driver",
          onPress: async () => {
            const updated = { ...profile, userType: "driver" as const, avatarType: 1 };
            await saveUserProfile(updated);
            setProfile(updated);
          },
        },
        {
          text: "Operator",
          onPress: async () => {
            const updated = { ...profile, userType: "operator" as const, avatarType: 2 };
            await saveUserProfile(updated);
            setProfile(updated);
          },
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const avatarColor = profile ? AVATAR_COLORS[profile.avatarType % AVATAR_COLORS.length] : BrandColors.gray[400];
  const userIcon = profile ? USER_TYPE_ICONS[profile.userType] || "user" : "user";

  const menuItems = [
    {
      icon: "users",
      label: "Emergency Contacts",
      subtitle: `${emergencyContacts.length} contact${emergencyContacts.length !== 1 ? "s" : ""} saved`,
      color: BrandColors.primary.red,
      onPress: handleEmergencyContacts,
    },
    {
      icon: "credit-card",
      label: "Haibo Pay",
      subtitle: "Manage your wallet",
      color: BrandColors.primary.green,
      onPress: handlePayment,
    },
    {
      icon: "clock",
      label: "Trip History",
      subtitle: "View past trips",
      color: BrandColors.primary.blue,
      onPress: triggerHaptic,
    },
    {
      icon: "help-circle",
      label: "Support",
      subtitle: "Get help",
      color: BrandColors.secondary.purple,
      onPress: triggerHaptic,
    },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: Spacing.lg,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
    >
      <View style={[styles.profileCard, { backgroundColor: theme.backgroundDefault }]}>
        <Pressable style={[styles.avatar, { backgroundColor: avatarColor }]} onPress={handleUserTypeChange}>
          <Feather name={userIcon as any} size={32} color="#FFFFFF" />
        </Pressable>
        <View style={styles.profileInfo}>
          <Pressable onPress={handleEditProfile}>
            <View style={styles.nameRow}>
              <ThemedText style={styles.name}>{profile?.name || "Guest User"}</ThemedText>
              <Feather name="edit-2" size={14} color={theme.textSecondary} />
            </View>
          </Pressable>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {profile?.phone || "No phone number"}
          </ThemedText>
          <View style={styles.badgeRow}>
            <View style={[styles.typeBadge, { backgroundColor: avatarColor + "20" }]}>
              <ThemedText style={[styles.typeBadgeText, { color: avatarColor }]}>
                {profile?.userType === "driver"
                  ? "Driver"
                  : profile?.userType === "operator"
                  ? "Operator"
                  : "Commuter"}
              </ThemedText>
            </View>
            {profile?.isVerified ? (
              <View style={styles.verifiedBadge}>
                <Feather name="check-circle" size={14} color={BrandColors.primary.green} />
                <ThemedText style={styles.verifiedText}>Verified</ThemedText>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText style={styles.statValue}>0</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            Trips
          </ThemedText>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText style={styles.statValue}>0</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            Reports
          </ThemedText>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText style={styles.statValue}>{emergencyContacts.length}</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            Contacts
          </ThemedText>
        </View>
      </View>

      <View style={styles.menuSection}>
        {menuItems.map((item, index) => (
          <Pressable
            key={item.label}
            style={[styles.menuItem, { backgroundColor: theme.backgroundDefault }]}
            onPress={item.onPress}
          >
            <View style={[styles.menuIcon, { backgroundColor: item.color + "15" }]}>
              <Feather name={item.icon as any} size={20} color={item.color} />
            </View>
            <View style={styles.menuContent}>
              <ThemedText style={styles.menuLabel}>{item.label}</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {item.subtitle}
              </ThemedText>
            </View>
            <Feather name="chevron-right" size={20} color={theme.textSecondary} />
          </Pressable>
        ))}
      </View>

      <ThemedText type="small" style={styles.version}>
        Haibo! Taxi v1.0.0
      </ThemedText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.lg,
  },
  profileInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  name: {
    fontSize: 20,
    fontWeight: "700",
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  typeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  verifiedText: {
    fontSize: 12,
    color: BrandColors.primary.green,
    fontWeight: "500",
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 2,
  },
  menuSection: {
    marginTop: Spacing.xl,
    gap: Spacing.sm,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  menuContent: {
    flex: 1,
  },
  menuLabel: {
    fontWeight: "600",
    marginBottom: 2,
  },
  version: {
    textAlign: "center",
    color: BrandColors.gray[500],
    marginTop: Spacing["2xl"],
  },
});
