import { Router, Response } from "express";
import { db } from "../db";
import {
  users, taxis, driverProfiles, complaints, events,
  transactions, walletTransactions, groupRides, deliveries,
  associations, taxiDrivers, withdrawalRequests,
  reels, lostFoundItems, jobs, adminAuditLog, pasopReports,
  sosAlerts, driverRatings, routeContributions, p2pTransfers,
  referralCodes, referralSignups, referralRewards, vendorProfiles,
} from "../../shared/schema";
import { alias } from "drizzle-orm/pg-core";
import { eq, desc, sql, count, and, gte, lte, sum, avg, inArray } from "drizzle-orm";
import { authMiddleware, AuthRequest, requireRole } from "../middleware/auth";
import { notifyUser, notifyUsers } from "../services/notifications";
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

    const userColumns = {
      id: users.id,
      phone: users.phone,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
      isVerified: users.isVerified,
      walletBalance: users.walletBalance,
      createdAt: users.createdAt,
      lastActiveAt: users.lastActiveAt,
      isSuspended: users.isSuspended,
      suspendedAt: users.suspendedAt,
      suspensionReason: users.suspensionReason,
    };

    let results;
    if (role) {
      results = await db.select(userColumns).from(users)
        .where(eq(users.role, role))
        .orderBy(desc(users.createdAt))
        .limit(100);
    } else {
      results = await db.select(userColumns).from(users)
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

    // Notify the reporter. Before Chunk 43 a reporter had no way to
    // know their complaint was actioned — the resolution column was
    // set server-side but nothing surfaced it on the mobile side.
    // Skipped for anonymous complaints (userId still set for audit
    // but the reporter asked not to be contacted) and when status
    // didn't actually change.
    if (status && updated && !updated.isAnonymous) {
      try {
        const friendlyStatus =
          status === "resolved"
            ? "resolved"
            : status === "rejected"
            ? "closed without action"
            : status === "in_review"
            ? "under review"
            : status;

        await notifyUser({
          userId: updated.userId,
          type: "complaint_update",
          title: `Your complaint is ${friendlyStatus}`,
          body: resolution
            ? resolution
            : `We've updated the status of your ${updated.category} report.`,
          data: {
            kind: "complaint_update",
            complaintId: updated.id,
            status,
          },
        });
      } catch (notifyErr) {
        console.log("[Admin] complaint update notify failed:", notifyErr);
      }
    }

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
  pasop: {
    table: pasopReports,
    idColumn: pasopReports.id,
    listColumns: {
      id: pasopReports.id,
      createdAt: pasopReports.createdAt,
      status: pasopReports.status,
      category: pasopReports.category,
      latitude: pasopReports.latitude,
      longitude: pasopReports.longitude,
      description: pasopReports.description,
      reporterId: pasopReports.reporterId,
      reporterName: pasopReports.reporterName,
      petitionCount: pasopReports.petitionCount,
      expiresAt: pasopReports.expiresAt,
    },
    allowedFields: ["status"],
  },
  "route-contributions": {
    table: routeContributions,
    idColumn: routeContributions.id,
    listColumns: {
      id: routeContributions.id,
      createdAt: routeContributions.createdAt,
      status: routeContributions.status,
      origin: routeContributions.origin,
      destination: routeContributions.destination,
      taxiRankName: routeContributions.taxiRankName,
      fare: routeContributions.fare,
      currency: routeContributions.currency,
      estimatedTime: routeContributions.estimatedTime,
      distance: routeContributions.distance,
      province: routeContributions.province,
      routeType: routeContributions.routeType,
      handSignal: routeContributions.handSignal,
      handSignalDescription: routeContributions.handSignalDescription,
      additionalNotes: routeContributions.additionalNotes,
      contributorName: routeContributions.contributorName,
      upvotes: routeContributions.upvotes,
      downvotes: routeContributions.downvotes,
      originLatitude: routeContributions.originLatitude,
      originLongitude: routeContributions.originLongitude,
      destinationLatitude: routeContributions.destinationLatitude,
      destinationLongitude: routeContributions.destinationLongitude,
    },
    allowedFields: ["status"],
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

// ============ SOS ALERTS ============
// sendSOSAlert() in services/notifications.ts already persists every
// trigger to sos_alerts and broadcasts sos:alert to the admins room.
// These endpoints just expose the table + let ops mark incidents as
// resolved for post-incident accountability.

// GET /api/admin/sos-alerts?status=unresolved|resolved|all&limit=…&offset=…
router.get(
  "/sos-alerts",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { status, limit: rawLimit, offset: rawOffset } = req.query as {
        status?: string;
        limit?: string;
        offset?: string;
      };
      const limit = Math.min(Number(rawLimit) || 50, 200);
      const offset = Math.max(Number(rawOffset) || 0, 0);

      const baseQuery = db
        .select({
          id: sosAlerts.id,
          userId: sosAlerts.userId,
          phone: sosAlerts.phone,
          latitude: sosAlerts.latitude,
          longitude: sosAlerts.longitude,
          message: sosAlerts.message,
          source: sosAlerts.source,
          adminRecipients: sosAlerts.adminRecipients,
          smsRecipients: sosAlerts.smsRecipients,
          resolvedAt: sosAlerts.resolvedAt,
          resolvedBy: sosAlerts.resolvedBy,
          createdAt: sosAlerts.createdAt,
          // Pull the reporter display name when it exists so the queue
          // doesn't need a second round-trip per row for "who triggered?"
          reporterName: users.displayName,
        })
        .from(sosAlerts)
        .leftJoin(users, eq(sosAlerts.userId, users.id))
        .orderBy(desc(sosAlerts.createdAt))
        .limit(limit)
        .offset(offset);

      const rows =
        status === "unresolved"
          ? await baseQuery.where(sql`${sosAlerts.resolvedAt} IS NULL`)
          : status === "resolved"
          ? await baseQuery.where(sql`${sosAlerts.resolvedAt} IS NOT NULL`)
          : await baseQuery;

      const [unresolvedResult] = await db
        .select({ count: count() })
        .from(sosAlerts)
        .where(sql`${sosAlerts.resolvedAt} IS NULL`);

      res.json({
        data: rows,
        unresolvedCount: unresolvedResult.count,
      });
    } catch (error: any) {
      console.error("SOS list error:", error);
      res.status(500).json({ error: "Failed to fetch SOS alerts" });
    }
  }
);

