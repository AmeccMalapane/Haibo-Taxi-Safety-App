import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  Platform,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, BrandColors, Typography } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest } from "@/lib/query-client";
import { getDeviceId } from "@/lib/deviceId";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface FormSectionProps {
  title: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  children: React.ReactNode;
}

function FormSection({ title, icon, color, children }: FormSectionProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.formSection}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: color }]}>
          <Feather name={icon} size={16} color="#FFFFFF" />
        </View>
        <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
      </View>
      <Card style={styles.sectionCard}>
        {children}
      </Card>
    </View>
  );
}

interface InputFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  keyboardType?: "default" | "phone-pad" | "numeric" | "email-address";
  multiline?: boolean;
}

function InputField({ label, value, onChangeText, placeholder, keyboardType = "default", multiline }: InputFieldProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.inputField}>
      <ThemedText style={styles.inputLabel}>{label}</ThemedText>
      <TextInput
        style={[
          styles.textInput,
          { 
            backgroundColor: theme.backgroundDefault,
            color: theme.text,
            borderColor: theme.border,
          },
          multiline && styles.textInputMultiline,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
    </View>
  );
}

export default function SendPackageScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [senderName, setSenderName] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [senderAddress, setSenderAddress] = useState("");
  
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [receiverAddress, setReceiverAddress] = useState("");
  
  const [packageContents, setPackageContents] = useState("");
  const [packageWeight, setPackageWeight] = useState("");
  const [packageDimensions, setPackageDimensions] = useState("");
  const [declaredValue, setDeclaredValue] = useState("");

  useEffect(() => {
    getDeviceId().then(setDeviceId);
  }, []);

  const createPackageMutation = useMutation({
    mutationFn: async (packageData: any) => {
      const response = await apiRequest("POST", "/api/hub/packages", packageData);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/hub/packages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hub/stats"] });
      
      Alert.alert(
        "Package Created",
        `Your tracking number is: ${data.trackingNumber}\n\nPlease drop off your package at the nearest hub.`,
        [
          {
            text: "OK",
            onPress: () => navigation.goBack(),
          },
        ]
      );
    },
    onError: (error) => {
      Alert.alert("Error", "Failed to create package. Please try again.");
    },
  });

  const calculateFare = () => {
    const weight = parseFloat(packageWeight) || 0;
    const value = parseFloat(declaredValue) || 0;
    const baseFare = 25;
    const weightFee = weight * 5;
    const insuranceFee = value > 500 ? value * 0.02 : 0;
    return (baseFare + weightFee + insuranceFee).toFixed(2);
  };

  const handleSubmit = async () => {
    if (!senderName || !senderPhone || !senderAddress || 
        !receiverName || !receiverPhone || !receiverAddress ||
        !packageContents) {
      Alert.alert("Missing Information", "Please fill in all required fields");
      return;
    }

    if (!deviceId) {
      Alert.alert("Error", "Unable to identify device. Please try again.");
      return;
    }

    if (Platform.OS !== "web") {
      try {
        const Haptics = await import("expo-haptics");
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    }

    const fare = parseFloat(calculateFare());
    const weight = parseFloat(packageWeight) || undefined;
    const value = parseFloat(declaredValue) || undefined;
    const insuranceFee = value && value > 500 ? value * 0.02 : 0;

    createPackageMutation.mutate({
      senderName,
      senderPhone,
      senderAddress,
      receiverName,
      receiverPhone,
      receiverAddress,
      contents: packageContents,
      weight,
      dimensions: packageDimensions || undefined,
      declaredValue: value,
      fare,
      insuranceFee,
      deviceId,
      status: "pending",
    });
  };

  const fare = calculateFare();

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <FormSection title="Sender Details" icon="user" color={BrandColors.primary.blue}>
          <InputField
            label="Full Name"
            value={senderName}
            onChangeText={setSenderName}
            placeholder="Enter sender's name"
          />
          <InputField
            label="Phone Number"
            value={senderPhone}
            onChangeText={setSenderPhone}
            placeholder="+27 XX XXX XXXX"
            keyboardType="phone-pad"
          />
          <InputField
            label="Pickup Address"
            value={senderAddress}
            onChangeText={setSenderAddress}
            placeholder="Enter pickup location"
            multiline
          />
        </FormSection>

        <FormSection title="Receiver Details" icon="users" color={BrandColors.primary.green}>
          <InputField
            label="Full Name"
            value={receiverName}
            onChangeText={setReceiverName}
            placeholder="Enter receiver's name"
          />
          <InputField
            label="Phone Number"
            value={receiverPhone}
            onChangeText={setReceiverPhone}
            placeholder="+27 XX XXX XXXX"
            keyboardType="phone-pad"
          />
          <InputField
            label="Delivery Address"
            value={receiverAddress}
            onChangeText={setReceiverAddress}
            placeholder="Enter delivery location"
            multiline
          />
        </FormSection>

        <FormSection title="Package Details" icon="package" color={BrandColors.secondary.orange}>
          <InputField
            label="Contents Description"
            value={packageContents}
            onChangeText={setPackageContents}
            placeholder="What's in the package?"
          />
          <View style={styles.row}>
            <View style={styles.halfInput}>
              <InputField
                label="Weight (kg)"
                value={packageWeight}
                onChangeText={setPackageWeight}
                placeholder="0.0"
                keyboardType="numeric"
              />
            </View>
            <View style={styles.halfInput}>
              <InputField
                label="Dimensions (cm)"
                value={packageDimensions}
                onChangeText={setPackageDimensions}
                placeholder="L x W x H"
              />
            </View>
          </View>
          <InputField
            label="Declared Value (R)"
            value={declaredValue}
            onChangeText={setDeclaredValue}
            placeholder="0.00"
            keyboardType="numeric"
          />
        </FormSection>

        <Card style={styles.fareCard}>
          <View style={styles.fareHeader}>
            <ThemedText style={styles.fareLabel}>Estimated Fare</ThemedText>
            <Feather name="info" size={16} color={theme.textSecondary} />
          </View>
          <ThemedText style={styles.fareAmount}>R {fare}</ThemedText>
          <ThemedText style={styles.fareNote}>
            Includes base fare, weight fee, and insurance if applicable
          </ThemedText>
        </Card>

        <View style={styles.buttonContainer}>
          <Button
            onPress={handleSubmit}
            disabled={createPackageMutation.isPending}
          >
            {createPackageMutation.isPending ? "Creating Shipment..." : "Create Shipment"}
          </Button>
        </View>
      </KeyboardAwareScrollViewCompat>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  formSection: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  sectionCard: {
    padding: Spacing.md,
  },
  inputField: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: Spacing.xs,
    opacity: 0.8,
  },
  textInput: {
    fontSize: 16,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  textInputMultiline: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  halfInput: {
    flex: 1,
  },
  fareCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    alignItems: "center",
  },
  fareHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  fareLabel: {
    fontSize: 14,
    opacity: 0.6,
  },
  fareAmount: {
    fontSize: 36,
    fontWeight: "700",
    color: BrandColors.primary.green,
    marginBottom: Spacing.xs,
  },
  fareNote: {
    fontSize: 12,
    opacity: 0.5,
    textAlign: "center",
  },
  buttonContainer: {
    marginBottom: Spacing.lg,
  },
});
