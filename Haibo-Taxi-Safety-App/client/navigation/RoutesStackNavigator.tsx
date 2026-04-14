import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import RoutesScreen from "@/screens/RoutesScreen";
import RouteDetailScreen from "@/screens/RouteDetailScreen";
import { ProfileButton } from "@/components/ProfileButton";
import { MenuButton } from "@/components/MenuButton";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type RoutesStackParamList = {
  Routes: undefined;
  RouteDetail: { routeId: string };
};

const Stack = createNativeStackNavigator<RoutesStackParamList>();

export default function RoutesStackNavigator() {
  const screenOptions = useScreenOptions({ transparent: false });

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Routes"
        component={RoutesScreen}
        options={{ 
          headerTitle: "Routes & Fares",
          headerLeft: () => <MenuButton />,
          headerRight: () => <ProfileButton />,
        }}
      />
      <Stack.Screen
        name="RouteDetail"
        component={RouteDetailScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
