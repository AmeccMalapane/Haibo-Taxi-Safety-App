import { Router, Response } from "express";
import { db } from "../db";
import { taxis, taxiDrivers, driverProfiles, users, complaints } from "../../shared/schema";
import { eq, and, like, sql, desc, asc, count } from "drizzle-orm";
import { authMiddleware, AuthRequest, requireRole } from "../middleware/auth";
import { parsePagination, paginationResponse, generatePayReferenceCode } from "../utils/helpers";

const router = Router();

// GET /api/taxis - List taxis (with pagination, search, filter)
router.get("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const { status, search, sortBy, sortOrder } = req.query as any;

    let query = db.select().from(taxis).$dynamic();

    // Filter by owner if not admin
    if (req.user!.role !== "admin") {
      query = query.where(eq(taxis.ownerId, req.user!.userId));
    }

    if (status) {
      query = query.where(eq(taxis.status, status));
    }

    const results = await query.limit(limit).offset(offset);

    const [totalResult] = await db.select({ count: count() }).from(taxis);

    res.json({
      data: results,
      pagination: paginationResponse(totalResult.count, { page, limit, offset }),
    });
  } catch (error: any) {
    console.error("Get taxis error:", error);
    res.status(500).json({ error: "Failed to fetch taxis" });
  }
});

// POST /api/taxis - Register a new taxi
router.post("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const {
      plateNumber, make, model, year, color, seatingCapacity,
      insuranceNumber, insuranceExpiry, registrationNumber,
      registrationExpiry, operatingPermitNumber, operatingPermitExpiry,
      primaryRoute, associationId,
    } = req.body;

    if (!plateNumber || !make || !model) {
      res.status(400).json({ error: "Plate number, make, and model are required" });
      return;
    }

    // Check for duplicate plate
    const existing = await db.select().from(taxis).where(eq(taxis.plateNumber, plateNumber)).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "Taxi with this plate number already exists" });
      return;
    }

    const [newTaxi] = await db.insert(taxis).values({
      ownerId: req.user!.userId,
      plateNumber,
      make,
      model,
      year: year || null,
      color: color || null,
      seatingCapacity: seatingCapacity || 15,
      insuranceNumber: insuranceNumber || null,
      insuranceExpiry: insuranceExpiry ? new Date(insuranceExpiry) : null,
      registrationNumber: registrationNumber || null,
      registrationExpiry: registrationExpiry ? new Date(registrationExpiry) : null,
      operatingPermitNumber: operatingPermitNumber || null,
      operatingPermitExpiry: operatingPermitExpiry ? new Date(operatingPermitExpiry) : null,
      primaryRoute: primaryRoute || null,
      associationId: associationId || null,
    }).returning();

    res.status(201).json({
      id: newTaxi.id,
      plateNumber: newTaxi.plateNumber,
      status: newTaxi.status,
      registrationId: newTaxi.id,
    });
  } catch (error: any) {
    console.error("Register taxi error:", error);
    res.status(500).json({ error: "Failed to register taxi" });
  }
});

// GET /api/taxis/:id - Get taxi details (owner or admin only)
router.get("/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.select().from(taxis).where(eq(taxis.id, req.params.id)).limit(1);
    if (result.length === 0) {
      res.status(404).json({ error: "Taxi not found" });
      return;
    }

    const isOwner = result[0].ownerId === req.user!.userId;
    const isAdmin = req.user!.role === "admin";
    if (!isOwner && !isAdmin) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }

    res.json(result[0]);
  } catch (error: any) {
    console.error("Get taxi error:", error);
    res.status(500).json({ error: "Failed to fetch taxi details" });
  }
});

// PUT /api/taxis/:id - Update taxi (owner or admin only)
router.put("/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = await db.select().from(taxis).where(eq(taxis.id, req.params.id)).limit(1);
    if (existing.length === 0) {
      res.status(404).json({ error: "Taxi not found" });
      return;
    }

    const isOwner = existing[0].ownerId === req.user!.userId;
    const isAdmin = req.user!.role === "admin";
    if (!isOwner && !isAdmin) {
      res.status(403).json({ error: "You do not own this taxi" });
      return;
    }

    const { status, color, primaryRoute, seatingCapacity, insuranceNumber, insuranceExpiry } = req.body;

    const updateData: any = { updatedAt: new Date() };
    if (status !== undefined) updateData.status = status;
    if (color !== undefined) updateData.color = color;
    if (primaryRoute !== undefined) updateData.primaryRoute = primaryRoute;
    if (seatingCapacity !== undefined) updateData.seatingCapacity = seatingCapacity;
    if (insuranceNumber !== undefined) updateData.insuranceNumber = insuranceNumber;
    if (insuranceExpiry !== undefined) updateData.insuranceExpiry = new Date(insuranceExpiry);

    const [updated] = await db.update(taxis).set(updateData).where(eq(taxis.id, req.params.id)).returning();

    res.json(updated);
  } catch (error: any) {
    console.error("Update taxi error:", error);
    res.status(500).json({ error: "Failed to update taxi" });
  }
});

export default router;