// PUT /api/admin/sos-alerts/:id/resolve — mark alert as resolved.
// Once resolved, the row is frozen (no re-resolve, no un-resolve) because
// sos_alerts is an immutable audit log: updates would destroy the original
// response-time measurement we need for post-incident review.
router.put(
  "/sos-alerts/:id/resolve",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const [existing] = await db
        .select()
        .from(sosAlerts)
        .where(eq(sosAlerts.id, req.params.id))
        .limit(1);

      if (!existing) {
        res.status(404).json({ error: "SOS alert not found" });
        return;
      }
      if (existing.resolvedAt) {
        res.status(400).json({ error: "SOS alert already resolved" });
        return;
      }

      const [updated] = await db
        .update(sosAlerts)
        .set({
          resolvedAt: new Date(),
          resolvedBy: req.user!.userId,
        })
        .where(eq(sosAlerts.id, req.params.id))
        .returning();

      await recordAdminAction(req, "sos.resolve", "sos_alerts", req.params.id, {
        userId: existing.userId,
        phone: existing.phone,
      });

      // Tell the reporter their alert has been acknowledged (Chunk 45 —
      // audit gap #8). Skipped for guest SOS submissions where userId is
      // null — those came from a pre-login device and have no account
      // to notify. The notification lets the user know someone is on
      // their side, which matters more than any feature on this app.
      if (existing.userId) {
        try {
          await notifyUser({
            userId: existing.userId,
            type: "sos",
            title: "Your SOS alert has been acknowledged",
            body: "A responder has reviewed your alert. Stay safe — if you still need help, call emergency services directly.",
            data: {
              kind: "sos_resolved",
              sosAlertId: existing.id,
            },
          });
        } catch (notifyErr) {
          console.log("[Admin] sos resolve notify failed:", notifyErr);
        }
      }

      res.json(updated);
    } catch (error: any) {
      console.error("SOS resolve error:", error);
      res.status(500).json({ error: "Failed to resolve SOS alert" });
    }
  }
);

// ============ USER WALLET ADMIN ============
// Read a single user's wallet (balance + recent transactions + lifetime
// totals) and apply credit/debit adjustments with a mandatory reason.
// Every adjustment creates a walletTransactions row of type="adjustment"
// and lands in the admin audit log — we never mutate balance silently.

// GET /api/admin/users/:id/wallet
router.get(
  "/users/:id/wallet",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const [user] = await db
        .select({
          id: users.id,
          phone: users.phone,
          displayName: users.displayName,
          email: users.email,
          role: users.role,
          walletBalance: users.walletBalance,
          isVerified: users.isVerified,
          createdAt: users.createdAt,
          isSuspended: users.isSuspended,
          suspendedAt: users.suspendedAt,
          suspendedBy: users.suspendedBy,
          suspensionReason: users.suspensionReason,
        })
        .from(users)
        .where(eq(users.id, req.params.id))
        .limit(1);

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      // Recent transactions (last 50)
      const recentTxns = await db
        .select()
        .from(walletTransactions)
        .where(eq(walletTransactions.userId, req.params.id))
        .orderBy(desc(walletTransactions.createdAt))
        .limit(50);

      // Lifetime totals — sum positive deposits vs negative outflows,
      // only counting completed rows so pending withdrawals don't inflate
      // "withdrawn" before they actually leave the wallet.
      const [totalsIn] = await db
        .select({ sum: sum(walletTransactions.amount) })
        .from(walletTransactions)
        .where(
          and(
            eq(walletTransactions.userId, req.params.id),
            eq(walletTransactions.status, "completed"),
            sql`${walletTransactions.amount} > 0`
          )
        );

      const [totalsOut] = await db
        .select({ sum: sum(walletTransactions.amount) })
        .from(walletTransactions)
        .where(
          and(
            eq(walletTransactions.userId, req.params.id),
            eq(walletTransactions.status, "completed"),
            sql`${walletTransactions.amount} < 0`
          )
        );

      // walletTransactions.status can be "pending" for in-flight
      // withdrawals — expose that count so the admin UI can warn
      // before applying another debit.
      const [pendingCount] = await db
        .select({ count: count() })
        .from(walletTransactions)
        .where(
          and(
            eq(walletTransactions.userId, req.params.id),
            eq(walletTransactions.status, "pending")
          )
        );

      res.json({
        user,
        transactions: recentTxns,
        totals: {
          depositedAllTime: Number(totalsIn.sum) || 0,
          // Outflows are stored negative; flip for display convenience.
          withdrawnAllTime: Math.abs(Number(totalsOut.sum) || 0),
          pendingCount: pendingCount.count,
        },
      });
    } catch (error: any) {
      console.error("Get user wallet error:", error);
      res.status(500).json({ error: "Failed to fetch user wallet" });
    }
  }
);

