import { Router, Response } from "express";
import QRCode from "qrcode";
import { db } from "../db";
import {
  driverProfiles,
  driverRatings,
  driverOwnerInvitations,
  users,
  locationUpdates,
  p2pTransfers,
} from "../../shared/schema";
import { eq, desc, count, avg, sql, and, gte, isNull } from "drizzle-orm";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { notifyUser } from "../services/notifications";
import { generatePayReferenceCode, parsePagination, paginationResponse } from "../utils/helpers";

const router = Router();

// Same plate normalization as taxis + ratings. Storing plates this way
// guarantees the join from a rating → taxi → driver uses a consistent
// key instead of hoping users type the plate the same way twice.
function normalizePlate(plate: string): string {
  return plate.toUpperCase().replace(/[\s-]/g, "");
}

// Optional image URL gate — must be https:// or a /uploads/ path we
// serve ourselves. Blocks data: / javascript: / http: URIs from ever
// reaching the admin KYC drawer via an <img src>.
function isSafeImageUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 500 &&
    (/^https:\/\//i.test(value) || value.startsWith("/uploads/"))
  );
}

// ─── GET /api/drivers/lookup/:plate ──────────────────────────────────────
// Resolves a plate number to the public driver card so the passenger
// sees who they're about to pay before confirming the amount. Mirrors
// /api/vendor-profile/lookup/:vendorRef for the Haibo Pay fare flow.
//
// Suspended / unverified drivers still resolve — a passenger might
// scan a taxi's plate QR at the rank before the driver's KYC clears;
// blocking the lookup would surface a confusing "not found" at a
// moment where the driver is clearly in front of them.
router.get("/lookup/:plate", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const normalized = normalizePlate(req.params.plate);

    const [row] = await db
      .select({
        userId: driverProfiles.userId,
        taxiPlateNumber: driverProfiles.taxiPlateNumber,
        vehicleColor: driverProfiles.vehicleColor,
        vehicleModel: driverProfiles.vehicleModel,
        vehicleYear: driverProfiles.vehicleYear,
        totalRides: driverProfiles.totalRides,
        safetyRating: driverProfiles.safetyRating,
        totalRatings: driverProfiles.totalRatings,
        isVerified: driverProfiles.isVerified,
        linkStatus: driverProfiles.linkStatus,
        displayName: users.displayName,
        handle: users.handle,
      })
      .from(driverProfiles)
      .leftJoin(users, eq(users.id, driverProfiles.userId))
      .where(eq(driverProfiles.taxiPlateNumber, normalized))
      .limit(1);

    if (!row) {
      res.status(404).json({ error: "Driver not found" });
      return;
    }

    res.json({ data: row });
  } catch (error: any) {
    console.error("Lookup driver error:", error);
    res.status(500).json({ error: "Failed to look up driver" });
  }
});

// ─── GET /api/drivers/plate/:plate/qr.png ────────────────────────────────
// Public — prints the driver's Haibo Pay QR so it can be stuck on the
// windscreen and scanned by any native camera app. The URL the QR
// encodes lands on the PayDriver screen with the plate pre-filled.
//
// Public not because leaking plates is secure (they're visible on the
// taxi itself) but because forcing auth on a printed sticker breaks
// the "scan and pay" UX end to end.
router.get("/plate/:plate/qr.png", async (req, res: Response) => {
  try {
    const normalized = normalizePlate(req.params.plate);

    const [driver] = await db
      .select({ userId: driverProfiles.userId })
      .from(driverProfiles)
      .where(eq(driverProfiles.taxiPlateNumber, normalized))
      .limit(1);

    if (!driver) {
      res.status(404).json({ error: "Driver not found" });
      return;
    }

    const shareBase =
      process.env.DRIVER_SHARE_BASE_URL ||
      (process.env.EXPO_PUBLIC_DOMAIN
        ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
        : null);
    const url = shareBase
      ? `${shareBase.replace(/\/$/, "")}/pay-driver/${encodeURIComponent(normalized)}`
      : `haibo-taxi://pay-driver/${encodeURIComponent(normalized)}`;

    const png = await QRCode.toBuffer(url, {
      type: "png",
      errorCorrectionLevel: "M",
      width: 512,
      margin: 2,
      color: {
        // Rose brand primary — keeps driver QRs visually aligned with
        // vendor QRs so commuters learn one visual affordance.
        dark: "#C81E5E",
        light: "#FFFFFF",
      },
    });

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(png);
  } catch (error: any) {
    console.error("Driver QR error:", error);
    res.status(500).json({ error: "Failed to generate QR" });
  }
});

