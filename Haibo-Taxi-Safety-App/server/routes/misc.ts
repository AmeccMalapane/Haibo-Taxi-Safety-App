import { Router, Response } from "express";
import { db } from "../db";
import {
  complaints, jobs, jobApplications, lostFoundItems,
  explorerProgress, fareSurveys, stopContributions,
  photoContributions, explorerLeaderboard,
  associations, notifications, referralCodes, referralSignups,
} from "../../shared/schema";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { authMiddleware, optionalAuth, AuthRequest } from "../middleware/auth";
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

    res.status(201).json(complaint);
  } catch (error: any) {
    console.error("Submit complaint error:", error);
    res.status(500).json({ error: "Failed to submit complaint" });
  }
});

// GET /api/complaints - List complaints (admin/owner)
router.get("/complaints", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const { status, category } = req.query as any;

    const results = await db.select().from(complaints)
      .orderBy(desc(complaints.createdAt))
      .limit(limit).offset(offset);

    const [totalResult] = await db.select({ count: count() }).from(complaints);

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

// GET /api/referral/:deviceId - Get or create referral code
router.get("/referral/:deviceId", async (req, res: Response) => {
  try {
    const existing = await db.select().from(referralCodes)
      .where(eq(referralCodes.deviceId, req.params.deviceId))
      .limit(1);

    if (existing.length > 0) {
      res.json(existing[0]);
      return;
    }

    const code = generateReferralCode();
    const [referral] = await db.insert(referralCodes).values({
      deviceId: req.params.deviceId,
      code,
    }).returning();

    res.json(referral);
  } catch (error: any) {
    console.error("Get referral error:", error);
    res.status(500).json({ error: "Failed to get referral code" });
  }
});

export default router;
