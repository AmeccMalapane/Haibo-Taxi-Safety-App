import { Router, Response } from "express";
import { db } from "../db";
import {
  users, taxis, driverProfiles, complaints, events,
  transactions, walletTransactions, groupRides, deliveries,
  associations, taxiDrivers, withdrawalRequests,
  reels, lostFoundItems, jobs, adminAuditLog,
} from "../../shared/schema";
import { eq, desc, sql, count, and, gte, lte, sum, avg } from "drizzle-orm";
import { authMiddleware, AuthRequest, requireRole } from "../middleware/auth";
import { notifyUser } from "../services/notifications";
import { recordAdminAction } from "../services/audit";

const router = Router();

// GET /api/admin/system-metrics - Dashboard overview
router.get("/system-metrics", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const [userCount] = await db.select({ count: count() }).from(users);
    const [taxiCount] = await db.select({ count: count() }).from(taxis);
    const [driverCount] = await db.select({ count: count() }).from(driverProfiles);
    const [complaintCount] = await db.select({ count: count() }).from(complaints).where(eq(complaints.status, "pending"));
    const [eventCount] = await db.select({ count: count() }).from(events);
    const [rideCount] = await db.select({ count: count() }).from(groupRides);
    const [deliveryCount] = await db.select({ count: count() }).from(deliveries);
    const [activeVehicles] = await db.select({ count: count() }).from(taxis).where(eq(taxis.status, "active"));

    // Get recent complaints
    const recentComplaints = await db.select().from(complaints)
      .orderBy(desc(complaints.createdAt))
      .limit(10);

    res.json({
      totalUsers: userCount.count,
      totalFleets: taxiCount.count,
      activeVehicles: activeVehicles.count,
      totalDrivers: driverCount.count,
      pendingComplaints: complaintCount.count,
      totalEvents: eventCount.count,
      totalRides: rideCount.count,
      totalDeliveries: deliveryCount.count,
      recentComplaints,
    });
  } catch (error: any) {
    console.error("System metrics error:", error);
    res.status(500).json({ error: "Failed to fetch system metrics" });
  }
});

// GET /api/admin/analytics/earnings - Earnings analytics
router.get("/analytics/earnings", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { period, startDate, endDate } = req.query as any;

    const [totalEarnings] = await db
      .select({ total: sum(transactions.amount) })
      .from(transactions)
      .where(eq(transactions.status, "completed"));

    const recentTransactions = await db.select().from(transactions)
      .where(eq(transactions.status, "completed"))
      .orderBy(desc(transactions.createdAt))
      .limit(50);

    res.json({
      total: Number(totalEarnings.total) || 0,
      transactions: recentTransactions,
    });
  } catch (error: any) {
    console.error("Earnings analytics error:", error);
    res.status(500).json({ error: "Failed to fetch earnings analytics" });
  }
});

// GET /api/admin/analytics/compliance-metrics - Compliance overview
router.get("/analytics/compliance-metrics", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const [totalTaxis] = await db.select({ count: count() }).from(taxis);
    const [verifiedTaxis] = await db.select({ count: count() }).from(taxis).where(eq(taxis.isVerified, true));
    const [verifiedDrivers] = await db.select({ count: count() }).from(driverProfiles).where(eq(driverProfiles.isVerified, true));
    const [totalDrivers] = await db.select({ count: count() }).from(driverProfiles);

    const overallRate = totalTaxis.count > 0
      ? Math.round((verifiedTaxis.count / totalTaxis.count) * 100)
      : 0;

    // Get complaints by severity
    const criticalComplaints = await db.select({ count: count() }).from(complaints).where(eq(complaints.severity, "critical"));
    const highComplaints = await db.select({ count: count() }).from(complaints).where(eq(complaints.severity, "high"));
    const mediumComplaints = await db.select({ count: count() }).from(complaints).where(eq(complaints.severity, "medium"));

    res.json({
      overallRate,
      documentStatus: {
        verified: verifiedTaxis.count,
        pending: totalTaxis.count - verifiedTaxis.count,
        expired: 0,
        rejected: 0,
      },
      driverCompliance: {
        verified: verifiedDrivers.count,
        total: totalDrivers.count,
      },
      issuesSummary: {
        critical: criticalComplaints[0].count,
        warning: highComplaints[0].count,
        info: mediumComplaints[0].count,
      },
    });
  } catch (error: any) {
    console.error("Compliance metrics error:", error);
    res.status(500).json({ error: "Failed to fetch compliance metrics" });
  }
});