// GET /api/drivers/me - Read the current user's driver profile (or null)
router.get("/me", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [row] = await db
      .select()
      .from(driverProfiles)
      .where(eq(driverProfiles.userId, req.user!.userId))
      .limit(1);
    res.json({ data: row || null });
  } catch (error: any) {
    console.error("Get own driver profile error:", error);
    res.status(500).json({ error: "Failed to fetch driver profile" });
  }
});

// GET /api/drivers/me/earnings — today / week / month totals plus a
// short recent-fares feed for the driver dashboard. Driver earnings on
// Haibo come through the p2pTransfers rail: every commuter tap-to-pay
// lands here as a completed row where recipientId = driverUserId. We
// deliberately exclude rows with a vendorRef tag so vendor sales don't
// get double-counted as ride fares (same user might run a taxi AND a
// rank stall with one wallet).
router.get(
  "/me/earnings",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;

      // Time boundaries — use UTC midnight + ISO week so "today" rolls
      // over at midnight local for the overwhelming majority of
      // our users (Southern African UTC+2, so UTC midnight ≈ 02:00 SAST,
      // close enough for a dashboard summary).
      const now = new Date();
      const dayStart = new Date(now);
      dayStart.setUTCHours(0, 0, 0, 0);
      const weekStart = new Date(dayStart);
      weekStart.setUTCDate(weekStart.getUTCDate() - 7);
      const monthStart = new Date(dayStart);
      monthStart.setUTCDate(monthStart.getUTCDate() - 30);

      // Base predicate: completed ride fares paid TO this driver.
      // isNull(vendorRef) strips out any vendor sales so the totals
      // only reflect transport income.
      const rideFaresBase = and(
        eq(p2pTransfers.recipientId, userId),
        eq(p2pTransfers.status, "completed"),
        isNull(p2pTransfers.vendorRef),
      );

      const [todayTotals] = await db
        .select({
          total: sql<number>`COALESCE(SUM(${p2pTransfers.amount}), 0)::float`,
          txns: sql<number>`COUNT(*)::int`,
        })
        .from(p2pTransfers)
        .where(and(rideFaresBase, gte(p2pTransfers.createdAt, dayStart)));

      const [weekTotals] = await db
        .select({
          total: sql<number>`COALESCE(SUM(${p2pTransfers.amount}), 0)::float`,
          txns: sql<number>`COUNT(*)::int`,
        })
        .from(p2pTransfers)
        .where(and(rideFaresBase, gte(p2pTransfers.createdAt, weekStart)));

      const [monthTotals] = await db
        .select({
          total: sql<number>`COALESCE(SUM(${p2pTransfers.amount}), 0)::float`,
          txns: sql<number>`COUNT(*)::int`,
        })
        .from(p2pTransfers)
        .where(and(rideFaresBase, gte(p2pTransfers.createdAt, monthStart)));

      const recent = await db
        .select({
          id: p2pTransfers.id,
          amount: p2pTransfers.amount,
          message: p2pTransfers.message,
          createdAt: p2pTransfers.createdAt,
          payerName: users.displayName,
          payerPhone: users.phone,
        })
        .from(p2pTransfers)
        .leftJoin(users, eq(p2pTransfers.senderId, users.id))
        .where(rideFaresBase)
        .orderBy(desc(p2pTransfers.createdAt))
        .limit(15);

      res.json({
        today: {
          total: Number(todayTotals?.total) || 0,
          txns: Number(todayTotals?.txns) || 0,
        },
        week: {
          total: Number(weekTotals?.total) || 0,
          txns: Number(weekTotals?.txns) || 0,
        },
        month: {
          total: Number(monthTotals?.total) || 0,
          txns: Number(monthTotals?.txns) || 0,
        },
        recent,
      });
    } catch (error: any) {
      console.error("Driver earnings error:", error);
      res.status(500).json({ error: "Failed to fetch driver earnings" });
    }
  }
);