// POST /api/admin/users/:id/wallet/adjust
// Body: { amount: number, direction: "credit" | "debit", reason: string }
// `amount` is always positive in the request; the server writes a signed
// walletTransactions row and updates the user's balance in the right
// direction. Debits are rejected if they would overdraw the wallet.
router.post(
  "/users/:id/wallet/adjust",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { amount, direction, reason } = req.body as {
        amount?: number;
        direction?: "credit" | "debit";
        reason?: string;
      };

      if (!amount || amount <= 0) {
        res.status(400).json({ error: "amount must be a positive number" });
        return;
      }
      if (direction !== "credit" && direction !== "debit") {
        res.status(400).json({ error: "direction must be 'credit' or 'debit'" });
        return;
      }
      if (!reason || reason.trim().length < 4) {
        res
          .status(400)
          .json({ error: "reason is required (min 4 chars)" });
        return;
      }

      const [target] = await db
        .select()
        .from(users)
        .where(eq(users.id, req.params.id))
        .limit(1);

      if (!target) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const currentBalance = target.walletBalance || 0;
      if (direction === "debit" && currentBalance < amount) {
        res.status(400).json({
          error: "Insufficient balance — cannot debit more than current balance",
          currentBalance,
          requestedDebit: amount,
        });
        return;
      }

      // Signed amount for the wallet_transactions row: credits positive,
      // debits negative. Matches the existing convention from topups
      // (+) and withdrawals (-).
      const signedAmount = direction === "credit" ? amount : -amount;
      const newBalance = currentBalance + signedAmount;

      await db
        .update(users)
        .set({ walletBalance: newBalance })
        .where(eq(users.id, req.params.id));

      const [txn] = await db
        .insert(walletTransactions)
        .values({
          userId: req.params.id,
          type: "adjustment",
          amount: signedAmount,
          description: `Admin ${direction}: ${reason.trim()}`,
          status: "completed",
        })
        .returning();

      await recordAdminAction(
        req,
        "wallet.adjust",
        "users",
        req.params.id,
        {
          direction,
          amount,
          reason: reason.trim(),
          previousBalance: currentBalance,
          newBalance,
        }
      );

      try {
        await notifyUser({
          userId: req.params.id,
          type: "payment",
          title: direction === "credit" ? "Wallet credited" : "Wallet debited",
          body: `${direction === "credit" ? "+" : "-"}R${amount.toFixed(2)} — ${reason.trim()}`,
        });
      } catch (notifyErr) {
        console.log("[Admin] wallet adjust notify failed:", notifyErr);
      }

      res.json({
        transaction: txn,
        newBalance,
      });
    } catch (error: any) {
      console.error("Adjust wallet error:", error);
      res.status(500).json({ error: "Failed to adjust wallet" });
    }
  }
);

// ============ DRIVER KYC ============
// List, inspect, and verify/unverify driver_profiles. This is handled
// outside MODERATION_RESOURCES because driver KYC has richer context
// than a plain status queue — we want license expiry warnings, recent
// ratings, and a joined user record per row.

// GET /api/admin/drivers?verified=true|false&limit=&offset=
router.get(
  "/drivers",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { verified, limit: rawLimit, offset: rawOffset } = req.query as {
        verified?: string;
        limit?: string;
        offset?: string;
      };
      const limit = Math.min(Number(rawLimit) || 50, 200);
      const offset = Math.max(Number(rawOffset) || 0, 0);

      const baseQuery = db
        .select({
          id: driverProfiles.id,
          userId: driverProfiles.userId,
          taxiPlateNumber: driverProfiles.taxiPlateNumber,
          licenseNumber: driverProfiles.licenseNumber,
          licenseExpiry: driverProfiles.licenseExpiry,
          insuranceExpiry: driverProfiles.insuranceExpiry,
          safetyRating: driverProfiles.safetyRating,
          totalRatings: driverProfiles.totalRatings,
          totalRides: driverProfiles.totalRides,
          acceptanceRate: driverProfiles.acceptanceRate,
          isVerified: driverProfiles.isVerified,
          vehicleModel: driverProfiles.vehicleModel,
          vehicleYear: driverProfiles.vehicleYear,
          vehicleColor: driverProfiles.vehicleColor,
          licenseImageUrl: driverProfiles.licenseImageUrl,
          vehicleImageUrl: driverProfiles.vehicleImageUrl,
          lastLocationUpdate: driverProfiles.lastLocationUpdate,
          createdAt: driverProfiles.createdAt,
          userPhone: users.phone,
          userDisplayName: users.displayName,
        })
        .from(driverProfiles)
        .leftJoin(users, eq(driverProfiles.userId, users.id))
        .orderBy(desc(driverProfiles.createdAt))
        .limit(limit)
        .offset(offset);

      const rows =
        verified === "true"
          ? await baseQuery.where(eq(driverProfiles.isVerified, true))
          : verified === "false"
          ? await baseQuery.where(eq(driverProfiles.isVerified, false))
          : await baseQuery;

      const [pendingResult] = await db
        .select({ count: count() })
        .from(driverProfiles)
        .where(eq(driverProfiles.isVerified, false));

      res.json({
        data: rows,
        pendingCount: pendingResult.count,
      });
    } catch (error: any) {
      console.error("List drivers error:", error);
      res.status(500).json({ error: "Failed to fetch drivers" });
    }
  }
);

