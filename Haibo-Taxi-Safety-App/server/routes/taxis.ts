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

// Normalize a plate number the same way the rating lookup does:
// uppercase, strip whitespace + hyphens. Stored this way so the
// uniqueness constraint catches "GP 123 456" / "GP-123-456" / "gp123456"
// as the same taxi, and /api/ratings/trip can resolve plate → driver
// without having to do fuzzy matching on insert-time variants.
function normalizePlate(plate: string): string {
  return plate.toUpperCase().replace(/[\s-]/g, "");
}

// Optional ISO-date parse with friendly 400. Returns null for
// undefined/null inputs, Date for valid strings, and throws a tagged
// Error for garbage so the caller can map it to a per-field message.
function parseOptionalDate(value: unknown, label: string): Date | null {
  if (value === undefined || value === null || value === "") return null;
  const d = new Date(value as string);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`__INVALID_DATE__${label}`);
  }
  return d;
}

// POST /api/taxis - Register a new taxi
router.post("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const {
      plateNumber: rawPlate, make, model, year, color, seatingCapacity,
      insuranceNumber, insuranceExpiry, registrationNumber,
      registrationExpiry, operatingPermitNumber, operatingPermitExpiry,
      primaryRoute, associationId,
    } = req.body;

    if (!rawPlate || !make || !model) {
      res.status(400).json({ error: "Plate number, make, and model are required" });
      return;
    }
    if (typeof rawPlate !== "string" || rawPlate.length > 20) {
      res.status(400).json({ error: "plateNumber must be ≤ 20 characters" });
      return;
    }
    if (typeof make !== "string" || make.length > 50 ||
        typeof model !== "string" || model.length > 50) {
      res.status(400).json({ error: "make and model must be ≤ 50 characters" });
      return;
    }
    if (color !== undefined && color !== null && (typeof color !== "string" || color.length > 30)) {
      res.status(400).json({ error: "color must be ≤ 30 characters" });
      return;
    }
    if (primaryRoute !== undefined && primaryRoute !== null &&
        (typeof primaryRoute !== "string" || primaryRoute.length > 200)) {
      res.status(400).json({ error: "primaryRoute must be ≤ 200 characters" });
      return;
    }

    // Year of manufacture — South African minibus fleet ranges roughly
    // 1995–current, but allow a bit of slack for heritage plates.
    const currentYear = new Date().getFullYear();
    if (year !== undefined && year !== null) {
      if (!Number.isInteger(year) || year < 1980 || year > currentYear + 1) {
        res.status(400).json({ error: `year must be an integer between 1980 and ${currentYear + 1}` });
        return;
      }
    }

    // Seating capacity — a sprinter maxes out at ~22 seats, set the
    // ceiling at 30 so unusual charter vehicles aren't rejected but
    // `Infinity` / `-1` / `1e9` are.
    if (seatingCapacity !== undefined && seatingCapacity !== null) {
      if (!Number.isInteger(seatingCapacity) || seatingCapacity < 1 || seatingCapacity > 30) {
        res.status(400).json({ error: "seatingCapacity must be an integer between 1 and 30" });
        return;
      }
    }

    // Parse each optional date into a real Date or throw a tagged error.
    let insuranceExpiryDate: Date | null = null;
    let registrationExpiryDate: Date | null = null;
    let operatingPermitExpiryDate: Date | null = null;
    try {
      insuranceExpiryDate = parseOptionalDate(insuranceExpiry, "insuranceExpiry");
      registrationExpiryDate = parseOptionalDate(registrationExpiry, "registrationExpiry");
      operatingPermitExpiryDate = parseOptionalDate(operatingPermitExpiry, "operatingPermitExpiry");
    } catch (err: any) {
      const match = String(err?.message || "").match(/^__INVALID_DATE__(.+)$/);
      if (match) {
        res.status(400).json({ error: `${match[1]} must be a valid ISO date` });
        return;
      }
      throw err;
    }

    const plateNumber = normalizePlate(rawPlate);

    // Check for duplicate plate against the normalized form.
    const existing = await db.select().from(taxis).where(eq(taxis.plateNumber, plateNumber)).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "Taxi with this plate number already exists" });
      return;
    }

    const [newTaxi] = await db.insert(taxis).values({
      ownerId: req.user!.userId,
      plateNumber,
      make: make.trim(),
      model: model.trim(),
      year: year ?? null,
      color: color || null,
      seatingCapacity: seatingCapacity || 15,
      insuranceNumber: insuranceNumber || null,
      insuranceExpiry: insuranceExpiryDate,
      registrationNumber: registrationNumber || null,
      registrationExpiry: registrationExpiryDate,
      operatingPermitNumber: operatingPermitNumber || null,
      operatingPermitExpiry: operatingPermitExpiryDate,
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
