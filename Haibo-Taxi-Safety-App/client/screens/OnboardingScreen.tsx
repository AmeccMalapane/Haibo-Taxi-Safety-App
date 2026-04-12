import React, { useState, useRef } from "react";
import {
  StyleSheet,
  View,
  FlatList,
  Dimensions,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
  ScrollView,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";

const { width, height } = Dimensions.get("window");

interface OnboardingSlide {
  id: string;
  title: string;
  description: string;
  image: any;
}

const SLIDES: OnboardingSlide[] = [
  {
    id: "1",
    title: "Safety First",
    description: "Your safety is our priority. One-tap SOS and real-time tracking for every ride.",
    image: require("../assets/svg/SOS.svg"),
  },
  {
    id: "2",
    title: "Reliable Navigation",
    description: "Find the nearest taxi ranks and optimized routes across South Africa.",
    image: require("../assets/svg/TXISTOP.svg"),
  },
  {
    id: "3",
    title: "Strong Community",
    description: "Connect with other commuters, share updates, and find lost items together.",
    image: require("../assets/svg/COMMUNITY.svg"),
  },
  {
    id: "4",
    title: "Seamless Payments",
    description: "Pay for your rides digitally with Haibo Pay. Fast, secure, and cashless.",
    image: require("../assets/svg/FINDRNKS.svg"),
  },
];

interface OnboardingScreenProps {
  onComplete: (role: "driver" | "commuter", driverData?: any) => void;
}

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showRoleSelection, setShowRoleSelection] = useState(false);
  const [userRole, setUserRole] = useState<"driver" | "commuter" | null>(null);
  
  // Driver Form State
  const [driverName, setDriverName] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  
  const flatListRef = useRef<FlatList>(null);

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      const nextIndex = currentIndex + 1;
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setCurrentIndex(nextIndex);
    } else {
      setShowRoleSelection(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const handleDriverSubmit = () => {
    if (!driverName || !plateNumber) {
      Alert.alert("Required", "Please provide your name and taxi plate number.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    
    // Generate reference code from plate number
    const refCode = `HB-${plateNumber.replace(/\s/g, "").toUpperCase()}`;
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onComplete("driver", {
      name: driverName,
      plateNumber: plateNumber,
      refCode: refCode,
      trackingEnabled: true,
    });
  };

  const renderSlide = ({ item }: { item: OnboardingSlide }) => (
    <View style={[styles.slide, { width }]}>
      <View style={styles.imageContainer}>
        <Image source={item.image} style={styles.image} resizeMode="contain" />
      </View>
      <View style={styles.textContainer}>
        <ThemedText style={styles.title}>{item.title}</ThemedText>
        <ThemedText style={[styles.description, { color: theme.textSecondary }]}>
          {item.description}
        </ThemedText>
      </View>
    </View>
  );

  if (showRoleSelection) {
    if (userRole === "driver") {
      return (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={[styles.container, { backgroundColor: theme.backgroundDefault }]}
        >
          <ScrollView contentContainerStyle={[styles.formContainer, { paddingTop: insets.top + 20 }]}>
            <Pressable onPress={() => setUserRole(null)} style={styles.backButton}>
              <Feather name="arrow-left" size={24} color={theme.text} />
            </Pressable>
            
            <ThemedText style={styles.roleTitle}>Driver Registration</ThemedText>
            <ThemedText style={[styles.roleSubtitle, { color: theme.textSecondary }]}>
              Register to receive Haibo Pay and track your routes.
            </ThemedText>

            <View style={styles.inputGroup}>
              <ThemedText style={styles.label}>Full Name</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                placeholder="Enter your name"
                placeholderTextColor={theme.textSecondary}
                value={driverName}
                onChangeText={setDriverName}
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={styles.label}>Taxi Plate Number</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                placeholder="e.g. GP 123 456"
                placeholderTextColor={theme.textSecondary}
                value={plateNumber}
                onChangeText={setPlateNumber}
                autoCapitalize="characters"
              />
            </View>

            <View style={[styles.infoBox, { backgroundColor: BrandColors.primary.blue + "10" }]}>
              <Feather name="info" size={20} color={BrandColors.primary.blue} />
              <ThemedText style={[styles.infoText, { color: theme.textSecondary }]}>
                Your plate number will be used to generate your unique Haibo Pay reference code.
              </ThemedText>
            </View>

            <Button title="Complete Registration" onPress={handleDriverSubmit} />
          </ScrollView>
        </KeyboardAvoidingView>
      );
    }

    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top + 40 }]}>
        <View style={styles.roleHeader}>
          <ThemedText style={styles.roleTitle}>Choose Your Role</ThemedText>
          <ThemedText style={[styles.roleSubtitle, { color: theme.textSecondary }]}>
            Tell us how you'll be using Haibo!
          </ThemedText>
        </View>

        <View style={styles.roleOptions}>
          <Pressable
            style={[styles.roleCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              onComplete("commuter");
            }}
          >
            <LinearGradient colors={["#4facfe", "#00f2fe"]} style={styles.roleIcon}>
              <Feather name="user" size={32} color="#FFF" />
            </LinearGradient>
            <View style={styles.roleText}>
              <ThemedText style={styles.roleName}>I am a Commuter</ThemedText>
              <ThemedText style={[styles.roleDesc, { color: theme.textSecondary }]}>
                I want to find safe rides and pay digitally.
              </ThemedText>
            </View>
            <Feather name="chevron-right" size={20} color={theme.textSecondary} />
          </Pressable>

          <Pressable
            style={[styles.roleCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => {
              setUserRole("driver");
              Haptics.selectionAsync();
            }}
          >
            <LinearGradient colors={BrandColors.gradient.primary} style={styles.roleIcon}>
              <Feather name="truck" size={32} color="#FFF" />
            </LinearGradient>
            <View style={styles.roleText}>
              <ThemedText style={styles.roleName}>I am a Taxi Driver</ThemedText>
              <ThemedText style={[styles.roleDesc, { color: theme.textSecondary }]}>
                I want to track my routes and receive payments.
              </ThemedText>
            </View>
            <Feather name="chevron-right" size={20} color={theme.textSecondary} />
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          setCurrentIndex(index);
        }}
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.pagination}>
          {SLIDES.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  backgroundColor: index === currentIndex ? BrandColors.primary.red : theme.border,
                  width: index === currentIndex ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>

        <Pressable onPress={handleNext} style={styles.buttonContainer}>
          <LinearGradient
            colors={[BrandColors.primary.red, "#EA4F52"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.button}
          >
            <ThemedText style={styles.buttonText}>
              {currentIndex === SLIDES.length - 1 ? "Get Started" : "Next"}
            </ThemedText>
            <Feather name={currentIndex === SLIDES.length - 1 ? "check" : "arrow-right"} size={20} color="#FFF" />
          </LinearGradient>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  slide: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  imageContainer: { width: "100%", height: height * 0.4, alignItems: "center", justifyContent: "center" },
  image: { width: "100%", height: "100%" },
  textContainer: { alignItems: "center", marginTop: Spacing.xl, paddingHorizontal: 20 },
  title: { fontSize: 28, fontWeight: "800", textAlign: "center", marginBottom: Spacing.md },
  description: { fontSize: 16, textAlign: "center", lineHeight: 24 },
  footer: { paddingHorizontal: Spacing.xl },
  pagination: { flexDirection: "row", justifyContent: "center", marginBottom: Spacing.xl, gap: 8 },
  dot: { height: 8, borderRadius: 4 },
  buttonContainer: { width: "100%" },
  button: { height: 56, borderRadius: BorderRadius.lg, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  buttonText: { color: "#FFF", fontSize: 18, fontWeight: "700" },
  // Role Selection
  roleHeader: { paddingHorizontal: 30, marginBottom: 40 },
  roleTitle: { fontSize: 32, fontWeight: "900", marginBottom: 8 },
  roleSubtitle: { fontSize: 18, opacity: 0.7 },
  roleOptions: { paddingHorizontal: 20, gap: 16 },
  roleCard: { flexDirection: "row", alignItems: "center", padding: 20, borderRadius: BorderRadius.lg, borderWidth: 1, gap: 16 },
  roleIcon: { width: 60, height: 60, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  roleText: { flex: 1 },
  roleName: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  roleDesc: { fontSize: 13, opacity: 0.6 },
  // Driver Form
  formContainer: { paddingHorizontal: 25, paddingBottom: 40 },
  backButton: { marginBottom: 20 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: "700", marginBottom: 8, marginLeft: 4 },
  input: { height: 55, borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, fontSize: 16 },
  infoBox: { flexDirection: "row", padding: 16, borderRadius: 12, gap: 12, marginBottom: 30, alignItems: "center" },
  infoText: { flex: 1, fontSize: 13, lineHeight: 18 },
});
