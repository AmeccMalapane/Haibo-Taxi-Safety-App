import { Router, Response } from "express";
import { db } from "../db";
import { vendorProfiles, users } from "../../shared/schema";
import { eq, desc, ilike, and, SQL } from "drizzle-orm";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();

// HBV-xxxx-xxxx — last 4 of phone + 4 hex chars. Short enough to read
// on a printed receipt, unique enough that collisions within a single
// vendor are effectively impossible. If two different users somehow
// hit the same ref (1 in ~16M per phone suffix), we retry.
async function generateUniqueVendorRef(phone: string): Promise<string> {
  const phoneTail = (phone || "").replace(/\D/g, "").slice(-4) || "0000";
  for (let attempt = 0; attempt < 5; attempt++) {
    const random = Math.floor(Math.random() * 0xffff)
      .toString(16)
      .toUpperCase()
      .padStart(4, "0");
    const candidate = `HBV-${phoneTail}-${random}`;
    const existing = await db
      .select({ id: vendorProfiles.id })
      .from(vendorProfiles)
      .where(eq(vendorProfiles.vendorRef, candidate))
      .limit(1);
    if (existing.length === 0) return candidate;
  }
  // Extraordinarily unlikely — bail out with a timestamp-based fallback.
  return `HBV-${phoneTail}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
}

// ============ SELF-SERVICE (authenticated user) ============

// GET /api/vendor-profile/me — read own profile (or null)
router.get("/me", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [row] = await db
      .select()
      .from(vendorProfiles)
      .where(eq(vendorProfiles.userId, req.user!.userId))
      .limit(1);
    res.json({ data: row || null });
  } catch (error: any) {
    console.error("Get own vendor profile error:", error);
    res.status(500).json({ error: "Failed to fetch vendor profile" });
  }
});

// POST /api/vendor-profile — create own profile. Idempotent: if the
// user already has a profile we return it instead of erroring, so
// re-running onboarding doesn't wedge the UI.
router.post("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { vendorType, businessName, rankLocation, description, businessImageUrl } = req.body;

    if (!vendorType || !businessName) {
      res.status(400).json({ error: "vendorType and businessName are required" });
      return;
    }
    const validTypes = ["taxi_vendor", "hawker", "accessories"];
    if (!validTypes.includes(vendorType)) {
      res.status(400).json({ error: "Invalid vendorType" });
      return;
    }

    const existing = await db
      .select()
      .from(vendorProfiles)
      .where(eq(vendorProfiles.userId, req.user!.userId))
      .limit(1);
    if (existing.length > 0) {
      res.json({ data: existing[0], created: false });
      return;
    }

    const [user] = await db
      .select({ phone: users.phone })
      .from(users)
      .where(eq(users.id, req.user!.userId))
      .limit(1);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const vendorRef = await generateUniqueVendorRef(user.phone);

    const [row] = await db
      .insert(vendorProfiles)
      .values({
        userId: req.user!.userId,
        vendorType,
        businessName,
        rankLocation: rankLocation || null,
        description: description || null,
        businessImageUrl: businessImageUrl || null,
        vendorRef,
      })
      .returning();

    res.status(201).json({ data: row, created: true });
  } catch (error: any) {
    console.error("Create vendor profile error:", error);
    res.status(500).json({ error: "Failed to create vendor profile" });
  }
});

// PUT /api/vendor-profile/me — update own profile. Only mutable fields;
// status, vendorRef, and totals are server-controlled.
router.put("/me", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { businessName, rankLocation, description, businessImageUrl } = req.body;

    const [existing] = await db
      .select()
      .from(vendorProfiles)
      .where(eq(vendorProfiles.userId, req.user!.userId))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Vendor profile not found" });
      return;
    }

    const [row] = await db
      .update(vendorProfiles)
      .set({
        ...(businessName !== undefined && { businessName }),
        ...(rankLocation !== undefined && { rankLocation }),
        ...(description !== undefined && { description }),
        ...(businessImageUrl !== undefined && { businessImageUrl }),
        updatedAt: new Date(),
      })
      .where(eq(vendorProfiles.id, existing.id))
      .returning();

    res.json({ data: row });
  } catch (error: any) {
    console.error("Update vendor profile error:", error);
    res.status(500).json({ error: "Failed to update vendor profile" });
  }
});

// ============ PUBLIC (authenticated but not profile-owner) ============

// GET /api/vendor-profile/lookup/:vendorRef — resolve a ref to a
// vendor profile so the pay flow can show the buyer who they're
// paying before confirming. Suspended vendors return 404 so a
// malicious user can't discover they exist.
router.get(
  "/lookup/:vendorRef",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { vendorRef } = req.params;
      const [row] = await db
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
        })
        .from(vendorProfiles)
        .where(eq(vendorProfiles.vendorRef, vendorRef))
        .limit(1);

      if (!row || row.status === "suspended") {
        res.status(404).json({ error: "Vendor not found" });
        return;
      }

      res.json({ data: row });
    } catch (error: any) {
      console.error("Lookup vendor error:", error);
      res.status(500).json({ error: "Failed to look up vendor" });
    }
  }
);

// GET /api/vendor-profile/directory — list of verified vendors for
// the commuter-facing directory. Supports optional rank filter, free-
// text search on business name, and cursor-style limit/offset
// pagination. Response includes hasMore so the client can stop
// firing onEndReached once the server has nothing left.
router.get(
  "/directory",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { rank, q, limit: rawLimit, offset: rawOffset } = req.query as {
        rank?: string;
        q?: string;
        limit?: string;
        offset?: string;
      };
      const limit = Math.min(Number(rawLimit) || 50, 100);
      const offset = Math.max(Number(rawOffset) || 0, 0);

      const conditions: SQL[] = [eq(vendorProfiles.status, "verified")];
      if (rank) conditions.push(ilike(vendorProfiles.rankLocation, `%${rank}%`));
      if (q) conditions.push(ilike(vendorProfiles.businessName, `%${q}%`));

      // Fetch one extra row so we can tell the client whether another
      // page exists without a second COUNT query. Trim it off before
      // responding.
      const rows = await db
        .select({
          id: vendorProfiles.id,
          vendorType: vendorProfiles.vendorType,
          businessName: vendorProfiles.businessName,
          rankLocation: vendorProfiles.rankLocation,
          description: vendorProfiles.description,
          businessImageUrl: vendorProfiles.businessImageUrl,
          vendorRef: vendorProfiles.vendorRef,
          salesCount: vendorProfiles.salesCount,
        })
        .from(vendorProfiles)
        .where(and(...conditions))
        .orderBy(desc(vendorProfiles.salesCount))
        .limit(limit + 1)
        .offset(offset);

      const hasMore = rows.length > limit;
      const data = hasMore ? rows.slice(0, limit) : rows;

      res.json({ data, hasMore, nextOffset: hasMore ? offset + limit : null });
    } catch (error: any) {
      console.error("Vendor directory error:", error);
      res.status(500).json({ error: "Failed to fetch vendor directory" });
    }
  }
);

export default router;
