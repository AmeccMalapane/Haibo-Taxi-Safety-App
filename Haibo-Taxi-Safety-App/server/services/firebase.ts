import admin from "firebase-admin";

let firebaseApp: admin.app.App | null = null;

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
 * Send a push notification to a single device.
 */
export async function sendPushNotification(
  fcmToken: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<boolean> {
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
 * Send push notification to multiple devices.
 */
export async function sendMulticastNotification(
  fcmTokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<{ success: number; failure: number }> {
  if (!firebaseApp || fcmTokens.length === 0) {
    return { success: 0, failure: fcmTokens.length };
  }

  try {
    const response = await admin.messaging().sendEachForMulticast({
      tokens: fcmTokens,
      notification: { title, body },
      data: data || {},
      android: { priority: "high" },
    });
    console.log(`[Firebase] Multicast: ${response.successCount} sent, ${response.failureCount} failed`);
    return { success: response.successCount, failure: response.failureCount };
  } catch (error: any) {
    console.error("[Firebase] Multicast failed:", error.message);
    return { success: 0, failure: fcmTokens.length };
  }
}
