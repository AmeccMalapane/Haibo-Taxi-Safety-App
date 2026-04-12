import React, { ReactNode } from "react";
import { StyleSheet, Pressable, ViewStyle, StyleProp, TextStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  WithSpringConfig,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { BorderRadius, Spacing, BrandColors } from "@/constants/theme";

interface GradientButtonProps {
  onPress?: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  disabled?: boolean;
  icon?: keyof typeof Feather.glyphMap;
  iconPosition?: "left" | "right";
  size?: "small" | "medium" | "large";
  variant?: "primary" | "outline";
}

const springConfig: WithSpringConfig = {
  damping: 15,
  mass: 0.3,
  stiffness: 150,
  overshootClamping: true,
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function GradientButton({
  onPress,
  children,
  style,
  textStyle,
  disabled = false,
  icon,
  iconPosition = "left",
  size = "medium",
  variant = "primary",
}: GradientButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (!disabled) {
      scale.value = withSpring(0.97, springConfig);
    }
  };

  const handlePressOut = () => {
    if (!disabled) {
      scale.value = withSpring(1, springConfig);
    }
  };

  const sizeStyles = {
    small: { height: 40, paddingHorizontal: Spacing.md, iconSize: 16, fontSize: 14 },
    medium: { height: Spacing.buttonHeight, paddingHorizontal: Spacing.xl, iconSize: 20, fontSize: 16 },
    large: { height: 56, paddingHorizontal: Spacing["2xl"], iconSize: 24, fontSize: 18 },
  };

  const currentSize = sizeStyles[size];

  if (variant === "outline") {
    return (
      <AnimatedPressable
        onPress={disabled ? undefined : onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={[
          styles.button,
          styles.outlineButton,
          {
            height: currentSize.height,
            paddingHorizontal: currentSize.paddingHorizontal,
            opacity: disabled ? 0.5 : 1,
          },
          style,
          animatedStyle,
        ]}
      >
        {icon && iconPosition === "left" && (
          <Feather
            name={icon}
            size={currentSize.iconSize}
            color={BrandColors.primary.gradientStart}
            style={styles.iconLeft}
          />
        )}
        <ThemedText
          type="body"
          style={[
            styles.outlineButtonText,
            { fontSize: currentSize.fontSize },
            textStyle,
          ]}
        >
          {children}
        </ThemedText>
        {icon && iconPosition === "right" && (
          <Feather
            name={icon}
            size={currentSize.iconSize}
            color={BrandColors.primary.gradientStart}
            style={styles.iconRight}
          />
        )}
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      onPress={disabled ? undefined : onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={[
        styles.buttonContainer,
        { opacity: disabled ? 0.5 : 1 },
        animatedStyle,
      ]}
    >
      <LinearGradient
        colors={BrandColors.gradient.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[
          styles.button,
          styles.gradientButton,
          {
            height: currentSize.height,
            paddingHorizontal: currentSize.paddingHorizontal,
          },
          style,
        ]}
      >
        {icon && iconPosition === "left" && (
          <Feather
            name={icon}
            size={currentSize.iconSize}
            color="#FFFFFF"
            style={styles.iconLeft}
          />
        )}
        <ThemedText
          type="body"
          style={[
            styles.buttonText,
            { fontSize: currentSize.fontSize },
            textStyle,
          ]}
        >
          {children}
        </ThemedText>
        {icon && iconPosition === "right" && (
          <Feather
            name={icon}
            size={currentSize.iconSize}
            color="#FFFFFF"
            style={styles.iconRight}
          />
        )}
      </LinearGradient>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  buttonContainer: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  button: {
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  gradientButton: {
    shadowColor: "#E72369",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  outlineButton: {
    borderWidth: 2,
    borderColor: BrandColors.primary.gradientStart,
    backgroundColor: "transparent",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  outlineButtonText: {
    color: BrandColors.primary.gradientStart,
    fontWeight: "600",
  },
  iconLeft: {
    marginRight: Spacing.sm,
  },
  iconRight: {
    marginLeft: Spacing.sm,
  },
});