// GET /api/admin/drivers/:id — full profile with recent ratings
router.get(
  "/drivers/:id",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const [row] = await db
        .select({
          profile: driverProfiles,
          user: {
            id: users.id,
            phone: users.phone,
            displayName: users.displayName,
            email: users.email,
            role: users.role,
            createdAt: users.createdAt,
            isVerified: users.isVerified,
            homeAddress: users.homeAddress,
          },
        })
        .from(driverProfiles)
        .leftJoin(users, eq(driverProfiles.userId, users.id))
        .where(eq(driverProfiles.id, req.params.id))
        .limit(1);

      if (!row) {
        res.status(404).json({ error: "Driver profile not found" });
        return;
      }

      const ratings = await db
        .select()
        .from(driverRatings)
        .where(eq(driverRatings.driverId, row.profile.userId))
        .orderBy(desc(driverRatings.createdAt))
        .limit(20);

      res.json({
        profile: row.profile,
        user: row.user,
        recentRatings: ratings,
      });
    } catch (error: any) {
      console.error("Get driver detail error:", error);
      res.status(500).json({ error: "Failed to fetch driver" });
    }
  }
);

// PUT /api/admin/drivers/:id/verify — mark driver as KYC-verified
router.put(
  "/drivers/:id/verify",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const [existing] = await db
        .select()
        .from(driverProfiles)
        .where(eq(driverProfiles.id, req.params.id))
        .limit(1);

      if (!existing) {
        res.status(404).json({ error: "Driver profile not found" });
        return;
      }
      if (existing.isVerified) {
        res.status(400).json({ error: "Driver already verified" });
        return;
      }

      const [updated] = await db
        .update(driverProfiles)
        .set({ isVerified: true })
        .where(eq(driverProfiles.id, req.params.id))
        .returning();

      await recordAdminAction(req, "driver.verify", "driver_profiles", req.params.id, {
        userId: existing.userId,
        plateNumber: existing.taxiPlateNumber,
      });

      try {
        await notifyUser({
          userId: existing.userId,
          type: "system",
          title: "You're verified on Haibo!",
          body: `KYC complete — you can now accept commuters with plate ${existing.taxiPlateNumber}.`,
        });
      } catch (notifyErr) {
        console.log("[Admin] driver verify notify failed:", notifyErr);
      }

      res.json(updated);
    } catch (error: any) {
      console.error("Verify driver error:", error);
      res.status(500).json({ error: "Failed to verify driver" });
    }
  }
);

// PUT /api/admin/drivers/:id/unverify — revoke verification
// Body optional: { reason?: string } — recorded in the audit log and
// shown to the driver in the revocation notification.
router.put(
  "/drivers/:id/unverify",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { reason } = req.body as { reason?: string };

      const [existing] = await db
        .select()
        .from(driverProfiles)
        .where(eq(driverProfiles.id, req.params.id))
        .limit(1);

      if (!existing) {
        res.status(404).json({ error: "Driver profile not found" });
        return;
      }
      if (!existing.isVerified) {
        res.status(400).json({ error: "Driver is already unverified" });
        return;
      }

      const [updated] = await db
        .update(driverProfiles)
        .set({ isVerified: false })
        .where(eq(driverProfiles.id, req.params.id))
        .returning();

      await recordAdminAction(req, "driver.unverify", "driver_profiles", req.params.id, {
        userId: existing.userId,
        plateNumber: existing.taxiPlateNumber,
        reason: reason || null,
      });

      try {
        await notifyUser({
          userId: existing.userId,
          type: "system",
          title: "Verification revoked",
          body: reason
            ? `Your Haibo verification has been revoked. Reason: ${reason}`
            : "Your Haibo verification has been revoked. Contact support for details.",
        });
      } catch (notifyErr) {
        console.log("[Admin] driver unverify notify failed:", notifyErr);
      }

      res.json(updated);
    } catch (error: any) {
      console.error("Unverify driver error:", error);
      res.status(500).json({ error: "Failed to unverify driver" });
    }
  }
);

// ============ BROADCAST / PUSH NOTIFICATIONS ============
// Ops-side tool for sending targeted announcements. Resolves the audience
// (all / by role / by phone list) to userIds, then fans out via
// notifyUsers which persists to the notifications table and fires FCM
// push in one pass. Every broadcast is audit-logged with recipient count
// so the history view can reconstruct who sent what.

type BroadcastAudience =
  | { kind: "all" }
  | { kind: "role"; role: string }
  | { kind: "phones"; phones: string[] };

