import { Router, Response } from "express";
import QRCode from "qrcode";
import { db } from "../db";
import { vendorProfiles, users, p2pTransfers } from "../../shared/schema";
import { eq, desc, ilike, and, isNotNull, sql, SQL } from "drizzle-orm";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { notifyUser } from "../services/notifications";

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

// GET /api/vendor-profile/me/sales — recent sales feed for the current
// vendor. Filters p2pTransfers by the caller's vendorRef so vendors can
// reconcile individual sales against their physical inventory. Joined
// against users so the UI can show buyer name/phone where available
// (non-user recipients still show a friendly "walk-up customer" label
// on the client side).
router.get(
  "/me/sales",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { limit: rawLimit, offset: rawOffset } = req.query as {
        limit?: string;
        offset?: string;
      };
      const limit = Math.min(Number(rawLimit) || 30, 100);
      const offset = Math.max(Number(rawOffset) || 0, 0);

      const [profile] = await db
        .select({ vendorRef: vendorProfiles.vendorRef })
        .from(vendorProfiles)
        .where(eq(vendorProfiles.userId, req.user!.userId))
        .limit(1);

      if (!profile) {
        // No vendor profile → return an empty feed rather than 404. The
        // client can render the same empty state whether you've never
        // registered or just haven't received your first sale yet.
        res.json({ data: [], hasMore: false, nextOffset: null });
        return;
      }

      // Fetch limit+1 to compute hasMore without a second COUNT query,
      // same pattern as the directory endpoint in Chunk 19.
      const rows = await db
        .select({
          id: p2pTransfers.id,
          senderId: p2pTransfers.senderId,
          amount: p2pTransfers.amount,
          message: p2pTransfers.message,
          createdAt: p2pTransfers.createdAt,
          buyerName: users.displayName,
          buyerPhone: users.phone,
        })
        .from(p2pTransfers)
        .leftJoin(users, eq(p2pTransfers.senderId, users.id))
        .where(
          and(
            eq(p2pTransfers.vendorRef, profile.vendorRef),
            eq(p2pTransfers.status, "completed"),
          ),
        )
        .orderBy(desc(p2pTransfers.createdAt))
        .limit(limit + 1)
        .offset(offset);

      const hasMore = rows.length > limit;
      const data = hasMore ? rows.slice(0, limit) : rows;

      res.json({
        data,
        hasMore,
        nextOffset: hasMore ? offset + limit : null,
      });
    } catch (error: any) {
      console.error("Vendor sales feed error:", error);
      res.status(500).json({ error: "Failed to fetch sales" });
    }
  },
);

// Vendor profile field caps. The public vendor directory renders these
// on every page load so unbounded values become feed DoS.
const MAX_VENDOR_BUSINESS_NAME = 120;
const MAX_VENDOR_RANK_LOCATION = 200;
const MAX_VENDOR_DESCRIPTION = 2000;
const MAX_VENDOR_IMAGE_URL = 500;
const VENDOR_TYPES = new Set(["taxi_vendor", "hawker", "accessories"]);

