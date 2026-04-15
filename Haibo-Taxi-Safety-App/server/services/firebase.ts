import admin from "firebase-admin";

let firebaseApp: admin.app.App | null = null;

// The mobile client registers tokens via Expo's getExpoPushTokenAsync(),
// which returns an Expo-wrapped token like "ExponentPushToken[xxx]" —
// Firebase's FCM API rejects these as invalid. Detect the prefix and
// route through Expo's push service instead. This keeps the server
// tolerant of both native FCM tokens (if the app ever moves off Expo
// managed) and Expo push tokens (current launch path).
const EXPO_PUSH_API = "https://exp.host/--/api/v2/push/send";
function isExpoPushToken(token: string): boolean {
  return token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[");
}

async function sendViaExpoPush(
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<boolean> {
  try {
    const res = await fetch(EXPO_PUSH_API, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: token,
        title,
        body,
        data: data || {},
        sound: "default",
        priority: "high",
        channelId: "haibo-alerts",
      }),
    });
    if (!res.ok) {
      console.error(`[Expo Push] HTTP ${res.status} for ${token.slice(0, 25)}...`);
      return false;
    }
    const result = await res.json();
    // Expo returns { data: { status: "ok" | "error", ... } } per ticket
    const ticket = result?.data;
    if (ticket?.status === "ok") {
      console.log(`[Expo Push] Sent to ${token.slice(0, 25)}...`);
      return true;
    }
    console.error(
      `[Expo Push] Send failed for ${token.slice(0, 25)}...: ${ticket?.message || "unknown"}`,
    );
    return false;
  } catch (error: any) {
    console.error(`[Expo Push] Request failed:`, error.message);
    return false;
  }
}

async function sendMulticastViaExpoPush(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<{ success: number; failure: number }> {
  // Expo accepts a `to` array for batch sends. Cap at 100 per Expo's
  // documented limit — well above what we'll hit per SOS broadcast.
  if (tokens.length === 0) return { success: 0, failure: 0 };
  try {
    const res = await fetch(EXPO_PUSH_API, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: tokens,
        title,
        body,
        data: data || {},
        sound: "default",
        priority: "high",
        channelId: "haibo-alerts",
      }),
    });
    if (!res.ok) {
      console.error(`[Expo Push] Multicast HTTP ${res.status}`);
      return { success: 0, failure: tokens.length };
    }
    const result = await res.json();
    const tickets = Array.isArray(result?.data) ? result.data : [];
    const success = tickets.filter((t: any) => t?.status === "ok").length;
    console.log(
      `[Expo Push] Multicast: ${success} sent, ${tokens.length - success} failed`,
    );
    return { success, failure: tokens.length - success };
  } catch (error: any) {
    console.error("[Expo Push] Multicast failed:", error.message);
    return { success: 0, failure: tokens.length };
  }
}

/**
 * Initialize Firebase Admin SDK.
 * Requires FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in env.
 */
export function initFirebase(): boolean {
  if (firebaseApp) return true;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    console.warn("[Firebase] Missing credentials — push notifications disabled");
    console.warn("[Firebase] Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in .env");
    return false;
  }

  try {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
    console.log("[Firebase] Initialized successfully");
    return true;
  } catch (error: any) {
    console.error("[Firebase] Init failed:", error.message);
    return false;
  }
}

/**
 * Send a push notification to a single device. Routes Expo-format tokens
 * through Expo's push service and raw FCM tokens through Firebase Admin.
 */
export async function sendPushNotification(
  fcmToken: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<boolean> {
  if (isExpoPushToken(fcmToken)) {
    return sendViaExpoPush(fcmToken, title, body, data);
  }

  if (!firebaseApp) {
    console.warn("[Firebase] Not initialized — notification not sent");
    return false;
  }

  try {
    await admin.messaging().send({
      token: fcmToken,
      notification: { title, body },
      data: data || {},
      android: {
        priority: "high",
        notification: { sound: "default", channelId: "haibo-alerts" },
      },
      apns: {
        payload: { aps: { sound: "default", badge: 1 } },
      },
    });
    console.log(`[Firebase] Notification sent to ${fcmToken.slice(0, 20)}...`);
    return true;
  } catch (error: any) {
    console.error(`[Firebase] Send failed:`, error.message);
    return false;
  }
}

/**
 * Send push notification to multiple devices. Partitions the token list
 * by format and dispatches each subset to the right backend so one mixed
 * broadcast still reaches everyone.
 */
export async function sendMulticastNotification(
  fcmTokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<{ success: number; failure: number }> {
  if (fcmTokens.length === 0) return { success: 0, failure: 0 };

  const expoTokens = fcmTokens.filter(isExpoPushToken);
  const nativeFcmTokens = fcmTokens.filter((t) => !isExpoPushToken(t));

  let totalSuccess = 0;
  let totalFailure = 0;

  if (expoTokens.length > 0) {
    const r = await sendMulticastViaExpoPush(expoTokens, title, body, data);
    totalSuccess += r.success;
    totalFailure += r.failure;
  }

  if (nativeFcmTokens.length > 0) {
    if (!firebaseApp) {
      console.warn(
        `[Firebase] Not initialized — dropping ${nativeFcmTokens.length} FCM notifications`,
      );
      totalFailure += nativeFcmTokens.length;
    } else {
      try {
        const response = await admin.messaging().sendEachForMulticast({
          tokens: nativeFcmTokens,
          notification: { title, body },
          data: data || {},
          android: { priority: "high" },
        });
        console.log(
          `[Firebase] Multicast: ${response.successCount} sent, ${response.failureCount} failed`,
        );
        totalSuccess += response.successCount;
        totalFailure += response.failureCount;
      } catch (error: any) {
        console.error("[Firebase] Multicast failed:", error.message);
        totalFailure += nativeFcmTokens.length;
      }
    }
  }

  return { success: totalSuccess, failure: totalFailure };
}
