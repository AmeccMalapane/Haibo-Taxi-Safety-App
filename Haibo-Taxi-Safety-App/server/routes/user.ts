import { Router, Response } from "express";
import { db } from "../db";
import {
  users,
  complaints,
  driverRatings,
  walletTransactions,
  notifications,
  sosAlerts,
  reels,
} from "../../shared/schema";
import { eq, count, sql } from "drizzle-orm";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { sensitiveRateLimit } from "../middleware/rateLimit";
import { kickUserSockets } from "../services/realtime";

// POPIA §23-§25 self-service data rights endpoints.
//
// These are launch-minimum stubs — the privacy policy directs users to
// privacy@haibo.africa for the full export + erasure flow, and these
// endpoints supplement that by giving authenticated users a one-tap
// "here's what we have on you" dump and a "start my deletion" trigger.
// Comprehensive cross-table export + 30-day purge cron ships post-launch.

const router = Router();

// POST /api/user/export — returns the caller's own users row plus counts
// of records they own across the highest-signal related tables. Users who
// want the raw records across every table are pointed at the email path.
router.post(
  "/export",
  authMiddleware,
  sensitiveRateLimit,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;

      const [profile] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!profile) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      // Redact the bcrypt hash — POPIA export is "data about you", not a
      // credential dump. Leaving password out prevents a lost-device
      // scenario from becoming a credential exfil vector.
      const { password: _password, ...redactedProfile } = profile;

      // Counts, not rows, for the related tables. Full rows live behind
      // the email-request flow where a human can verify identity before
      // handing over ride history etc.
      const [
        complaintCount,
        ratingCount,
        walletTxCount,
        notificationCount,
        sosCount,
        communityPostCount,
      ] = await Promise.all([
        db
          .select({ n: count() })
          .from(complaints)
          .where(eq(complaints.userId, userId)),
        db
          .select({ n: count() })
          .from(driverRatings)
          .where(eq(driverRatings.userId, userId)),
        db
          .select({ n: count() })
          .from(walletTransactions)
          .where(eq(walletTransactions.userId, userId)),
        db
          .select({ n: count() })
          .from(notifications)
          .where(eq(notifications.userId, userId)),
        db
          .select({ n: count() })
          .from(sosAlerts)
          .where(eq(sosAlerts.userId, userId)),
        db
          .select({ n: count() })
          .from(reels)
          .where(eq(reels.userId, userId)),
      ]);

      res.json({
        generatedAt: new Date().toISOString(),
        legalBasis:
          "POPIA §23 access to personal information — requested by authenticated user",
        profile: redactedProfile,
        relatedRecordCounts: {
          complaints: complaintCount[0]?.n ?? 0,
          driverRatings: ratingCount[0]?.n ?? 0,
          walletTransactions: walletTxCount[0]?.n ?? 0,
          notifications: notificationCount[0]?.n ?? 0,
          sosAlerts: sosCount[0]?.n ?? 0,
          reels: communityPostCount[0]?.n ?? 0,
        },
        fullExportInstructions:
          "For raw row-level exports across every table, email privacy@haibo.africa from the address on file and we'll respond within 30 days per POPIA §23(2).",
      });
    } catch (error: any) {
      console.error("User export error:", error);
      res.status(500).json({ error: "Failed to generate data export" });
    }
  },
);

// POST /api/user/delete — self-service erasure request. Soft-suspends the
// account, anonymizes identifying PII fields in-place, and leaves a
// suspension reason so admins can still audit the chain. Hard purge of
// related rows happens in a post-launch cron job.
//
// We reuse the existing isSuspended column rather than adding a new
// deletedAt column — that keeps the change launch-compatible (no schema
// migration + db:push coordination). authMiddleware already blocks
// suspended accounts with a 403, so this effectively locks the user out
// the moment the endpoint returns.
router.post(
  "/delete",
  authMiddleware,
  sensitiveRateLimit,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;

      // Preserve uniqueness on phone (NOT NULL UNIQUE) by prefixing with
      // DELETED- and a short id slice. This keeps any foreign keys intact
      // while making it impossible for the number to log back in.
      const deletedPhonePrefix = `DELETED-${userId.substring(0, 8)}-`;

      await db
        .update(users)
        .set({
          isSuspended: true,
          suspendedAt: new Date(),
          suspendedBy: userId,
          suspensionReason: "Self-service POPIA erasure request",
          // Anonymize identifying fields in-place. Keep the uuid + timestamps
          // so the audit trail survives for the 30-day purge window.
          displayName: null,
          email: null,
          avatarUrl: null,
          emergencyContactName: null,
          emergencyContactPhone: null,
          homeAddress: null,
          fcmToken: null,
          phone: sql`${deletedPhonePrefix} || substr(${users.phone}, -4)`,
        })
        .where(eq(users.id, userId));

      // Forcefully disconnect any live WebSocket sessions the erasing
      // user currently holds. POPIA erasure must mean "stops being able
      // to do anything immediately" — without this a user mid-session
      // could keep watching GPS, posting to ride chat, and triggering
      // SOS until their socket naturally disconnects. Non-fatal if it
      // fails; the erasure itself already committed at this point.
      try {
        await kickUserSockets(userId, "account_deleted");
      } catch (kickErr) {
        console.error("[User delete] kickUserSockets failed:", kickErr);
      }

      res.json({
        submitted: true,
        message:
          "Your account has been locked and your identifying information anonymized. Remaining records will be purged within 30 days per POPIA §24. For urgent questions email privacy@haibo.africa.",
      });
    } catch (error: any) {
      console.error("User delete error:", error);
      res.status(500).json({ error: "Failed to process deletion request" });
    }
  },
);

export default router;