// POST /api/drivers/register - Register as a driver
router.post("/register", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const {
      taxiPlateNumber: rawPlate, licenseNumber, licenseExpiry,
      insuranceNumber, insuranceExpiry, vehicleColor,
      vehicleModel, vehicleYear, licenseImageUrl, vehicleImageUrl,
    } = req.body;

    if (!rawPlate) {
      res.status(400).json({ error: "Taxi plate number is required" });
      return;
    }
    if (typeof rawPlate !== "string" || rawPlate.length === 0 || rawPlate.length > 20) {
      res.status(400).json({ error: "taxiPlateNumber must be a non-empty string ≤ 20 characters" });
      return;
    }

    // Simple string field caps — these land on the admin KYC drawer
    // and the driver's own profile card.
    if (licenseNumber !== undefined && licenseNumber !== null &&
        (typeof licenseNumber !== "string" || licenseNumber.length > 50)) {
      res.status(400).json({ error: "licenseNumber must be ≤ 50 characters" });
      return;
    }
    if (insuranceNumber !== undefined && insuranceNumber !== null &&
        (typeof insuranceNumber !== "string" || insuranceNumber.length > 50)) {
      res.status(400).json({ error: "insuranceNumber must be ≤ 50 characters" });
      return;
    }
    if (vehicleColor !== undefined && vehicleColor !== null &&
        (typeof vehicleColor !== "string" || vehicleColor.length > 30)) {
      res.status(400).json({ error: "vehicleColor must be ≤ 30 characters" });
      return;
    }
    if (vehicleModel !== undefined && vehicleModel !== null &&
        (typeof vehicleModel !== "string" || vehicleModel.length > 80)) {
      res.status(400).json({ error: "vehicleModel must be ≤ 80 characters" });
      return;
    }

    // Vehicle year sanity — same range as taxi registration.
    const currentYear = new Date().getFullYear();
    if (vehicleYear !== undefined && vehicleYear !== null) {
      if (!Number.isInteger(vehicleYear) || vehicleYear < 1980 || vehicleYear > currentYear + 1) {
        res.status(400).json({ error: `vehicleYear must be an integer between 1980 and ${currentYear + 1}` });
        return;
      }
    }

    // Expiry dates must parse cleanly if supplied.
    let licenseExpiryDate: Date | null = null;
    let insuranceExpiryDate: Date | null = null;
    if (licenseExpiry) {
      const d = new Date(licenseExpiry);
      if (Number.isNaN(d.getTime())) {
        res.status(400).json({ error: "licenseExpiry must be a valid ISO date" });
        return;
      }
      licenseExpiryDate = d;
    }
    if (insuranceExpiry) {
      const d = new Date(insuranceExpiry);
      if (Number.isNaN(d.getTime())) {
        res.status(400).json({ error: "insuranceExpiry must be a valid ISO date" });
        return;
      }
      insuranceExpiryDate = d;
    }

    // KYC image URLs must be https:// or a /uploads/ path — never a
    // raw data: URI or cross-origin http: link that could exfil on
    // admin preview.
    if (licenseImageUrl !== undefined && licenseImageUrl !== null && !isSafeImageUrl(licenseImageUrl)) {
      res.status(400).json({ error: "licenseImageUrl must be an https:// URL or a Haibo upload path" });
      return;
    }
    if (vehicleImageUrl !== undefined && vehicleImageUrl !== null && !isSafeImageUrl(vehicleImageUrl)) {
      res.status(400).json({ error: "vehicleImageUrl must be an https:// URL or a Haibo upload path" });
      return;
    }

    const taxiPlateNumber = normalizePlate(rawPlate);

    // Check if already registered
    const existing = await db.select().from(driverProfiles).where(eq(driverProfiles.userId, req.user!.userId)).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "Driver profile already exists" });
      return;
    }

    const payReferenceCode = generatePayReferenceCode(taxiPlateNumber);

    const [profile] = await db.insert(driverProfiles).values({
      userId: req.user!.userId,
      taxiPlateNumber,
      licenseNumber: licenseNumber || null,
      licenseExpiry: licenseExpiryDate,
      insuranceNumber: insuranceNumber || null,
      insuranceExpiry: insuranceExpiryDate,
      vehicleColor: vehicleColor || null,
      vehicleModel: vehicleModel || null,
      vehicleYear: vehicleYear ?? null,
      licenseImageUrl: licenseImageUrl || null,
      vehicleImageUrl: vehicleImageUrl || null,
      payReferenceCode,
    }).returning();

    // Update user role to driver
    await db.update(users).set({ role: "driver" }).where(eq(users.id, req.user!.userId));

    // Onboarding confirmation. KYC is still pending at this point but
    // the driver can already accept Haibo Pay payments, so the copy
    // leans on that rather than the verification state.
    try {
      await notifyUser({
        userId: req.user!.userId,
        type: "system",
        title: "You're registered as a Haibo driver",
        body: `Plate ${profile.taxiPlateNumber} is linked to your wallet. Share your Haibo Pay QR to start receiving fares — KYC review runs in parallel.`,
        data: { kind: "welcome_driver", plate: profile.taxiPlateNumber },
      });
    } catch (notifyErr) {
      console.log("[Drivers] welcome notify failed:", notifyErr);
    }

    res.status(201).json({
      id: profile.id,
      taxiPlateNumber: profile.taxiPlateNumber,
      payReferenceCode: profile.payReferenceCode,
      status: "active",
    });
  } catch (error: any) {
    console.error("Register driver error:", error);
    res.status(500).json({ error: "Failed to register driver" });
  }
});