// GET /api/admin/users - List all users (admin)
router.get("/users", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.query as any;

    let results;
    if (role) {
      results = await db.select({
        id: users.id,
        phone: users.phone,
        email: users.email,
        displayName: users.displayName,
        role: users.role,
        isVerified: users.isVerified,
        walletBalance: users.walletBalance,
        createdAt: users.createdAt,
        lastActiveAt: users.lastActiveAt,
      }).from(users)
        .where(eq(users.role, role))
        .orderBy(desc(users.createdAt))
        .limit(100);
    } else {
      results = await db.select({
        id: users.id,
        phone: users.phone,
        email: users.email,
        displayName: users.displayName,
        role: users.role,
        isVerified: users.isVerified,
        walletBalance: users.walletBalance,
        createdAt: users.createdAt,
        lastActiveAt: users.lastActiveAt,
      }).from(users)
        .orderBy(desc(users.createdAt))
        .limit(100);
    }

    res.json({ data: results });
  } catch (error: any) {
    console.error("Get users error:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// PUT /api/admin/complaints/:id - Update complaint status
router.put("/complaints/:id", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { status, resolution, internalNotes } = req.body;

    const updateData: any = { updatedAt: new Date() };
    if (status) updateData.status = status;
    if (resolution) updateData.resolution = resolution;
    if (internalNotes) updateData.internalNotes = internalNotes;
    if (status === "resolved") {
      updateData.resolvedBy = req.user!.userId;
      updateData.resolvedAt = new Date();
    }

    const [updated] = await db.update(complaints)
      .set(updateData)
      .where(eq(complaints.id, req.params.id))
      .returning();

    await recordAdminAction(req, "complaint.update", "complaints", req.params.id, {
      status,
      resolution,
    });

    res.json(updated);
  } catch (error: any) {
    console.error("Update complaint error:", error);
    res.status(500).json({ error: "Failed to update complaint" });
  }
});

// PUT /api/admin/taxis/:id/verify - Verify a taxi
router.put("/taxis/:id/verify", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const [updated] = await db.update(taxis)
      .set({
        isVerified: true,
        verifiedAt: new Date(),
        verifiedBy: req.user!.userId,
        updatedAt: new Date(),
      })
      .where(eq(taxis.id, req.params.id))
      .returning();

    await recordAdminAction(req, "taxi.verify", "taxis", req.params.id);

    res.json(updated);
  } catch (error: any) {
    console.error("Verify taxi error:", error);
    res.status(500).json({ error: "Failed to verify taxi" });
  }
});

// ============ WITHDRAWAL APPROVAL QUEUE ============
// Real money: these endpoints action rows that /api/wallet/withdraw creates
// (the user-facing route deducts the balance up front and files a pending
// withdrawal_request). Approve here marks the request actionable by ops;
// reject refunds the balance.

// GET /api/admin/withdrawals - List withdrawals with optional status filter
router.get("/withdrawals", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query as { status?: string };

    const baseQuery = db
      .select({
        id: withdrawalRequests.id,
        userId: withdrawalRequests.userId,
        amount: withdrawalRequests.amount,
        status: withdrawalRequests.status,
        bankCode: withdrawalRequests.bankCode,
        accountNumber: withdrawalRequests.accountNumber,
        accountName: withdrawalRequests.accountName,
        narration: withdrawalRequests.narration,
        requestedAt: withdrawalRequests.requestedAt,
        approvedAt: withdrawalRequests.approvedAt,
        approvedBy: withdrawalRequests.approvedBy,
        rejectionReason: withdrawalRequests.rejectionReason,
        requires2FA: withdrawalRequests.requires2FA,
        userPhone: users.phone,
        userDisplayName: users.displayName,
      })
      .from(withdrawalRequests)
      .leftJoin(users, eq(withdrawalRequests.userId, users.id))
      .orderBy(desc(withdrawalRequests.requestedAt))
      .limit(100);

    const results = status
      ? await baseQuery.where(eq(withdrawalRequests.status, status))
      : await baseQuery;

    res.json({ data: results });
  } catch (error: any) {
    console.error("List withdrawals error:", error);
    res.status(500).json({ error: "Failed to list withdrawals" });
  }
});

