import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import PushaScreen from "@/screens/PushaScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type PushaStackParamList = {
  Pusha: undefined;
};

const Stack = createNativeStackNavigator<PushaStackParamList>();

export default function PushaStackNavigator() {
  const screenOptions = useScreenOptions({ transparent: false });

  return (
    <Stack.Navigator 
      screenOptions={{
        ...screenOptions,
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="Pusha"
        component={PushaScreen}
        options={{
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}
