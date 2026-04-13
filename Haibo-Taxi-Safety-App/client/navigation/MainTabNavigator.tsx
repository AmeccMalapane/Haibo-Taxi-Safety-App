import React, { memo } from "react";
import { View, StyleSheet, Platform, Dimensions, Image } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import HomeStackNavigator from "@/navigation/HomeStackNavigator";
import { useTheme } from "@/hooks/useTheme";
import { BrandColors } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { SOSButton } from "@/components/SOSButton";

export type MainTabParamList = {
  HomeTab: undefined;
  MenuTab: undefined;
  ProfileTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

function EmptyScreen() {
  return <View style={{ flex: 1 }} />;
}

// Memoized Icon component to prevent re-renders of the whole tab bar
const TabIcon = memo(({ name, focused, color, isHome }: { name: any, focused: boolean, color: string, isHome?: boolean }) => (
  <View style={[styles.iconContainer, focused && styles.activeIconContainer]}>
    {isHome && focused ? (
      <Image
        source={require("../../assets/images/icon.png")}
        style={styles.homeIcon}
        resizeMode="contain"
      />
    ) : (
      <Feather name={name} size={24} color={focused ? "#FFFFFF" : color} />
    )}
  </View>
));

export default function MainTabNavigator() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const tabBarHeight = 70;

  return (
    <View style={styles.container}>
      <Tab.Navigator
        initialRouteName="HomeTab"
        screenOptions={{
          tabBarActiveTintColor: BrandColors.primary.red,
          tabBarInactiveTintColor: theme.textSecondary,
          tabBarShowLabel: false,
          // Optimization: Lazy loading for tabs
          lazy: true,
          tabBarStyle: {
            position: "absolute",
            bottom: insets.bottom + 12,
            left: 16,
            right: 16,
            height: 70,
            backgroundColor: Platform.OS === 'ios' ? "transparent" : theme.backgroundSecondary,
            borderRadius: 35,
            borderTopWidth: 0,
            elevation: 8,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 10,
            paddingHorizontal: 8,
            // Optimization: hardware acceleration
            transform: [{ translateZ: 0 }] as any,
          },
          tabBarBackground: () =>
            Platform.OS === "ios" ? (
              <BlurView
                intensity={80}
                tint={isDark ? "dark" : "light"}
                style={[StyleSheet.absoluteFill, { borderRadius: 35, overflow: 'hidden' }]}
              />
            ) : null,
          headerShown: false,

        }}
      >
        <Tab.Screen
          name="HomeTab"
          component={HomeStackNavigator}
          options={{
            tabBarIcon: (props) => <TabIcon name="home" isHome {...props} />,
          }}
        />

        <Tab.Screen
          name="MenuTab"
          component={EmptyScreen}
          options={{
            tabBarIcon: (props) => <TabIcon name="menu" {...props} />,
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              navigation.navigate("Menu");
            },
          }}
        />

        <Tab.Screen
          name="ProfileTab"
          component={EmptyScreen}
          options={{
            tabBarIcon: (props) => <TabIcon name="user" {...props} />,
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              navigation.navigate("Profile");
            },
          }}
        />
      </Tab.Navigator>
      <SOSButton tabBarHeight={tabBarHeight + insets.bottom} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  activeIconContainer: {
    backgroundColor: BrandColors.primary.red,
    shadowColor: BrandColors.primary.red,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  homeIcon: {
    width: 28,
    height: 28,
  },
});