// POST /api/drivers/location-update - Update driver GPS location
router.post("/location-update", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { latitude, longitude, accuracy, speed, heading } = req.body;

    // Coordinate bounds — same validation the WS path uses. Rejects
    // non-numbers, NaN, Infinity, and out-of-range lat/lon values that
    // would otherwise pollute driver position history.
    if (
      typeof latitude !== "number" ||
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      typeof longitude !== "number" ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      res.status(400).json({ error: "Valid latitude (-90..90) and longitude (-180..180) are required" });
      return;
    }

    // Only verified drivers may update driver position. Without this
    // check, any authenticated commuter could spam the endpoint with
    // their own userId and either mutate a stale driverProfiles row
    // or inflate locationUpdates with junk history. Look up the row
    // once and 403 if the caller isn't a registered driver.
    const [driverRow] = await db
      .select({ userId: driverProfiles.userId })
      .from(driverProfiles)
      .where(eq(driverProfiles.userId, req.user!.userId))
      .limit(1);
    if (!driverRow) {
      res.status(403).json({ error: "Only registered drivers can post location updates" });
      return;
    }

    // Update driver profile with current location
    await db.update(driverProfiles)
      .set({
        currentLatitude: latitude,
        currentLongitude: longitude,
        lastLocationUpdate: new Date(),
      })
      .where(eq(driverProfiles.userId, req.user!.userId));

    // Insert location history
    await db.insert(locationUpdates).values({
      userId: req.user!.userId,
      latitude,
      longitude,
      accuracy: accuracy || null,
      speed: speed || null,
      heading: heading || null,
    });

    res.json({ message: "Location updated" });
  } catch (error: any) {
    console.error("Location update error:", error);
    res.status(500).json({ error: "Failed to update location" });
  }
});

// GET /api/drivers/:id - Get driver profile
router.get("/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.select().from(driverProfiles).where(eq(driverProfiles.id, req.params.id)).limit(1);
    if (result.length === 0) {
      res.status(404).json({ error: "Driver not found" });
      return;
    }

    res.json(result[0]);
  } catch (error: any) {
    console.error("Get driver error:", error);
    res.status(500).json({ error: "Failed to fetch driver" });
  }
});

// GET /api/drivers/:id/performance - Get driver performance metrics
router.get("/:id/performance", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const profile = await db.select().from(driverProfiles).where(eq(driverProfiles.id, req.params.id)).limit(1);
    if (profile.length === 0) {
      res.status(404).json({ error: "Driver not found" });
      return;
    }

    const driver = profile[0];

    // Get rating stats
    const [ratingStats] = await db
      .select({
        avgRating: avg(driverRatings.rating),
        totalRatings: count(),
      })
      .from(driverRatings)
      .where(eq(driverRatings.driverId, driver.userId));

    res.json({
      id: driver.id,
      userId: driver.userId,
      taxiPlateNumber: driver.taxiPlateNumber,
      rating: Number(ratingStats.avgRating) || driver.safetyRating,
      totalRatings: ratingStats.totalRatings || driver.totalRatings,
      totalRides: driver.totalRides,
      acceptanceRate: driver.acceptanceRate,
      safetyRating: driver.safetyRating,
      isVerified: driver.isVerified,
    });
  } catch (error: any) {
    console.error("Get driver performance error:", error);
    res.status(500).json({ error: "Failed to fetch driver performance" });
  }
});

// POST /api/drivers/rate - Rate a driver
router.post("/rate", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { driverId, rating, review, rideId } = req.body;

    if (!driverId || !rating || rating < 1 || rating > 5) {
      res.status(400).json({ error: "Driver ID and rating (1-5) are required" });
      return;
    }

    await db.insert(driverRatings).values({
      driverId,
      userId: req.user!.userId,
      rating,
      review: review || null,
      rideId: rideId || null,
    });

    // Update driver's average rating
    const [stats] = await db
      .select({ avgRating: avg(driverRatings.rating), total: count() })
      .from(driverRatings)
      .where(eq(driverRatings.driverId, driverId));

    await db.update(driverProfiles)
      .set({
        safetyRating: Number(stats.avgRating) || 5,
        totalRatings: stats.total,
      })
      .where(eq(driverProfiles.userId, driverId));

    res.json({ message: "Rating submitted" });
  } catch (error: any) {
    console.error("Rate driver error:", error);
    res.status(500).json({ error: "Failed to submit rating" });
  }
});

