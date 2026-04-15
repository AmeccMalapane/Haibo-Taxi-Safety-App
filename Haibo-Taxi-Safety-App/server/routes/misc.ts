import { Router, Response } from "express";
import { db } from "../db";
import {
  complaints, jobs, jobApplications, lostFoundItems,
  explorerProgress, fareSurveys, stopContributions,
  photoContributions, explorerLeaderboard, taxiLocations,
  associations, notifications, referralCodes, referralSignups,
  referralRewards,
} from "../../shared/schema";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { authMiddleware, optionalAuth, AuthRequest } from "../middleware/auth";
import { emitToAdmins } from "../services/realtime";
import { parsePagination, paginationResponse, generateReferralCode } from "../utils/helpers";

const router = Router();

// ============ COMPLAINTS ============

// POST /api/complaints - Submit a complaint
router.post("/complaints", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const {
      taxiPlateNumber, category, severity, description,
      incidentDate, incidentLocation, incidentLatitude, incidentLongitude,
      routeName, evidence, isAnonymous,
    } = req.body;

    if (!category || !description) {
      res.status(400).json({ error: "Category and description are required" });
      return;
    }

    const [complaint] = await db.insert(complaints).values({
      userId: req.user!.userId,
      taxiPlateNumber: taxiPlateNumber || null,
      category,
      severity: severity || "medium",
      description,
      incidentDate: incidentDate ? new Date(incidentDate) : null,
      incidentLocation: incidentLocation || null,
      incidentLatitude: incidentLatitude || null,
      incidentLongitude: incidentLongitude || null,
      routeName: routeName || null,
      evidence: evidence || null,
      isAnonymous: isAnonymous || false,
      status: "pending",
    }).returning();

    // Fan out so the Command Center dashboard + complaints page can update
    // without a manual refetch
    emitToAdmins("complaint:new", complaint);

    res.status(201).json(complaint);
  } catch (error: any) {
    console.error("Submit complaint error:", error);
    res.status(500).json({ error: "Failed to submit complaint" });
  }
});

// GET /api/complaints - List complaints scoped to the caller.
//
// SECURITY: before Chunk 43 this endpoint returned every complaint row
// to any authenticated user — the comment said "admin/owner" but neither
// filter was enforced, so a plain commuter token could read every other
// user's incident reports. Now admins see everything (the Command
// Center ComplaintsPage calls this endpoint with an admin token and
// relies on the full feed), everyone else sees only their own rows.
router.get("/complaints", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const isAdmin = req.user!.role === "admin";

    const ownerFilter = isAdmin
      ? undefined
      : eq(complaints.userId, req.user!.userId);

    const rowsQuery = db
      .select()
      .from(complaints)
      .orderBy(desc(complaints.createdAt))
      .limit(limit)
      .offset(offset);
    const results = ownerFilter
      ? await rowsQuery.where(ownerFilter)
      : await rowsQuery;

    const countQuery = db.select({ count: count() }).from(complaints);
    const [totalResult] = ownerFilter
      ? await countQuery.where(ownerFilter)
      : await countQuery;

    res.json({
      data: results,
      pagination: paginationResponse(totalResult.count, { page, limit, offset }),
    });
  } catch (error: any) {
    console.error("Get complaints error:", error);
    res.status(500).json({ error: "Failed to fetch complaints" });
  }
});

// ============ JOBS ============

