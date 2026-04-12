import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import CommunityScreen from "@/screens/CommunityScreen";
import { ProfileButton } from "@/components/ProfileButton";
import { MenuButton } from "@/components/MenuButton";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type CommunityStackParamList = {
  Community: undefined;
};

const Stack = createNativeStackNavigator<CommunityStackParamList>();

export default function CommunityStackNavigator() {
  const screenOptions = useScreenOptions({ transparent: false });

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Community"
        component={CommunityScreen}
        options={{ 
          headerTitle: "Community",
          headerLeft: () => <MenuButton />,
          headerRight: () => <ProfileButton />,
        }}
      />
    </Stack.Navigator>
  );
}
