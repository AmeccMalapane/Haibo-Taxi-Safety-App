import { db } from "../db";
import { notifications, users, sosAlerts } from "../../shared/schema";
import { eq, and, inArray } from "drizzle-orm";
import { sendPushNotification, sendMulticastNotification } from "./firebase";
import { emitToUser, broadcast, getIO } from "./realtime";

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
 * Send SOS alert to emergency contact (SMS), admins (push), and command center (WebSocket).
 * Every trigger is persisted to sos_alerts for audit / post-incident review.
 */
export async function sendSOSAlert(
  userId: string,
  latitude: number,
  longitude: number,
  message?: string,
  source: "api" | "websocket" = "api"
): Promise<void> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return;

  const mapsLink = `https://maps.google.com/?q=${latitude},${longitude}`;
  const sosMessage = message || `${user.displayName || user.phone} triggered an SOS alert!`;
  const smsBody = `HAIBO SOS ALERT: ${user.displayName || "A passenger"} needs help! Location: ${mapsLink}`;

  // 1. Notify all admins via push
  const admins = await db.select({ id: users.id })
    .from(users)
    .where(eq(users.role, "admin"));

  if (admins.length > 0) {
    await notifyUsers(
      admins.map((a) => a.id),
      "sos",
      "SOS Alert",
      sosMessage,
      { latitude: String(latitude), longitude: String(longitude), userId, mapsLink }
    );
  }

  // 2. Broadcast to command center via WebSocket
  const io = getIO();
  if (io) {
    io.to("admins").emit("sos:alert", {
      userId,
      phone: user.phone,
      displayName: user.displayName,
      latitude,
      longitude,
      message: sosMessage,
      mapsLink,
      timestamp: new Date().toISOString(),
    });
  }

  // 3. Send SMS to the user's registered emergency contact (inline on users table)
  let smsRecipients = 0;
  if (user.emergencyContactPhone) {
    try {
      const { sendSms } = await import("./sms");
      await sendSms(user.emergencyContactPhone, smsBody);
      smsRecipients = 1;
      console.log(`[SOS] SMS sent to ${user.emergencyContactName || "contact"} (${user.emergencyContactPhone})`);
    } catch (smsErr) {
      console.log(`[SOS] SMS to ${user.emergencyContactPhone} failed:`, smsErr);
    }
  }

  // 4. Persist audit record — even if push/SMS fail, we have a record of the trigger
  try {
    await db.insert(sosAlerts).values({
      userId,
      phone: user.phone,
      latitude,
      longitude,
      message: sosMessage,
      source,
      adminRecipients: admins.length,
      smsRecipients,
    });
  } catch (auditErr) {
    console.error("[SOS] CRITICAL: audit log insert failed:", auditErr);
  }

  console.log(`[SOS] Full alert from ${user.phone} at ${latitude},${longitude}`);
}
