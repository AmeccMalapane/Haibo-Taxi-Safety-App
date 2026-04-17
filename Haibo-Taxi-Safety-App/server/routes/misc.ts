import { Router, Response } from "express";
import QRCode from "qrcode";
import { db } from "../db";
import {
  complaints, jobs, jobApplications, lostFoundItems,
  explorerProgress, fareSurveys, stopContributions,
  photoContributions, explorerLeaderboard, taxiLocations,
  associations, notifications, referralCodes, referralSignups,
  referralRewards, taxis, taxiDrivers, driverRatings, driverProfiles,
} from "../../shared/schema";
import { eq, desc, sql, count, and, avg } from "drizzle-orm";
import { authMiddleware, optionalAuth, AuthRequest } from "../middleware/auth";
import { emitToAdmins } from "../services/realtime";
import { parsePagination, paginationResponse, generateReferralCode } from "../utils/helpers";

const router = Router();

// ============ COMPLAINTS ============

// Allowlists mirror the schema comments — kept here so an attacker can't
// slip a junk category into the audit stream and break the admin filters.
const COMPLAINT_CATEGORIES = new Set([
  "reckless_driving",
  "overcharging",
  "harassment",
  "vehicle_condition",
  "overcrowding",
  "rude_behavior",
  "safety_violation",
  "other",
]);
const COMPLAINT_SEVERITIES = new Set(["low", "medium", "high", "critical"]);
const MAX_COMPLAINT_DESCRIPTION = 4000;
const MAX_COMPLAINT_EVIDENCE = 10;

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
    if (typeof category !== "string" || !COMPLAINT_CATEGORIES.has(category)) {
      res.status(400).json({ error: "Invalid complaint category" });
      return;
    }
    if (severity !== undefined && (typeof severity !== "string" || !COMPLAINT_SEVERITIES.has(severity))) {
      res.status(400).json({ error: "Invalid severity value" });
      return;
    }
    if (typeof description !== "string" || description.trim().length === 0) {
      res.status(400).json({ error: "Description is required" });
      return;
    }
    if (description.length > MAX_COMPLAINT_DESCRIPTION) {
      res.status(400).json({
        error: `Description must be ${MAX_COMPLAINT_DESCRIPTION} characters or fewer`,
      });
      return;
    }
    // Coordinate bounds — reject out-of-range values that would pollute
    // the admin incident map. Both fields are optional but if provided
    // they must be valid finite numbers in the correct range.
    if (
      incidentLatitude !== undefined &&
      incidentLatitude !== null &&
      (typeof incidentLatitude !== "number" ||
        !Number.isFinite(incidentLatitude) ||
        incidentLatitude < -90 ||
        incidentLatitude > 90)
    ) {
      res.status(400).json({ error: "incidentLatitude must be between -90 and 90" });
      return;
    }
    if (
      incidentLongitude !== undefined &&
      incidentLongitude !== null &&
      (typeof incidentLongitude !== "number" ||
        !Number.isFinite(incidentLongitude) ||
        incidentLongitude < -180 ||
        incidentLongitude > 180)
    ) {
      res.status(400).json({ error: "incidentLongitude must be between -180 and 180" });
      return;
    }
    // Evidence is a jsonb array of { type, url, description? } — cap the
    // array size and validate each entry's shape so a malformed client
    // can't poison the admin complaint drawer.
    let evidenceValue: { type: string; url: string; description?: string }[] | null = null;
    if (evidence !== undefined && evidence !== null) {
      if (!Array.isArray(evidence)) {
        res.status(400).json({ error: "evidence must be an array" });
        return;
      }
      if (evidence.length > MAX_COMPLAINT_EVIDENCE) {
        res.status(400).json({
          error: `Max ${MAX_COMPLAINT_EVIDENCE} evidence items per complaint`,
        });
        return;
      }
      if (
        evidence.some(
          (e: any) =>
            !e ||
            typeof e.type !== "string" ||
            typeof e.url !== "string" ||
            (e.description !== undefined && typeof e.description !== "string"),
        )
      ) {
        res.status(400).json({
          error: "Each evidence item needs a string type and url",
        });
        return;
      }
      evidenceValue = evidence;
    }

    const [complaint] = await db.insert(complaints).values({
      userId: req.user!.userId,
      taxiPlateNumber: taxiPlateNumber || null,
      category,
      severity: severity || "medium",
      description: description.trim(),
      incidentDate: incidentDate ? new Date(incidentDate) : null,
      incidentLocation: incidentLocation || null,
      incidentLatitude: incidentLatitude ?? null,
      incidentLongitude: incidentLongitude ?? null,
      routeName: routeName || null,
      evidence: evidenceValue,
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

// ============ TRIP RATINGS ============

// POST /api/ratings/trip — commuter-facing trip rating.
//
// The RatingScreen in mobile collects driver + rank stars plus plate number
// and free-text context. The existing `/api/drivers/rate` endpoint wants a
// canonical driverId (UUID), which the commuter doesn't have. This endpoint
// bridges the two worlds: we accept a plate number, best-effort resolve it
// to an active driver via the taxi_drivers join, and if we find one we
// insert into `driver_ratings` and refresh the driver's cached avg. If we
// can't resolve (unregistered plate, no active driver), we still return 200
// so the commuter's feedback isn't lost — it's logged server-side for the
// Taxi Association to review.
//
// Rank rating lives in the review text for v1 (no rank_ratings table yet;
// adding one is a post-launch schema change).
router.post("/ratings/trip", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const {
      plateNumber,
      driverRating,
      rankRating,
      driverName,
      location,
      review,
      mediaUrls,
    } = req.body as {
      plateNumber?: string;
      driverRating?: number;
      rankRating?: number;
      driverName?: string;
      location?: string;
      review?: string;
      mediaUrls?: string[];
    };

    if (!plateNumber || typeof plateNumber !== "string") {
      res.status(400).json({ error: "Plate number is required" });
      return;
    }
    if (!driverRating || driverRating < 1 || driverRating > 5) {
      res.status(400).json({ error: "Driver rating must be between 1 and 5" });
      return;
    }
    if (!rankRating || rankRating < 1 || rankRating > 5) {
      res.status(400).json({ error: "Rank rating must be between 1 and 5" });
      return;
    }

    const normalizedPlate = plateNumber.toUpperCase().replace(/\s+/g, "");

    // Fold rank rating + free-text context into a single review string so
    // nothing is lost even when we don't have a driver to attach it to.
    const contextParts: string[] = [`[Rank ${rankRating}/5]`];
    if (driverName?.trim()) contextParts.push(`driver: ${driverName.trim()}`);
    if (location?.trim()) contextParts.push(`location: ${location.trim()}`);
    if (review?.trim()) contextParts.push(review.trim());
    const enrichedReview = contextParts.join(" · ");

    // Try to resolve plate → taxi → active driver. Uppercase match against
    // the stored plate_number (which we also uppercase-normalize on insert
    // in the onboarding flow, but legacy rows may not be normalized — so
    // match on a case-insensitive comparison instead of a direct equal).
    const [taxiRow] = await db
      .select({ id: taxis.id })
      .from(taxis)
      .where(sql`UPPER(REPLACE(${taxis.plateNumber}, ' ', '')) = ${normalizedPlate}`)
      .limit(1);

    let linkedDriverId: string | null = null;
    if (taxiRow) {
      const [driverLink] = await db
        .select({ driverId: taxiDrivers.driverId })
        .from(taxiDrivers)
        .where(
          and(
            eq(taxiDrivers.taxiId, taxiRow.id),
            eq(taxiDrivers.isActive, true),
          ),
        )
        .limit(1);
      if (driverLink) linkedDriverId = driverLink.driverId;
    }

    // Normalize + cap media URLs. Drop anything that doesn't look like a
    // URL to prevent junk rows, and cap at 6 to match what the client UI
    // can realistically attach without freezing the submit flow.
    const safeMedia = Array.isArray(mediaUrls)
      ? mediaUrls
          .filter((u): u is string => typeof u === "string" && /^https?:\/\/|^\//.test(u))
          .slice(0, 6)
      : [];

    if (linkedDriverId) {
      await db.insert(driverRatings).values({
        driverId: linkedDriverId,
        userId: req.user!.userId,
        rating: driverRating,
        review: enrichedReview,
        mediaUrls: safeMedia,
      });

      // Refresh the driver's cached average — same pattern as drivers.ts.
      const [stats] = await db
        .select({
          avgRating: avg(driverRatings.rating),
          total: count(),
        })
        .from(driverRatings)
        .where(eq(driverRatings.driverId, linkedDriverId));

      await db
        .update(driverProfiles)
        .set({
          safetyRating: Number(stats.avgRating) || 5,
          totalRatings: stats.total,
        })
        .where(eq(driverProfiles.userId, linkedDriverId));
    } else {
      // No matching driver — surface to server logs so the Taxi Association
      // can still mine feedback on unregistered plates during the launch
      // window. Post-launch this should write to a dedicated unlinked-ratings
      // table for proper moderation.
      const mediaSuffix = safeMedia.length ? ` · media=${safeMedia.join(",")}` : "";
      console.info(
        `[trip-rating] unlinked feedback from user ${req.user!.userId} for plate ${normalizedPlate}: ${enrichedReview}${mediaSuffix}`,
      );
    }

    res.json({ submitted: true, linkedToDriver: Boolean(linkedDriverId) });
  } catch (error: any) {
    console.error("Submit trip rating error:", error);
    res.status(500).json({ error: "Failed to submit rating" });
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

// GET /api/jobs/:id - Get a single job listing (public)
router.get("/jobs/:id", async (req, res: Response) => {
  try {
    const result = await db.select().from(jobs).where(eq(jobs.id, req.params.id)).limit(1);
    if (result.length === 0) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    // Best-effort view counter — non-fatal if it errors.
    db.update(jobs)
      .set({ viewCount: sql`${jobs.viewCount} + 1` })
      .where(eq(jobs.id, req.params.id))
      .catch((err) => console.warn("Job view increment failed:", err));
    res.json(result[0]);
  } catch (error: any) {
    console.error("Get job error:", error);
    res.status(500).json({ error: "Failed to fetch job" });
  }
});

// Length caps on public-facing job listings — reactive moderation model
// means these render immediately on app.haibo.africa/jobs, so the
// validation layer is what protects the feed from DoS and junk content.
const MAX_JOB_TITLE = 200;
const MAX_JOB_COMPANY = 150;
const MAX_JOB_DESCRIPTION = 5000;
const MAX_JOB_REQUIREMENTS = 3000;
const MAX_JOB_LOCATION = 200;
const MAX_JOB_SALARY_STR = 100;
const MAX_JOB_BENEFITS = 2000;

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

    // String length caps on free-text fields.
    const stringField = (value: unknown, max: number, label: string) => {
      if (typeof value !== "string" || value.length === 0) {
        return `${label} must be a non-empty string`;
      }
      if (value.length > max) {
        return `${label} must be ≤ ${max} characters`;
      }
      return null;
    };
    for (const [v, max, label] of [
      [title, MAX_JOB_TITLE, "Title"],
      [company, MAX_JOB_COMPANY, "Company"],
      [description, MAX_JOB_DESCRIPTION, "Description"],
      [location, MAX_JOB_LOCATION, "Location"],
    ] as const) {
      const err = stringField(v, max, label);
      if (err) {
        res.status(400).json({ error: err });
        return;
      }
    }
    // Optional text fields — only check when provided.
    for (const [v, max, label] of [
      [requirements, MAX_JOB_REQUIREMENTS, "Requirements"],
      [salary, MAX_JOB_SALARY_STR, "Salary"],
      [benefits, MAX_JOB_BENEFITS, "Benefits"],
    ] as const) {
      if (v !== undefined && v !== null && (typeof v !== "string" || v.length > max)) {
        res.status(400).json({ error: `${label} must be ≤ ${max} characters` });
        return;
      }
    }

    // Salary range must be non-negative finite numbers when provided.
    for (const [v, label] of [
      [salaryMin, "salaryMin"],
      [salaryMax, "salaryMax"],
    ] as const) {
      if (
        v !== undefined && v !== null &&
        (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 10_000_000)
      ) {
        res.status(400).json({ error: `${label} must be a non-negative number` });
        return;
      }
    }
    if (
      typeof salaryMin === "number" &&
      typeof salaryMax === "number" &&
      salaryMin > salaryMax
    ) {
      res.status(400).json({ error: "salaryMin cannot exceed salaryMax" });
      return;
    }

    // Application deadline must parse cleanly if supplied.
    let deadline: Date | null = null;
    if (applicationDeadline) {
      const d = new Date(applicationDeadline);
      if (Number.isNaN(d.getTime())) {
        res.status(400).json({ error: "applicationDeadline must be a valid ISO date" });
        return;
      }
      deadline = d;
    }

    const [job] = await db.insert(jobs).values({
      title: title.trim(),
      company: company.trim(),
      description: description.trim(),
      requirements: requirements || null,
      jobType: jobType || "full-time",
      category: category || "driver",
      location: location.trim(),
      province: province || null,
      salary: salary || null,
      salaryMin: salaryMin ?? null,
      salaryMax: salaryMax ?? null,
      contactPhone: contactPhone || null,
      contactEmail: contactEmail || null,
      contactWhatsapp: contactWhatsapp || null,
      experienceLevel: experienceLevel || "entry",
      licenseRequired: licenseRequired || null,
      benefits: benefits || null,
      applicationDeadline: deadline,
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

// Lost & found posters supply a contact phone so claimants can reach
// them, and that phone is PII. We want the public listing (what users
// browse to find their lost phone) to stay accessible, but don't want
// the API to serve as a phone-number scraping endpoint for unauth'd
// callers. Redact contact fields unless the caller is authenticated.
function redactLostFoundForList(item: typeof lostFoundItems.$inferSelect) {
  const { contactPhone: _phone, contactName: _name, ...safe } = item;
  return safe;
}

const LOST_FOUND_TYPES = new Set(["lost", "found"]);

// GET /api/lost-found - List lost & found items (public, phone redacted)
router.get("/lost-found", optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const { type } = req.query as { type?: string };

    // Always include the status=active filter; layer type on top when set.
    // Share the filter between the rows and count queries so pagination
    // totals match the rendered list (the old code counted the whole
    // table and the mobile UI would show "47 items" above 3 rows).
    const filter = type
      ? and(eq(lostFoundItems.status, "active"), eq(lostFoundItems.type, type))
      : eq(lostFoundItems.status, "active");

    const results = await db
      .select()
      .from(lostFoundItems)
      .where(filter)
      .orderBy(desc(lostFoundItems.createdAt))
      .limit(limit)
      .offset(offset);

    const [totalResult] = await db
      .select({ count: count() })
      .from(lostFoundItems)
      .where(filter);

    const data = req.user
      ? results
      : results.map(redactLostFoundForList);

    res.json({
      data,
      pagination: paginationResponse(totalResult.count, { page, limit, offset }),
    });
  } catch (error: any) {
    console.error("Get lost-found error:", error);
    res.status(500).json({ error: "Failed to fetch items" });
  }
});

// GET /api/lost-found/:id - Fetch a single lost/found item.
// Returns the raw schema plus a `contactInfo` alias for the Details screen
// (which has a single contact field rather than name+phone). Contact
// fields are gated behind authMiddleware so the API can't be scraped
// for phone numbers by random crawlers — claimants still need to log
// in (which costs at least one OTP send) before seeing poster contact.
router.get("/lost-found/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
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

    // Type allowlist — schema takes any string but the mobile filter UI
    // only knows "lost" / "found". Reject unknown values so a malformed
    // client can't post items that show up in neither filter tab.
    const resolvedType = type || "lost";
    if (!LOST_FOUND_TYPES.has(resolvedType)) {
      res.status(400).json({ error: "type must be 'lost' or 'found'" });
      return;
    }

    // Length caps on every free-text field so the public listing read
    // path stays bounded regardless of how long a post someone writes.
    const strField = (v: unknown, max: number, label: string) => {
      if (typeof v !== "string" || v.trim().length === 0) {
        return `${label} must be a non-empty string`;
      }
      if (v.length > max) return `${label} must be ≤ ${max} characters`;
      return null;
    };
    for (const [v, max, label] of [
      [title, 150, "title"],
      [description, 2000, "description"],
      [contactPhone, 20, "contactPhone"],
      [contactName, 100, "contactName"],
      [category, 50, "category"],
    ] as const) {
      const err = strField(v, max, label);
      if (err) {
        res.status(400).json({ error: err });
        return;
      }
    }
    if (routeOrigin !== undefined && routeOrigin !== null &&
        (typeof routeOrigin !== "string" || routeOrigin.length > 150)) {
      res.status(400).json({ error: "routeOrigin must be ≤ 150 characters" });
      return;
    }
    if (routeDestination !== undefined && routeDestination !== null &&
        (typeof routeDestination !== "string" || routeDestination.length > 150)) {
      res.status(400).json({ error: "routeDestination must be ≤ 150 characters" });
      return;
    }
    if (reward !== undefined && reward !== null &&
        (typeof reward !== "string" || reward.length > 100)) {
      res.status(400).json({ error: "reward must be a short string (≤ 100 characters)" });
      return;
    }

    // Image URL (if provided) must be an https:// or local /uploads/
    // path. Same gate as vendor / driver KYC images.
    if (imageUrl !== undefined && imageUrl !== null) {
      if (
        typeof imageUrl !== "string" || imageUrl.length > 500 ||
        !(/^https:\/\//i.test(imageUrl) || imageUrl.startsWith("/uploads/"))
      ) {
        res.status(400).json({
          error: "imageUrl must be an https:// URL or a Haibo upload path",
        });
        return;
      }
    }

    // dateLost must parse cleanly if provided.
    let dateLostParsed: Date | null = null;
    if (dateLost) {
      const d = new Date(dateLost);
      if (Number.isNaN(d.getTime())) {
        res.status(400).json({ error: "dateLost must be a valid ISO date" });
        return;
      }
      dateLostParsed = d;
    }

    const [item] = await db.insert(lostFoundItems).values({
      type: resolvedType,
      category: category.trim(),
      title: title.trim(),
      description: description.trim(),
      imageUrl: imageUrl || null,
      routeOrigin: routeOrigin || null,
      routeDestination: routeDestination || null,
      dateLost: dateLostParsed,
      contactPhone: contactPhone.trim(),
      contactName: contactName.trim(),
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
    const shareBase = process.env.REFERRAL_SHARE_BASE_URL || "https://app.haibo.africa/r";
    res.json({
      referralCode: row.code,
      shareLink: `${shareBase}/${row.code}`,
    });
  } catch (error: any) {
    console.error("Get referral code error:", error);
    res.status(500).json({ error: "Failed to get referral code" });
  }
});

// GET /api/referral/code/:deviceId/qr.png — Scannable QR for the user's
// referral link. Public (deviceId is already a semi-public hash — same
// privacy footprint as /code/:deviceId). Encodes the share URL so a
// recipient scanning with their phone's camera lands straight on the
// invite screen with the code pre-filled.
router.get("/referral/code/:deviceId/qr.png", async (req, res: Response) => {
  try {
    const row = await getOrCreateReferralCode(req.params.deviceId);
    const shareBase =
      process.env.REFERRAL_SHARE_BASE_URL || "https://app.haibo.africa/r";
    const url = `${shareBase.replace(/\/$/, "")}/${encodeURIComponent(row.code)}`;

    const png = await QRCode.toBuffer(url, {
      type: "png",
      errorCorrectionLevel: "M",
      width: 512,
      margin: 2,
      color: {
        // Fuchsia accent — distinguishes referral QRs from vendor (rose)
        // and driver (rose) QRs at a glance when printed side-by-side.
        dark: "#C026D3",
        light: "#FFFFFF",
      },
    });

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(png);
  } catch (error: any) {
    console.error("Referral QR error:", error);
    res.status(500).json({ error: "Failed to generate QR" });
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

// POST /api/referral/apply — New user applies a referral code they received
// from a friend. Links the new device as a signup under the referrer's code.
router.post("/referral/apply", async (req, res: Response) => {
  try {
    const { referralCode, referredDeviceId } = req.body as {
      referralCode?: string;
      referredDeviceId?: string;
    };

    if (!referralCode || !referredDeviceId) {
      res.status(400).json({ error: "referralCode and referredDeviceId are required" });
      return;
    }

    // Look up the referral code to find the referrer's device.
    const [codeRow] = await db
      .select()
      .from(referralCodes)
      .where(eq(referralCodes.code, referralCode.toUpperCase()))
      .limit(1);

    if (!codeRow) {
      res.status(404).json({ error: "Invalid referral code" });
      return;
    }

    // Prevent self-referral.
    if (codeRow.deviceId === referredDeviceId) {
      res.status(400).json({ error: "Cannot use your own referral code" });
      return;
    }

    // Check duplicate — each device can only be referred once.
    const [existing] = await db
      .select()
      .from(referralSignups)
      .where(eq(referralSignups.referredDeviceId, referredDeviceId))
      .limit(1);

    if (existing) {
      // Already referred — silently succeed so the client doesn't show an error
      // on re-submit (e.g. app killed mid-setup and user retries).
      res.json({ applied: true, alreadyReferred: true });
      return;
    }

    await db.insert(referralSignups).values({
      referrerDeviceId: codeRow.deviceId,
      referredDeviceId,
      referralCode: codeRow.code,
      status: "signed_up",
    });

    res.status(201).json({ applied: true, alreadyReferred: false });
  } catch (error: any) {
    console.error("Apply referral error:", error);
    res.status(500).json({ error: "Failed to apply referral code" });
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
