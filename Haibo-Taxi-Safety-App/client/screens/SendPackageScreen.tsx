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
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { GradientButton } from "@/components/GradientButton";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import {
  Spacing,
  BorderRadius,
  BrandColors,
  Typography,
} from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest } from "@/lib/query-client";
import { getDeviceId } from "@/lib/deviceId";

// typeui-clean rework — Send package form.
//
// Latent bug fixed: apiRequest("POST", url, data) followed by .json()
// was a runtime crash — apiRequest already returns the parsed body,
// calling .json() throws "json is not a function". Switched to the
// new options-object form: apiRequest(url, { method, body }).
//
// Also: the screen had no back button (it's reached from HubScreen
// via root-stack modal push). Added one in the hero.

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface FormSectionProps {
  title: string;
  icon: keyof typeof Feather.glyphMap;
  children: React.ReactNode;
  theme: any;
}

function FormSection({ title, icon, children, theme }: FormSectionProps) {
  return (
    <View style={styles.formSection}>
      <View style={styles.sectionHeader}>
        <View
          style={[
            styles.sectionIcon,
            { backgroundColor: BrandColors.primary.gradientStart + "12" },
          ]}
        >
          <Feather
            name={icon}
            size={14}
            color={BrandColors.primary.gradientStart}
          />
        </View>
        <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
      </View>
      <View
        style={[
          styles.sectionCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        {children}
      </View>
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

function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  multiline,
}: InputFieldProps) {
  const { theme } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.inputField}>
      <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
        {label.toUpperCase()}
      </ThemedText>
      <TextInput
        style={[
          styles.textInput,
          {
            backgroundColor: theme.backgroundDefault,
            color: theme.text,
            borderColor: focused
              ? BrandColors.primary.gradientStart
              : theme.border,
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
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
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
    getDeviceId().then(setDeviceId).catch(() => {});
  }, []);

  const triggerHaptic = (
    type: "success" | "error" | "selection" = "selection"
  ) => {
    if (Platform.OS === "web") return;
    try {
      const Haptics = require("expo-haptics");
      if (type === "success") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (type === "error") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else {
        Haptics.selectionAsync();
      }
    } catch {}
  };

  const createPackageMutation = useMutation({
    mutationFn: async (packageData: any) => {
      return apiRequest("/api/hub/packages", {
        method: "POST",
        body: JSON.stringify(packageData),
      });
    },
    onSuccess: (data) => {
      triggerHaptic("success");
      queryClient.invalidateQueries({ queryKey: ["/api/hub/packages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hub/stats"] });

      Alert.alert(
        "Package created",
        `Your tracking number is:\n\n${data.trackingNumber}\n\nDrop your package at the nearest hub.`,
        [{ text: "Done", onPress: () => navigation.goBack() }]
      );
    },
    onError: () => {
      triggerHaptic("error");
      Alert.alert("Couldn't create", "Failed to create package. Please try again.");
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

  const isValid =
    !!senderName.trim() &&
    !!senderPhone.trim() &&
    !!senderAddress.trim() &&
    !!receiverName.trim() &&
    !!receiverPhone.trim() &&
    !!receiverAddress.trim() &&
    !!packageContents.trim();

  const handleSubmit = () => {
    if (!isValid) {
      triggerHaptic("error");
      Alert.alert(
        "Missing details",
        "Please fill in sender, receiver and package contents."
      );
      return;
    }
    if (!deviceId) {
      triggerHaptic("error");
      Alert.alert("Error", "Unable to identify device. Please try again.");
      return;
    }

    const fare = parseFloat(calculateFare());
    const weight = parseFloat(packageWeight) || undefined;
    const value = parseFloat(declaredValue) || undefined;
    const insuranceFee = value && value > 500 ? value * 0.02 : 0;

    createPackageMutation.mutate({
      senderName: senderName.trim(),
      senderPhone: senderPhone.trim(),
      senderAddress: senderAddress.trim(),
      receiverName: receiverName.trim(),
      receiverPhone: receiverPhone.trim(),
      receiverAddress: receiverAddress.trim(),
      contents: packageContents.trim(),
      weight,
      dimensions: packageDimensions.trim() || undefined,
      declaredValue: value,
      fare,
      insuranceFee,
      deviceId,
      status: "pending",
    });
  };

  const fare = calculateFare();

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
      <KeyboardAwareScrollViewCompat
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing["3xl"] },
        ]}
      >
        {/* Rose gradient hero */}
        <LinearGradient
          colors={BrandColors.gradient.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + Spacing.lg }]}
        >
          <Animated.View entering={FadeIn.duration(300)}>
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
            entering={FadeIn.duration(400).delay(100)}
            style={styles.heroBadgeWrap}
          >
            <View style={styles.heroBadge}>
              <Feather
                name="send"
                size={32}
                color={BrandColors.primary.gradientStart}
              />
            </View>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(500).delay(150)}
            style={styles.heroText}
          >
            <ThemedText style={styles.heroTitle}>Send a package</ThemedText>
            <ThemedText style={styles.heroSubtitle}>
              Ship anywhere in SA via the taxi network.
            </ThemedText>
          </Animated.View>
        </LinearGradient>

        {/* Floating content card */}
        <Animated.View
          entering={FadeInUp.duration(500).delay(200)}
          style={[
            styles.contentCard,
            { backgroundColor: theme.backgroundRoot },
          ]}
        >
          <FormSection title="Sender details" icon="user" theme={theme}>
            <InputField
              label="Full name"
              value={senderName}
              onChangeText={setSenderName}
              placeholder="Enter sender's name"
            />
            <InputField
              label="Phone number"
              value={senderPhone}
              onChangeText={setSenderPhone}
              placeholder="071 234 5678"
              keyboardType="phone-pad"
            />
            <InputField
              label="Pickup address"
              value={senderAddress}
              onChangeText={setSenderAddress}
              placeholder="Enter pickup location"
              multiline
            />
          </FormSection>

          <FormSection title="Receiver details" icon="users" theme={theme}>
            <InputField
              label="Full name"
              value={receiverName}
              onChangeText={setReceiverName}
              placeholder="Enter receiver's name"
            />
            <InputField
              label="Phone number"
              value={receiverPhone}
              onChangeText={setReceiverPhone}
              placeholder="071 234 5678"
              keyboardType="phone-pad"
            />
            <InputField
              label="Delivery address"
              value={receiverAddress}
              onChangeText={setReceiverAddress}
              placeholder="Enter delivery location"
              multiline
            />
          </FormSection>

          <FormSection title="Package details" icon="package" theme={theme}>
            <InputField
              label="Contents"
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
                  label="Dimensions"
                  value={packageDimensions}
                  onChangeText={setPackageDimensions}
                  placeholder="L × W × H"
                />
              </View>
            </View>
            <InputField
              label="Declared value (R)"
              value={declaredValue}
              onChangeText={setDeclaredValue}
              placeholder="0.00"
              keyboardType="numeric"
            />
          </FormSection>

          {/* Fare card — rose gradient */}
          <Animated.View
            entering={FadeInUp.duration(500).delay(300)}
            style={styles.fareCardWrap}
          >
            <LinearGradient
              colors={BrandColors.gradient.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.fareCard}
            >
              <View style={styles.fareTopRow}>
                <ThemedText style={styles.fareLabel}>ESTIMATED FARE</ThemedText>
                <Feather
                  name="info"
                  size={14}
                  color="rgba(255,255,255,0.7)"
                />
              </View>
              <View style={styles.fareAmountRow}>
                <ThemedText style={styles.fareCurrency}>R</ThemedText>
                <ThemedText style={styles.fareAmount}>{fare}</ThemedText>
              </View>
              <ThemedText style={styles.fareNote}>
                Includes base fare, weight fee, and insurance for items over
                R500
              </ThemedText>
            </LinearGradient>
          </Animated.View>

          {/* Submit */}
          <View style={styles.cta}>
            <GradientButton
              onPress={handleSubmit}
              disabled={!isValid || createPackageMutation.isPending}
              size="large"
              icon={createPackageMutation.isPending ? undefined : "arrow-right"}
              iconPosition="right"
            >
              {createPackageMutation.isPending
                ? "Creating shipment..."
                : "Create shipment"}
            </GradientButton>
          </View>
        </Animated.View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

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
  hero: {
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

  // Content card
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

  // Form sections
  formSection: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    ...Typography.h4,
    fontSize: 16,
  },
  sectionCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },

  // Input fields
  inputField: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    ...Typography.label,
    letterSpacing: 1.2,
    fontSize: 11,
    marginBottom: Spacing.xs,
  },
  textInput: {
    height: 48,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
  },
  textInputMultiline: {
    minHeight: 80,
    paddingTop: Spacing.md,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  halfInput: {
    flex: 1,
  },

  // Fare card
  fareCardWrap: {
    marginBottom: Spacing.xl,
  },
  fareCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius["2xl"],
    shadowColor: BrandColors.primary.gradientStart,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  fareTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  fareLabel: {
    ...Typography.label,
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
    letterSpacing: 1.4,
  },
  fareAmountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  fareCurrency: {
    ...Typography.h3,
    color: "rgba(255,255,255,0.85)",
    fontWeight: "600",
  },
  fareAmount: {
    color: "#FFFFFF",
    fontSize: 38,
    fontWeight: "800",
    fontFamily: "SpaceGrotesk_700Bold",
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.5,
  },
  fareNote: {
    ...Typography.small,
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    marginTop: Spacing.sm,
  },

  // CTA
  cta: {
    marginBottom: Spacing.lg,
  },
});