// Validates the subset of fields that can be mutated via either POST (create)
// or PUT /me (update). Returns null on success or an error string to surface
// in a 400. Kept as a single helper so the two endpoints can't drift.
function validateVendorFields(body: {
  businessName?: unknown;
  rankLocation?: unknown;
  description?: unknown;
  businessImageUrl?: unknown;
}): string | null {
  const { businessName, rankLocation, description, businessImageUrl } = body;

  if (businessName !== undefined) {
    if (typeof businessName !== "string" || businessName.trim().length === 0) {
      return "businessName must be a non-empty string";
    }
    if (businessName.length > MAX_VENDOR_BUSINESS_NAME) {
      return `businessName must be ≤ ${MAX_VENDOR_BUSINESS_NAME} characters`;
    }
  }
  if (rankLocation !== undefined && rankLocation !== null) {
    if (typeof rankLocation !== "string" || rankLocation.length > MAX_VENDOR_RANK_LOCATION) {
      return `rankLocation must be a string ≤ ${MAX_VENDOR_RANK_LOCATION} characters`;
    }
  }
  if (description !== undefined && description !== null) {
    if (typeof description !== "string" || description.length > MAX_VENDOR_DESCRIPTION) {
      return `description must be a string ≤ ${MAX_VENDOR_DESCRIPTION} characters`;
    }
  }
  if (businessImageUrl !== undefined && businessImageUrl !== null) {
    if (typeof businessImageUrl !== "string" || businessImageUrl.length > MAX_VENDOR_IMAGE_URL) {
      return `businessImageUrl must be a string ≤ ${MAX_VENDOR_IMAGE_URL} characters`;
    }
    // Accept only https URLs (or local upload refs served from /uploads).
    // This blocks data: / javascript: URIs from ever reaching the public
    // directory render path, even though the command-center doesn't use
    // dangerouslySetInnerHTML today.
    if (
      !/^https:\/\//i.test(businessImageUrl) &&
      !businessImageUrl.startsWith("/uploads/")
    ) {
      return "businessImageUrl must be an https:// URL or a Haibo upload path";
    }
  }
  return null;
}

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
    if (!VENDOR_TYPES.has(vendorType)) {
      res.status(400).json({ error: "Invalid vendorType" });
      return;
    }
    const validationError = validateVendorFields({
      businessName, rankLocation, description, businessImageUrl,
    });
    if (validationError) {
      res.status(400).json({ error: validationError });
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

    // Registration confirmation. Vendors start in "pending" — moderators
    // review from the command-center drawer. Copy makes the pending
    // state clear so the vendor isn't surprised when their listing
    // doesn't appear in the public directory yet, while also noting
    // that they can already print and share their QR.
    try {
      await notifyUser({
        userId: req.user!.userId,
        type: "system",
        title: "Vendor registration received",
        body: `${businessName} is in the review queue. Ref ${vendorRef} — you can share your pay link now, and we'll notify you once our team verifies your business.`,
        data: { kind: "welcome_vendor", vendorRef },
      });
    } catch (notifyErr) {
      console.log("[Vendor] welcome notify failed:", notifyErr);
    }

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

    const validationError = validateVendorFields({
      businessName, rankLocation, description, businessImageUrl,
    });
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

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
        ...(businessName !== undefined && { businessName: (businessName as string).trim() }),
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

// GET /api/vendor-profile/:vendorRef/qr.png — server-rendered QR image
// encoding the public pay deep link. Vendors can print this directly
// onto stall signage or share it in their promotions; commuters scan
// with any native camera and land on PayVendorScreen with the ref
// pre-filled (see client/lib/deepLinks.ts + Chunk 17).
//
// Public (no auth) so the image can be embedded in printed materials,
// websites, and WhatsApp broadcasts without requiring a session. The
// underlying ref does nothing sensitive on its own — pay-vendor is
// still authenticated on the write side.
router.get("/:vendorRef/qr.png", async (req, res: Response) => {
  try {
    const { vendorRef } = req.params;

    // Verify the vendor exists and isn't suspended before generating
    // an image — otherwise we'd happily print QR stickers for invalid
    // refs. Note: we do NOT return 200 for pending vendors on payment
    // lookup, but we DO here because a vendor needs to print their QR
    // before anyone pays them (chicken/egg).
    const [vendor] = await db
      .select({ status: vendorProfiles.status })
      .from(vendorProfiles)
      .where(eq(vendorProfiles.vendorRef, vendorRef))
      .limit(1);

    if (!vendor || vendor.status === "suspended") {
      res.status(404).json({ error: "Vendor not found" });
      return;
    }

    // Build the smart link the QR encodes. Same shape as
    // client/lib/deepLinks.ts createVendorPayLink so a native camera
    // scan lands in exactly the same place as an in-app share tap.
    // VENDOR_SHARE_BASE_URL takes precedence, falls back to
    // EXPO_PUBLIC_DOMAIN for parity with client smart-links, then the
    // raw app scheme as a last resort for local dev.
    const shareBase =
      process.env.VENDOR_SHARE_BASE_URL ||
      (process.env.EXPO_PUBLIC_DOMAIN
        ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
        : null);
    const payUrl = shareBase
      ? `${shareBase.replace(/\/$/, "")}/pay/${encodeURIComponent(vendorRef)}`
      : `haibo-taxi://pay/${encodeURIComponent(vendorRef)}`;

    // Render a 512px PNG with medium error-correction (resilient to
    // smudges on a printed sticker) and a small quiet-zone margin.
    const png = await QRCode.toBuffer(payUrl, {
      type: "png",
      errorCorrectionLevel: "M",
      width: 512,
      margin: 2,
      color: {
        // Haibo rose primary for the modules; white quiet zone.
        dark: "#C81E5E",
        light: "#FFFFFF",
      },
    });

    res.setHeader("Content-Type", "image/png");
    // Short cache — if a vendor is suspended we want the printed sticker
    // to stop resolving reasonably quickly, so we don't lean on CDN edge
    // caches here.
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(png);
  } catch (error: any) {
    console.error("Vendor QR error:", error);
    res.status(500).json({ error: "Failed to render QR code" });
  }
});

// GET /api/vendor-profile/ranks — distinct list of rank names across
// verified vendors, sorted by popularity. Drives the rank filter
// chip strip on the mobile directory so users can one-tap filter to
// their local rank instead of typing a search term.
router.get("/ranks", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const rows = await db
      .select({
        rankLocation: vendorProfiles.rankLocation,
        count: sql<number>`count(*)::int`,
      })
      .from(vendorProfiles)
      .where(
        and(
          eq(vendorProfiles.status, "verified"),
          isNotNull(vendorProfiles.rankLocation),
        ),
      )
      .groupBy(vendorProfiles.rankLocation)
      .orderBy(desc(sql`count(*)`))
      .limit(20);

    res.json({
      data: rows
        .filter((r) => r.rankLocation)
        .map((r) => ({ rank: r.rankLocation as string, count: r.count })),
    });
  } catch (error: any) {
    console.error("Vendor ranks error:", error);
    res.status(500).json({ error: "Failed to fetch ranks" });
  }
});

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
