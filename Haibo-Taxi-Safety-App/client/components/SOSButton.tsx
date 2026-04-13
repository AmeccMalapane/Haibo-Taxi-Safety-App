import React, { useEffect, memo } from "react";
import { StyleSheet, Pressable, View, Platform, Image } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

import { BrandColors, Spacing } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface SOSButtonProps {
  tabBarHeight?: number;
}

// Memoize the button to prevent unnecessary re-renders during navigation
export const SOSButton = memo(({ tabBarHeight = 80 }: SOSButtonProps) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  
  const scale = useSharedValue(1);
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.3);

  useEffect(() => {
    // Optimization: Start animations on mount and let them run on UI thread
    pulseScale.value = withRepeat(
      withTiming(1.15, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    pulseOpacity.value = withRepeat(
      withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const handlePress = async () => {
    if (Platform.OS !== "web") {
      try {
        const Haptics = require("expo-haptics");
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } catch {}
    }
    const parent = navigation.getParent();
    if (parent) {
      parent.navigate("Emergency");
    } else {
      navigation.navigate("Emergency" as never);
    }
  };

  const handlePressIn = () => {
    scale.value = withSpring(0.92, { damping: 15, stiffness: 200 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  };

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const animatedPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const bottomOffset = tabBarHeight + Spacing.xl;

  return (
    <View
      style={[
        styles.container,
        { bottom: bottomOffset },
      ]}
      pointerEvents="box-none"
    >
      <Animated.View style={[styles.pulse, animatedPulseStyle]} />
      <AnimatedPressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.button, animatedButtonStyle]}
        accessibilityLabel="SOS Emergency Button"
        accessibilityRole="button"
      >
        <Image
          source={require("../../assets/images/icon.png")}
          style={styles.icon}
          resizeMode="contain"
        />
      </AnimatedPressable>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    right: Spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  pulse: {
    position: "absolute",
    width: Spacing.sosButtonSize,
    height: Spacing.sosButtonSize,
    borderRadius: Spacing.sosButtonSize / 2,
    backgroundColor: BrandColors.primary.red,
  },
  button: {
    width: Spacing.sosButtonSize,
    height: Spacing.sosButtonSize,
    borderRadius: Spacing.sosButtonSize / 2,
    backgroundColor: BrandColors.primary.red,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: BrandColors.primary.redDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  icon: {
    width: Spacing.iconSizeLarge * 1.4,
    height: Spacing.iconSizeLarge * 1.4,
  },
});
