import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Modal,
  StyleSheet,
  Pressable,
  Dimensions,
  Platform,
  RefreshControl,
  ScrollView,
  TextInput,
  Image,
  Alert,
  Share,
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
import * as ImagePicker from "expo-image-picker";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { ContentCard, ContentPost } from "@/components/ContentCard";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";
import { Button } from "@/components/Button";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

type CategoryType = "lost_found" | "directions" | "haibo_fam" | "group_rides";

interface Category {
  id: CategoryType;
  label: string;
  icon: keyof typeof Feather.glyphMap;
}

const CATEGORIES: Category[] = [
  { id: "lost_found", label: "Lost & Found", icon: "search" },
  { id: "directions", label: "Directions", icon: "map-pin" },
  { id: "haibo_fam", label: "Haibo Fam", icon: "heart" },
  { id: "group_rides", label: "Group Rides", icon: "users" },
];

const MOCK_POSTS: ContentPost[] = [
  {
    id: "1",
    type: "lost_found",
    title: "Lost Wallet - Bree Taxi Rank",
    content: "Lost a brown leather wallet this morning at Bree. Contains ID and driver's license. Please contact if found.",
    author: "Sipho M.",
    createdAt: new Date(Date.now() - 300000).toISOString(),
    likes: 12,
    comments: 5,
    isVerified: false,
  },
  {
    id: "2",
    type: "directions",
    title: "Quickest way to Waterfall?",
    content: "Does anyone know which rank has the quickest taxis to Waterfall City from JHB CBD during peak hours?",
    author: "Lerato K.",
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    likes: 8,
    comments: 15,
    isVerified: false,
  },
];

interface CommunityTrayProps {
  visible: boolean;
  onClose: () => void;
}

