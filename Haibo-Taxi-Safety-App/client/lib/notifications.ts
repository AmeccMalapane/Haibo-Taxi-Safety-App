import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { getCurrentToken } from "@/contexts/AuthContext";

/**
 * Configure notification handling behavior.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register for push notifications and send the token to the server.
 * Returns the Expo push token or null if registration fails.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Push notifications don't work in simulators
  if (!Device.isDevice) {
    console.log("[Notifications] Must use physical device for push notifications");
    return null;
  }

  // Check existing permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permission if not granted
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("[Notifications] Permission not granted");
    return null;
  }

  // Android needs a notification channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("haibo-alerts", {
      name: "Haibo Alerts",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#C81E5E",
      sound: "default",
    });
  }

  try {
    // Get the Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: "4304f120-f88f-4752-885a-ed316817d9b7",
    });

    const expoPushToken = tokenData.data;
    console.log("[Notifications] Expo push token:", expoPushToken);

    // Send to server if authenticated
    if (getApiUrl() && getCurrentToken()) {
      try {
        await apiRequest("/api/notifications/register-token", {
          method: "POST",
          body: JSON.stringify({ fcmToken: expoPushToken }),
        });
        console.log("[Notifications] Token registered with server");
      } catch (err) {
        console.log("[Notifications] Failed to register token with server:", err);
      }
    }

    return expoPushToken;
  } catch (error) {
    console.error("[Notifications] Failed to get push token:", error);
    return null;
  }
}

/**
 * Add a listener for incoming notifications (when app is foregrounded).
 */
export function onNotificationReceived(
  callback: (notification: Notifications.Notification) => void
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Add a listener for when user taps a notification.
 */
export function onNotificationTapped(
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Get the number of unread notifications (badge count).
 */
export async function getBadgeCount(): Promise<number> {
  return await Notifications.getBadgeCountAsync();
}

/**
 * Set the badge count.
 */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}
