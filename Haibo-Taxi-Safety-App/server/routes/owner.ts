import { Router, Response } from "express";
import QRCode from "qrcode";
import { db } from "../db";
import {
  ownerProfiles,
  driverOwnerInvitations,
  driverProfiles,
  walletTransactions,
  users,
} from "../../shared/schema";
import { eq, desc, and, sql, gte, inArray } from "drizzle-orm";
import { authMiddleware, AuthRequest, verifyToken } from "../middleware/auth";

const router = Router();

/**
 * Invitation code format: HBO-XXXXXX (3-letter prefix, 6-char suffix).
 * Suffix avoids ambiguous glyphs (0/O, 1/I/L) so a driver reading a
 * printed code off a payslip or WhatsApp voice note can't fat-finger it.
 */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0, O, 1, I, L
function generateInvitationCode(): string {
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `HBO-${suffix}`;
}

// ─── GET /api/owner/profile/me ──────────────────────────────────────────
// Read the current user's owner profile. Returns 404 if the user hasn't
// completed owner onboarding yet. Clients use this to decide whether to
// show OwnerOnboarding (no row) or the owner dashboard (row exists).
router.get("/profile/me", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [row] = await db
      .select()
      .from(ownerProfiles)
      .where(eq(ownerProfiles.userId, req.user!.userId))
      .limit(1);

    if (!row) {
      res.status(404).json({ error: "Owner profile not found" });
      return;
    }
    res.json(row);
  } catch (err: any) {
    console.error("Get owner profile error:", err);
    res.status(500).json({ error: "Failed to load owner profile" });
  }
});

// ─── POST /api/owner/profile ────────────────────────────────────────────
// Create-or-update the current user's owner profile. Upsert by userId so
// the same endpoint handles first-time onboarding and later edits (bank
// change, VAT update). Also flips users.role to 'owner' if the user isn't
// already one — this is how a commuter "becomes" an owner in the app.
router.post("/profile", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const {
      companyName,
      bankCode,
      accountNumber,
      accountName,
      companyRegNumber,
      vatNumber,
    } = req.body as {
      companyName?: string;
      bankCode?: string;
      accountNumber?: string;
      accountName?: string;
      companyRegNumber?: string;
      vatNumber?: string;
    };

    // Minimal validation — bank fields are optional at first entry so
    // an owner can register + start issuing invitations before their
    // bank details are verified. Withdrawals will block server-side
    // until paystack_recipient_code is populated.
    if (bankCode && !/^[0-9]{3,10}$/.test(bankCode)) {
      res.status(400).json({ error: "Invalid bank code" });
      return;
    }
    if (accountNumber && !/^[0-9]{6,20}$/.test(accountNumber)) {
      res.status(400).json({ error: "Invalid account number" });
      return;
    }

    const [existing] = await db
      .select()
      .from(ownerProfiles)
      .where(eq(ownerProfiles.userId, req.user!.userId))
      .limit(1);

    let row;
    if (existing) {
      [row] = await db
        .update(ownerProfiles)
        .set({
          companyName: companyName ?? existing.companyName,
          bankCode: bankCode ?? existing.bankCode,
          accountNumber: accountNumber ?? existing.accountNumber,
          accountName: accountName ?? existing.accountName,
          companyRegNumber: companyRegNumber ?? existing.companyRegNumber,
          vatNumber: vatNumber ?? existing.vatNumber,
          updatedAt: new Date(),
        })
        .where(eq(ownerProfiles.userId, req.user!.userId))
        .returning();
    } else {
      [row] = await db
        .insert(ownerProfiles)
        .values({
          userId: req.user!.userId,
          companyName: companyName || null,
          bankCode: bankCode || null,
          accountNumber: accountNumber || null,
          accountName: accountName || null,
          companyRegNumber: companyRegNumber || null,
          vatNumber: vatNumber || null,
        })
        .returning();

      // First-time onboarding — promote the user to 'owner' so role-aware
      // routing + dashboards pick them up.
      await db
        .update(users)
        .set({ role: "owner" })
        .where(eq(users.id, req.user!.userId));
    }

    res.json(row);
  } catch (err: any) {
    console.error("Upsert owner profile error:", err);
    res.status(500).json({ error: "Failed to save owner profile" });
  }
});