// GET /api/jobs - List jobs
router.get("/jobs", async (req, res: Response) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const { category, province, jobType } = req.query as any;

    let results;
    if (category) {
      results = await db.select().from(jobs)
        .where(and(eq(jobs.status, "active"), eq(jobs.category, category)))
        .orderBy(desc(jobs.createdAt))
        .limit(limit).offset(offset);
    } else {
      results = await db.select().from(jobs)
        .where(eq(jobs.status, "active"))
        .orderBy(desc(jobs.createdAt))
        .limit(limit).offset(offset);
    }

    const [totalResult] = await db.select({ count: count() }).from(jobs).where(eq(jobs.status, "active"));

    res.json({
      data: results,
      pagination: paginationResponse(totalResult.count, { page, limit, offset }),
    });
  } catch (error: any) {
    console.error("Get jobs error:", error);
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

// POST /api/jobs - Create a job listing
router.post("/jobs", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const {
      title, company, description, requirements, jobType,
      category, location, province, salary, salaryMin, salaryMax,
      contactPhone, contactEmail, contactWhatsapp,
      experienceLevel, licenseRequired, benefits, applicationDeadline,
    } = req.body;

    if (!title || !company || !description || !location) {
      res.status(400).json({ error: "Title, company, description, and location are required" });
      return;
    }

    const [job] = await db.insert(jobs).values({
      title,
      company,
      description,
      requirements: requirements || null,
      jobType: jobType || "full-time",
      category: category || "driver",
      location,
      province: province || null,
      salary: salary || null,
      salaryMin: salaryMin || null,
      salaryMax: salaryMax || null,
      contactPhone: contactPhone || null,
      contactEmail: contactEmail || null,
      contactWhatsapp: contactWhatsapp || null,
      experienceLevel: experienceLevel || "entry",
      licenseRequired: licenseRequired || null,
      benefits: benefits || null,
      applicationDeadline: applicationDeadline ? new Date(applicationDeadline) : null,
      postedBy: req.user!.userId,
      status: "active",
    }).returning();

    res.status(201).json(job);
  } catch (error: any) {
    console.error("Create job error:", error);
    res.status(500).json({ error: "Failed to create job" });
  }
});

// POST /api/jobs/:id/apply - Apply for a job
router.post("/jobs/:id/apply", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { applicantName, applicantPhone, applicantEmail, coverMessage, deviceId } = req.body;

    if (!applicantName || !applicantPhone) {
      res.status(400).json({ error: "Name and phone are required" });
      return;
    }

    // Increment view/application count
    await db.update(jobs)
      .set({ applicationCount: sql`${jobs.applicationCount} + 1` })
      .where(eq(jobs.id, req.params.id));

    const [application] = await db.insert(jobApplications).values({
      jobId: req.params.id,
      applicantName,
      applicantPhone,
      applicantEmail: applicantEmail || null,
      coverMessage: coverMessage || null,
      deviceId: deviceId || req.user?.userId || null,
      status: "pending",
    }).returning();

    res.status(201).json(application);
  } catch (error: any) {
    console.error("Apply for job error:", error);
    res.status(500).json({ error: "Failed to apply for job" });
  }
});

// ============ LOST & FOUND ============

// GET /api/lost-found - List lost & found items
router.get("/lost-found", async (req, res: Response) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const { type } = req.query as any;

    let results;
    if (type) {
      results = await db.select().from(lostFoundItems)
        .where(and(eq(lostFoundItems.status, "active"), eq(lostFoundItems.type, type)))
        .orderBy(desc(lostFoundItems.createdAt))
        .limit(limit).offset(offset);
    } else {
      results = await db.select().from(lostFoundItems)
        .where(eq(lostFoundItems.status, "active"))
        .orderBy(desc(lostFoundItems.createdAt))
        .limit(limit).offset(offset);
    }

    const [totalResult] = await db.select({ count: count() }).from(lostFoundItems);

    res.json({
      data: results,
      pagination: paginationResponse(totalResult.count, { page, limit, offset }),
    });
  } catch (error: any) {
    console.error("Get lost-found error:", error);
    res.status(500).json({ error: "Failed to fetch items" });
  }
});

// GET /api/lost-found/:id - Fetch a single lost/found item.
// Returns the raw schema plus a `contactInfo` alias for the Details screen
// (which has a single contact field rather than name+phone).
router.get("/lost-found/:id", async (req, res: Response) => {
  try {
    const result = await db.select().from(lostFoundItems)
      .where(eq(lostFoundItems.id, req.params.id))
      .limit(1);

    if (result.length === 0) {
      res.status(404).json({ error: "Item not found" });
      return;
    }

    const item = result[0];
    res.json({ ...item, contactInfo: item.contactPhone });
  } catch (error: any) {
    console.error("Get lost-found item error:", error);
    res.status(500).json({ error: "Failed to fetch item" });
  }
});

