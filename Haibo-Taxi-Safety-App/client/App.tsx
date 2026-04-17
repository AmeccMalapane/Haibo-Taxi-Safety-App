import "@/i18n";
import React, { useState, useEffect, Component, PropsWithChildren, useMemo } from "react";
import { StyleSheet, View, ActivityIndicator, Text, ScrollView, Pressable } from "react-native";
import { NavigationContainer, LinkingOptions } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SplashScreen from "expo-splash-screen";
import * as Font from "expo-font";
import * as Linking from "expo-linking";
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

import RootStackNavigator, { RootStackParamList } from "@/navigation/RootStackNavigator";
import OnboardingScreen from "@/screens/OnboardingScreen";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { useAuth } from "@/hooks/useAuth";
import { getLinkingConfig } from "@/lib/deepLinks";
import { registerForPushNotifications, onNotificationReceived, onNotificationTapped } from "@/lib/notifications";
import { connectSocket, disconnectSocket } from "@/lib/socket";
import { restoreSavedLanguage } from "@/hooks/useLanguage";
import i18n from "@/i18n";

const ONBOARDING_KEY = "@haibo_onboarding_complete";
// Versioned POPIA consent key. Bump the suffix (e.g. _v2) when the privacy
// policy or terms change materially so existing users are forced through the
// onboarding consent gate again. The onboarding marketing slides are tied to
// this key, so bumping it replays the full flow — acceptable since we'd only
// bump when users genuinely need to re-read the new policy.
const CONSENT_KEY = "@haibo_consent_accepted_v1";

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
          <Text style={{ color: "#C81E5E", fontSize: 22, fontWeight: "bold", marginBottom: 8 }}>
            Something went wrong
          </Text>
          <Text style={{ color: "#333333", fontSize: 14, marginBottom: 16 }}>
            {this.state.error.message}
          </Text>
          <Pressable
            onPress={() => this.setState({ error: null, errorInfo: "" })}
            style={{
              backgroundColor: "#C81E5E",
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
            <Text style={{ color: "#C81E5E", fontSize: 13, fontWeight: "bold", marginTop: 16 }}>
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
      const [hasCompleted, hasConsented] = await Promise.all([
        AsyncStorage.getItem(ONBOARDING_KEY),
        AsyncStorage.getItem(CONSENT_KEY),
      ]);
      // Both gates must be green. If the privacy policy version is bumped,
      // CONSENT_KEY changes and the user goes back through onboarding.
      setShowOnboarding(hasCompleted !== "true" || hasConsented !== "true");
    } catch {
      setShowOnboarding(true);
    } finally {
      setOnboardingChecked(true);
    }
  };

  const handleOnboardingComplete = async () => {
    try {
      await Promise.all([
        AsyncStorage.setItem(ONBOARDING_KEY, "true"),
        AsyncStorage.setItem(CONSENT_KEY, "true"),
      ]);
    } catch (error) {
      console.error("Failed to save onboarding status:", error);
    }
    setShowOnboarding(false);
  };

  // useMemo MUST be called before any early return — React requires hooks
  // to fire in the same order on every render. The old placement (after the
  // loading/onboarding guards) caused "Rendered more hooks than during the
  // previous render" because the first render hit the early return (5 hooks)
  // and the second render fell through to useMemo (6 hooks).
  const linking = useMemo<LinkingOptions<RootStackParamList>>(
    () => ({
      prefixes: [
        Linking.createURL("/"),
        "haibo-taxi://",
        "https://haibo.africa",
        "https://www.haibo.africa",
      ],
      config: {
        screens: getLinkingConfig() as any,
      },
    }),
    []
  );

  if (authLoading || !onboardingChecked) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#C81E5E" />
      </View>
    );
  }

  if (showOnboarding) {
    return <OnboardingScreen onComplete={handleOnboardingComplete} />;
  }

  return (
    <NavigationContainer linking={linking}>
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
      await restoreSavedLanguage(i18n);
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
        <ActivityIndicator size="large" color="#C81E5E" />
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