// POST /api/admin/broadcast/preview — resolve an audience and return the
// recipient count without actually sending. Lets the CC show an accurate
// "This will go to 1,432 users — confirm?" dialog before the operator
// commits.
router.post(
  "/broadcast/preview",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { audience } = req.body as { audience?: BroadcastAudience };
      if (!audience) {
        res.status(400).json({ error: "audience is required" });
        return;
      }

      const count = await resolveAudienceCount(audience);
      res.json({ recipientCount: count });
    } catch (error: any) {
      console.error("Broadcast preview error:", error);
      res.status(500).json({ error: "Failed to preview broadcast" });
    }
  }
);

// POST /api/admin/broadcast — send the broadcast. Body:
//   { title: string, body: string, audience: BroadcastAudience }
// Returns: { recipients: N, sent: N, failed: N }
router.post(
  "/broadcast",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { title, body, audience } = req.body as {
        title?: string;
        body?: string;
        audience?: BroadcastAudience;
      };

      if (!title || title.trim().length < 2) {
        res.status(400).json({ error: "title is required (min 2 chars)" });
        return;
      }
      if (!body || body.trim().length < 4) {
        res.status(400).json({ error: "body is required (min 4 chars)" });
        return;
      }
      if (!audience) {
        res.status(400).json({ error: "audience is required" });
        return;
      }

      const userIds = await resolveAudienceUserIds(audience);
      if (userIds.length === 0) {
        res.status(400).json({ error: "No recipients match the audience" });
        return;
      }

      const result = await notifyUsers(
        userIds,
        "system",
        title.trim(),
        body.trim()
      );

      await recordAdminAction(
        req,
        "broadcast.send",
        "notifications",
        null,
        {
          audience,
          title: title.trim(),
          body: body.trim(),
          recipients: userIds.length,
          sent: result.sent,
          failed: result.failed,
        }
      );

      res.json({
        recipients: userIds.length,
        sent: result.sent,
        failed: result.failed,
      });
    } catch (error: any) {
      console.error("Broadcast send error:", error);
      res.status(500).json({ error: "Failed to send broadcast" });
    }
  }
);

// Audience → userIds resolver. Kept as a local helper so preview + send
// share the exact same logic and can't drift.
async function resolveAudienceUserIds(
  audience: BroadcastAudience
): Promise<string[]> {
  if (audience.kind === "all") {
    const rows = await db.select({ id: users.id }).from(users);
    return rows.map((r) => r.id);
  }
  if (audience.kind === "role") {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, audience.role));
    return rows.map((r) => r.id);
  }
  if (audience.kind === "phones") {
    const cleaned = audience.phones
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    if (cleaned.length === 0) return [];
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.phone, cleaned));
    return rows.map((r) => r.id);
  }
  return [];
}

async function resolveAudienceCount(
  audience: BroadcastAudience
): Promise<number> {
  // Count-only variant to avoid loading every user row for "all" when we
  // just want a number.
  if (audience.kind === "all") {
    const [r] = await db.select({ count: count() }).from(users);
    return r.count;
  }
  if (audience.kind === "role") {
    const [r] = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.role, audience.role));
    return r.count;
  }
  if (audience.kind === "phones") {
    const ids = await resolveAudienceUserIds(audience);
    return ids.length;
  }
  return 0;
}

// ============ GROUP RIDES (read-only visibility) ============
// Surface scheduled + in-progress + completed community rides so ops
// can see what's happening in the shared-ride network. No mutations —
// if a ride needs to be cancelled, that's a future moderation pass.

router.get(
  "/group-rides",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { status, limit: rawLimit, offset: rawOffset } = req.query as {
        status?: string;
        limit?: string;
        offset?: string;
      };
      const limit = Math.min(Number(rawLimit) || 50, 200);
      const offset = Math.max(Number(rawOffset) || 0, 0);

      const baseQuery = db
        .select({
          id: groupRides.id,
          title: groupRides.title,
          description: groupRides.description,
          pickupLocation: groupRides.pickupLocation,
          dropoffLocation: groupRides.dropoffLocation,
          scheduledDate: groupRides.scheduledDate,
          maxPassengers: groupRides.maxPassengers,
          costPerPerson: groupRides.costPerPerson,
          rideType: groupRides.rideType,
          driverId: groupRides.driverId,
          driverPlateNumber: groupRides.driverPlateNumber,
          driverSafetyRating: groupRides.driverSafetyRating,
          status: groupRides.status,
          paymentMethod: groupRides.paymentMethod,
          isVerifiedDriver: groupRides.isVerifiedDriver,
          createdAt: groupRides.createdAt,
          startedAt: groupRides.startedAt,
          completedAt: groupRides.completedAt,
          organizerId: groupRides.organizerId,
          organizerPhone: users.phone,
          organizerName: users.displayName,
        })
        .from(groupRides)
        .leftJoin(users, eq(groupRides.organizerId, users.id))
        .orderBy(desc(groupRides.scheduledDate))
        .limit(limit)
        .offset(offset);

      const rows = status
        ? await baseQuery.where(eq(groupRides.status, status))
        : await baseQuery;

      // Live count for each status — powers the tab badges without
      // needing a second round-trip per tab.
      const countsRows = await db
        .select({ status: groupRides.status, count: count() })
        .from(groupRides)
        .groupBy(groupRides.status);
      const counts: Record<string, number> = {};
      for (const r of countsRows) counts[r.status] = r.count;

      res.json({ data: rows, counts });
    } catch (error: any) {
      console.error("List group rides error:", error);
      res.status(500).json({ error: "Failed to fetch group rides" });
    }
  }
);

