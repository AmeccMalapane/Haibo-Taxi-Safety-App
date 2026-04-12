import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  FlatList,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { EmergencyContact } from "@/lib/types";
import {
  getEmergencyContacts,
  addEmergencyContact,
  removeEmergencyContact,
  generateId,
} from "@/lib/storage";

const RELATIONSHIPS = ["Family", "Friend", "Partner", "Colleague", "Other"];

export default function EmergencyContactsScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRelationship, setNewRelationship] = useState("");

  const loadContacts = useCallback(async () => {
    const savedContacts = await getEmergencyContacts();
    setContacts(savedContacts);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadContacts();
    }, [loadContacts])
  );

  const handleAddContact = async () => {
    if (!newName.trim() || !newPhone.trim() || !newRelationship) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const contact: EmergencyContact = {
      id: generateId(),
      name: newName.trim(),
      phone: newPhone.trim(),
      relationship: newRelationship,
    };

    await addEmergencyContact(contact);
    setContacts((prev) => [...prev, contact]);
    setIsAdding(false);
    setNewName("");
    setNewPhone("");
    setNewRelationship("");
  };

  const handleRemoveContact = (contact: EmergencyContact) => {
    Alert.alert(
      "Remove Contact",
      `Are you sure you want to remove ${contact.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            await removeEmergencyContact(contact.id);
            setContacts((prev) => prev.filter((c) => c.id !== contact.id));
          },
        },
      ]
    );
  };

  const renderContact = ({ item }: { item: EmergencyContact }) => (
    <View style={[styles.contactCard, { backgroundColor: theme.backgroundDefault }]}>
      <View style={styles.contactIcon}>
        <Feather name="user" size={20} color={BrandColors.primary.red} />
      </View>
      <View style={styles.contactInfo}>
        <ThemedText style={styles.contactName}>{item.name}</ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {item.relationship} - {item.phone}
        </ThemedText>
      </View>
      <Pressable
        style={styles.removeButton}
        onPress={() => handleRemoveContact(item)}
      >
        <Feather name="trash-2" size={18} color={BrandColors.primary.red} />
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={styles.headerInfo}>
        <View style={[styles.infoCard, { backgroundColor: theme.backgroundDefault }]}>
          <Feather name="shield" size={20} color={BrandColors.primary.red} />
          <ThemedText type="small" style={{ color: theme.textSecondary, flex: 1, marginLeft: Spacing.sm }}>
            Emergency contacts will be notified when you use the SOS button or
            share your trip.
          </ThemedText>
        </View>
      </View>

      {isAdding ? (
        <View style={[styles.addForm, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText style={styles.formTitle}>Add New Contact</ThemedText>

          <View style={styles.formField}>
            <ThemedText type="small" style={styles.fieldLabel}>Name</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundRoot, color: theme.text, borderColor: theme.border }]}
              placeholder="Contact name"
              placeholderTextColor={theme.textSecondary}
              value={newName}
              onChangeText={setNewName}
            />
          </View>

          <View style={styles.formField}>
            <ThemedText type="small" style={styles.fieldLabel}>Phone Number</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundRoot, color: theme.text, borderColor: theme.border }]}
              placeholder="e.g., 071 234 5678"
              placeholderTextColor={theme.textSecondary}
              value={newPhone}
              onChangeText={setNewPhone}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.formField}>
            <ThemedText type="small" style={styles.fieldLabel}>Relationship</ThemedText>
            <View style={styles.relationshipGrid}>
              {RELATIONSHIPS.map((rel) => (
                <Pressable
                  key={rel}
                  style={[
                    styles.relationshipButton,
                    {
                      backgroundColor:
                        newRelationship === rel
                          ? BrandColors.primary.blue
                          : theme.backgroundRoot,
                      borderColor:
                        newRelationship === rel
                          ? BrandColors.primary.blue
                          : theme.border,
                    },
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setNewRelationship(rel);
                  }}
                >
                  <ThemedText
                    style={[
                      styles.relationshipText,
                      { color: newRelationship === rel ? "#FFFFFF" : theme.text },
                    ]}
                  >
                    {rel}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.formActions}>
            <Pressable
              style={styles.cancelButton}
              onPress={() => {
                setIsAdding(false);
                setNewName("");
                setNewPhone("");
                setNewRelationship("");
              }}
            >
              <ThemedText style={{ color: theme.textSecondary }}>Cancel</ThemedText>
            </Pressable>
            <Button
              onPress={handleAddContact}
              disabled={!newName.trim() || !newPhone.trim() || !newRelationship}
              style={{ flex: 1 }}
            >
              Add Contact
            </Button>
          </View>
        </View>
      ) : null}

      <FlatList
        data={contacts}
        keyExtractor={(item) => item.id}
        renderItem={renderContact}
        contentContainerStyle={{
          paddingHorizontal: Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xl,
        }}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="users" size={48} color={theme.textSecondary} />
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              No emergency contacts yet
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center" }}>
              Add contacts who should be notified in case of emergency.
            </ThemedText>
          </View>
        }
        ListFooterComponent={
          !isAdding ? (
            <Pressable
              style={[styles.addButton, { backgroundColor: theme.backgroundDefault }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsAdding(true);
              }}
            >
              <Feather name="plus" size={20} color={BrandColors.primary.blue} />
              <ThemedText style={[styles.addButtonText, { color: BrandColors.primary.blue }]}>
                Add Emergency Contact
              </ThemedText>
            </Pressable>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerInfo: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  addForm: {
    margin: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.lg,
  },
  formField: {
    marginBottom: Spacing.md,
  },
  fieldLabel: {
    fontWeight: "500",
    marginBottom: Spacing.xs,
  },
  input: {
    height: 48,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
    borderWidth: 1,
  },
  relationshipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  relationshipButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  relationshipText: {
    fontSize: 13,
    fontWeight: "500",
  },
  formActions: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.lg,
    gap: Spacing.md,
  },
  cancelButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  contactIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(211, 47, 47, 0.1)",
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
  removeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["5xl"],
    paddingHorizontal: Spacing.lg,
  },
  emptyText: {
    marginTop: Spacing.md,
    fontSize: 16,
    fontWeight: "600",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