// ─── POST /api/owner/profile/kyc ────────────────────────────────────────
// Owner submits KYC document URLs (uploaded via /api/uploads/image first).
// Stores the URL set on owner_profiles.kycDocuments and flips kycStatus
// to 'pending' so an admin picks it up in the command-center review queue.
//
// Accepts partial uploads (only idDocumentUrl required) so the client can
// implement a save-and-continue-later flow without the server rejecting
// incomplete submissions.
router.post(
  "/profile/kyc",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const {
        idDocumentUrl,
        proofOfAddressUrl,
        companyRegDocUrl,
      } = req.body ?? {};

      if (!idDocumentUrl || typeof idDocumentUrl !== "string") {
        res.status(400).json({
          error: "idDocumentUrl is required (at minimum, a government ID)",
        });
        return;
      }

      const [existing] = await db
        .select()
        .from(ownerProfiles)
        .where(eq(ownerProfiles.userId, userId))
        .limit(1);

      if (!existing) {
        // Can't upload KYC for a profile that doesn't exist — force the
        // user to complete onboarding first so we have bank details on
        // file before any admin even looks at their docs.
        res.status(404).json({
          error: "Complete owner onboarding first",
          code: "PROFILE_NOT_FOUND",
        });
        return;
      }

      const docs = {
        idDocumentUrl,
        proofOfAddressUrl: proofOfAddressUrl || undefined,
        companyRegDocUrl: companyRegDocUrl || undefined,
        uploadedAt: new Date().toISOString(),
      };

      const [updated] = await db
        .update(ownerProfiles)
        .set({
          kycDocuments: docs,
          kycStatus: "pending",
          kycRejectionReason: null,
          updatedAt: new Date(),
        })
        .where(eq(ownerProfiles.userId, userId))
        .returning();

      res.json(updated);
    } catch (err: any) {
      console.error("Owner KYC upload error:", err);
      res.status(500).json({ error: "Failed to save KYC documents" });
    }
  },
);

// ─── POST /api/owner/invitations ────────────────────────────────────────
// Owner generates a new invitation code for a driver they're hiring.
// Returns the generated code so the owner can copy / share it. Limited
// to 20 pending invites per owner so a stolen session can't spam the
// code pool.
router.post("/invitations", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { label, expiresInDays } = req.body as {
      label?: string;
      expiresInDays?: number;
    };

    // Must be an owner (onboarded + role set) to issue invitations.
    const [profile] = await db
      .select()
      .from(ownerProfiles)
      .where(eq(ownerProfiles.userId, req.user!.userId))
      .limit(1);
    if (!profile) {
      res.status(403).json({ error: "Complete owner onboarding first" });
      return;
    }

    // Cap pending invites per owner.
    const pending = await db
      .select({ id: driverOwnerInvitations.id })
      .from(driverOwnerInvitations)
      .where(
        and(
          eq(driverOwnerInvitations.ownerId, req.user!.userId),
          eq(driverOwnerInvitations.status, "pending"),
        ),
      );
    if (pending.length >= 20) {
      res.status(429).json({
        error: "You have too many pending invites. Revoke some first.",
      });
      return;
    }

    // Regenerate on collision (vanishingly rare at 31^6 ≈ 887M codes, but
    // handle it so we never crash the request).
    let code = generateInvitationCode();
    for (let attempts = 0; attempts < 4; attempts++) {
      const [hit] = await db
        .select({ id: driverOwnerInvitations.id })
        .from(driverOwnerInvitations)
        .where(eq(driverOwnerInvitations.code, code))
        .limit(1);
      if (!hit) break;
      code = generateInvitationCode();
    }

    const expiresAt = expiresInDays
      ? new Date(Date.now() + Math.min(expiresInDays, 90) * 24 * 60 * 60 * 1000)
      : null;

    const [row] = await db
      .insert(driverOwnerInvitations)
      .values({
        ownerId: req.user!.userId,
        code,
        label: label?.slice(0, 60) || null,
        expiresAt,
        status: "pending",
      })
      .returning();

    res.status(201).json(row);
  } catch (err: any) {
    console.error("Create invitation error:", err);
    res.status(500).json({ error: "Failed to create invitation" });
  }
});

