import React, { useState, useEffect, Component, PropsWithChildren } from "react";
import { StyleSheet, View, ActivityIndicator, Text, ScrollView, Pressable } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SplashScreen from "expo-splash-screen";
import * as Font from "expo-font";
import { Feather, Ionicons, MaterialIcons, FontAwesome } from "@expo/vector-icons";
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";

SplashScreen.preventAutoHideAsync();

import RootStackNavigator from "@/navigation/RootStackNavigator";
import OnboardingScreen from "@/screens/OnboardingScreen";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { useAuth } from "@/hooks/useAuth";
import { registerForPushNotifications, onNotificationReceived, onNotificationTapped } from "@/lib/notifications";
import { connectSocket, disconnectSocket } from "@/lib/socket";

const ONBOARDING_KEY = "@haibo_onboarding_complete";

// ─── Safe Error Boundary ─────────────────────────────────────────────────────
type SafeErrorState = { error: Error | null; errorInfo: string };

class SafeErrorBoundary extends Component<PropsWithChildren<{}>, SafeErrorState> {
  state: SafeErrorState = { error: null, errorInfo: "" };

  static getDerivedStateFromError(error: Error): Partial<SafeErrorState> {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    this.setState({ errorInfo: info.componentStack });
  }

  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, backgroundColor: "#ffffff", padding: 24, paddingTop: 60 }}>
          <Text style={{ color: "#E72369", fontSize: 22, fontWeight: "bold", marginBottom: 8 }}>
            Something went wrong
          </Text>
          <Text style={{ color: "#333333", fontSize: 14, marginBottom: 16 }}>
            {this.state.error.message}
          </Text>
          <Pressable
            onPress={() => this.setState({ error: null, errorInfo: "" })}
            style={{
              backgroundColor: "#E72369",
              paddingVertical: 12,
              paddingHorizontal: 24,
              borderRadius: 8,
              alignSelf: "flex-start",
              marginBottom: 16,
            }}
          >
            <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "600" }}>Try Again</Text>
          </Pressable>
          <ScrollView style={{ flex: 1 }}>
            <Text style={{ color: "#666666", fontSize: 11, fontFamily: "monospace" }}>
              {this.state.error.stack}
            </Text>
            <Text style={{ color: "#E72369", fontSize: 13, fontWeight: "bold", marginTop: 16 }}>
              Component Stack:
            </Text>
            <Text style={{ color: "#666666", fontSize: 11, fontFamily: "monospace" }}>
              {this.state.errorInfo}
            </Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

// ─── Auth-Gated Navigation ───────────────────────────────────────────────────
function AuthGatedApp() {
  const { isAuthenticated, isGuest, isLoading: authLoading } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  // Connect real-time socket + register push notifications after login
  useEffect(() => {
    if (isAuthenticated) {
      connectSocket();
      registerForPushNotifications();

      const sub1 = onNotificationReceived((notification) => {
        console.log("[Notification]", notification.request.content.title);
      });
      const sub2 = onNotificationTapped((response) => {
        console.log("[Notification Tap]", response.notification.request.content.data);
      });

      return () => {
        sub1.remove();
        sub2.remove();
        disconnectSocket();
      };
    }
  }, [isAuthenticated]);

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      const hasCompleted = await AsyncStorage.getItem(ONBOARDING_KEY);
      setShowOnboarding(hasCompleted !== "true");
    } catch {
      setShowOnboarding(false);
    } finally {
      setOnboardingChecked(true);
    }
  };

  const handleOnboardingComplete = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, "true");
    } catch (error) {
      console.error("Failed to save onboarding status:", error);
    }
    setShowOnboarding(false);
  };

  // Still loading auth or onboarding check
  if (authLoading || !onboardingChecked) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E72369" />
      </View>
    );
  }

  // Show onboarding first if not completed
  if (showOnboarding) {
    return <OnboardingScreen onComplete={handleOnboardingComplete} />;
  }

  // Main app — RootStackNavigator handles auth vs main routing
  return (
    <NavigationContainer>
      <RootStackNavigator />
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}

// ─── Fonts Loader ────────────────────────────────────────────────────────────
function AppWithFonts() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    async function loadFonts() {
      try {
        await Font.loadAsync({
          ...Feather.font,
          ...Ionicons.font,
          ...MaterialIcons.font,
          ...FontAwesome.font,
          SpaceGrotesk_500Medium,
          SpaceGrotesk_600SemiBold,
          SpaceGrotesk_700Bold,
          Inter_400Regular,
          Inter_500Medium,
          Inter_600SemiBold,
          Inter_700Bold,
        });
      } catch (e) {
        console.warn("Error loading fonts:", e);
      } finally {
        setFontsLoaded(true);
      }
    }
    loadFonts();
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E72369" />
      </View>
    );
  }

  return <AuthGatedApp />;
}

// ─── Root ────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <SafeErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemeProvider>
            <AuthProvider>
              <QueryClientProvider client={queryClient}>
                <AppWithFonts />
              </QueryClientProvider>
            </AuthProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </SafeErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
