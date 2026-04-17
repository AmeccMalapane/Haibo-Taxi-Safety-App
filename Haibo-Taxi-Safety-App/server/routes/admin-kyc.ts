import { Router, Response } from "express";
import { db } from "../db";
import {
  ownerProfiles,
  vendorProfiles,
  users,
} from "../../shared/schema";
import { eq, desc, and, isNotNull, inArray } from "drizzle-orm";
import { authMiddleware, AuthRequest, requireRole } from "../middleware/auth";
import { notifyUser } from "../services/notifications";
import { recordAdminAction } from "../services/audit";

// Admin KYC review queue.
//
// Reviews live in two places — owner_profiles.kyc_status and
// vendor_profiles.status. These endpoints unify both so the admin sees
// one queue, tagged by role. Status state machine:
//
//   owner_profiles.kycStatus:
//     unverified → pending (user uploaded docs)
//     pending    → verified | rejected (admin decided)
//
//   vendor_profiles.status:
//     pending  → verified | rejected
//     verified → suspended (out-of-band admin action)
//
// Rejections store a reason so the user can re-upload and fix the
// problem. Approvals clear the reason so a re-submitted profile isn't
// haunted by the old rejection text.

const router = Router();

router.use(authMiddleware, requireRole("admin"));

// ─── GET /api/admin/kyc ─────────────────────────────────────────────────
// Unified KYC review queue. Returns entries from both owner_profiles
// and vendor_profiles that have kyc_documents submitted (no point
// reviewing empty submissions). Filters:
//   • role=owner|vendor|all (default all)
//   • status=pending|verified|rejected|all (default pending)
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const role = (req.query.role as string) || "all";
    const status = (req.query.status as string) || "pending";

    const ownerStatuses: Record<string, string[]> = {
      pending: ["pending"],
      verified: ["verified"],
      rejected: ["rejected"],
      all: ["unverified", "pending", "verified", "rejected"],
    };
    const vendorStatuses: Record<string, string[]> = {
      pending: ["pending"],
      verified: ["verified"],
      rejected: ["rejected"],
      all: ["pending", "verified", "rejected", "suspended"],
    };

    const items: Array<{
      role: "owner" | "vendor";
      profileId: string;
      userId: string;
      displayName: string | null;
      phone: string | null;
      kycStatus: string;
      kycDocuments: any;
      rejectionReason: string | null;
      submittedAt: string | null;
      reviewedAt: string | null;
      reviewedBy: string | null;
      extra: Record<string, unknown>;
    }> = [];

    if (role === "owner" || role === "all") {
      const rows = await db
        .select({
          profileId: ownerProfiles.id,
          userId: ownerProfiles.userId,
          displayName: users.displayName,
          phone: users.phone,
          kycStatus: ownerProfiles.kycStatus,
          kycDocuments: ownerProfiles.kycDocuments,
          rejectionReason: ownerProfiles.kycRejectionReason,
          companyName: ownerProfiles.companyName,
          updatedAt: ownerProfiles.updatedAt,
          reviewedAt: ownerProfiles.kycReviewedAt,
          reviewedBy: ownerProfiles.kycReviewedBy,
        })
        .from(ownerProfiles)
        .leftJoin(users, eq(users.id, ownerProfiles.userId))
        .where(
          and(
            // Exclude rows that never submitted docs — those aren't
            // review work, they're just onboarded profiles.
            isNotNull(ownerProfiles.kycDocuments),
            inArray(
              ownerProfiles.kycStatus,
              ownerStatuses[status] || ownerStatuses.pending,
            ),
          ),
        )
        .orderBy(desc(ownerProfiles.updatedAt))
        .limit(200);

      for (const r of rows) {
        items.push({
          role: "owner",
          profileId: r.profileId,
          userId: r.userId,
          displayName: r.displayName,
          phone: r.phone,
          kycStatus: r.kycStatus || "unverified",
          kycDocuments: r.kycDocuments,
          rejectionReason: r.rejectionReason,
          submittedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
          reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
          reviewedBy: r.reviewedBy,
          extra: { companyName: r.companyName },
        });
      }
    }

    if (role === "vendor" || role === "all") {
      const rows = await db
        .select({
          profileId: vendorProfiles.id,
          userId: vendorProfiles.userId,
          displayName: users.displayName,
          phone: users.phone,
          status: vendorProfiles.status,
          kycDocuments: vendorProfiles.kycDocuments,
          rejectionReason: vendorProfiles.kycRejectionReason,
          businessName: vendorProfiles.businessName,
          vendorType: vendorProfiles.vendorType,
          vendorRef: vendorProfiles.vendorRef,
          updatedAt: vendorProfiles.updatedAt,
          reviewedAt: vendorProfiles.reviewedAt,
          reviewedBy: vendorProfiles.reviewedBy,
        })
        .from(vendorProfiles)
        .leftJoin(users, eq(users.id, vendorProfiles.userId))
        .where(
          and(
            isNotNull(vendorProfiles.kycDocuments),
            inArray(
              vendorProfiles.status,
              vendorStatuses[status] || vendorStatuses.pending,
            ),
          ),
        )
        .orderBy(desc(vendorProfiles.updatedAt))
        .limit(200);

      for (const r of rows) {
        items.push({
          role: "vendor",
          profileId: r.profileId,
          userId: r.userId,
          displayName: r.displayName,
          phone: r.phone,
          kycStatus: r.status,
          kycDocuments: r.kycDocuments,
          rejectionReason: r.rejectionReason,
          submittedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
          reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
          reviewedBy: r.reviewedBy,
          extra: {
            businessName: r.businessName,
            vendorType: r.vendorType,
            vendorRef: r.vendorRef,
          },
        });
      }
    }

    // Newest submitted first — admins care about the freshest queue.
    items.sort((a, b) => {
      const aTime = a.submittedAt ? Date.parse(a.submittedAt) : 0;
      const bTime = b.submittedAt ? Date.parse(b.submittedAt) : 0;
      return bTime - aTime;
    });

    res.json({ data: items });
  } catch (err: any) {
    console.error("List KYC submissions error:", err);
    res.status(500).json({ error: "Failed to list KYC submissions" });
  }
});