// ─── GET /api/owner/invitations/:id/qr.png ──────────────────────────────
// Renders a scannable QR image for an invitation — encodes a smart link
// that opens the Haibo app on ProfileSetup with the invite code pre-
// filled. Scanning with any phone's native camera app works without
// needing the in-app scanner.
//
// Authenticated + ownership-gated: only the owner who issued the code
// can fetch its QR (prevents guessing by invitation id). Revoked or
// used invitations still render the image — owners sometimes want to
// re-print a retired card, and the redeem endpoint will reject stale
// codes anyway.
router.get(
  "/invitations/:id/qr.png",
  async (req, res: Response) => {
    // Custom auth path: the mobile <Image> loader can't set an
    // Authorization header reliably across iOS/Android/web, so we
    // accept the bearer token via ?token=… as a fallback. Header still
    // takes precedence for non-image callers. Either way we verify and
    // own the lookup ourselves so a forged ?token=random string never
    // reaches the ownership check below.
    const authHeader = req.headers.authorization;
    const headerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : undefined;
    const queryToken =
      typeof req.query.token === "string" ? req.query.token : undefined;
    const token = headerToken || queryToken;

    if (!token) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    let userId: string;
    try {
      userId = verifyToken(token).userId;
    } catch {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    try {
      const [row] = await db
        .select({
          code: driverOwnerInvitations.code,
          ownerId: driverOwnerInvitations.ownerId,
        })
        .from(driverOwnerInvitations)
        .where(eq(driverOwnerInvitations.id, req.params.id))
        .limit(1);

      if (!row || row.ownerId !== userId) {
        res.status(404).json({ error: "Invitation not found" });
        return;
      }

      // Same smart-link pattern as vendor QR: prefer HTTPS for native
      // camera compatibility (iOS 11+ and every modern Android camera
      // auto-recognises https:// QRs), fall back to the app scheme for
      // local dev.
      const shareBase =
        process.env.INVITE_SHARE_BASE_URL ||
        (process.env.EXPO_PUBLIC_DOMAIN
          ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
          : null);
      const url = shareBase
        ? `${shareBase.replace(/\/$/, "")}/invite-driver/${encodeURIComponent(row.code)}`
        : `haibo-taxi://invite-driver/${encodeURIComponent(row.code)}`;

      const png = await QRCode.toBuffer(url, {
        type: "png",
        errorCorrectionLevel: "M",
        width: 512,
        margin: 2,
        color: {
          // Teal for owner-side surfaces — matches the role accent.
          dark: "#0D9488",
          light: "#FFFFFF",
        },
      });

      res.setHeader("Content-Type", "image/png");
      // Short TTL so a revoked/used code's QR image stops being cached
      // on mobile viewers shortly after the state change.
      res.setHeader("Cache-Control", "private, max-age=300");
      res.send(png);
    } catch (err: any) {
      console.error("Invitation QR error:", err);
      res.status(500).json({ error: "Failed to generate QR" });
    }
  },
);

// ─── GET /api/owner/invitations ─────────────────────────────────────────
// List the current owner's invitations. Most-recent-first. Includes
// usedByDisplayName + usedByPhone for redeemed ones so the owner can
// see which driver claimed which code.
router.get("/invitations", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const rows = await db
      .select({
        id: driverOwnerInvitations.id,
        code: driverOwnerInvitations.code,
        label: driverOwnerInvitations.label,
        status: driverOwnerInvitations.status,
        expiresAt: driverOwnerInvitations.expiresAt,
        usedAt: driverOwnerInvitations.usedAt,
        usedByUserId: driverOwnerInvitations.usedByUserId,
        revokedAt: driverOwnerInvitations.revokedAt,
        createdAt: driverOwnerInvitations.createdAt,
        usedByDisplayName: users.displayName,
        usedByPhone: users.phone,
      })
      .from(driverOwnerInvitations)
      .leftJoin(users, eq(users.id, driverOwnerInvitations.usedByUserId))
      .where(eq(driverOwnerInvitations.ownerId, req.user!.userId))
      .orderBy(desc(driverOwnerInvitations.createdAt))
      .limit(100);

    res.json({ data: rows });
  } catch (err: any) {
    console.error("List invitations error:", err);
    res.status(500).json({ error: "Failed to list invitations" });
  }
});

