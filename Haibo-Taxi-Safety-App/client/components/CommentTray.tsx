import React, { useState, useEffect } from "react";
import {
  View,
  Modal,
  StyleSheet,
  Pressable,
  TextInput,
  FlatList,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
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

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const TRAY_HEIGHT = SCREEN_HEIGHT * 0.5;

interface Comment {
  id: string;
  userName: string;
  userAvatar?: string;
  content: string;
  createdAt: string;
  likes: number;
}

interface CommentTrayProps {
  visible: boolean;
  onClose: () => void;
  reelId: string;
  commentCount: number;
}

const MOCK_COMMENTS: Comment[] = [
  {
    id: "1",
    userName: "TaxiKing",
    content: "This is so true! Happens every day on my route.",
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    likes: 24,
  },
  {
    id: "2",
    userName: "CommuterLife",
    content: "The hand signal at 0:15 is wrong though. In Soweto we do it differently.",
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    likes: 12,
  },
  {
    id: "3",
    userName: "SafeRider",
    content: "Great safety tip! Everyone should know this.",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    likes: 45,
  },
];

export default function CommentTray({ visible, onClose, reelId, commentCount }: CommentTrayProps) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const [comments, setComments] = useState<Comment[]>(MOCK_COMMENTS);
  const [newComment, setNewComment] = useState("");
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

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;

    if (Platform.OS !== "web") {
      try {
        const Haptics = await import("expo-haptics");
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }

    const comment: Comment = {
      id: Date.now().toString(),
      userName: "You",
      content: newComment.trim(),
      createdAt: new Date().toISOString(),
      likes: 0,
    };

    setComments((prev) => [comment, ...prev]);
    setNewComment("");
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString();
  };

  const renderComment = ({ item }: { item: Comment }) => (
    <View style={styles.commentItem}>
      <View style={[styles.avatar, { backgroundColor: BrandColors.primary.blue }]}>
        <ThemedText style={styles.avatarText}>
          {item.userName.charAt(0).toUpperCase()}
        </ThemedText>
      </View>
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <ThemedText style={styles.userName}>{item.userName}</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {formatTime(item.createdAt)}
          </ThemedText>
        </View>
        <ThemedText style={styles.commentText}>{item.content}</ThemedText>
        <View style={styles.commentActions}>
          <Pressable
            style={styles.commentAction}
            accessibilityRole="button"
            accessibilityLabel="Like comment"
          >
            <Feather name="heart" size={14} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {item.likes}
            </ThemedText>
          </Pressable>
          <Pressable style={styles.commentAction}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Reply
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </View>
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.modalContainer}
      >
        <Pressable
          style={styles.backdrop}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Close comments"
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
              <ThemedText style={styles.title}>
                {commentCount} Comments
              </ThemedText>
              <Pressable
                onPress={handleClose}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <FlatList
              data={comments}
              renderItem={renderComment}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.commentsList}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Feather name="message-circle" size={48} color={theme.textSecondary} />
                  <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                    Be the first to comment!
                  </ThemedText>
                </View>
              }
            />

            <View
              style={[
                styles.inputContainer,
                {
                  backgroundColor: theme.backgroundSecondary,
                  paddingBottom: insets.bottom + Spacing.sm,
                },
              ]}
            >
              <View style={[styles.inputRow, { backgroundColor: theme.backgroundTertiary }]}>
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="Add a comment..."
                  placeholderTextColor={theme.textSecondary}
                  value={newComment}
                  onChangeText={setNewComment}
                  multiline
                  maxLength={300}
                />
                <Pressable
                  style={[
                    styles.sendButton,
                    {
                      backgroundColor: newComment.trim()
                        ? BrandColors.primary.blue
                        : "transparent",
                    },
                  ]}
                  onPress={handleSubmitComment}
                  disabled={!newComment.trim()}
                  accessibilityRole="button"
                  accessibilityLabel="Send comment"
                  accessibilityState={{ disabled: !newComment.trim() }}
                >
                  <Feather
                    name="send"
                    size={18}
                    color={newComment.trim() ? "#FFFFFF" : theme.textSecondary}
                  />
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </GestureDetector>
      </KeyboardAvoidingView>
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
    height: TRAY_HEIGHT,
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
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
  },
  closeButton: {
    padding: Spacing.xs,
  },
  commentsList: {
    padding: Spacing.md,
  },
  commentItem: {
    flexDirection: "row",
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  avatarText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: 2,
  },
  userName: {
    fontWeight: "600",
    fontSize: 13,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.xs,
  },
  commentActions: {
    flexDirection: "row",
    gap: Spacing.lg,
  },
  commentAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["3xl"],
  },
  emptyText: {
    marginTop: Spacing.md,
    fontSize: 14,
  },
  inputContainer: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.full,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  input: {
    flex: 1,
    fontSize: 14,
    maxHeight: 80,
    paddingVertical: Spacing.xs,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
