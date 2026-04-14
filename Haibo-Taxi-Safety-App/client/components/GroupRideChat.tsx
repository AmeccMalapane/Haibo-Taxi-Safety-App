/**
 * Real-time group ride chat using Socket.IO.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, StyleSheet, TextInput, Pressable, FlatList, KeyboardAvoidingView, Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";
import { joinRideChat, leaveRideChat, sendRideMessage, onRideMessage } from "@/lib/socket";

interface ChatMessage {
  id: string;
  userId: string;
  phone: string;
  message: string;
  timestamp: string;
  isOwn: boolean;
}

interface GroupRideChatProps {
  rideId: string;
  onClose: () => void;
}

export default function GroupRideChat({ rideId, onClose }: GroupRideChatProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    // Join the ride chat room
    joinRideChat(rideId);

    // Listen for new messages
    const unsub = onRideMessage((msg) => {
      setMessages((prev) => [...prev, {
        id: `${msg.timestamp}-${msg.userId}`,
        userId: msg.userId,
        phone: msg.phone,
        message: msg.message,
        timestamp: msg.timestamp,
        isOwn: msg.userId === user?.id,
      }]);
    });

    return () => {
      leaveRideChat(rideId);
      unsub();
    };
  }, [rideId, user?.id]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const handleSend = useCallback(() => {
    if (!inputText.trim()) return;
    sendRideMessage(rideId, inputText.trim());

    // Optimistic update
    setMessages((prev) => [...prev, {
      id: `${Date.now()}-self`,
      userId: user?.id || "",
      phone: user?.phone || "",
      message: inputText.trim(),
      timestamp: new Date().toISOString(),
      isOwn: true,
    }]);

    setInputText("");
  }, [inputText, rideId, user]);

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <View style={[styles.messageBubble, item.isOwn ? styles.ownMessage : styles.otherMessage, {
      backgroundColor: item.isOwn ? BrandColors.primary.red : theme.backgroundSecondary,
    }]}>
      {!item.isOwn && (
        <ThemedText style={[styles.senderName, { color: BrandColors.primary.blue }]}>
          {item.phone.slice(-4)}
        </ThemedText>
      )}
      <ThemedText style={[styles.messageText, { color: item.isOwn ? "#fff" : theme.text }]}>
        {item.message}
      </ThemedText>
      <ThemedText style={[styles.messageTime, { color: item.isOwn ? "rgba(255,255,255,0.7)" : theme.textSecondary }]}>
        {formatTime(item.timestamp)}
      </ThemedText>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { backgroundColor: theme.backgroundDefault }]}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <ThemedText style={styles.headerTitle}>Ride Chat</ThemedText>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close chat"
        >
          <Feather name="x" size={22} color={theme.text} />
        </Pressable>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="message-circle" size={40} color={theme.textSecondary} />
            <ThemedText style={{ color: theme.textSecondary, marginTop: 8 }}>
              No messages yet. Say hello!
            </ThemedText>
          </View>
        }
      />

      {/* Input */}
      <View style={[styles.inputRow, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
        <TextInput
          style={[styles.textInput, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
          placeholder="Type a message..."
          placeholderTextColor={theme.textSecondary}
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />
        <Pressable
          style={[styles.sendButton, { opacity: inputText.trim() ? 1 : 0.4 }]}
          onPress={handleSend}
          disabled={!inputText.trim()}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          accessibilityState={{ disabled: !inputText.trim() }}
        >
          <Feather name="send" size={20} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: Spacing.md, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 16, fontWeight: "700" },
  messagesList: { padding: Spacing.md, flexGrow: 1 },
  messageBubble: {
    maxWidth: "78%", padding: 10, borderRadius: BorderRadius.md,
    marginBottom: 8,
  },
  ownMessage: { alignSelf: "flex-end", borderBottomRightRadius: 4 },
  otherMessage: { alignSelf: "flex-start", borderBottomLeftRadius: 4 },
  senderName: { fontSize: 11, fontWeight: "600", marginBottom: 2 },
  messageText: { fontSize: 14, lineHeight: 20 },
  messageTime: { fontSize: 10, alignSelf: "flex-end", marginTop: 4 },
  inputRow: {
    flexDirection: "row", alignItems: "center", padding: Spacing.sm,
    borderTopWidth: 1, gap: 8,
  },
  textInput: {
    flex: 1, height: 42, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, fontSize: 15,
  },
  sendButton: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: BrandColors.primary.red,
    alignItems: "center", justifyContent: "center",
  },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 },
});
