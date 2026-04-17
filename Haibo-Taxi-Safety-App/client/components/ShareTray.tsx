import React, { useState, useEffect } from "react";
import {
  View,
  Modal,
  StyleSheet,
  Pressable,
  Dimensions,
  Platform,
  Share,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Linking from "expo-linking";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const TRAY_HEIGHT = 320;

interface ShareTrayProps {
  visible: boolean;
  onClose: () => void;
  reelId: string;
  caption: string;
  mediaUrl: string;
}

interface SharePlatform {
  id: string;
  name: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  urlScheme?: string;
}

const sharePlatforms: SharePlatform[] = [
  { id: "whatsapp", name: "WhatsApp", icon: "message-circle", color: "#25D366", urlScheme: "whatsapp://" },
  { id: "facebook", name: "Facebook", icon: "facebook", color: "#1877F2", urlScheme: "fb://" },
  { id: "twitter", name: "Twitter", icon: "twitter", color: "#1DA1F2", urlScheme: "twitter://" },
  { id: "instagram", name: "Instagram", icon: "instagram", color: "#E4405F", urlScheme: "instagram://" },
  { id: "copy", name: "Copy Link", icon: "copy", color: "#666666" },
  { id: "more", name: "More", icon: "share-2", color: "#333333" },
];

export default function ShareTray({ visible, onClose, reelId, caption, mediaUrl }: ShareTrayProps) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const [isSharing, setIsSharing] = useState(false);
  const translateY = useSharedValue(TRAY_HEIGHT);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 20, stiffness: 100 });
    } else {
      translateY.value = withSpring(TRAY_HEIGHT, { damping: 20, stiffness: 100 });
    }
  }, [visible]);

  const handleClose = () => {
    translateY.value = withSpring(TRAY_HEIGHT, { damping: 20, stiffness: 100 });
    setTimeout(onClose, 200);
  };

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      if (event.translationY > TRAY_HEIGHT * 0.3) {
        translateY.value = withSpring(TRAY_HEIGHT, { damping: 20, stiffness: 100 });
        runOnJS(onClose)();
      } else {
        translateY.value = withSpring(0, { damping: 20, stiffness: 100 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const generateShareContent = () => {
    const shareUrl = `https://haibo.africa/reel/${reelId}`;
    const truncatedCaption = caption.length > 120 ? caption.slice(0, 117) + "..." : caption;
    const appLink = Platform.OS === "ios"
      ? "https://apps.apple.com/app/haibo/id0000000000"
      : "https://play.google.com/store/apps/details?id=com.haibo.africa.haiboapp";

    return {
      message: `${truncatedCaption}\n\n— Shared via Haibo! (haibo.africa)\nSafety for Mzansi's taxis\n\n${shareUrl}\nGet the app: ${appLink}`,
      url: shareUrl,
      title: "Haibo! — Safety for South Africa's taxis",
    };
  };

  const handleShare = async (platform: SharePlatform) => {
    if (Platform.OS !== "web") {
      try {
        const Haptics = await import("expo-haptics");
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }

    const content = generateShareContent();
    setIsSharing(true);

    try {
      if (platform.id === "copy") {
        if (Platform.OS !== "web") {
          const Clipboard = await import("expo-clipboard");
          await Clipboard.setStringAsync(content.url);
          Alert.alert("Copied!", "Link copied to clipboard");
        }
      } else if (platform.id === "more" || platform.id === "whatsapp" || platform.id === "facebook" || platform.id === "twitter") {
        const result = await Share.share({
          message: content.message,
          title: content.title,
        });
        
        if (result.action === Share.sharedAction) {
          if (Platform.OS !== "web") {
            try {
              const Haptics = await import("expo-haptics");
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch {}
          }
        }
      } else if (platform.urlScheme) {
        const canOpen = await Linking.canOpenURL(platform.urlScheme);
        if (canOpen) {
          if (platform.id === "instagram") {
            await Linking.openURL("instagram://app");
          } else {
            await Share.share({
              message: content.message,
              title: content.title,
            });
          }
        } else {
          Alert.alert("App Not Installed", `${platform.name} is not installed on your device.`);
        }
      }
    } catch (error) {
      console.error("Share error:", error);
    } finally {
      setIsSharing(false);
      handleClose();
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.modalContainer}>
        <Pressable
          style={styles.backdrop}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Close share tray"
        />
        
        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[
              styles.tray,
              { backgroundColor: isDark ? "#1E1E1E" : "#FFFFFF" },
              animatedStyle,
            ]}
          >
            <View style={styles.handle} />
            
            <View style={styles.header}>
              <ThemedText style={styles.title}>Share</ThemedText>
              <Pressable
                onPress={handleClose}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <View style={styles.watermarkNote}>
              <Feather name="check-circle" size={16} color={BrandColors.primary.green} />
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Shared with Haibo! branding + app download link
              </ThemedText>
            </View>

            {isSharing ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={BrandColors.primary.blue} />
              </View>
            ) : (
              <View style={styles.platformsGrid}>
                {sharePlatforms.map((platform) => (
                  <Pressable
                    key={platform.id}
                    style={styles.platformButton}
                    onPress={() => handleShare(platform)}
                  >
                    <View
                      style={[
                        styles.platformIcon,
                        { backgroundColor: platform.color + "20" },
                      ]}
                    >
                      <Feather name={platform.icon} size={24} color={platform.color} />
                    </View>
                    <ThemedText type="small" style={styles.platformName}>
                      {platform.name}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            )}

            <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
              <ThemedText type="small" style={[styles.footerText, { color: theme.textSecondary }]}>
                Share this reel with your friends and family
              </ThemedText>
            </View>
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  tray: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#999",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  closeButton: {
    padding: Spacing.xs,
  },
  watermarkNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  loadingContainer: {
    height: 150,
    alignItems: "center",
    justifyContent: "center",
  },
  platformsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
  },
  platformButton: {
    width: "33.33%",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  platformIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  platformName: {
    fontSize: 12,
    textAlign: "center",
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
  },
  footerText: {
    textAlign: "center",
  },
});