// ============ DELIVERIES (read-only visibility) ============
router.get(
  "/deliveries",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { status, limit: rawLimit, offset: rawOffset } = req.query as {
        status?: string;
        limit?: string;
        offset?: string;
      };
      const limit = Math.min(Number(rawLimit) || 50, 200);
      const offset = Math.max(Number(rawOffset) || 0, 0);

      const baseQuery = db
        .select({
          id: deliveries.id,
          senderId: deliveries.senderId,
          driverId: deliveries.driverId,
          driverPhone: deliveries.driverPhone,
          taxiPlateNumber: deliveries.taxiPlateNumber,
          description: deliveries.description,
          pickupRank: deliveries.pickupRank,
          dropoffRank: deliveries.dropoffRank,
          amount: deliveries.amount,
          status: deliveries.status,
          paymentStatus: deliveries.paymentStatus,
          confirmationCode: deliveries.confirmationCode,
          insuranceIncluded: deliveries.insuranceIncluded,
          insuranceAmount: deliveries.insuranceAmount,
          createdAt: deliveries.createdAt,
          acceptedAt: deliveries.acceptedAt,
          deliveredAt: deliveries.deliveredAt,
          senderPhone: users.phone,
          senderName: users.displayName,
        })
        .from(deliveries)
        .leftJoin(users, eq(deliveries.senderId, users.id))
        .orderBy(desc(deliveries.createdAt))
        .limit(limit)
        .offset(offset);

      const rows = status
        ? await baseQuery.where(eq(deliveries.status, status))
        : await baseQuery;

      const countsRows = await db
        .select({ status: deliveries.status, count: count() })
        .from(deliveries)
        .groupBy(deliveries.status);
      const counts: Record<string, number> = {};
      for (const r of countsRows) counts[r.status] = r.count;

      res.json({ data: rows, counts });
    } catch (error: any) {
      console.error("List deliveries error:", error);
      res.status(500).json({ error: "Failed to fetch deliveries" });
    }
  }
);

// ============ USER SUSPENSION ============
// Hard suspension: flipping isSuspended to true makes authMiddleware
// reject every authed API call from that user with 403 until an admin
// unsuspends them. Guardrails:
//   • admins cannot be suspended (admin.ts requireRole catches it before
//     the call even reaches here, but we double-check to prevent abuse
//     via a compromised admin account)
//   • operators cannot suspend themselves (prevents accidental lockout)
//   • reason is required on suspend but optional on unsuspend
//   • every suspend/unsuspend lands in admin_audit_log for review

// PUT /api/admin/users/:id/suspend
router.put(
  "/users/:id/suspend",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { reason } = req.body as { reason?: string };

      if (!reason || reason.trim().length < 4) {
        res.status(400).json({ error: "reason is required (min 4 chars)" });
        return;
      }
      if (req.params.id === req.user!.userId) {
        res.status(400).json({ error: "Admins cannot suspend themselves" });
        return;
      }

      const [target] = await db
        .select()
        .from(users)
        .where(eq(users.id, req.params.id))
        .limit(1);

      if (!target) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      if (target.role === "admin") {
        res.status(400).json({ error: "Cannot suspend admin accounts" });
        return;
      }
      if (target.isSuspended) {
        res.status(400).json({ error: "User is already suspended" });
        return;
      }

      const [updated] = await db
        .update(users)
        .set({
          isSuspended: true,
          suspendedAt: new Date(),
          suspendedBy: req.user!.userId,
          suspensionReason: reason.trim(),
        })
        .where(eq(users.id, req.params.id))
        .returning();

      await recordAdminAction(req, "user.suspend", "users", req.params.id, {
        targetPhone: target.phone,
        targetRole: target.role,
        reason: reason.trim(),
      });

      // Notify the user as a courtesy — they'll still see this in their
      // notification shade even after the token starts bouncing because
      // the push is dispatched before they retry.
      try {
        await notifyUser({
          userId: req.params.id,
          type: "system",
          title: "Account suspended",
          body: `Your Haibo account has been suspended. Reason: ${reason.trim()}`,
        });
      } catch (notifyErr) {
        console.log("[Admin] suspend notify failed:", notifyErr);
      }

      res.json(updated);
    } catch (error: any) {
      console.error("Suspend user error:", error);
      res.status(500).json({ error: "Failed to suspend user" });
    }
  }
);

// PUT /api/admin/users/:id/unsuspend
router.put(
  "/users/:id/unsuspend",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const [target] = await db
        .select()
        .from(users)
        .where(eq(users.id, req.params.id))
        .limit(1);

      if (!target) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      if (!target.isSuspended) {
        res.status(400).json({ error: "User is not suspended" });
        return;
      }

      const [updated] = await db
        .update(users)
        .set({
          isSuspended: false,
          suspendedAt: null,
          suspendedBy: null,
          suspensionReason: null,
        })
        .where(eq(users.id, req.params.id))
        .returning();

      await recordAdminAction(req, "user.unsuspend", "users", req.params.id, {
        targetPhone: target.phone,
        previousReason: target.suspensionReason,
      });

      try {
        await notifyUser({
          userId: req.params.id,
          type: "system",
          title: "Account restored",
          body: "Your Haibo account has been reinstated. Welcome back.",
        });
      } catch (notifyErr) {
        console.log("[Admin] unsuspend notify failed:", notifyErr);
      }

      res.json(updated);
    } catch (error: any) {
      console.error("Unsuspend user error:", error);
      res.status(500).json({ error: "Failed to unsuspend user" });
    }
  }
);