// PUT /api/admin/withdrawals/:id/approve - Mark a withdrawal as approved
router.put("/withdrawals/:id/approve", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const [existing] = await db
      .select()
      .from(withdrawalRequests)
      .where(eq(withdrawalRequests.id, req.params.id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Withdrawal request not found" });
      return;
    }
    if (existing.status !== "pending") {
      res.status(400).json({ error: `Cannot approve a ${existing.status} withdrawal` });
      return;
    }

    const [updated] = await db
      .update(withdrawalRequests)
      .set({
        status: "approved",
        approvedAt: new Date(),
        approvedBy: req.user!.userId,
        updatedAt: new Date(),
      })
      .where(eq(withdrawalRequests.id, req.params.id))
      .returning();

    // Notify the user their withdrawal is cleared for EFT processing
    try {
      await notifyUser({
        userId: existing.userId,
        type: "payment",
        title: "Withdrawal approved",
        body: `Your R${existing.amount.toFixed(2)} withdrawal is on its way via EFT.`,
      });
    } catch (notifyErr) {
      console.log("[Admin] withdrawal approve notify failed:", notifyErr);
    }

    await recordAdminAction(req, "withdrawal.approve", "withdrawal_requests", req.params.id, {
      amount: existing.amount,
      userId: existing.userId,
    });

    res.json(updated);
  } catch (error: any) {
    console.error("Approve withdrawal error:", error);
    res.status(500).json({ error: "Failed to approve withdrawal" });
  }
});

// PUT /api/admin/withdrawals/:id/reject - Reject a withdrawal and refund
router.put("/withdrawals/:id/reject", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { reason } = req.body as { reason?: string };

    const [existing] = await db
      .select()
      .from(withdrawalRequests)
      .where(eq(withdrawalRequests.id, req.params.id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Withdrawal request not found" });
      return;
    }
    if (existing.status !== "pending") {
      res.status(400).json({ error: `Cannot reject a ${existing.status} withdrawal` });
      return;
    }

    // Refund the balance — /api/wallet/withdraw deducted it up front
    await db
      .update(users)
      .set({ walletBalance: sql`${users.walletBalance} + ${existing.amount}` })
      .where(eq(users.id, existing.userId));

    const [updated] = await db
      .update(withdrawalRequests)
      .set({
        status: "rejected",
        rejectionReason: reason || "Rejected by admin",
        updatedAt: new Date(),
      })
      .where(eq(withdrawalRequests.id, req.params.id))
      .returning();

    // Record the refund as its own wallet transaction so history explains
    // why the user suddenly saw their balance return
    await db.insert(walletTransactions).values({
      userId: existing.userId,
      type: "transfer_received",
      amount: existing.amount,
      description: `Withdrawal rejected — refund (R${existing.amount.toFixed(2)})`,
      status: "completed",
    });

    try {
      await notifyUser({
        userId: existing.userId,
        type: "payment",
        title: "Withdrawal rejected",
        body: `Your R${existing.amount.toFixed(2)} has been refunded to your wallet.${
          reason ? ` Reason: ${reason}` : ""
        }`,
      });
    } catch (notifyErr) {
      console.log("[Admin] withdrawal reject notify failed:", notifyErr);
    }

    await recordAdminAction(req, "withdrawal.reject", "withdrawal_requests", req.params.id, {
      amount: existing.amount,
      userId: existing.userId,
      reason: reason || null,
    });

    res.json(updated);
  } catch (error: any) {
    console.error("Reject withdrawal error:", error);
    res.status(500).json({ error: "Failed to reject withdrawal" });
  }
});

