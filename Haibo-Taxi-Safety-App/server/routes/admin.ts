import { Router, Response } from "express";
import { db } from "../db";
import {
  users, taxis, driverProfiles, complaints, events,
  transactions, walletTransactions, groupRides, deliveries,
  associations, taxiDrivers, withdrawalRequests,
} from "../../shared/schema";
import { eq, desc, sql, count, and, gte, lte, sum, avg } from "drizzle-orm";
import { authMiddleware, AuthRequest, requireRole } from "../middleware/auth";
import { notifyUser } from "../services/notifications";

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

    res.json(updated);
  } catch (error: any) {
    console.error("Reject withdrawal error:", error);
    res.status(500).json({ error: "Failed to reject withdrawal" });
  }
});

export default router;
