import React, { useState, useCallback } from "react";
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";

import { useTheme } from "@/hooks/useTheme";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  Spacing,
  BrandColors,
  BorderRadius,
  Typography,
} from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { GradientButton } from "@/components/GradientButton";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { EmergencyContact } from "@/lib/types";
import {
  getEmergencyContacts,
  addEmergencyContact,
  removeEmergencyContact,
  generateId,
} from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

// typeui-clean rework — emergency contacts as a calm, brand-aligned hub:
//   1. Rose gradient header band with shield badge + clear copy
//   2. Inline expanding "Add contact" form with rose focus borders and
//      Typography tokens, wrapped in
//      KeyboardAwareScrollView so the keyboard doesn't cover the form
//   3. Contact rows with monogram avatars in rose tint, slide-in
//      FadeInDown entries, swipe-free remove via a confirm Alert
//   4. Empty state with rose-tinted users icon and friendly copy
//   5. Drops the BrandColors.primary.blue active state on relationship
//      pills — switches to canonical rose gradient
//   6. Auto-format SA phone numbers (strip non-digits, max 10 chars)

const RELATIONSHIPS = ["Family", "Friend", "Partner", "Colleague", "Other"];

export default function EmergencyContactsScreen() {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRelationship, setNewRelationship] = useState("");
  const [nameFocused, setNameFocused] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);

  const loadContacts = useCallback(async () => {
    const savedContacts = await getEmergencyContacts();
    setContacts(savedContacts);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadContacts();
    }, [loadContacts])
  );

  const triggerHaptic = (
    type: "selection" | "success" | "error" | "medium" = "selection"
  ) => {
    if (Platform.OS === "web") return;
    try {
      if (type === "success") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (type === "error") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else if (type === "medium") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        Haptics.selectionAsync();
      }
    } catch {}
  };

  const resetForm = () => {
    setIsAdding(false);
    setNewName("");
    setNewPhone("");
    setNewRelationship("");
  };

  const handleAddContact = async () => {
    if (!newName.trim() || !newPhone.trim() || !newRelationship) {
      triggerHaptic("error");
      Alert.alert("Missing details", "Please fill in name, phone, and relationship.");
      return;
    }

    triggerHaptic("success");

    const contact: EmergencyContact = {
      id: generateId(),
      name: newName.trim(),
      phone: newPhone.trim(),
      relationship: newRelationship,
    };

    await addEmergencyContact(contact);
    setContacts((prev) => [...prev, contact]);
    resetForm();
  };

  const handleRemoveContact = (contact: EmergencyContact) => {
    Alert.alert(
      "Remove contact",
      `Remove ${contact.name} from your emergency list?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            triggerHaptic("medium");
            await removeEmergencyContact(contact.id);
            setContacts((prev) => prev.filter((c) => c.id !== contact.id));
          },
        },
      ]
    );
  };

  const handleStartAdding = () => {
    triggerHaptic("selection");
    setIsAdding(true);
  };

  const formatPhone = (text: string) => {
    setNewPhone(text.replace(/[^\d+\s]/g, "").slice(0, 13));
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
      <KeyboardAwareScrollViewCompat
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing["3xl"] },
        ]}
      >
        {/* Rose gradient header — brand surface with back button */}
        <View
          style={[
            styles.heroWrap,
            { paddingTop: insets.top + Spacing.lg },
          ]}
        >
          <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(300)}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Feather name="arrow-left" size={22} color="#FFFFFF" />
            </Pressable>
          </Animated.View>

          <Animated.View
            entering={reducedMotion ? undefined : FadeIn.duration(400).delay(100)}
            style={styles.heroBadgeWrap}
          >
            <View style={styles.heroBadge}>
              <Feather name="shield" size={32} color={BrandColors.primary.gradientStart} />
            </View>
          </Animated.View>

          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(150)}
            style={styles.heroText}
          >
            <ThemedText style={styles.heroTitle}>Quick-share contacts</ThemedText>
            <ThemedText style={styles.heroSubtitle}>
              Saved on this device for one-tap location sharing during an SOS.
              Your primary emergency contact from your profile is auto-notified
              by our servers — these extras are for quick manual sharing.
            </ThemedText>
          </Animated.View>
        </View>

        {/* Floating content card */}
        <Animated.View
          entering={reducedMotion ? undefined : FadeInUp.duration(500).delay(200)}
          style={[
            styles.contentCard,
            { backgroundColor: theme.backgroundRoot },
          ]}
        >
          {/* Add form (inline) */}
          {isAdding ? (
            <Animated.View
              entering={reducedMotion ? undefined : FadeInDown.duration(300)}
              style={[
                styles.formCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                },
              ]}
            >
              <View style={styles.formHeader}>
                <ThemedText style={styles.formTitle}>New contact</ThemedText>
                <Pressable
                  onPress={resetForm}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                >
                  <Feather name="x" size={20} color={theme.textSecondary} />
                </Pressable>
              </View>

              <ThemedText
                style={[styles.fieldLabel, { color: theme.textSecondary }]}
              >
                FULL NAME
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundDefault,
                    color: theme.text,
                    borderColor: nameFocused
                      ? BrandColors.primary.gradientStart
                      : theme.border,
                  },
                ]}
                placeholder="e.g. Mama Thandi"
                placeholderTextColor={theme.textSecondary}
                value={newName}
                onChangeText={setNewName}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
              />

              <ThemedText
                style={[styles.fieldLabel, { color: theme.textSecondary }]}
              >
                PHONE NUMBER
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundDefault,
                    color: theme.text,
                    borderColor: phoneFocused
                      ? BrandColors.primary.gradientStart
                      : theme.border,
                  },
                ]}
                placeholder="071 234 5678"
                placeholderTextColor={theme.textSecondary}
                value={newPhone}
                onChangeText={formatPhone}
                onFocus={() => setPhoneFocused(true)}
                onBlur={() => setPhoneFocused(false)}
                keyboardType="phone-pad"
              />

              <ThemedText
                style={[styles.fieldLabel, { color: theme.textSecondary }]}
              >
                RELATIONSHIP
              </ThemedText>
              <View style={styles.relationshipGrid}>
                {RELATIONSHIPS.map((rel) => {
                  const active = newRelationship === rel;
                  return (
                    <Pressable
                      key={rel}
                      onPress={() => {
                        triggerHaptic("selection");
                        setNewRelationship(rel);
                      }}
                      style={({ pressed }) => [
                        styles.relationshipPill,
                        {
                          backgroundColor: active
                            ? BrandColors.primary.gradientStart + "15"
                            : theme.backgroundDefault,
                          borderColor: active
                            ? BrandColors.primary.gradientStart
                            : theme.border,
                        },
                        pressed && styles.pressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <ThemedText
                        style={[
                          styles.relationshipText,
                          {
                            color: active
                              ? BrandColors.primary.gradientStart
                              : theme.text,
                            fontWeight: active ? "700" : "500",
                          },
                        ]}
                      >
                        {rel}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.formCta}>
                <GradientButton
                  onPress={handleAddContact}
                  disabled={!newName.trim() || !newPhone.trim() || !newRelationship}
                  size="large"
                  icon="check"
                  iconPosition="right"
                >
                  Save contact
                </GradientButton>
              </View>
            </Animated.View>
          ) : null}

          {/* Contact list */}
          {contacts.length === 0 && !isAdding ? (
            <Animated.View
              entering={reducedMotion ? undefined : FadeIn.duration(400)}
              style={styles.emptyState}
            >
              <View
                style={[
                  styles.emptyIcon,
                  { backgroundColor: BrandColors.primary.gradientStart + "12" },
                ]}
              >
                <Feather
                  name="users"
                  size={28}
                  color={BrandColors.primary.gradientStart}
                />
              </View>
              <ThemedText style={styles.emptyTitle}>No contacts yet</ThemedText>
              <ThemedText
                style={[styles.emptyHint, { color: theme.textSecondary }]}
              >
                Add the people you trust most. They'll be the first to know if you need help.
              </ThemedText>
            </Animated.View>
          ) : null}

          {contacts.length > 0 ? (
            <View style={styles.contactList}>
              <ThemedText
                style={[styles.listLabel, { color: theme.textSecondary }]}
              >
                YOUR CONTACTS · {contacts.length}
              </ThemedText>
              {contacts.map((contact, index) => {
                const monogram =
                  contact.name?.trim()?.charAt(0)?.toUpperCase() || "?";
                return (
                  <Animated.View
                    key={contact.id}
                    entering={reducedMotion ? undefined : FadeInDown.duration(300).delay(
                      Math.min(index * 40, 200)
                    )}
                  >
                    <View
                      style={[
                        styles.contactCard,
                        {
                          backgroundColor: theme.surface,
                          borderColor: theme.border,
                        },
                      ]}
                    >
                      <View style={styles.contactAvatar}>
                        <ThemedText style={styles.contactMonogram}>
                          {monogram}
                        </ThemedText>
                      </View>
                      <View style={styles.contactInfo}>
                        <ThemedText style={styles.contactName} numberOfLines={1}>
                          {contact.name}
                        </ThemedText>
                        <View style={styles.contactMeta}>
                          <View
                            style={[
                              styles.relationshipChip,
                              {
                                backgroundColor:
                                  BrandColors.primary.gradientStart + "12",
                              },
                            ]}
                          >
                            <ThemedText style={styles.relationshipChipText}>
                              {contact.relationship}
                            </ThemedText>
                          </View>
                          <ThemedText
                            style={[
                              styles.contactPhone,
                              { color: theme.textSecondary },
                            ]}
                            numberOfLines={1}
                          >
                            {contact.phone}
                          </ThemedText>
                        </View>
                      </View>
                      <Pressable
                        onPress={() => handleRemoveContact(contact)}
                        hitSlop={10}
                        style={({ pressed }) => [
                          styles.removeButton,
                          {
                            backgroundColor: pressed
                              ? BrandColors.status.emergency + "12"
                              : "transparent",
                          },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${contact.name}`}
                      >
                        <Feather
                          name="trash-2"
                          size={16}
                          color={BrandColors.status.emergency}
                        />
                      </Pressable>
                    </View>
                  </Animated.View>
                );
              })}
            </View>
          ) : null}

          {/* Add CTA — bottom anchor when not adding */}
          {!isAdding ? (
            <Pressable
              onPress={handleStartAdding}
              style={({ pressed }) => [
                styles.addCtaButton,
                {
                  borderColor: BrandColors.primary.gradientStart,
                  backgroundColor: BrandColors.primary.gradientStart + "08",
                },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Add emergency contact"
            >
              <Feather
                name="plus-circle"
                size={18}
                color={BrandColors.primary.gradientStart}
              />
              <ThemedText
                style={[
                  styles.addCtaText,
                  { color: BrandColors.primary.gradientStart },
                ]}
              >
                Add emergency contact
              </ThemedText>
            </Pressable>
          ) : null}
        </Animated.View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const HERO_HEIGHT = 280;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // Hero
  heroWrap: {
    backgroundColor: BrandColors.primary.gradientStart,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    marginBottom: Spacing.lg,
  },
  heroBadgeWrap: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  heroBadge: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  heroText: {
    alignItems: "center",
  },
  heroTitle: {
    ...Typography.h2,
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  heroSubtitle: {
    ...Typography.body,
    color: "rgba(255,255,255,0.92)",
    textAlign: "center",
    maxWidth: 320,
  },

  // Content card (floats over hero bottom)
  contentCard: {
    flex: 1,
    marginTop: -Spacing["2xl"],
    borderTopLeftRadius: BorderRadius["2xl"],
    borderTopRightRadius: BorderRadius["2xl"],
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing["2xl"],
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },

  // Form
  formCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.xl,
  },
  formHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  formTitle: {
    ...Typography.h4,
  },
  fieldLabel: {
    ...Typography.label,
    letterSpacing: 1.2,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  input: {
    height: 52,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    borderWidth: 1.5,
  },
  relationshipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  relationshipPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
  },
  relationshipText: {
    ...Typography.small,
  },
  formCta: {
    marginTop: Spacing.lg,
  },

  // Empty state
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    ...Typography.h4,
    marginBottom: Spacing.xs,
  },
  emptyHint: {
    ...Typography.small,
    textAlign: "center",
    maxWidth: 280,
  },

  // Contact list
  contactList: {
    marginBottom: Spacing.lg,
  },
  listLabel: {
    ...Typography.label,
    letterSpacing: 1.2,
    fontSize: 11,
    marginBottom: Spacing.md,
    marginLeft: Spacing.xs,
  },
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: BrandColors.primary.gradientStart,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  contactMonogram: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    fontFamily: "SpaceGrotesk_700Bold",
  },
  contactInfo: {
    flex: 1,
    minWidth: 0,
  },
  contactName: {
    ...Typography.body,
    fontWeight: "700",
  },
  contactMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: 4,
  },
  relationshipChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  relationshipChipText: {
    ...Typography.label,
    color: BrandColors.primary.gradientStart,
    fontSize: 10,
    letterSpacing: 0.6,
    fontWeight: "700",
  },
  contactPhone: {
    ...Typography.small,
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    flexShrink: 1,
  },
  removeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: Spacing.sm,
  },

  // Add CTA (dashed-look outline)
  addCtaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderStyle: "dashed",
    marginTop: Spacing.md,
  },
  addCtaText: {
    ...Typography.body,
    fontWeight: "700",
  },

  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});