// PUT /api/lost-found/:id/claim - Mark an item as claimed/resolved.
// Client passes deviceId in the body; falls back to authenticated user id
// when present. Claim is intentionally open — anyone with the URL can mark
// something resolved (matches the "it's been handled" UX in the app).
router.put("/lost-found/:id/claim", optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const claimedBy = req.user?.userId || (req.body?.deviceId as string | undefined) || null;

    const [updated] = await db.update(lostFoundItems)
      .set({
        status: "claimed",
        claimedAt: new Date(),
        claimedBy,
      })
      .where(eq(lostFoundItems.id, req.params.id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Item not found" });
      return;
    }

    res.json({ ...updated, contactInfo: updated.contactPhone });
  } catch (error: any) {
    console.error("Claim lost-found item error:", error);
    res.status(500).json({ error: "Failed to claim item" });
  }
});

// POST /api/lost-found - Report a lost/found item
router.post("/lost-found", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const {
      type, category, title, description, imageUrl,
      routeOrigin, routeDestination, dateLost,
      contactPhone, contactName, reward, deviceId,
    } = req.body;

    if (!category || !title || !description || !contactPhone || !contactName) {
      res.status(400).json({ error: "Category, title, description, contact phone, and name are required" });
      return;
    }

    const [item] = await db.insert(lostFoundItems).values({
      type: type || "lost",
      category,
      title,
      description,
      imageUrl: imageUrl || null,
      routeOrigin: routeOrigin || null,
      routeDestination: routeDestination || null,
      dateLost: dateLost ? new Date(dateLost) : null,
      contactPhone,
      contactName,
      reward: reward || null,
      deviceId: deviceId || req.user?.userId || null,
      status: "active",
    }).returning();

    res.status(201).json(item);
  } catch (error: any) {
    console.error("Report lost-found error:", error);
    res.status(500).json({ error: "Failed to report item" });
  }
});

// ============ CITY EXPLORER ============

// GET /api/explorer/progress/:deviceId - Get explorer progress
router.get("/explorer/progress/:deviceId", async (req, res: Response) => {
  try {
    const result = await db.select().from(explorerProgress)
      .where(eq(explorerProgress.deviceId, req.params.deviceId))
      .limit(1);

    if (result.length === 0) {
      // Create new progress
      const [progress] = await db.insert(explorerProgress).values({
        deviceId: req.params.deviceId,
      }).returning();
      res.json(progress);
      return;
    }

    res.json(result[0]);
  } catch (error: any) {
    console.error("Get explorer progress error:", error);
    res.status(500).json({ error: "Failed to fetch progress" });
  }
});

