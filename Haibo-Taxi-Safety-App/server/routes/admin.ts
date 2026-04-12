import { Router, Response } from "express";
import { db } from "../db";
import {
  users, taxis, driverProfiles, complaints, events,
  transactions, walletTransactions, groupRides, deliveries,
  associations, taxiDrivers,
} from "../../shared/schema";
import { eq, desc, sql, count, and, gte, lte, sum, avg } from "drizzle-orm";
import { authMiddleware, AuthRequest, requireRole } from "../middleware/auth";

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

export default router;
