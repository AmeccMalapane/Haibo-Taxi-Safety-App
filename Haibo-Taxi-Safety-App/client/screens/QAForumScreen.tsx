import React, { useState, useRef, useCallback } from "react";
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
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";
import { useCommunityPosts, useCreatePost } from "@/hooks/useApiData";

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

const MOCK_QUESTIONS: Question[] = [
  {
    id: "1",
    authorName: "TaxiCommuter",
    content: "What's the typical fare from Bree Taxi Rank to Sandton City? I've been quoted different prices lately.",
    timestamp: "2 min ago",
    upvotes: 12,
    replies: [
      {
        id: "r1",
        authorName: "DriverMike",
        content: "The standard fare is R25-R30. If they're charging more, it might be peak hour pricing.",
        timestamp: "1 min ago",
        isVerified: true,
        upvotes: 8,
      },
      {
        id: "r2",
        authorName: "SafetyWatch",
        content: "Always confirm the fare before getting in. The official rate is R28 as of January 2026.",
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
        content: "First taxis leave around 4:30 AM from Orlando East. By 5 AM there's a good flow.",
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
        content: "Welcome! Always have small change ready, confirm your destination with the gaatjie, and use our SOS feature if you ever feel unsafe. Happy commuting!",
        timestamp: "2 hours ago",
        isVerified: true,
        upvotes: 32,
      },
      {
        id: "r6",
        authorName: "RegularCommuter",
        content: "Learn the hand signals for your route - it helps drivers know where you're going!",
        timestamp: "1 hour ago",
        upvotes: 18,
      },
    ],
  },
];

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
  return (
    <View
      style={[
        styles.messageBubble,
        {
          backgroundColor: isDark ? theme.backgroundSecondary : "#F8F9FA",
          marginLeft: isReply ? Spacing.xl : 0,
          borderLeftWidth: isReply ? 3 : 0,
          borderLeftColor: isReply ? BrandColors.primary.green : "transparent",
        },
      ]}
    >
      <View style={styles.messageHeader}>
        <View style={styles.authorInfo}>
          <View style={[styles.avatarSmall, { backgroundColor: BrandColors.primary.gradientStart + "20" }]}>
            <Feather name="user" size={14} color={BrandColors.primary.gradientStart} />
          </View>
          <ThemedText style={styles.authorName}>{message.authorName}</ThemedText>
          {message.isVerified ? (
            <View style={styles.verifiedBadge}>
              <Feather name="check-circle" size={12} color={BrandColors.primary.blue} />
            </View>
          ) : null}
        </View>
        <ThemedText style={[styles.timestamp, { color: theme.textSecondary }]}>
          {message.timestamp}
        </ThemedText>
      </View>
      
      <ThemedText style={styles.messageContent}>{message.content}</ThemedText>
      
      <View style={styles.messageActions}>
        <Pressable style={styles.actionButton} onPress={onUpvote}>
          <Feather name="arrow-up" size={16} color={theme.textSecondary} />
          <ThemedText style={[styles.actionText, { color: theme.textSecondary }]}>
            {message.upvotes}
          </ThemedText>
        </Pressable>
        {!isReply ? (
          <View style={styles.actionButton}>
            <Feather name="message-circle" size={16} color={theme.textSecondary} />
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
}: {
  question: Question;
  theme: any;
  isDark: boolean;
  onToggleExpand: () => void;
  onUpvote: (isReply: boolean, replyId?: string) => void;
}) {
  const hasReplies = question.replies.length > 0;

  return (
    <View style={styles.threadContainer}>
      <MessageBubble
        message={question}
        theme={theme}
        isDark={isDark}
        onUpvote={() => onUpvote(false)}
      />
      
      {hasReplies ? (
        <>
          <Pressable onPress={onToggleExpand} style={styles.repliesToggle}>
            <Feather
              name={question.isExpanded ? "chevron-up" : "chevron-down"}
              size={16}
              color={BrandColors.primary.green}
            />
            <ThemedText style={[styles.repliesCount, { color: BrandColors.primary.green }]}>
              {question.isExpanded
                ? "Hide replies"
                : `${question.replies.length} ${question.replies.length === 1 ? "reply" : "replies"}`}
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
    </View>
  );
}

export default function QAForumScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();
  const flatListRef = useRef<FlatList>(null);
  const [questions, setQuestions] = useState<Question[]>(MOCK_QUESTIONS);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const { data: apiPosts = [] } = useCommunityPosts("directions");
  const createPost = useCreatePost();

  // Merge API posts with mock questions
  React.useEffect(() => {
    if (apiPosts.length > 0) {
      const apiQuestions: Question[] = apiPosts.map((p: any) => ({
        id: p.id,
        authorName: p.userName || "Community",
        content: p.caption || "",
        timestamp: p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "recently",
        upvotes: p.likeCount || 0,
        replies: [],
        isExpanded: false,
      }));
      setQuestions([...apiQuestions, ...MOCK_QUESTIONS]);
    }
  }, [apiPosts]);

  const handleToggleExpand = useCallback((questionId: string) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === questionId ? { ...q, isExpanded: !q.isExpanded } : q))
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

  const handleSend = async () => {
    if (!inputText.trim()) return;

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

    // Post to API as a community post with "directions" category
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
    ({ item }: { item: Question }) => (
      <QuestionThread
        question={item}
        theme={theme}
        isDark={isDark}
        onToggleExpand={() => handleToggleExpand(item.id)}
        onUpvote={(isReply, replyId) => handleUpvote(item.id, isReply, replyId)}
      />
    ),
    [theme, isDark, handleToggleExpand, handleUpvote]
  );

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
        keyboardVerticalOffset={100}
      >
        <View style={[styles.headerBar, { backgroundColor: isDark ? theme.backgroundSecondary : "#FFFFFF", borderBottomColor: theme.border, marginTop: headerHeight }]}>
          <View style={styles.headerContent}>
            <View style={[styles.onlineIndicator, { backgroundColor: BrandColors.primary.green }]} />
            <ThemedText style={styles.headerText}>Live Q&A Chat</ThemedText>
          </View>
          <ThemedText style={[styles.headerSubtext, { color: theme.textSecondary }]}>
            {questions.length} questions
          </ThemedText>
        </View>

        <FlatList
          ref={flatListRef}
          data={questions}
          renderItem={renderQuestion}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 80 },
          ]}
          showsVerticalScrollIndicator={false}
          inverted={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="message-circle" size={48} color={theme.textSecondary} />
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                No questions yet. Be the first to ask!
              </ThemedText>
            </View>
          }
        />

        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: isDark ? "#1E1E1E" : "#FFFFFF",
              borderTopColor: theme.border,
              paddingBottom: insets.bottom + Spacing.sm,
            },
          ]}
        >
          <View style={[styles.inputWrapper, { backgroundColor: theme.backgroundSecondary }]}>
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="Ask a question..."
              placeholderTextColor={theme.textSecondary}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={300}
            />
          </View>
          
          <Pressable
            onPress={handleSend}
            disabled={!inputText.trim() || isSending}
            style={styles.sendButtonContainer}
          >
            <LinearGradient
              colors={
                !inputText.trim() || isSending
                  ? ["#CCCCCC", "#AAAAAA"]
                  : BrandColors.gradient.primary
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.sendButton}
            >
              {isSending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Feather name="send" size={20} color="#FFFFFF" />
              )}
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  onlineIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  headerText: {
    fontSize: 16,
    fontWeight: "600",
  },
  headerSubtext: {
    fontSize: 12,
  },
  listContent: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  threadContainer: {
    gap: Spacing.sm,
  },
  messageBubble: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  messageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  authorInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  avatarSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  authorName: {
    fontSize: 14,
    fontWeight: "600",
  },
  verifiedBadge: {
    marginLeft: 2,
  },
  timestamp: {
    fontSize: 12,
  },
  messageContent: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: Spacing.sm,
  },
  messageActions: {
    flexDirection: "row",
    gap: Spacing.lg,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  actionText: {
    fontSize: 12,
  },
  repliesToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginLeft: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  repliesCount: {
    fontSize: 13,
    fontWeight: "500",
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
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    gap: Spacing.sm,
  },
  inputWrapper: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    maxHeight: 100,
  },
  textInput: {
    fontSize: 15,
    maxHeight: 80,
  },
  sendButtonContainer: {
    marginBottom: 2,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