// ─── PUT /api/admin/kyc/owner/:profileId/approve ────────────────────────
router.put(
  "/owner/:profileId/approve",
  async (req: AuthRequest, res: Response) => {
    try {
      const updated = await db
        .update(ownerProfiles)
        .set({
          kycStatus: "verified",
          kycReviewedAt: new Date(),
          kycReviewedBy: req.user!.userId,
          kycRejectionReason: null,
          updatedAt: new Date(),
        })
        .where(eq(ownerProfiles.id, req.params.profileId))
        .returning();

      if (updated.length === 0) {
        res.status(404).json({ error: "Owner profile not found" });
        return;
      }

      const row = updated[0];

      try {
        await notifyUser({
          userId: row.userId,
          type: "system",
          title: "Fleet verified",
          body: "Your owner profile is verified. Withdrawals are unlocked.",
          data: { kind: "kyc_approved", role: "owner" },
        });
      } catch (notifyErr) {
        console.log("[Admin KYC] owner approve notify failed:", notifyErr);
      }

      await recordAdminAction(
        req,
        "kyc.owner.approve",
        "owner_profiles",
        row.id,
        { userId: row.userId },
      );

      res.json(row);
    } catch (err: any) {
      console.error("Approve owner KYC error:", err);
      res.status(500).json({ error: "Failed to approve owner KYC" });
    }
  },
);

