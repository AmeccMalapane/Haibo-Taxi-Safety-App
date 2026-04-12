import { Router } from "express";
import { eq, sql, desc } from "drizzle-orm";
import * as schema from "../../shared/schema";

export function jobRoutes(db: any) {
  const router = Router();

  // Get jobs
  router.get("/", async (req, res) => {
    try {
      const { category, province, featured } = req.query;

      let jobs = await db.select().from(schema.jobs)
        .where(eq(schema.jobs.status, "active"))
        .orderBy(desc(schema.jobs.createdAt))
        .limit(50);

      if (category && category !== "all") {
        jobs = jobs.filter((j: any) => j.category === category);
      }
      if (province) {
        jobs = jobs.filter((j: any) => j.province === province);
      }
      if (featured === "true") {
        jobs = jobs.filter((j: any) => j.isFeatured);
      }

      res.json(jobs);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch jobs", message: error.message });
    }
  });

  // Get job by ID
  router.get("/:id", async (req, res) => {
    try {
      const [job] = await db.select().from(schema.jobs)
        .where(eq(schema.jobs.id, req.params.id))
        .limit(1);

      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Increment view count
      await db.update(schema.jobs).set({
        viewCount: sql`view_count + 1`,
      }).where(eq(schema.jobs.id, req.params.id));

      res.json(job);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch job", message: error.message });
    }
  });

  // Post a job
  router.post("/", async (req, res) => {
    try {
      const [job] = await db.insert(schema.jobs).values(req.body).returning();
      res.status(201).json(job);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to post job", message: error.message });
    }
  });

  // Apply for a job
  router.post("/:id/apply", async (req, res) => {
    try {
      const { id } = req.params;

      const [application] = await db.insert(schema.jobApplications).values({
        jobId: id,
        ...req.body,
      }).returning();

      // Increment application count
      await db.update(schema.jobs).set({
        applicationCount: sql`application_count + 1`,
      }).where(eq(schema.jobs.id, id));

      res.status(201).json(application);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to apply", message: error.message });
    }
  });

  return router;
}
