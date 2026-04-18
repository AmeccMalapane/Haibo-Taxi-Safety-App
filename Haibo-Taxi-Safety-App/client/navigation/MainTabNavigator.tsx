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
import WalletScreen from "@/screens/WalletScreen";
import DriverDashboardScreen from "@/screens/DriverDashboardScreen";
import OwnerDashboardScreen from "@/screens/OwnerDashboardScreen";
import VendorDashboardScreen from "@/screens/VendorDashboardScreen";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { BrandColors } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { SOSButton } from "@/components/SOSButton";

// Role-aware 5-tab navigator with the central Haibo SOS button always
// in the center slot (safety is every role's highest priority). The
// outer tabs rotate based on user.role so each role sees the surfaces
// that matter to them first:
//
//   commuter → Home · Fare · [SOS] · Community · Pusha      (legacy)
//   driver   → Dashboard · Rides · [SOS] · Community · Wallet
//   owner    → Dashboard · Fleet · [SOS] · Community · Wallet
//   vendor   → Dashboard · Directory · [SOS] · Community · Wallet
//
// Admin role gets the commuter tabs (admins also ride taxis). Their
// admin surfaces live in the command-center app, not mobile.
//
// Profile and Menu stay in the FloatingHeader corners on any screen
// that renders it — those aren't role-specific and work the same for
// every user.

export type MainTabParamList = {
  HomeTab: undefined;
  TaxiFareTab: undefined;
  SOSTab: undefined;
  CommunityTab: undefined;
  PushaTab: undefined;
  // Role-specific tab names — declared so nav type-checks; unused tabs
  // for a given role are simply not registered on that render.
  DashboardTab: undefined;
  WalletTab: undefined;
  FleetTab: undefined;
  DirectoryTab: undefined;
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

// ─── Role tab config ──────────────────────────────────────────────────
//
// Each role declares its own 4 outer tabs. The SOS tab is injected in
// the center by MainTabNavigator itself (roles can't disable it), so
// this config only lists the outer four. `initialRoute` is the tab
// key a user lands on after login.

type RoleRole = "commuter" | "driver" | "owner" | "vendor" | "admin";

interface TabDef {
  name: keyof MainTabParamList;
  component: React.ComponentType<any>;
  icon: keyof typeof Feather.glyphMap;
  label: string;
}

interface RoleTabConfig {
  leftTabs: [TabDef, TabDef];
  rightTabs: [TabDef, TabDef];
  initialRoute: keyof MainTabParamList;
}

const TAB_CONFIG: Record<RoleRole, RoleTabConfig> = {
  commuter: {
    leftTabs: [
      { name: "HomeTab", component: HomeStackNavigator, icon: "map", label: "Home and map" },
      { name: "TaxiFareTab", component: TaxiFareScreen, icon: "tag", label: "Taxi fares" },
    ],
    rightTabs: [
      { name: "CommunityTab", component: CommunityScreen, icon: "users", label: "Community hub" },
      { name: "PushaTab", component: PushaScreen, icon: "play-circle", label: "Phusha reels" },
    ],
    initialRoute: "HomeTab",
  },
  driver: {
    leftTabs: [
      { name: "DashboardTab", component: DriverDashboardScreen, icon: "bar-chart-2", label: "Driver dashboard" },
      { name: "TaxiFareTab", component: TaxiFareScreen, icon: "tag", label: "Fare reference" },
    ],
    rightTabs: [
      { name: "CommunityTab", component: CommunityScreen, icon: "users", label: "Community hub" },
      { name: "WalletTab", component: WalletScreen, icon: "credit-card", label: "Wallet" },
    ],
    initialRoute: "DashboardTab",
  },
  owner: {
    leftTabs: [
      { name: "DashboardTab", component: OwnerDashboardScreen, icon: "bar-chart-2", label: "Owner dashboard" },
      // "Fleet" tab routes to the same component because invitations are
      // fleet management — keeps the navigation model consistent without
      // a new screen for Phase E.
      { name: "FleetTab", component: OwnerDashboardScreen, icon: "truck", label: "Fleet" },
    ],
    rightTabs: [
      { name: "CommunityTab", component: CommunityScreen, icon: "users", label: "Community hub" },
      { name: "WalletTab", component: WalletScreen, icon: "credit-card", label: "Wallet" },
    ],
    initialRoute: "DashboardTab",
  },
  vendor: {
    leftTabs: [
      { name: "DashboardTab", component: VendorDashboardScreen, icon: "bar-chart-2", label: "Vendor dashboard" },
      { name: "DirectoryTab", component: HomeStackNavigator, icon: "map", label: "Explore map" },
    ],
    rightTabs: [
      { name: "CommunityTab", component: CommunityScreen, icon: "users", label: "Community hub" },
      { name: "WalletTab", component: WalletScreen, icon: "credit-card", label: "Wallet" },
    ],
    initialRoute: "DashboardTab",
  },
  // Admin users see commuter tabs on mobile — their admin surfaces
  // live in the command-center web app.
  admin: {
    leftTabs: [
      { name: "HomeTab", component: HomeStackNavigator, icon: "map", label: "Home and map" },
      { name: "TaxiFareTab", component: TaxiFareScreen, icon: "tag", label: "Taxi fares" },
    ],
    rightTabs: [
      { name: "CommunityTab", component: CommunityScreen, icon: "users", label: "Community hub" },
      { name: "PushaTab", component: PushaScreen, icon: "play-circle", label: "Phusha reels" },
    ],
    initialRoute: "HomeTab",
  },
};

function getRoleTabConfig(role?: string | null): RoleTabConfig {
  if (role === "driver" || role === "owner" || role === "vendor" || role === "admin") {
    return TAB_CONFIG[role];
  }
  return TAB_CONFIG.commuter;
}

export default function MainTabNavigator() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, activeRole } = useAuth();

  // activeRole is the user-selected persona (falls back to user.role for
  // legacy sessions before role switching existed).
  const config = getRoleTabConfig(activeRole || user?.role);

  // Render helper so the 4 outer tabs and the SOS slot share one code
  // path. Each TabDef gets turned into a <Tab.Screen> with the standard
  // TabIcon treatment.
  const renderTab = (def: TabDef) => (
    <Tab.Screen
      key={def.name}
      name={def.name}
      component={def.component}
      options={{
        tabBarIcon: (props) => <TabIcon name={def.icon} {...props} />,
        tabBarAccessibilityLabel: def.label,
      }}
    />
  );

  // Force a fresh tab stack whenever the active persona changes so a
  // role swap (e.g. driver → owner) actually swaps the DashboardTab
  // component instead of showing a cached version of the previous role.
  const navigatorKey = `tabs-${activeRole || user?.role || "commuter"}`;

  return (
    <View style={styles.container}>
      <Tab.Navigator
        key={navigatorKey}
        initialRouteName={config.initialRoute}
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
        {renderTab(config.leftTabs[0])}
        {renderTab(config.leftTabs[1])}

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

        {renderTab(config.rightTabs[0])}
        {renderTab(config.rightTabs[1])}
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
