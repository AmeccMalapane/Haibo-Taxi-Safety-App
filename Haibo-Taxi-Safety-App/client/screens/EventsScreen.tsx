import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Dimensions,
  Image,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEvents } from "@/hooks/useApiData";

const { width } = Dimensions.get("window");

interface EventPost {
  id: string;
  title: string;
  organizer: string;
  date: string;
  location: string;
  price: number;
  description: string;
  imageUrl: string;
  likes: number;
  comments: number;
  isVerified: boolean;
  expiryDate: string;
}

const mockEvents: EventPost[] = [
  {
    id: "1",
    title: "Soweto Street Food Festival",
    organizer: "Gauteng Events Hub",
    date: "March 15, 2026",
    location: "Soweto Theatre",
    price: 150,
    description: "Experience the best of local flavors, music, and culture. A day for the whole family!",
    imageUrl: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=1000",
    likes: 156,
    comments: 24,
    isVerified: true,
    expiryDate: "2026-03-01",
  },
];

export default function EventsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [isPosting, setIsPosting] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [ticketPrice, setTicketPrice] = useState("");
  const { data: apiEvents = [] } = useEvents();

  const events: EventPost[] = apiEvents.length > 0
    ? apiEvents.map((e: any) => ({
        id: e.id,
        title: e.title,
        organizer: e.organizer || "Community",
        date: new Date(e.eventDate).toLocaleDateString("en-ZA", { month: "long", day: "numeric", year: "numeric" }),
        location: e.location,
        price: e.ticketPrice || 0,
        description: e.description,
        imageUrl: e.imageUrl || "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=1000",
        likes: 0,
        comments: 0,
        isVerified: e.isVerified || false,
        expiryDate: e.eventEndDate || e.eventDate,
      }))
    : mockEvents;

  const handlePostEvent = () => {
    Alert.alert(
      "Confirm Promotion",
      "Promoting an event costs R50.00 for 7 days. You will be notified via email for renewals.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Pay R50 with Haibo Pay", 
          onPress: () => {
            Alert.alert("Success", "Your event is now live! It will be promoted for the next 7 days.");
            setIsPosting(false);
          } 
        },
      ]
    );
  };

  const handleBuyTicket = (event: EventPost) => {
    Alert.alert(
      "Buy Ticket",
      `Purchase ticket for ${event.title} at R${event.price}?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Confirm Purchase", 
          onPress: () => Alert.alert("Ticket Secured", "Your ticket has been added to your profile. See you there!") 
        },
      ]
    );
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { borderBottomColor: theme.border, paddingTop: insets.top + 10 }]}>
        <ThemedText type="h3">Events & Fun</ThemedText>
        <Pressable 
          onPress={() => setIsPosting(!isPosting)}
          style={[styles.postToggle, { backgroundColor: isPosting ? theme.border : BrandColors.primary.red }]}
        >
          <Feather name={isPosting ? "x" : "volume-2"} size={20} color="#FFF" />
          <Text style={styles.postToggleText}>{isPosting ? "Cancel" : "Promote Event"}</Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}>
        {isPosting && (
          <View style={[styles.postForm, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <ThemedText style={styles.formTitle}>Create Event Ad</ThemedText>
            <ThemedText style={styles.formSubtitle}>R50 per 7 days • Notified via Email</ThemedText>
            
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Event Title</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
                placeholder="What's happening?"
                placeholderTextColor={theme.textSecondary}
                value={eventTitle}
                onChangeText={setEventTitle}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Date & Time</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
                placeholder="e.g. March 15, 2:00 PM"
                placeholderTextColor={theme.textSecondary}
                value={eventDate}
                onChangeText={setEventDate}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Location</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
                placeholder="Where is it?"
                placeholderTextColor={theme.textSecondary}
                value={eventLocation}
                onChangeText={setEventLocation}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Ticket Price (R)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
                placeholder="0.00"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
                value={ticketPrice}
                onChangeText={setTicketPrice}
              />
            </View>
            
            <Button title="Pay R50 & Post Event" onPress={handlePostEvent} />
          </View>
        )}

        {events.map((event) => (
          <View key={event.id} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {/* Event Image */}
            <View style={styles.imageContainer}>
              <Image source={{ uri: event.imageUrl }} style={styles.eventImage} />
              <LinearGradient colors={["transparent", "rgba(0,0,0,0.7)"]} style={styles.imageOverlay}>
                <View style={styles.priceTag}>
                  <Text style={styles.priceText}>R{event.price}</Text>
                </View>
              </LinearGradient>
              {/* SEO Friendly Title Overlay */}
              <View style={styles.titleOverlay}>
                <ThemedText style={styles.cardTitle}>{event.title}</ThemedText>
              </View>
            </View>

            {/* Event Info */}
            <View style={styles.cardContent}>
              <View style={styles.organizerRow}>
                <Feather name="user" size={14} color={BrandColors.primary.blue} />
                <Text style={[styles.organizerText, { color: theme.textSecondary }]}>{event.organizer}</Text>
                {event.isVerified && <Feather name="check-circle" size={12} color={BrandColors.primary.blue} />}
              </View>
              
              <View style={styles.detailRow}>
                <View style={styles.detailItem}>
                  <Feather name="calendar" size={14} color={theme.textSecondary} />
                  <Text style={[styles.detailText, { color: theme.textSecondary }]}>{event.date}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Feather name="map-pin" size={14} color={theme.textSecondary} />
                  <Text style={[styles.detailText, { color: theme.textSecondary }]}>{event.location}</Text>
                </View>
              </View>

              <ThemedText style={styles.description} numberOfLines={2}>
                {event.description}
              </ThemedText>
            </View>

            {/* Social & Action Bar */}
            <View style={[styles.actionBar, { borderTopColor: theme.border }]}>
              <View style={styles.socialActions}>
                <Pressable style={styles.socialBtn}>
                  <Feather name="heart" size={20} color={theme.textSecondary} />
                  <Text style={[styles.socialText, { color: theme.textSecondary }]}>{event.likes}</Text>
                </Pressable>
                <Pressable style={styles.socialBtn}>
                  <Feather name="message-circle" size={20} color={theme.textSecondary} />
                  <Text style={[styles.socialText, { color: theme.textSecondary }]}>{event.comments}</Text>
                </Pressable>
                <Pressable style={styles.socialBtn}>
                  <Feather name="share-2" size={20} color={theme.textSecondary} />
                </Pressable>
              </View>
              
              <Pressable 
                style={[styles.buyBtn, { backgroundColor: BrandColors.primary.red }]}
                onPress={() => handleBuyTicket(event)}
              >
                <Text style={styles.buyBtnText}>Get Tickets</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1 },
  postToggle: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, gap: 6 },
  postToggleText: { color: "#FFF", fontWeight: "700", fontSize: 12 },
  scrollContent: { padding: 16 },
  postForm: { padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 24 },
  formTitle: { fontSize: 18, fontWeight: "800", marginBottom: 4 },
  formSubtitle: { fontSize: 12, opacity: 0.6, marginBottom: 16 },
  inputGroup: { marginBottom: 12 },
  label: { fontSize: 12, fontWeight: "700", marginBottom: 6, marginLeft: 4 },
  input: { height: 44, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12 },
  card: { borderRadius: 16, borderWidth: 1, marginBottom: 20, overflow: "hidden" },
  imageContainer: { width: "100%", height: 200, position: "relative" },
  eventImage: { width: "100%", height: "100%" },
  imageOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end", padding: 12 },
  priceTag: { position: "absolute", top: 12, right: 12, backgroundColor: BrandColors.primary.green, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  priceText: { color: "#FFF", fontWeight: "800", fontSize: 14 },
  titleOverlay: { position: "absolute", bottom: 12, left: 12, right: 12 },
  cardTitle: { color: "#FFF", fontSize: 20, fontWeight: "900", textShadowColor: "rgba(0,0,0,0.5)", textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 4 },
  cardContent: { padding: 16 },
  organizerRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  organizerText: { fontSize: 12, fontWeight: "700" },
  detailRow: { flexDirection: "row", gap: 16, marginBottom: 12 },
  detailItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  detailText: { fontSize: 12 },
  description: { fontSize: 14, lineHeight: 20, opacity: 0.8 },
  actionBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, borderTopWidth: 1 },
  socialActions: { flexDirection: "row", gap: 16 },
  socialBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  socialText: { fontSize: 12, fontWeight: "600" },
  buyBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  buyBtnText: { color: "#FFF", fontWeight: "800", fontSize: 14 },
});