// ============ P2P TRANSFERS (read-only) ============
// Peer-to-peer wallet transfer audit trail. Join twice on users to
// resolve both sides of the transfer, alias each join so drizzle
// doesn't collide the column names.

router.get(
  "/p2p-transfers",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { status, limit: rawLimit, offset: rawOffset } = req.query as {
        status?: string;
        limit?: string;
        offset?: string;
      };
      const limit = Math.min(Number(rawLimit) || 50, 200);
      const offset = Math.max(Number(rawOffset) || 0, 0);

      const senderU = alias(users, "sender_u");
      const recipientU = alias(users, "recipient_u");

      const baseQuery = db
        .select({
          id: p2pTransfers.id,
          senderId: p2pTransfers.senderId,
          recipientId: p2pTransfers.recipientId,
          recipientPhone: p2pTransfers.recipientPhone,
          recipientUsername: p2pTransfers.recipientUsername,
          amount: p2pTransfers.amount,
          message: p2pTransfers.message,
          status: p2pTransfers.status,
          createdAt: p2pTransfers.createdAt,
          senderPhone: senderU.phone,
          senderName: senderU.displayName,
          recipientResolvedPhone: recipientU.phone,
          recipientResolvedName: recipientU.displayName,
        })
        .from(p2pTransfers)
        .leftJoin(senderU, eq(p2pTransfers.senderId, senderU.id))
        .leftJoin(recipientU, eq(p2pTransfers.recipientId, recipientU.id))
        .orderBy(desc(p2pTransfers.createdAt))
        .limit(limit)
        .offset(offset);

      const rows = status
        ? await baseQuery.where(eq(p2pTransfers.status, status))
        : await baseQuery;

      const countsRows = await db
        .select({ status: p2pTransfers.status, count: count() })
        .from(p2pTransfers)
        .groupBy(p2pTransfers.status);
      const counts: Record<string, number> = {};
      for (const r of countsRows) counts[r.status] = r.count;

      // Volume across all completed transfers for dashboard/sub label
      const [volume] = await db
        .select({ sum: sum(p2pTransfers.amount) })
        .from(p2pTransfers)
        .where(eq(p2pTransfers.status, "completed"));

      res.json({
        data: rows,
        counts,
        totalVolumeCompleted: Number(volume?.sum) || 0,
      });
    } catch (error: any) {
      console.error("List p2p transfers error:", error);
      res.status(500).json({ error: "Failed to fetch p2p transfers" });
    }
  }
);

// ============ REFERRALS DASHBOARD (read-only) ============
// Aggregated referral metrics — top-line stats + recent signups +
// top referrers leaderboard. One round-trip keeps the page simple
// and lets us compute derived fields (conversion rate) server-side.

router.get(
  "/referrals",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const [codesCount] = await db
        .select({ count: count() })
        .from(referralCodes);

      const [signupsCount] = await db
        .select({ count: count() })
        .from(referralSignups);

      const [completedCount] = await db
        .select({ count: count() })
        .from(referralSignups)
        .where(eq(referralSignups.hasCompletedRide, true));

      const [rewardsCount] = await db
        .select({ count: count() })
        .from(referralRewards);

      const [claimedCount] = await db
        .select({ count: count() })
        .from(referralRewards)
        .where(eq(referralRewards.status, "claimed"));

      // Recent signups — last 20, for the activity feed
      const recentSignups = await db
        .select()
        .from(referralSignups)
        .orderBy(desc(referralSignups.createdAt))
        .limit(20);

      // Top referrers — group by referrerDeviceId, count signups
      const topReferrers = await db
        .select({
          referrerDeviceId: referralSignups.referrerDeviceId,
          signupCount: count(),
        })
        .from(referralSignups)
        .groupBy(referralSignups.referrerDeviceId)
        .orderBy(desc(count()))
        .limit(10);

      const conversionRate =
        signupsCount.count > 0
          ? Math.round((completedCount.count / signupsCount.count) * 100)
          : 0;

      res.json({
        stats: {
          totalCodes: codesCount.count,
          totalSignups: signupsCount.count,
          completedSignups: completedCount.count,
          conversionRate,
          totalRewards: rewardsCount.count,
          claimedRewards: claimedCount.count,
        },
        recentSignups,
        topReferrers,
      });
    } catch (error: any) {
      console.error("Referrals dashboard error:", error);
      res.status(500).json({ error: "Failed to fetch referrals data" });
    }
  }
);

// ============ VENDORS (Haibo Vault) ============
// Admin view of vendor_profiles with status-based filtering, counts
// for the sidebar badge, and a single mutation endpoint for
// verify/suspend/unsuspend. Sales totals come straight off the
// vendor row thanks to the atomic counters in /api/wallet/pay-vendor.