export default function CommunityTray({ visible, onClose }: CommunityTrayProps) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>("haibo_fam");
  const [refreshing, setRefreshing] = useState(false);
  const [posts, setPosts] = useState<ContentPost[]>(MOCK_POSTS);
  
  // Posting State
  const [isPosting, setIsPosting] = useState(false);
  const [postContent, setPostContent] = useState("");
  const [postTitle, setPostTitle] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const translateY = useSharedValue(SCREEN_HEIGHT);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 20, stiffness: 100 });
    } else {
      translateY.value = withSpring(SCREEN_HEIGHT, { damping: 20, stiffness: 100 });
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    translateY.value = withSpring(SCREEN_HEIGHT, { damping: 20, stiffness: 100 });
    setTimeout(onClose, 200);
  }, [onClose, translateY]);

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      if (event.velocityY > 500 || translateY.value > SCREEN_HEIGHT * 0.3) {
        runOnJS(handleClose)();
      } else {
        translateY.value = withSpring(0, { damping: 20, stiffness: 100 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const handleCreatePost = () => {
    if (!postTitle || !postContent) {
      Alert.alert("Error", "Please provide both a title and content for your post.");
      return;
    }

    const newPost: ContentPost = {
      id: Date.now().toString(),
      type: selectedCategory,
      title: postTitle,
      content: postContent,
      author: "Me",
      createdAt: new Date().toISOString(),
      likes: 0,
      comments: 0,
      image: selectedImage || undefined,
    };

    setPosts([newPost, ...posts]);
    setPostTitle("");
    setPostContent("");
    setSelectedImage(null);
    setIsPosting(false);
    Alert.alert("Success", "Your post has been shared with the community!");
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setRefreshing(false);
  }, []);

  const filteredPosts = posts.filter((post) => post.type === selectedCategory);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose} statusBarTranslucent>
      <View style={styles.modalContainer}>
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.tray, { backgroundColor: theme.backgroundRoot, paddingTop: insets.top }, animatedStyle]}>
            <View style={styles.header}>
              <Pressable
                onPress={handleClose}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Feather name="chevron-down" size={28} color={theme.text} />
              </Pressable>
              <ThemedText type="h3" style={styles.headerTitle}>Haibo Community</ThemedText>
              <Pressable
                onPress={() => setIsPosting(!isPosting)}
                style={styles.postToggleButton}
                accessibilityRole="button"
                accessibilityLabel={isPosting ? "Cancel post" : "Create new post"}
              >
                <Feather name={isPosting ? "x" : "plus"} size={24} color={BrandColors.primary.red} />
              </Pressable>
            </View>

            {isPosting ? (
              <ScrollView style={styles.postingContainer} keyboardShouldPersistTaps="handled">
                <ThemedText type="h4" style={styles.postingTitle}>Share with {CATEGORIES.find(c => c.id === selectedCategory)?.label}</ThemedText>
                
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                  placeholder="Title of your post"
                  placeholderTextColor={theme.textSecondary}
                  value={postTitle}
                  onChangeText={setPostTitle}
                />
                
                <TextInput
                  style={[styles.textArea, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                  placeholder="What's on your mind?"
                  placeholderTextColor={theme.textSecondary}
                  multiline
                  numberOfLines={4}
                  value={postContent}
                  onChangeText={setPostContent}
                />

                <View style={styles.mediaActions}>
                  <Pressable style={[styles.mediaButton, { backgroundColor: theme.surface }]} onPress={pickImage}>
                    <Feather name="image" size={20} color={BrandColors.primary.blue} />
                    <ThemedText style={styles.mediaButtonText}>Add Photo</ThemedText>
                  </Pressable>
                  
                  {selectedImage && (
                    <View style={styles.imagePreviewContainer}>
                      <Image source={{ uri: selectedImage }} style={styles.imagePreview} />
                      <Pressable
                        style={styles.removeImage}
                        onPress={() => setSelectedImage(null)}
                        accessibilityRole="button"
                        accessibilityLabel="Remove photo"
                      >
                        <Feather name="x" size={14} color="#FFF" />
                      </Pressable>
                    </View>
                  )}
                </View>

                <Button 
                  onPress={handleCreatePost}
                  style={styles.submitButton}
                >Post to Community</Button>
              </ScrollView>
            ) : (
              <>
                <View style={styles.categoriesContainer}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesScroll}>
                    {CATEGORIES.map((category) => (
                      <Pressable
                        key={category.id}
                        style={[
                          styles.categoryTab,
                          {
                            backgroundColor: selectedCategory === category.id ? BrandColors.primary.red : theme.surface,
                            borderColor: selectedCategory === category.id ? BrandColors.primary.red : theme.border,
                            borderWidth: 1,
                          },
                        ]}
                        onPress={() => setSelectedCategory(category.id)}
                      >
                        <Feather
                          name={category.icon}
                          size={16}
                          color={selectedCategory === category.id ? "#FFFFFF" : theme.textSecondary}
                        />
                        <ThemedText style={[styles.categoryLabel, { color: selectedCategory === category.id ? "#FFFFFF" : theme.textSecondary }]}>
                          {category.label}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                <ScrollView
                  style={styles.content}
                  showsVerticalScrollIndicator={false}
                  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                  contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}
                >
                  {filteredPosts.length > 0 ? (
                    filteredPosts.map((post) => (
                      <ContentCard
                        key={post.id}
                        post={post}
                        onLike={() => {}}
                        onComment={() => {
                          Alert.alert("Comments", "Comments feature coming soon!");
                        }}
                        onShare={async () => {
                          try {
                            await Share.share({
                              message: `${post.title}\n\n${post.content}\n\nShared via Haibo App`,
                            });
                          } catch {}
                        }}
                      />
                    ))
                  ) : (
                    <View style={styles.emptyState}>
                      <Feather name="message-square" size={48} color={theme.textSecondary} opacity={0.3} />
                      <ThemedText style={{ color: theme.textSecondary, marginTop: Spacing.md }}>No posts in this category yet.</ThemedText>
                      <Button 
                        onPress={() => setIsPosting(true)}
                        style={{ marginTop: Spacing.lg, borderColor: BrandColors.primary.red, backgroundColor: 'transparent', borderWidth: 1 }}
                      >Be the first to post</Button>
                    </View>
                  )}
                </ScrollView>
              </>
            )}
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  tray: { flex: 1, width: "100%", borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.05)" },
  headerTitle: { fontSize: 20, fontWeight: "800" },
  closeButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  postToggleButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: BrandColors.primary.red + "10" },
  categoriesContainer: { paddingVertical: Spacing.md },
  categoriesScroll: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  categoryTab: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 25, gap: 8 },
  categoryLabel: { fontSize: 14, fontWeight: "700" },
  content: { flex: 1, paddingHorizontal: Spacing.lg },
  postingContainer: { padding: Spacing.lg },
  postingTitle: { marginBottom: Spacing.lg },
  input: { height: 50, borderRadius: BorderRadius.md, borderWidth: 1, paddingHorizontal: Spacing.md, fontSize: 16, marginBottom: Spacing.md },
  textArea: { height: 120, borderRadius: BorderRadius.md, borderWidth: 1, paddingHorizontal: Spacing.md, paddingTop: Spacing.md, fontSize: 16, marginBottom: Spacing.md, textAlignVertical: "top" },
  mediaActions: { flexDirection: "row", alignItems: "center", gap: Spacing.md, marginBottom: Spacing.xl },
  mediaButton: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: BorderRadius.md, gap: 8 },
  mediaButtonText: { fontSize: 14, fontWeight: "600" },
  imagePreviewContainer: { position: "relative" },
  imagePreview: { width: 60, height: 60, borderRadius: BorderRadius.sm },
  removeImage: { position: "absolute", top: -5, right: -5, backgroundColor: BrandColors.primary.red, borderRadius: 10, width: 20, height: 20, alignItems: "center", justifyContent: "center" },
  submitButton: { marginTop: Spacing.md, backgroundColor: BrandColors.primary.red },
  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 60 },
});