// ============ MODERATION ============
// One endpoint for every community surface that has a `status` field, so
// the Command Center doesn't need a new admin route per resource. Fields
// are whitelisted per resource to keep the attack surface tight — if a
// later resource needs extra levers (e.g. pinning, shadow-ban), add them
// here explicitly rather than letting the client patch arbitrary columns.

const MODERATION_RESOURCES: Record<
  string,
  {
    table: any;
    idColumn: any;
    listColumns: any;
    allowedFields: Array<"status" | "isVerified" | "isFeatured">;
  }
> = {
  reels: {
    table: reels,
    idColumn: reels.id,
    listColumns: {
      id: reels.id,
      createdAt: reels.createdAt,
      status: reels.status,
      userId: reels.userId,
      userName: reels.userName,
      caption: reels.caption,
      mediaUrl: reels.mediaUrl,
      thumbnailUrl: reels.thumbnailUrl,
      category: reels.category,
      likeCount: reels.likeCount,
      commentCount: reels.commentCount,
      shareCount: reels.shareCount,
    },
    allowedFields: ["status"],
  },
  "lost-found": {
    table: lostFoundItems,
    idColumn: lostFoundItems.id,
    listColumns: {
      id: lostFoundItems.id,
      createdAt: lostFoundItems.createdAt,
      status: lostFoundItems.status,
      type: lostFoundItems.type,
      category: lostFoundItems.category,
      title: lostFoundItems.title,
      description: lostFoundItems.description,
      contactName: lostFoundItems.contactName,
      contactPhone: lostFoundItems.contactPhone,
      routeOrigin: lostFoundItems.routeOrigin,
      routeDestination: lostFoundItems.routeDestination,
      reward: lostFoundItems.reward,
    },
    allowedFields: ["status"],
  },
  jobs: {
    table: jobs,
    idColumn: jobs.id,
    listColumns: {
      id: jobs.id,
      createdAt: jobs.createdAt,
      status: jobs.status,
      title: jobs.title,
      company: jobs.company,
      location: jobs.location,
      province: jobs.province,
      jobType: jobs.jobType,
      category: jobs.category,
      salary: jobs.salary,
      isVerified: jobs.isVerified,
      isFeatured: jobs.isFeatured,
      viewCount: jobs.viewCount,
      applicationCount: jobs.applicationCount,
    },
    allowedFields: ["status", "isVerified", "isFeatured"],
  },
  taxis: {
    table: taxis,
    idColumn: taxis.id,
    listColumns: {
      id: taxis.id,
      createdAt: taxis.createdAt,
      status: taxis.status,
      plateNumber: taxis.plateNumber,
      make: taxis.make,
      model: taxis.model,
      year: taxis.year,
      color: taxis.color,
      seatingCapacity: taxis.seatingCapacity,
      primaryRoute: taxis.primaryRoute,
      associationId: taxis.associationId,
      ownerId: taxis.ownerId,
      insuranceExpiry: taxis.insuranceExpiry,
      operatingPermitExpiry: taxis.operatingPermitExpiry,
      safetyRating: taxis.safetyRating,
      totalRatings: taxis.totalRatings,
      totalTrips: taxis.totalTrips,
      isVerified: taxis.isVerified,
    },
    allowedFields: ["status", "isVerified"],
  },
  events: {
    table: events,
    idColumn: events.id,
    listColumns: {
      id: events.id,
      createdAt: events.createdAt,
      status: events.status,
      title: events.title,
      description: events.description,
      category: events.category,
      eventDate: events.eventDate,
      location: events.location,
      venue: events.venue,
      province: events.province,
      organizer: events.organizer,
      organizerPhone: events.organizerPhone,
      ticketPrice: events.ticketPrice,
      currentAttendees: events.currentAttendees,
      maxAttendees: events.maxAttendees,
      isVerified: events.isVerified,
      isFeatured: events.isFeatured,
      imageUrl: events.imageUrl,
    },
    allowedFields: ["status", "isVerified", "isFeatured"],
  },
};