// ─── POST /api/drivers/accept-invitation ────────────────────────────────
// Driver redeems an owner-issued invitation code. Atomic: flips the
// invitation to 'used' and writes ownerId+linkStatus='active' on the
// driver's profile in the same transaction. If the driver doesn't have
// a driver_profiles row yet (signed up but didn't complete driver
// onboarding), we create a minimal row with just userId + plate.
//
// Validation:
//   - code exists + status='pending' + not expired
//   - driver hasn't already been linked (linkStatus='active' blocks re-link)
//   - prevent self-linking (owner shouldn't redeem their own code)
router.post(
  "/accept-invitation",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { code, taxiPlateNumber } = req.body as {
        code?: string;
        taxiPlateNumber?: string;
      };

      if (!code || typeof code !== "string") {
        res.status(400).json({ error: "Invitation code is required" });
        return;
      }

      const normalizedCode = code.trim().toUpperCase();

      // Look up invitation.
      const [invitation] = await db
        .select()
        .from(driverOwnerInvitations)
        .where(eq(driverOwnerInvitations.code, normalizedCode))
        .limit(1);

      if (!invitation) {
        res.status(404).json({ error: "Invalid invitation code" });
        return;
      }
      if (invitation.status !== "pending") {
        res.status(410).json({
          error:
            invitation.status === "used"
              ? "This code has already been used"
              : invitation.status === "revoked"
                ? "This code was revoked by the owner"
                : "This code is no longer valid",
        });
        return;
      }
      if (invitation.expiresAt && invitation.expiresAt < new Date()) {
        // Soft-expire on read so stale rows get cleaned up as they're seen.
        await db
          .update(driverOwnerInvitations)
          .set({ status: "expired" })
          .where(eq(driverOwnerInvitations.id, invitation.id));
        res.status(410).json({ error: "This code has expired" });
        return;
      }
      if (invitation.ownerId === req.user!.userId) {
        res.status(400).json({ error: "You cannot redeem your own code" });
        return;
      }

      // Check driver profile state. A freshly-signed-up driver who hasn't
      // done driver onboarding won't have a profile row yet.
      const [profile] = await db
        .select()
        .from(driverProfiles)
        .where(eq(driverProfiles.userId, req.user!.userId))
        .limit(1);

      if (profile?.linkStatus === "active") {
        res.status(409).json({
          error: "You're already linked to an owner. Ask them to remove you first.",
        });
        return;
      }

      const now = new Date();

      if (profile) {
        // Existing driver profile — link it.
        await db
          .update(driverProfiles)
          .set({
            ownerId: invitation.ownerId,
            linkStatus: "active",
            linkedAt: now,
          })
          .where(eq(driverProfiles.userId, req.user!.userId));
      } else {
        // New driver — create a minimal profile. Full KYC details get
        // captured later via the driver onboarding screen. `taxiPlateNumber`
        // is required by the schema's UNIQUE constraint, so ask for it
        // alongside the code.
        if (!taxiPlateNumber) {
          res.status(400).json({
            error: "Taxi plate number is required to finish driver setup",
          });
          return;
        }
        await db.insert(driverProfiles).values({
          userId: req.user!.userId,
          taxiPlateNumber: normalizePlate(taxiPlateNumber),
          ownerId: invitation.ownerId,
          linkStatus: "active",
          linkedAt: now,
        });
      }

      // Flip the invitation to 'used' so it can't be reused. Also sets
      // users.role='driver' so subsequent auth/me calls reflect the role.
      await db
        .update(driverOwnerInvitations)
        .set({
          status: "used",
          usedByUserId: req.user!.userId,
          usedAt: now,
        })
        .where(eq(driverOwnerInvitations.id, invitation.id));

      await db
        .update(users)
        .set({ role: "driver" })
        .where(eq(users.id, req.user!.userId));

      res.json({
        linked: true,
        ownerId: invitation.ownerId,
        linkedAt: now.toISOString(),
      });
    } catch (err: any) {
      console.error("Accept invitation error:", err);
      res.status(500).json({ error: "Failed to redeem invitation" });
    }
  },
);

export default router;
