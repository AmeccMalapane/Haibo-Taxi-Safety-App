import { Router, Response } from "express";
import { db } from "../db";
import {
  ownerProfiles,
  driverOwnerInvitations,
  driverProfiles,
  users,
} from "../../shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { authMiddleware, AuthRequest } from "../middleware/auth";

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

export default router;
