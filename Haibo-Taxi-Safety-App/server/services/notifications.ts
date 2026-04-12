import { db } from "../db";
import { notifications, users } from "../../shared/schema";
import { eq, and, inArray } from "drizzle-orm";
import { sendPushNotification, sendMulticastNotification } from "./firebase";

export type NotificationType = "sos" | "delivery" | "ride" | "payment" | "system" | "complaint_update";

interface SendNotificationOptions {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
}

/**
 * Send a notification to a single user — saves to DB + sends push.
 */
export async function notifyUser(opts: SendNotificationOptions): Promise<boolean> {
  const { userId, type, title, body, data } = opts;

  // Save to notifications table
  await db.insert(notifications).values({
    userId,
    type,
    title,
    body,
    data: data || null,
    sentAt: new Date(),
  });

  // Get user's FCM token
  const [user] = await db.select({ fcmToken: users.fcmToken })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (user?.fcmToken) {
    return await sendPushNotification(
      user.fcmToken,
      title,
      body,
      data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : undefined
    );
  }

  console.log(`[Notify] No FCM token for user ${userId} — saved to DB only`);
  return false;
}

/**
 * Send a notification to multiple users (e.g., SOS broadcast).
 */
export async function notifyUsers(
  userIds: string[],
  type: NotificationType,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<{ sent: number; failed: number }> {
  if (userIds.length === 0) return { sent: 0, failed: 0 };

  // Save notifications for all users
  await db.insert(notifications).values(
    userIds.map((userId) => ({
      userId,
      type,
      title,
      body,
      data: data || null,
      sentAt: new Date(),
    }))
  );

  // Get FCM tokens
  const usersWithTokens = await db.select({ id: users.id, fcmToken: users.fcmToken })
    .from(users)
    .where(inArray(users.id, userIds));

  const tokens = usersWithTokens
    .filter((u) => u.fcmToken)
    .map((u) => u.fcmToken!);

  if (tokens.length === 0) {
    return { sent: 0, failed: userIds.length };
  }

  const stringData = data
    ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]))
    : undefined;

  return await sendMulticastNotification(tokens, title, body, stringData);
}

/**
 * Send SOS alert to emergency contacts and nearby users.
 */
export async function sendSOSAlert(
  userId: string,
  latitude: number,
  longitude: number,
  message?: string
): Promise<void> {
  // Get user info
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return;

  const sosMessage = message || `${user.displayName || user.phone} triggered an SOS alert!`;

  // Notify admins
  const admins = await db.select({ id: users.id })
    .from(users)
    .where(eq(users.role, "admin"));

  if (admins.length > 0) {
    await notifyUsers(
      admins.map((a) => a.id),
      "sos",
      "SOS Alert",
      sosMessage,
      { latitude: String(latitude), longitude: String(longitude), userId }
    );
  }

  console.log(`[SOS] Alert from ${user.phone} at ${latitude},${longitude}`);
}