// ─── PUT /api/admin/kyc/owner/:profileId/reject ─────────────────────────
router.put(
  "/owner/:profileId/reject",
  async (req: AuthRequest, res: Response) => {
    try {
      const { reason } = req.body as { reason?: string };
      if (
        !reason ||
        typeof reason !== "string" ||
        reason.trim().length === 0 ||
        reason.length > 500
      ) {
        res
          .status(400)
          .json({ error: "reason is required and must be ≤ 500 characters" });
        return;
      }

      const updated = await db
        .update(ownerProfiles)
        .set({
          kycStatus: "rejected",
          kycRejectionReason: reason.trim(),
          kycReviewedAt: new Date(),
          kycReviewedBy: req.user!.userId,
          updatedAt: new Date(),
        })
        .where(eq(ownerProfiles.id, req.params.profileId))
        .returning();

      if (updated.length === 0) {
        res.status(404).json({ error: "Owner profile not found" });
        return;
      }

      const row = updated[0];

      try {
        await notifyUser({
          userId: row.userId,
          type: "system",
          title: "Verification needs attention",
          body: `Your owner documents need changes: ${reason.trim()}. Tap to re-upload.`,
          data: { kind: "kyc_rejected", role: "owner" },
        });
      } catch (notifyErr) {
        console.log("[Admin KYC] owner reject notify failed:", notifyErr);
      }

      await recordAdminAction(
        req,
        "kyc.owner.reject",
        "owner_profiles",
        row.id,
        { userId: row.userId, reason: reason.trim() },
      );

      res.json(row);
    } catch (err: any) {
      console.error("Reject owner KYC error:", err);
      res.status(500).json({ error: "Failed to reject owner KYC" });
    }
  },
);

// ─── PUT /api/admin/kyc/vendor/:profileId/approve ───────────────────────
router.put(
  "/vendor/:profileId/approve",
  async (req: AuthRequest, res: Response) => {
    try {
      const updated = await db
        .update(vendorProfiles)
        .set({
          status: "verified",
          reviewedAt: new Date(),
          reviewedBy: req.user!.userId,
          kycRejectionReason: null,
          updatedAt: new Date(),
        })
        .where(eq(vendorProfiles.id, req.params.profileId))
        .returning();

      if (updated.length === 0) {
        res.status(404).json({ error: "Vendor profile not found" });
        return;
      }

      const row = updated[0];

      try {
        await notifyUser({
          userId: row.userId,
          type: "system",
          title: "Business verified",
          body: "Your vendor profile is verified. Withdrawals are unlocked.",
          data: { kind: "kyc_approved", role: "vendor" },
        });
      } catch (notifyErr) {
        console.log("[Admin KYC] vendor approve notify failed:", notifyErr);
      }

      await recordAdminAction(
        req,
        "kyc.vendor.approve",
        "vendor_profiles",
        row.id,
        { userId: row.userId },
      );

      res.json(row);
    } catch (err: any) {
      console.error("Approve vendor KYC error:", err);
      res.status(500).json({ error: "Failed to approve vendor KYC" });
    }
  },
);

// ─── PUT /api/admin/kyc/vendor/:profileId/reject ────────────────────────
router.put(
  "/vendor/:profileId/reject",
  async (req: AuthRequest, res: Response) => {
    try {
      const { reason } = req.body as { reason?: string };
      if (
        !reason ||
        typeof reason !== "string" ||
        reason.trim().length === 0 ||
        reason.length > 500
      ) {
        res
          .status(400)
          .json({ error: "reason is required and must be ≤ 500 characters" });
        return;
      }

      const updated = await db
        .update(vendorProfiles)
        .set({
          status: "rejected",
          kycRejectionReason: reason.trim(),
          reviewedAt: new Date(),
          reviewedBy: req.user!.userId,
          updatedAt: new Date(),
        })
        .where(eq(vendorProfiles.id, req.params.profileId))
        .returning();

      if (updated.length === 0) {
        res.status(404).json({ error: "Vendor profile not found" });
        return;
      }

      const row = updated[0];

      try {
        await notifyUser({
          userId: row.userId,
          type: "system",
          title: "Verification needs attention",
          body: `Your business documents need changes: ${reason.trim()}. Tap to re-upload.`,
          data: { kind: "kyc_rejected", role: "vendor" },
        });
      } catch (notifyErr) {
        console.log("[Admin KYC] vendor reject notify failed:", notifyErr);
      }

      await recordAdminAction(
        req,
        "kyc.vendor.reject",
        "vendor_profiles",
        row.id,
        { userId: row.userId, reason: reason.trim() },
      );

      res.json(row);
    } catch (err: any) {
      console.error("Reject vendor KYC error:", err);
      res.status(500).json({ error: "Failed to reject vendor KYC" });
    }
  },
);

export default router;
