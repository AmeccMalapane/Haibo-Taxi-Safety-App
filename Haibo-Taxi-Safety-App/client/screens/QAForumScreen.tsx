import React, { useState, useRef, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";

import { useTheme } from "@/hooks/useTheme";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { ThemedText } from "@/components/ThemedText";
import {
  Spacing,
  BrandColors,
  BrandShadows,
  BorderRadius,
  Typography,
} from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useCommunityPosts, useCreatePost } from "@/hooks/useApiData";

// Q&A thread for the "Get directions" community tile. Sibling to
// PasopFeed / CommunityRoutes / LostFound, so it wears the same canonical
// chrome: rose gradient hero with a back button + title + live-activity
// badge, rather than a flat cream bar with an ad-hoc "live" dot. Was
// previously the only community sub-screen rendering its own header.

interface Reply {
  id: string;
  authorName: string;
  content: string;
  timestamp: string;
  isVerified?: boolean;
  upvotes: number;
}

interface Question {
  id: string;
  authorName: string;
  content: string;
  timestamp: string;
  isVerified?: boolean;
  upvotes: number;
  replies: Reply[];
  isExpanded?: boolean;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const MOCK_QUESTIONS: Question[] = [
  {
    id: "1",
    authorName: "TaxiCommuter",
    content:
      "What's the typical fare from Bree Taxi Rank to Sandton City? I've been quoted different prices lately.",
    timestamp: "2 min ago",
    upvotes: 12,
    replies: [
      {
        id: "r1",
        authorName: "DriverMike",
        content:
          "The standard fare is R25-R30. If they're charging more, it might be peak hour pricing.",
        timestamp: "1 min ago",
        isVerified: true,
        upvotes: 8,
      },
      {
        id: "r2",
        authorName: "SafetyWatch",
        content:
          "Always confirm the fare before getting in. The official rate is R28 as of January 2026.",
        timestamp: "just now",
        isVerified: true,
        upvotes: 15,
      },
    ],
  },
  {
    id: "2",
    authorName: "NewCommuter",
    content: "Is the N1 route operating normally today? Heard there might be roadworks.",
    timestamp: "15 min ago",
    upvotes: 8,
    replies: [
      {
        id: "r3",
        authorName: "TrafficUpdates",
        content: "Yes, N1 is clear! Roadworks are only scheduled for this weekend.",
        timestamp: "10 min ago",
        isVerified: true,
        upvotes: 6,
      },
    ],
  },
  {
    id: "3",
    authorName: "DailyRider",
    content: "What time do taxis from Soweto to CBD start running in the morning?",
    timestamp: "1 hour ago",
    upvotes: 5,
    replies: [
      {
        id: "r4",
        authorName: "CommuterVet",
        content:
          "First taxis leave around 4:30 AM from Orlando East. By 5 AM there's a good flow.",
        timestamp: "45 min ago",
        upvotes: 10,
      },
    ],
  },
  {
    id: "4",
    authorName: "SafetyFirst",
    content: "Any tips for first-time taxi commuters? Starting a new job in town next week.",
    timestamp: "3 hours ago",
    upvotes: 24,
    replies: [
      {
        id: "r5",
        authorName: "HaiboTeam",
        content:
          "Welcome! Always have small change ready, confirm your destination with the gaatjie, and use our SOS feature if you ever feel unsafe. Happy commuting!",
        timestamp: "2 hours ago",
        isVerified: true,
        upvotes: 32,
      },
      {
        id: "r6",
        authorName: "RegularCommuter",
        content:
          "Learn the hand signals for your route — it helps drivers know where you're going!",
        timestamp: "1 hour ago",
        upvotes: 18,
      },
    ],
  },
];

// Deterministic rose-to-coral tint picker so the same author always gets
// the same avatar colour across re-renders. Paired colours mirror
// BrandColors.gradient.primary + accent tints so every avatar reads as
// part of the Haibo palette rather than a random hue.
const AVATAR_TINTS: ReadonlyArray<readonly [string, string]> = [
  [BrandColors.primary.gradientStart, BrandColors.primary.gradientEnd],
  [BrandColors.primary.brandVivid, BrandColors.primary.brandVividDark],
  [BrandColors.accent.fuchsia, BrandColors.accent.fuchsiaLight],
  [BrandColors.accent.sky, BrandColors.accent.skyLight],
  [BrandColors.secondary.orange, BrandColors.secondary.orangeLight],
];
function tintFor(name: string): readonly [string, string] {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}

function Monogram({
  name,
  size = 34,
}: {
  name: string;
  size?: number;
}) {
  const letter = (name?.trim()?.charAt(0) || "?").toUpperCase();
  const [from, to] = tintFor(name);
  return (
    <LinearGradient
      colors={[from, to]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <ThemedText
        style={{
          color: "#FFFFFF",
          fontSize: size * 0.4,
          fontFamily: "SpaceGrotesk_700Bold",
          fontWeight: "800",
        }}
      >
        {letter}
      </ThemedText>
    </LinearGradient>
  );
}

function MessageBubble({
  message,
  isReply,
  theme,
  isDark,
  onUpvote,
}: {
  message: Question | Reply;
  isReply?: boolean;
  theme: any;
  isDark: boolean;
  onUpvote: () => void;
}) {
  const surface = isDark ? theme.backgroundSecondary : "#FFFFFF";
  return (
    <View
      style={[
        styles.messageBubble,
        BrandShadows.sm,
        {
          backgroundColor: surface,
          marginLeft: isReply ? Spacing.xl : 0,
          borderLeftWidth: isReply ? 3 : 0,
          borderLeftColor: isReply ? BrandColors.primary.gradientStart : "transparent",
        },
      ]}
    >
      <View style={styles.messageHeader}>
        <View style={styles.authorInfo}>
          <Monogram name={message.authorName} size={isReply ? 28 : 34} />
          <View style={{ flex: 1 }}>
            <View style={styles.authorRow}>
              <ThemedText style={styles.authorName} numberOfLines={1}>
                {message.authorName}
              </ThemedText>
              {message.isVerified ? (
                <View style={styles.verifiedBadge}>
                  <Feather
                    name="check-circle"
                    size={12}
                    color={BrandColors.primary.gradientStart}
                  />
                  <ThemedText style={styles.verifiedLabel}>Verified</ThemedText>
                </View>
              ) : null}
            </View>
            <ThemedText style={[styles.timestamp, { color: theme.textSecondary }]}>
              {message.timestamp}
            </ThemedText>
          </View>
        </View>
      </View>

      <ThemedText style={[styles.messageContent, { color: theme.text }]}>
        {message.content}
      </ThemedText>

      <View style={styles.messageActions}>
        <Pressable
          onPress={onUpvote}
          style={styles.actionButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Upvote — currently ${message.upvotes} upvotes`}
        >
          <Feather
            name="arrow-up"
            size={14}
            color={BrandColors.primary.gradientStart}
          />
          <ThemedText style={styles.actionText}>{message.upvotes}</ThemedText>
        </Pressable>
        {!isReply ? (
          <View style={styles.actionButton}>
            <Feather name="message-circle" size={14} color={theme.textSecondary} />
            <ThemedText style={[styles.actionText, { color: theme.textSecondary }]}>
              Reply
            </ThemedText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function QuestionThread({
  question,
  theme,
  isDark,
  onToggleExpand,
  onUpvote,
  index,
  reducedMotion,
}: {
  question: Question;
  theme: any;
  isDark: boolean;
  onToggleExpand: () => void;
  onUpvote: (isReply: boolean, replyId?: string) => void;
  index: number;
  reducedMotion: boolean;
}) {
  const hasReplies = question.replies.length > 0;

  return (
    <Animated.View
      entering={
        reducedMotion
          ? undefined
          : FadeInDown.delay(Math.min(index * 40, 240)).duration(320)
      }
      style={styles.threadContainer}
    >
      <MessageBubble
        message={question}
        theme={theme}
        isDark={isDark}
        onUpvote={() => onUpvote(false)}
      />

      {hasReplies ? (
        <>
          <Pressable
            onPress={onToggleExpand}
            style={styles.repliesToggle}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityState={{ expanded: !!question.isExpanded }}
          >
            <Feather
              name={question.isExpanded ? "chevron-up" : "chevron-down"}
              size={14}
              color={BrandColors.primary.gradientStart}
            />
            <ThemedText style={styles.repliesCount}>
              {question.isExpanded
                ? "Hide replies"
                : `${question.replies.length} ${
                    question.replies.length === 1 ? "reply" : "replies"
                  }`}
            </ThemedText>
          </Pressable>

          {question.isExpanded
            ? question.replies.map((reply) => (
                <MessageBubble
                  key={reply.id}
                  message={reply}
                  isReply
                  theme={theme}
                  isDark={isDark}
                  onUpvote={() => onUpvote(true, reply.id)}
                />
              ))
            : null}
        </>
      ) : null}
    </Animated.View>
  );
}

export default function QAForumScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const reducedMotion = useReducedMotion();
  const flatListRef = useRef<FlatList>(null);
  const [questions, setQuestions] = useState<Question[]>(MOCK_QUESTIONS);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const { data: apiPosts = [] } = useCommunityPosts("directions");
  const createPost = useCreatePost();

  // Merge API-backed questions with the seed mocks. Keeps the forum
  // populated for first-run users while still surfacing real community
  // posts from the backend as soon as they arrive.
  React.useEffect(() => {
    if (apiPosts.length > 0) {
      const apiQuestions: Question[] = apiPosts.map((p: any) => ({
        id: p.id,
        authorName: p.userName || "Community",
        content: p.caption || "",
        timestamp: p.createdAt
          ? new Date(p.createdAt).toLocaleDateString()
          : "recently",
        upvotes: p.likeCount || 0,
        replies: [],
        isExpanded: false,
      }));
      setQuestions([...apiQuestions, ...MOCK_QUESTIONS]);
    }
  }, [apiPosts]);

  const handleToggleExpand = useCallback((questionId: string) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId ? { ...q, isExpanded: !q.isExpanded } : q
      )
    );
  }, []);

  const handleUpvote = useCallback(
    async (questionId: string, isReply: boolean, replyId?: string) => {
      if (Platform.OS !== "web") {
        try {
          const Haptics = await import("expo-haptics");
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch {}
      }

      setQuestions((prev) =>
        prev.map((q) => {
          if (q.id === questionId) {
            if (isReply && replyId) {
              return {
                ...q,
                replies: q.replies.map((r) =>
                  r.id === replyId ? { ...r, upvotes: r.upvotes + 1 } : r
                ),
              };
            }
            return { ...q, upvotes: q.upvotes + 1 };
          }
          return q;
        })
      );
    },
    []
  );

  const canSend = inputText.trim().length > 0 && !isSending;

  const handleSend = async () => {
    if (!canSend) return;

    setIsSending(true);

    if (Platform.OS !== "web") {
      try {
        const Haptics = await import("expo-haptics");
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    }

    const newQuestion: Question = {
      id: Date.now().toString(),
      authorName: "You",
      content: inputText.trim(),
      timestamp: "just now",
      upvotes: 0,
      replies: [],
      isExpanded: false,
    };

    setQuestions((prev) => [newQuestion, ...prev]);

    try {
      await createPost.mutateAsync({
        caption: inputText.trim(),
        category: "directions",
        contentType: "text",
      });
    } catch (err) {
      console.log("Failed to post question to API:", err);
    }

    setInputText("");
    setIsSending(false);

    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const renderQuestion = useCallback(
    ({ item, index }: { item: Question; index: number }) => (
      <QuestionThread
        question={item}
        theme={theme}
        isDark={isDark}
        reducedMotion={reducedMotion}
        index={index}
        onToggleExpand={() => handleToggleExpand(item.id)}
        onUpvote={(isReply, replyId) =>
          handleUpvote(item.id, isReply, replyId)
        }
      />
    ),
    [theme, isDark, reducedMotion, handleToggleExpand, handleUpvote]
  );

  const questionCount = useMemo(() => questions.length, [questions.length]);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
        keyboardVerticalOffset={0}
      >
        {/* Canonical Haibo hero — rose gradient, glass back, live badge.
            Matches Pasop / CommunityRoutes / LostFound siblings so this
            tile looks like the rest of the community hub. */}
        <LinearGradient
          colors={BrandColors.gradient.primary as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + Spacing.md }]}
        >
          <View style={styles.heroTopRow}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={styles.glassButton}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Feather name="arrow-left" size={20} color="#FFFFFF" />
            </Pressable>
            <View style={styles.heroBadge}>
              <View style={styles.liveDot} />
              <ThemedText style={styles.heroBadgeText}>Live Q&amp;A</ThemedText>
            </View>
            <View style={styles.heroSpacer} />
          </View>
          <ThemedText style={styles.heroTitle}>Ask the crew.</ThemedText>
          <ThemedText style={styles.heroSubtitle}>
            {questionCount} {questionCount === 1 ? "question" : "questions"} from commuters, drivers
            and the Haibo team.
          </ThemedText>
        </LinearGradient>

        <FlatList
          ref={flatListRef}
          data={questions}
          renderItem={renderQuestion}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 96 },
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather
                name="message-circle"
                size={40}
                color={theme.textSecondary}
              />
              <ThemedText
                style={[styles.emptyText, { color: theme.textSecondary }]}
              >
                No questions yet. Be the first to ask.
              </ThemedText>
            </View>
          }
        />

        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: isDark ? theme.surface : "#FFFFFF",
              borderTopColor: theme.border,
              paddingBottom: insets.bottom + Spacing.sm,
            },
          ]}
        >
          <View
            style={[
              styles.inputWrapper,
              {
                backgroundColor: theme.backgroundSecondary,
                borderColor: inputFocused
                  ? BrandColors.primary.gradientStart
                  : "transparent",
              },
            ]}
          >
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="Ask a question…"
              placeholderTextColor={theme.textSecondary}
              value={inputText}
              onChangeText={setInputText}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              multiline
              maxLength={300}
              returnKeyType="send"
              blurOnSubmit={false}
            />
          </View>

          <Pressable
            onPress={handleSend}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="Post question"
            accessibilityState={{ disabled: !canSend }}
            style={[
              styles.sendButtonContainer,
              canSend ? BrandShadows.brandSm : undefined,
              !canSend && { opacity: 0.4 },
            ]}
          >
            <LinearGradient
              colors={BrandColors.gradient.primary as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.sendButton}
            >
              {isSending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Feather name="send" size={18} color="#FFFFFF" />
              )}
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  hero: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing["2xl"],
    borderBottomLeftRadius: BorderRadius["2xl"],
    borderBottomRightRadius: BorderRadius["2xl"],
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  glassButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: "rgba(255, 255, 255, 0.22)",
  },
  heroBadgeText: {
    ...Typography.label,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
  },
  heroSpacer: {
    width: 40,
  },
  heroTitle: {
    ...Typography.h1,
    color: "#FFFFFF",
  },
  heroSubtitle: {
    ...Typography.body,
    color: "rgba(255, 255, 255, 0.92)",
    marginTop: Spacing.xs,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    gap: Spacing.md,
  },
  threadContainer: {
    gap: Spacing.xs,
  },
  messageBubble: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  messageHeader: {
    marginBottom: Spacing.sm,
  },
  authorInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  authorName: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "SpaceGrotesk_600SemiBold",
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    backgroundColor: BrandColors.primary.gradientStart + "18",
  },
  verifiedLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: BrandColors.primary.gradientStart,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
  },
  timestamp: {
    fontSize: 12,
    marginTop: 1,
  },
  messageContent: {
    ...Typography.body,
    marginBottom: Spacing.sm,
  },
  messageActions: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginTop: 2,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 2,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "600",
    color: BrandColors.primary.gradientStart,
  },
  repliesToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginLeft: Spacing.lg,
    paddingVertical: Spacing.xs,
  },
  repliesCount: {
    fontSize: 13,
    fontWeight: "600",
    color: BrandColors.primary.gradientStart,
    fontFamily: "Inter_600SemiBold",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["4xl"],
  },
  emptyText: {
    marginTop: Spacing.md,
    fontSize: 14,
    textAlign: "center",
  },
  inputContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    gap: Spacing.md,
  },
  inputWrapper: {
    flex: 1,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    maxHeight: 110,
    borderWidth: 1.5,
  },
  textInput: {
    ...Typography.body,
    maxHeight: 88,
    paddingTop: Platform.OS === "ios" ? 4 : 0,
  },
  sendButtonContainer: {
    marginBottom: 2,
    borderRadius: 22,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