// GET /api/explorer/leaderboard - Get leaderboard
router.get("/explorer/leaderboard", async (req, res: Response) => {
  try {
    const results = await db.select().from(explorerLeaderboard)
      .orderBy(desc(explorerLeaderboard.weeklyPoints))
      .limit(50);

    res.json({ data: results });
  } catch (error: any) {
    console.error("Get leaderboard error:", error);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

// ============ CITY EXPLORER CONTRIBUTIONS (Chunk 48) ============
// Before this chunk the CityExplorerScreen flow was writing to four
// endpoints that didn't exist on the server (404 on every engagement):
// GET /api/explorer/fare-question, POST /api/explorer/fare-survey,
// POST /api/explorer/stop, POST /api/explorer/photo. The schema had
// fareSurveys, stopContributions, photoContributions tables all along
// but nothing wrote to them. Now the mobile writes actually persist
// and explorerProgress aggregate counters bump on each contribution.

// Small helper to bump a single counter on explorerProgress. Creates
// the progress row if it doesn't exist yet so a brand-new device can
// immediately earn points without a separate init step.
async function bumpExplorerProgress(
  deviceId: string,
  field: "faresVerified" | "stopsAdded" | "photosUploaded" | "surveysCompleted",
  pointsEarned: number,
) {
  const existing = await db
    .select({ id: explorerProgress.id })
    .from(explorerProgress)
    .where(eq(explorerProgress.deviceId, deviceId))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(explorerProgress).values({
      deviceId,
      [field]: 1,
      totalPoints: pointsEarned,
      surveysCompleted: field === "surveysCompleted" ? 1 : 0,
      lastSurveyDate: new Date(),
    } as any);
    return;
  }

  const col = (explorerProgress as any)[field];
  await db
    .update(explorerProgress)
    .set({
      [field]: sql`${col} + 1`,
      totalPoints: sql`${explorerProgress.totalPoints} + ${pointsEarned}`,
      lastSurveyDate: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(explorerProgress.deviceId, deviceId));
}

// GET /api/explorer/fare-question — returns a random origin/destination
// pair for the mobile fare-verification game. Picks two real taxi ranks
// from taxi_locations when available so the question is anchored in
// actual routes the commuter might know, falling back to a static
// pair when the DB has fewer than two ranks (fresh installs, tests).
router.get("/explorer/fare-question", async (req, res: Response) => {
  try {
    const ranks = await db
      .select({ id: taxiLocations.id, name: taxiLocations.name })
      .from(taxiLocations)
      .where(eq(taxiLocations.type, "rank"))
      .orderBy(sql`random()`)
      .limit(2);

    if (ranks.length >= 2) {
      res.json({
        origin: ranks[0].name,
        originId: ranks[0].id,
        destination: ranks[1].name,
        destinationId: ranks[1].id,
      });
      return;
    }

    res.json({
      origin: "Johannesburg CBD",
      destination: "Soweto",
    });
  } catch (error: any) {
    console.error("Fare question error:", error);
    res.status(500).json({ error: "Failed to fetch fare question" });
  }
});

// POST /api/explorer/fare-survey — persist a commuter's fare answer
// and bump faresVerified on their explorer progress row. Points are
// determined server-side so mobile can't cheat.
router.post("/explorer/fare-survey", async (req, res: Response) => {
  try {
    const {
      deviceId,
      originRankId,
      originName,
      destinationName,
      fareAmount,
      responseType,
    } = req.body as {
      deviceId?: string;
      originRankId?: string;
      originName?: string;
      destinationName?: string;
      fareAmount?: number;
      responseType?: string;
    };

    if (!deviceId || !originName || !destinationName || !responseType) {
      res
        .status(400)
        .json({
          error:
            "deviceId, originName, destinationName, and responseType are required",
        });
      return;
    }

    const pointsEarned = responseType === "known" ? 10 : 5;

    const [row] = await db
      .insert(fareSurveys)
      .values({
        deviceId,
        originRankId: originRankId || null,
        originName,
        destinationName,
        fareAmount: typeof fareAmount === "number" ? fareAmount : null,
        responseType,
        pointsEarned,
      })
      .returning();

    await bumpExplorerProgress(deviceId, "faresVerified", pointsEarned);

    res.status(201).json({ ...row, pointsEarned });
  } catch (error: any) {
    console.error("Fare survey error:", error);
    res.status(500).json({ error: "Failed to save fare survey" });
  }
});

// POST /api/explorer/stop — persist a new stop the commuter spotted.
// latitude/longitude are notNull() in the schema, so the server rejects
// submissions without coordinates rather than defaulting to 0,0 (which
// would pin bogus stops to the Gulf of Guinea). Mobile catches the 400
// and shows a friendly "Could not save" alert.
router.post("/explorer/stop", async (req, res: Response) => {
  try {
    const {
      deviceId,
      stopName,
      latitude,
      longitude,
      tip,
      landmark,
      bestTime,
    } = req.body as {
      deviceId?: string;
      stopName?: string;
      latitude?: number | null;
      longitude?: number | null;
      tip?: string;
      landmark?: string;
      bestTime?: string;
    };

    if (!deviceId || !stopName) {
      res
        .status(400)
        .json({ error: "deviceId and stopName are required" });
      return;
    }

    if (typeof latitude !== "number" || typeof longitude !== "number") {
      res
        .status(400)
        .json({
          error:
            "Location services are required to submit a stop — grant GPS access and try again.",
        });
      return;
    }

    const pointsEarned = 30;

    const [row] = await db
      .insert(stopContributions)
      .values({
        deviceId,
        stopName,
        latitude,
        longitude,
        tip: tip || null,
        landmark: landmark || null,
        bestTime: bestTime || null,
        pointsEarned,
      })
      .returning();

    await bumpExplorerProgress(deviceId, "stopsAdded", pointsEarned);

    res.status(201).json({ ...row, pointsEarned });
  } catch (error: any) {
    console.error("Stop contribution error:", error);
    res.status(500).json({ error: "Failed to save stop contribution" });
  }
});

// POST /api/explorer/photo — persist a photo contribution. The mobile
// flow currently doesn't upload the actual bytes so imageUrl stays
// null for now; the description + landmark text are the useful payload.
// Follow-up: wire the /api/uploads/image → POST /photo pipe so photos
// actually ride along.
router.post("/explorer/photo", async (req, res: Response) => {
  try {
    const {
      deviceId,
      locationId,
      stopContributionId,
      imageUrl,
      description,
      landmark,
      bestTime,
    } = req.body as {
      deviceId?: string;
      locationId?: string;
      stopContributionId?: string;
      imageUrl?: string;
      description?: string;
      landmark?: string;
      bestTime?: string;
    };

    if (!deviceId) {
      res.status(400).json({ error: "deviceId is required" });
      return;
    }

    const pointsEarned = 20;

    const [row] = await db
      .insert(photoContributions)
      .values({
        deviceId,
        locationId: locationId || null,
        stopContributionId: stopContributionId || null,
        imageUrl: imageUrl || null,
        description: description || null,
        landmark: landmark || null,
        bestTime: bestTime || null,
        pointsEarned,
      })
      .returning();

    await bumpExplorerProgress(deviceId, "photosUploaded", pointsEarned);

    res.status(201).json({ ...row, pointsEarned });
  } catch (error: any) {
    console.error("Photo contribution error:", error);
    res.status(500).json({ error: "Failed to save photo contribution" });
  }
});

// ============ ASSOCIATIONS ============

// GET /api/associations - List associations
router.get("/associations", async (req, res: Response) => {
  try {
    const results = await db.select().from(associations)
      .where(eq(associations.status, "active"))
      .orderBy(associations.name);

    res.json({ data: results });
  } catch (error: any) {
    console.error("Get associations error:", error);
    res.status(500).json({ error: "Failed to fetch associations" });
  }
});

// ============ NOTIFICATIONS ============

// GET /api/notifications - Get user notifications
router.get("/notifications", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const results = await db.select().from(notifications)
      .where(eq(notifications.userId, req.user!.userId))
      .orderBy(desc(notifications.createdAt))
      .limit(50);

    res.json({ data: results });
  } catch (error: any) {
    console.error("Get notifications error:", error);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// ============ REFERRALS ============
//
// Device-scoped referral system. All endpoints identify the user by deviceId
// (not JWT), matching the client's expo-constants-based device identity.

interface RewardTierDef {
  signups: number;
  type: "wallet_credit" | "tshirt" | "accessory_pack";
  description: string;
}

const REWARD_TIERS: RewardTierDef[] = [
  { signups: 3, type: "wallet_credit", description: "R20 wallet credit" },
  { signups: 5, type: "tshirt", description: "Haibo T-shirt" },
  { signups: 10, type: "wallet_credit", description: "R50 wallet credit" },
  { signups: 20, type: "accessory_pack", description: "Haibo accessory pack" },
  { signups: 50, type: "wallet_credit", description: "R200 wallet credit" },
];

async function getOrCreateReferralCode(deviceId: string) {
  const existing = await db.select().from(referralCodes)
    .where(eq(referralCodes.deviceId, deviceId))
    .limit(1);
  if (existing.length > 0) return existing[0];

  const code = generateReferralCode();
  const [row] = await db.insert(referralCodes).values({ deviceId, code }).returning();
  return row;
}

// GET /api/referral/code/:deviceId — Get or create a referral code for this device
router.get("/referral/code/:deviceId", async (req, res: Response) => {
  try {
    const row = await getOrCreateReferralCode(req.params.deviceId);
    const shareBase = process.env.REFERRAL_SHARE_BASE_URL || "https://haibo.africa/r";
    res.json({
      referralCode: row.code,
      shareLink: `${shareBase}/${row.code}`,
    });
  } catch (error: any) {
    console.error("Get referral code error:", error);
    res.status(500).json({ error: "Failed to get referral code" });
  }
});

// GET /api/referral/stats/:deviceId — Aggregate signups + reward tier progress
router.get("/referral/stats/:deviceId", async (req, res: Response) => {
  try {
    const { deviceId } = req.params;

    const [signupCountRow] = await db
      .select({ c: count() })
      .from(referralSignups)
      .where(eq(referralSignups.referrerDeviceId, deviceId));
    const totalSignups = Number(signupCountRow?.c || 0);

    const [completedRow] = await db
      .select({ c: count() })
      .from(referralSignups)
      .where(and(
        eq(referralSignups.referrerDeviceId, deviceId),
        eq(referralSignups.hasCompletedRide, true),
      ));
    const completedRides = Number(completedRow?.c || 0);

    const allTiers = REWARD_TIERS.map((tier) => ({
      signups: tier.signups,
      type: tier.type,
      description: tier.description,
      unlocked: totalSignups >= tier.signups,
    }));

    const nextTierDef = REWARD_TIERS.find((t) => t.signups > totalSignups);
    const nextTier = nextTierDef
      ? {
          signups: nextTierDef.signups,
          description: nextTierDef.description,
          progress: Math.min(1, totalSignups / nextTierDef.signups),
          remaining: nextTierDef.signups - totalSignups,
        }
      : null;

    res.json({ totalSignups, completedRides, nextTier, allTiers });
  } catch (error: any) {
    console.error("Get referral stats error:", error);
    res.status(500).json({ error: "Failed to get referral stats" });
  }
});

// GET /api/referral/signups/:deviceId — List signups this user referred
router.get("/referral/signups/:deviceId", async (req, res: Response) => {
  try {
    const rows = await db
      .select({
        id: referralSignups.id,
        referredDeviceId: referralSignups.referredDeviceId,
        status: referralSignups.status,
        hasCompletedRide: referralSignups.hasCompletedRide,
        createdAt: referralSignups.createdAt,
      })
      .from(referralSignups)
      .where(eq(referralSignups.referrerDeviceId, req.params.deviceId))
      .orderBy(desc(referralSignups.createdAt))
      .limit(100);

    res.json(rows);
  } catch (error: any) {
    console.error("Get referral signups error:", error);
    res.status(500).json({ error: "Failed to get referral signups" });
  }
});

// POST /api/referral/claim-reward — Claim an unlocked reward tier
router.post("/referral/claim-reward", async (req, res: Response) => {
  try {
    const { deviceId, tier } = req.body as { deviceId?: string; tier?: number };

    if (!deviceId || typeof tier !== "number") {
      res.status(400).json({ error: "deviceId and tier are required" });
      return;
    }

    const tierDef = REWARD_TIERS.find((t) => t.signups === tier);
    if (!tierDef) {
      res.status(400).json({ error: "Unknown reward tier" });
      return;
    }

    // Verify the user has enough signups to unlock this tier.
    const [signupCountRow] = await db
      .select({ c: count() })
      .from(referralSignups)
      .where(eq(referralSignups.referrerDeviceId, deviceId));
    const totalSignups = Number(signupCountRow?.c || 0);

    if (totalSignups < tierDef.signups) {
      res.status(400).json({
        error: "Tier not yet unlocked",
        required: tierDef.signups,
        current: totalSignups,
      });
      return;
    }

    // Prevent double-claim of the same tier for the same device.
    const [existing] = await db
      .select()
      .from(referralRewards)
      .where(and(
        eq(referralRewards.deviceId, deviceId),
        eq(referralRewards.rewardTier, tierDef.signups),
      ))
      .limit(1);

    if (existing) {
      res.status(409).json({ error: "Reward already claimed", reward: existing });
      return;
    }

    const [reward] = await db.insert(referralRewards).values({
      deviceId,
      rewardType: tierDef.type,
      rewardTier: tierDef.signups,
      description: tierDef.description,
      status: "pending",
    }).returning();

    res.status(201).json(reward);
  } catch (error: any) {
    console.error("Claim reward error:", error);
    res.status(500).json({ error: "Failed to claim reward" });
  }
});

export default router;
