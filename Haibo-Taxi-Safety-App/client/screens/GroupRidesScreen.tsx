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
import { useGroupRides } from "@/hooks/useApiData";

const { width } = Dimensions.get("window");

interface GroupRidePost {
  id: string;
  driverName: string;
  driverRating: number;
  isVerified: boolean;
  origin: string;
  destination: string;
  departureTime: string;
  fare: number;
  seatsAvailable: number;
  description: string;
  mapPreviewUrl: string;
  likes: number;
  comments: number;
}

const mockPosts: GroupRidePost[] = [
  {
    id: "1",
    driverName: "Thabo Mokoena",
    driverRating: 4.8,
    isVerified: true,
    origin: "Johannesburg CBD",
    destination: "Soweto",
    departureTime: "Today, 17:30",
    fare: 35,
    seatsAvailable: 4,
    description: "Heading to Soweto after work. Clean taxi, strictly no smoking. Safe drop-offs along the main road.",
    mapPreviewUrl: "https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=1000",
    likes: 24,
    comments: 5,
  },
];

export default function GroupRidesScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [isPosting, setIsPosting] = useState(false);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [fare, setFare] = useState("");
  const { data: apiRides = [] } = useGroupRides();

  const rides: GroupRidePost[] = apiRides.length > 0
    ? apiRides.map((r: any) => ({
        id: r.id,
        driverName: r.organizerId || "Community Driver",
        driverRating: r.driverSafetyRating || 4.5,
        isVerified: r.isVerifiedDriver || false,
        origin: r.pickupLocation,
        destination: r.dropoffLocation,
        date: new Date(r.scheduledDate).toLocaleDateString("en-ZA"),
        time: r.scheduledDate ? new Date(r.scheduledDate).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" }) : "TBA",
        seatsAvailable: r.maxPassengers || 4,
        fare: r.costPerPerson || 0,
        rideType: r.rideType || "scheduled",
      }))
    : mockPosts;

  const handleBookRide = (post: GroupRidePost) => {
    Alert.alert(
      "Confirm Booking",
      `Book a seat from ${post.origin} to ${post.destination} for R${post.fare}?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Pay with Haibo Pay", 
          onPress: () => Alert.alert("Success", "Seat booked successfully! Your reference code is HB-RIDE-123") 
        },
      ]
    );
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { borderBottomColor: theme.border, paddingTop: insets.top + 10 }]}>
        <ThemedText type="h3">Group Rides</ThemedText>
        <Pressable 
          onPress={() => setIsPosting(!isPosting)}
          style={[styles.postToggle, { backgroundColor: isPosting ? theme.border : BrandColors.primary.red }]}
        >
          <Feather name={isPosting ? "x" : "plus"} size={20} color="#FFF" />
          <Text style={styles.postToggleText}>{isPosting ? "Cancel" : "Post Trip"}</Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}>
        {isPosting && (
          <View style={[styles.postForm, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <ThemedText style={styles.formTitle}>Post a Verified Trip</ThemedText>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Starting Point</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
                placeholder="Where are you starting?"
                placeholderTextColor={theme.textSecondary}
                value={origin}
                onChangeText={setOrigin}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Destination</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
                placeholder="Where are you going?"
                placeholderTextColor={theme.textSecondary}
                value={destination}
                onChangeText={setDestination}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Fare (R)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
                placeholder="e.g. 35"
                keyboardType="numeric"
                placeholderTextColor={theme.textSecondary}
                value={fare}
                onChangeText={setFare}
              />
            </View>
            <Button title="Post Trip with Map Route" onPress={() => setIsPosting(false)} />
          </View>
        )}

        {rides.map((post) => (
          <View key={post.id} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {/* Driver Info Header */}
            <View style={styles.cardHeader}>
              <View style={[styles.avatar, { backgroundColor: theme.border }]}>
                <Feather name="user" size={24} color={theme.textSecondary} />
              </View>
              <View style={styles.driverInfo}>
                <View style={styles.nameRow}>
                  <ThemedText style={styles.driverName}>{post.driverName}</ThemedText>
                  {post.isVerified && <Feather name="check-circle" size={14} color={BrandColors.primary.blue} />}
                </View>
                <View style={styles.ratingRow}>
                  <Feather name="star" size={12} color="#FFD700" />
                  <Text style={[styles.ratingText, { color: theme.textSecondary }]}>{post.driverRating}</Text>
                </View>
              </View>
              <View style={styles.fareTag}>
                <Text style={styles.fareText}>R{post.fare}</Text>
              </View>
            </View>

            {/* Route Map Preview */}
            <View style={styles.mapContainer}>
              <Image 
                source={{ uri: post.mapPreviewUrl }} 
                style={styles.mapImage}
              />
              <LinearGradient 
                colors={["transparent", "rgba(0,0,0,0.6)"]} 
                style={styles.mapOverlay}
              >
                <View style={styles.routeOverlay}>
                  <Feather name="navigation" size={16} color="#FFF" />
                  <Text style={styles.routeOverlayText}>{post.origin} → {post.destination}</Text>
                </View>
              </LinearGradient>
              {/* Watermark */}
              <View style={styles.watermark}>
                <Text style={styles.watermarkText}>Haibo! App</Text>
              </View>
            </View>

            {/* Post Content */}
            <View style={styles.cardContent}>
              <ThemedText style={styles.description}>{post.description}</ThemedText>
              <View style={styles.rideDetails}>
                <View style={styles.detailItem}>
                  <Feather name="clock" size={14} color={theme.textSecondary} />
                  <Text style={[styles.detailText, { color: theme.textSecondary }]}>{post.departureTime}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Feather name="users" size={14} color={theme.textSecondary} />
                  <Text style={[styles.detailText, { color: theme.textSecondary }]}>{post.seatsAvailable} seats left</Text>
                </View>
              </View>
            </View>

            {/* Interaction Bar */}
            <View style={[styles.interactionBar, { borderTopColor: theme.border }]}>
              <View style={styles.socialActions}>
                <Pressable style={styles.actionButton}>
                  <Feather name="heart" size={20} color={theme.textSecondary} />
                  <Text style={[styles.actionText, { color: theme.textSecondary }]}>{post.likes}</Text>
                </Pressable>
                <Pressable style={styles.actionButton}>
                  <Feather name="message-circle" size={20} color={theme.textSecondary} />
                  <Text style={[styles.actionText, { color: theme.textSecondary }]}>{post.comments}</Text>
                </Pressable>
                <Pressable style={styles.actionButton}>
                  <Feather name="share-2" size={20} color={theme.textSecondary} />
                </Pressable>
              </View>
              <Pressable 
                style={[styles.bookButton, { backgroundColor: BrandColors.primary.red }]}
                onPress={() => handleBookRide(post)}
              >
                <Text style={styles.bookButtonText}>Book with Haibo Pay</Text>
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
  postForm: { padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 20 },
  formTitle: { fontSize: 18, fontWeight: "800", marginBottom: 16 },
  inputGroup: { marginBottom: 12 },
  label: { fontSize: 12, fontWeight: "700", marginBottom: 6, marginLeft: 4 },
  input: { height: 44, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12 },
  card: { borderRadius: 16, borderWidth: 1, marginBottom: 20, overflow: "hidden" },
  cardHeader: { flexDirection: "row", alignItems: "center", padding: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  driverInfo: { flex: 1, marginLeft: 12 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  driverName: { fontWeight: "700", fontSize: 14 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingText: { fontSize: 12 },
  fareTag: { backgroundColor: BrandColors.primary.green + "20", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  fareText: { color: BrandColors.primary.green, fontWeight: "800", fontSize: 16 },
  mapContainer: { width: "100%", height: 180, position: "relative" },
  mapImage: { width: "100%", height: "100%" },
  mapOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end", padding: 12 },
  routeOverlay: { flexDirection: "row", alignItems: "center", gap: 8 },
  routeOverlayText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
  watermark: { position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.3)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  watermarkText: { color: "#FFF", fontSize: 10, fontWeight: "700", opacity: 0.8 },
  cardContent: { padding: 12 },
  description: { fontSize: 14, lineHeight: 20, marginBottom: 10 },
  rideDetails: { flexDirection: "row", gap: 16 },
  detailItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  detailText: { fontSize: 12 },
  interactionBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, borderTopWidth: 1 },
  socialActions: { flexDirection: "row", gap: 16 },
  actionButton: { flexDirection: "row", alignItems: "center", gap: 4 },
  actionText: { fontSize: 12, fontWeight: "600" },
  bookButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  bookButtonText: { color: "#FFF", fontWeight: "700", fontSize: 12 },
});
