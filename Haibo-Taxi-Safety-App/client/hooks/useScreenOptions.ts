import { Platform } from "react-native";
import { NativeStackNavigationOptions } from "@react-navigation/native-stack";

import { useTheme } from "@/hooks/useTheme";

interface UseScreenOptionsParams {
  transparent?: boolean;
}

export function useScreenOptions({
  transparent = false,
}: UseScreenOptionsParams = {}): NativeStackNavigationOptions {
  const { theme, isDark } = useTheme();

  if (transparent) {
    return {
      headerTitleAlign: "center",
      headerTransparent: true,
      headerBlurEffect: isDark ? "dark" : "light",
      headerTintColor: theme.text,
      headerStyle: {
        backgroundColor: Platform.select({
          ios: undefined,
          android: "transparent",
        }),
      },
      headerShadowVisible: false,
      gestureEnabled: true,
      gestureDirection: "horizontal",
      fullScreenGestureEnabled: true,
      contentStyle: {
        backgroundColor: theme.backgroundRoot,
      },
    };
  }

  return {
    headerTitleAlign: "center",
    headerTransparent: false,
    headerTintColor: theme.text,
    headerStyle: {
      backgroundColor: theme.backgroundRoot,
    },
    headerShadowVisible: false,
    gestureEnabled: true,
    gestureDirection: "horizontal",
    fullScreenGestureEnabled: true,
    contentStyle: {
      backgroundColor: theme.backgroundRoot,
    },
  };
}