// ─── POST /api/owner/invitations/:id/revoke ─────────────────────────────
// Owner cancels a pending invitation. No-op if already redeemed.
router.post(
  "/invitations/:id/revoke",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const [invitation] = await db
        .select()
        .from(driverOwnerInvitations)
        .where(eq(driverOwnerInvitations.id, req.params.id))
        .limit(1);

      if (!invitation) {
        res.status(404).json({ error: "Invitation not found" });
        return;
      }
      if (invitation.ownerId !== req.user!.userId) {
        res.status(403).json({ error: "Not your invitation" });
        return;
      }
      if (invitation.status !== "pending") {
        res.status(400).json({
          error: "Only pending invitations can be revoked",
          status: invitation.status,
        });
        return;
      }

      const [row] = await db
        .update(driverOwnerInvitations)
        .set({ status: "revoked", revokedAt: new Date() })
        .where(eq(driverOwnerInvitations.id, req.params.id))
        .returning();

      res.json(row);
    } catch (err: any) {
      console.error("Revoke invitation error:", err);
      res.status(500).json({ error: "Failed to revoke invitation" });
    }
  },
);

// ─── GET /api/owner/drivers ─────────────────────────────────────────────
// List drivers linked to the current owner. Useful for the owner
// dashboard's "my drivers" section. Includes basic earnings + rating
// info so the dashboard can render a per-driver row without a second
// round-trip.
router.get("/drivers", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const rows = await db
      .select({
        userId: driverProfiles.userId,
        linkStatus: driverProfiles.linkStatus,
        linkedAt: driverProfiles.linkedAt,
        taxiPlateNumber: driverProfiles.taxiPlateNumber,
        safetyRating: driverProfiles.safetyRating,
        totalRides: driverProfiles.totalRides,
        displayName: users.displayName,
        phone: users.phone,
        handle: users.handle,
        avatarUrl: users.avatarUrl,
        fareBalance: users.fareBalance,
      })
      .from(driverProfiles)
      .leftJoin(users, eq(users.id, driverProfiles.userId))
      .where(eq(driverProfiles.ownerId, req.user!.userId))
      .orderBy(desc(driverProfiles.linkedAt));

    res.json({ data: rows });
  } catch (err: any) {
    console.error("List owner drivers error:", err);
    res.status(500).json({ error: "Failed to list drivers" });
  }
});

// ─── GET /api/owner/dashboard ───────────────────────────────────────────
// One-shot snapshot for the OwnerDashboardScreen: aggregate fleet
// revenue, pending settlements, driver count. Designed to be cheap
// enough to call on screen focus without pagination.
router.get("/dashboard", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const ownerId = req.user!.userId;

    // Owner's own wallet (platform withdrawals go from here).
    const [owner] = await db
      .select({
        walletBalance: users.walletBalance,
        displayName: users.displayName,
        phone: users.phone,
      })
      .from(users)
      .where(eq(users.id, ownerId))
      .limit(1);

    // KYC state drives the "Verify identity" banner on the mobile
    // dashboard. Left-joined (separate query) so an owner who hasn't
    // completed onboarding still gets a dashboard, not a 500.
    const [ownerProfileRow] = await db
      .select({ kycStatus: ownerProfiles.kycStatus })
      .from(ownerProfiles)
      .where(eq(ownerProfiles.userId, ownerId))
      .limit(1);

    // Linked drivers — for driver count + ids used by downstream aggregates.
    const linkedDrivers = await db
      .select({
        userId: driverProfiles.userId,
        fareBalance: users.fareBalance,
        displayName: users.displayName,
      })
      .from(driverProfiles)
      .leftJoin(users, eq(users.id, driverProfiles.userId))
      .where(
        and(
          eq(driverProfiles.ownerId, ownerId),
          eq(driverProfiles.linkStatus, "active"),
        ),
      );

    const driverIds = linkedDrivers.map((d) => d.userId).filter(Boolean);

    // Aggregate pending fare balances across all linked drivers. This is
    // money the owner hasn't received yet — drivers see it in their
    // dashboards, owner settles it on withdrawal.
    const totalPendingFare = linkedDrivers.reduce(
      (sum, d) => sum + Number(d.fareBalance || 0),
      0,
    );

    // Today's gross inflow (fares + hub deliveries) across all linked
    // drivers. Counts only credits (positive amounts) since debits
    // represent money movement out.
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const weekStart = new Date(dayStart);
    weekStart.setUTCDate(weekStart.getUTCDate() - 7);

    let today = 0;
    let week = 0;
    if (driverIds.length > 0) {
      const [todayAgg] = await db
        .select({
          total: sql<number>`COALESCE(SUM(${walletTransactions.amount}), 0)::float`,
        })
        .from(walletTransactions)
        .where(
          and(
            inArray(walletTransactions.userId, driverIds),
            inArray(walletTransactions.type, ["fare_in", "hub_delivery_in"]),
            gte(walletTransactions.createdAt, dayStart),
          ),
        );
      today = Number(todayAgg?.total || 0);

      const [weekAgg] = await db
        .select({
          total: sql<number>`COALESCE(SUM(${walletTransactions.amount}), 0)::float`,
        })
        .from(walletTransactions)
        .where(
          and(
            inArray(walletTransactions.userId, driverIds),
            inArray(walletTransactions.type, ["fare_in", "hub_delivery_in"]),
            gte(walletTransactions.createdAt, weekStart),
          ),
        );
      week = Number(weekAgg?.total || 0);
    }

    res.json({
      owner: {
        displayName: owner?.displayName || "Owner",
        walletBalance: Number(owner?.walletBalance || 0),
        kycStatus: ownerProfileRow?.kycStatus || "unverified",
      },
      fleet: {
        driverCount: linkedDrivers.length,
        totalPendingFare,
      },
      earnings: { today, week },
      drivers: linkedDrivers.map((d) => ({
        userId: d.userId,
        displayName: d.displayName || "Driver",
        fareBalance: Number(d.fareBalance || 0),
      })),
    });
  } catch (err: any) {
    console.error("Owner dashboard error:", err);
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});