router.get(
  "/vendors",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { status, limit: rawLimit, offset: rawOffset } = req.query as {
        status?: string;
        limit?: string;
        offset?: string;
      };
      const limit = Math.min(Number(rawLimit) || 100, 200);
      const offset = Math.max(Number(rawOffset) || 0, 0);

      const baseQuery = db
        .select({
          id: vendorProfiles.id,
          userId: vendorProfiles.userId,
          vendorType: vendorProfiles.vendorType,
          businessName: vendorProfiles.businessName,
          rankLocation: vendorProfiles.rankLocation,
          description: vendorProfiles.description,
          businessImageUrl: vendorProfiles.businessImageUrl,
          vendorRef: vendorProfiles.vendorRef,
          status: vendorProfiles.status,
          salesCount: vendorProfiles.salesCount,
          totalSales: vendorProfiles.totalSales,
          createdAt: vendorProfiles.createdAt,
          updatedAt: vendorProfiles.updatedAt,
          ownerPhone: users.phone,
          ownerName: users.displayName,
        })
        .from(vendorProfiles)
        .leftJoin(users, eq(vendorProfiles.userId, users.id))
        .orderBy(desc(vendorProfiles.createdAt))
        .limit(limit)
        .offset(offset);

      const rows = status
        ? await baseQuery.where(eq(vendorProfiles.status, status))
        : await baseQuery;

      const countsRows = await db
        .select({ status: vendorProfiles.status, count: count() })
        .from(vendorProfiles)
        .groupBy(vendorProfiles.status);
      const counts: Record<string, number> = {};
      for (const r of countsRows) counts[r.status] = r.count;

      const [totals] = await db
        .select({
          totalSales: sum(vendorProfiles.totalSales),
          totalTxns: sum(vendorProfiles.salesCount),
        })
        .from(vendorProfiles);

      res.json({
        data: rows,
        counts,
        totals: {
          totalSales: Number(totals?.totalSales) || 0,
          totalTxns: Number(totals?.totalTxns) || 0,
        },
        pendingCount: counts.pending || 0,
      });
    } catch (error: any) {
      console.error("List vendors error:", error);
      res.status(500).json({ error: "Failed to fetch vendors" });
    }
  }
);

// GET /api/admin/vendors/:id — full vendor record + a short recent
// sales feed for the detail drawer. Separate endpoint (rather than
// bundling into the list query) keeps the list fast; most moderators
// only open a detail view for the row they want to action.
router.get(
  "/vendors/:id",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const [vendor] = await db
        .select({
          id: vendorProfiles.id,
          userId: vendorProfiles.userId,
          vendorType: vendorProfiles.vendorType,
          businessName: vendorProfiles.businessName,
          rankLocation: vendorProfiles.rankLocation,
          description: vendorProfiles.description,
          businessImageUrl: vendorProfiles.businessImageUrl,
          vendorRef: vendorProfiles.vendorRef,
          status: vendorProfiles.status,
          salesCount: vendorProfiles.salesCount,
          totalSales: vendorProfiles.totalSales,
          reviewedBy: vendorProfiles.reviewedBy,
          reviewedAt: vendorProfiles.reviewedAt,
          createdAt: vendorProfiles.createdAt,
          updatedAt: vendorProfiles.updatedAt,
          ownerPhone: users.phone,
          ownerName: users.displayName,
          ownerRole: users.role,
          ownerIsSuspended: users.isSuspended,
        })
        .from(vendorProfiles)
        .leftJoin(users, eq(vendorProfiles.userId, users.id))
        .where(eq(vendorProfiles.id, id))
        .limit(1);

      if (!vendor) {
        res.status(404).json({ error: "Vendor not found" });
        return;
      }

      // Pull the 10 most recent sales tagged to this vendorRef. We
      // leftJoin users so the drawer can show buyer display name /
      // phone next to the amount, same shape as the mobile sales feed.
      const recentSales = await db
        .select({
          id: p2pTransfers.id,
          amount: p2pTransfers.amount,
          message: p2pTransfers.message,
          status: p2pTransfers.status,
          createdAt: p2pTransfers.createdAt,
          buyerName: users.displayName,
          buyerPhone: users.phone,
        })
        .from(p2pTransfers)
        .leftJoin(users, eq(p2pTransfers.senderId, users.id))
        .where(
          and(
            eq(p2pTransfers.vendorRef, vendor.vendorRef),
            eq(p2pTransfers.status, "completed"),
          ),
        )
        .orderBy(desc(p2pTransfers.createdAt))
        .limit(10);

      res.json({ data: vendor, recentSales });
    } catch (error: any) {
      console.error("Get vendor detail error:", error);
      res.status(500).json({ error: "Failed to fetch vendor" });
    }
  }
);

// PUT /api/admin/vendors/:id/status — transition a vendor between
// pending / verified / suspended. Writes review audit columns so
// we know who last actioned the row.
router.put(
  "/vendors/:id/status",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body as { status?: string };

      const valid = ["pending", "verified", "suspended"];
      if (!status || !valid.includes(status)) {
        res.status(400).json({ error: "Invalid status" });
        return;
      }

      const [updated] = await db
        .update(vendorProfiles)
        .set({
          status,
          reviewedBy: req.user!.userId,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(vendorProfiles.id, id))
        .returning();

      if (!updated) {
        res.status(404).json({ error: "Vendor not found" });
        return;
      }

      await recordAdminAction(req, `vendor.${status}`, "vendor_profile", id, {
        vendorRef: updated.vendorRef,
      });

      res.json({ data: updated });
    } catch (error: any) {
      console.error("Update vendor status error:", error);
      res.status(500).json({ error: "Failed to update vendor status" });
    }
  }
);

export default router;
