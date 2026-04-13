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

import { BrandColors } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface SOSButtonProps {
  /** When true, the button skips its own absolute positioning so a parent
   *  (e.g. a custom tab bar slot) can place it. */
  inline?: boolean;
}

// Memoized to prevent re-renders during navigation transitions.
export const SOSButton = memo(({ inline = false }: SOSButtonProps) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const scale = useSharedValue(1);
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.35);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withTiming(1.18, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
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

  return (
    <View
      style={inline ? styles.inlineContainer : styles.absoluteContainer}
      pointerEvents="box-none"
    >
      <Animated.View style={[styles.pulse, animatedPulseStyle]} />
      <AnimatedPressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.button, animatedButtonStyle]}
        accessibilityLabel="SOS Emergency"
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

const SOS_SIZE = 64;

const styles = StyleSheet.create({
  // Inline mode — used inside a tab bar slot, parent handles positioning
  inlineContainer: {
    width: SOS_SIZE,
    height: SOS_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  // Legacy absolute mode — kept so the component can still float standalone
  absoluteContainer: {
    position: "absolute",
    bottom: 100,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  pulse: {
    position: "absolute",
    width: SOS_SIZE,
    height: SOS_SIZE,
    borderRadius: SOS_SIZE / 2,
    backgroundColor: BrandColors.primary.gradientStart,
  },
  button: {
    width: SOS_SIZE,
    height: SOS_SIZE,
    borderRadius: SOS_SIZE / 2,
    backgroundColor: BrandColors.primary.gradientStart,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: BrandColors.primary.redDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  icon: {
    width: 36,
    height: 36,
  },
});