// ─── GET /api/owner/stats/timeseries ────────────────────────────────────
// Daily fleet earnings for the last 7 or 30 days, shaped for the
// StatTrendChart component. Pre-aggregates on the DB side so the
// client receives ≤30 rows instead of thousands.
router.get("/stats/timeseries", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const ownerId = req.user!.userId;
    const windowDays = Math.min(
      Math.max(Number(req.query.window) || 7, 1),
      90,
    );

    // Resolve linked driver ids up front.
    const linkedDrivers = await db
      .select({ userId: driverProfiles.userId })
      .from(driverProfiles)
      .where(
        and(
          eq(driverProfiles.ownerId, ownerId),
          eq(driverProfiles.linkStatus, "active"),
        ),
      );
    const driverIds = linkedDrivers.map((d) => d.userId).filter(Boolean);

    if (driverIds.length === 0) {
      res.json({ windowDays, points: [] });
      return;
    }

    const windowStart = new Date();
    windowStart.setUTCHours(0, 0, 0, 0);
    windowStart.setUTCDate(windowStart.getUTCDate() - (windowDays - 1));

    const rows = await db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${walletTransactions.createdAt}), 'YYYY-MM-DD')`,
        total: sql<number>`COALESCE(SUM(${walletTransactions.amount}), 0)::float`,
      })
      .from(walletTransactions)
      .where(
        and(
          inArray(walletTransactions.userId, driverIds),
          inArray(walletTransactions.type, ["fare_in", "hub_delivery_in"]),
          gte(walletTransactions.createdAt, windowStart),
        ),
      )
      .groupBy(sql`date_trunc('day', ${walletTransactions.createdAt})`)
      .orderBy(sql`date_trunc('day', ${walletTransactions.createdAt})`);

    // Fill in zero-days so the chart x-axis is continuous.
    const byDay = new Map(rows.map((r) => [r.day, Number(r.total || 0)]));
    const points: { day: string; total: number }[] = [];
    for (let i = 0; i < windowDays; i++) {
      const d = new Date(windowStart);
      d.setUTCDate(d.getUTCDate() + i);
      const key = d.toISOString().slice(0, 10);
      points.push({ day: key, total: byDay.get(key) ?? 0 });
    }

    res.json({ windowDays, points });
  } catch (err: any) {
    console.error("Owner timeseries error:", err);
    res.status(500).json({ error: "Failed to load timeseries" });
  }
});

export default router;
