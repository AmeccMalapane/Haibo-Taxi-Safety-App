import React, { memo } from "react";
import {
  View,
  StyleSheet,
  Platform,
  Pressable,
  GestureResponderEvent,
} from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import HomeStackNavigator from "@/navigation/HomeStackNavigator";
import TaxiFareScreen from "@/screens/TaxiFareScreen";
import CommunityScreen from "@/screens/CommunityScreen";
import PushaScreen from "@/screens/PushaScreen";
import { useTheme } from "@/hooks/useTheme";
import { BrandColors } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { SOSButton } from "@/components/SOSButton";

// 5-tab layout with the central Haibo SOS button:
//   1. Home      — taxi map, rank finder
//   2. Taxi fare — fare lookup powered by taxi_routes_fares.json
//   3. SOS       — center, raised, brand mark, navigates to Emergency
//   4. Community — Haibo community hub (groups, hashtags, posts)
//   5. Phusha    — TikTok-style reels feed (PushaScreen + phusha_content.json)
//
// Profile and Menu were removed from the tab bar at the user's request and
// are now reachable from FloatingHeader corners on Home (top-left = menu,
// top-right = profile avatar). They remain registered as root-stack screens
// so deep-link navigation from anywhere still works.
//
// The center slot uses a custom tabBarButton that renders SOSButton in
// inline mode and lifts it above the bar via negative top offset, so the
// rose-red button "pops" through the floating pill bar — same pattern as
// Uber Eats / Cash App center actions. The non-Home tabs use the existing
// EmptyScreen + listener.tabPress.preventDefault trick to navigate to
// stack screens that live in the root stack instead of inside MainTabs.

export type MainTabParamList = {
  HomeTab: undefined;
  TaxiFareTab: undefined;
  SOSTab: undefined;
  CommunityTab: undefined;
  PushaTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

function EmptyScreen() {
  return <View style={{ flex: 1 }} />;
}

const TabIcon = memo(
  ({
    name,
    focused,
    color,
  }: {
    name: keyof typeof Feather.glyphMap;
    focused: boolean;
    color: string;
  }) => (
    <View style={[styles.iconContainer, focused && styles.activeIconContainer]}>
      <Feather name={name} size={22} color={focused ? "#FFFFFF" : color} />
    </View>
  )
);

// Center slot — renders SOSButton lifted above the tab bar.
function SOSTabButton({ onPress }: { onPress?: (e: GestureResponderEvent) => void }) {
  return (
    <View style={styles.sosSlot} pointerEvents="box-none">
      <SOSButton inline />
    </View>
  );
}

export default function MainTabNavigator() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <View style={styles.container}>
      <Tab.Navigator
        initialRouteName="HomeTab"
        screenOptions={{
          tabBarActiveTintColor: BrandColors.primary.gradientStart,
          tabBarInactiveTintColor: theme.textSecondary,
          tabBarShowLabel: false,
          lazy: true,
          tabBarStyle: {
            position: "absolute",
            bottom: insets.bottom + 12,
            left: 16,
            right: 16,
            height: 70,
            backgroundColor:
              Platform.OS === "ios" ? "transparent" : theme.backgroundSecondary,
            borderRadius: 35,
            borderTopWidth: 0,
            elevation: 8,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.12,
            shadowRadius: 12,
            paddingHorizontal: 8,
            // Allow the SOS button to overflow the bar's top edge
            overflow: "visible",
            transform: [{ translateZ: 0 }] as any,
          },
          tabBarItemStyle: {
            // Allow SOS slot's lifted button to overflow upward
            overflow: "visible",
          },
          tabBarBackground: () =>
            Platform.OS === "ios" ? (
              <BlurView
                intensity={80}
                tint={isDark ? "dark" : "light"}
                style={[
                  StyleSheet.absoluteFill,
                  { borderRadius: 35, overflow: "hidden" },
                ]}
              />
            ) : null,
          headerShown: false,
        }}
      >
        <Tab.Screen
          name="HomeTab"
          component={HomeStackNavigator}
          options={{
            tabBarIcon: (props) => <TabIcon name="map" {...props} />,
            tabBarAccessibilityLabel: "Home and map",
          }}
        />

        <Tab.Screen
          name="TaxiFareTab"
          component={TaxiFareScreen}
          options={{
            tabBarIcon: (props) => <TabIcon name="dollar-sign" {...props} />,
            tabBarAccessibilityLabel: "Taxi fares",
          }}
        />

        <Tab.Screen
          name="SOSTab"
          component={EmptyScreen}
          options={{
            tabBarIcon: () => null,
            tabBarButton: (props) => (
              <Pressable
                onPress={props.onPress}
                style={styles.sosTouchTarget}
                accessibilityRole="button"
                accessibilityLabel="Emergency SOS"
              >
                <SOSTabButton onPress={props.onPress} />
              </Pressable>
            ),
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              navigation.navigate("Emergency");
            },
          }}
        />

        <Tab.Screen
          name="CommunityTab"
          component={CommunityScreen}
          options={{
            tabBarIcon: (props) => <TabIcon name="users" {...props} />,
            tabBarAccessibilityLabel: "Community hub",
          }}
        />

        <Tab.Screen
          name="PushaTab"
          component={PushaScreen}
          options={{
            tabBarIcon: (props) => <TabIcon name="play-circle" {...props} />,
            tabBarAccessibilityLabel: "Phusha reels",
          }}
        />
      </Tab.Navigator>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  activeIconContainer: {
    backgroundColor: BrandColors.primary.gradientStart,
    shadowColor: BrandColors.primary.gradientStart,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  sosTouchTarget: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sosSlot: {
    // Lift the button above the tab bar so it pops over the rounded pill.
    // -22 puts the button center roughly even with the tab bar's top edge.
    marginTop: -22,
    alignItems: "center",
    justifyContent: "center",
  },
});