// GET /api/admin/moderation/:resource — list items for a moderation queue.
// Supports optional ?status=… filter so the CC can separate pending from
// active rows without a client-side reduce.
router.get(
  "/moderation/:resource",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { resource } = req.params;
      const cfg = MODERATION_RESOURCES[resource];
      if (!cfg) {
        res.status(404).json({ error: `Unknown moderation resource: ${resource}` });
        return;
      }

      const { status, limit: rawLimit } = req.query as { status?: string; limit?: string };
      const limit = Math.min(Number(rawLimit) || 100, 200);

      const baseQuery = db
        .select(cfg.listColumns)
        .from(cfg.table)
        .orderBy(desc((cfg.table as any).createdAt))
        .limit(limit);

      const results = status
        ? await baseQuery.where(eq((cfg.table as any).status, status))
        : await baseQuery;

      res.json({ data: results });
    } catch (error: any) {
      console.error(`Moderation list error (${req.params.resource}):`, error);
      res.status(500).json({ error: "Failed to fetch moderation queue" });
    }
  }
);

// PUT /api/admin/moderation/:resource/:id — patch whitelisted moderation
// fields on a single row. Rejects requests that try to patch fields not in
// the resource's allowedFields list.
router.put(
  "/moderation/:resource/:id",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { resource, id } = req.params;
      const cfg = MODERATION_RESOURCES[resource];
      if (!cfg) {
        res.status(404).json({ error: `Unknown moderation resource: ${resource}` });
        return;
      }

      const patch: Record<string, any> = {};
      for (const field of cfg.allowedFields) {
        if (field in req.body) {
          patch[field] = req.body[field];
        }
      }

      if (Object.keys(patch).length === 0) {
        res.status(400).json({
          error: `No patchable fields in body. Allowed: ${cfg.allowedFields.join(", ")}`,
        });
        return;
      }

      // Resources that track updatedAt get it stamped automatically
      if ("updatedAt" in (cfg.table as any)) {
        patch.updatedAt = new Date();
      }

      const [updated] = await db
        .update(cfg.table)
        .set(patch)
        .where(eq(cfg.idColumn, id))
        .returning();

      if (!updated) {
        res.status(404).json({ error: "Item not found" });
        return;
      }

      await recordAdminAction(req, "moderation.update", resource, id, { patch });

      res.json(updated);
    } catch (error: any) {
      console.error(`Moderation update error (${req.params.resource}):`, error);
      res.status(500).json({ error: "Failed to update item" });
    }
  }
);

// ============ AUDIT LOG ============

// GET /api/admin/audit-log — paginated, most-recent first
router.get(
  "/audit-log",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { action, resource, limit: rawLimit, offset: rawOffset } = req.query as {
        action?: string;
        resource?: string;
        limit?: string;
        offset?: string;
      };
      const limit = Math.min(Number(rawLimit) || 50, 200);
      const offset = Math.max(Number(rawOffset) || 0, 0);

      const conditions: any[] = [];
      if (action) conditions.push(eq(adminAuditLog.action, action));
      if (resource) conditions.push(eq(adminAuditLog.resource, resource));
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const baseQuery = db
        .select()
        .from(adminAuditLog)
        .orderBy(desc(adminAuditLog.createdAt))
        .limit(limit)
        .offset(offset);

      const rows = whereClause ? await baseQuery.where(whereClause) : await baseQuery;

      const [totalResult] = whereClause
        ? await db.select({ count: count() }).from(adminAuditLog).where(whereClause)
        : await db.select({ count: count() }).from(adminAuditLog);

      res.json({
        data: rows,
        total: totalResult.count,
        limit,
        offset,
      });
    } catch (error: any) {
      console.error("Audit log error:", error);
      res.status(500).json({ error: "Failed to fetch audit log" });
    }
  }
);

export default router;
