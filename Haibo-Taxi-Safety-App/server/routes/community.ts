import { Router, Response } from "express";
import { db } from "../db";
import { reels, reelLikes, reelComments } from "../../shared/schema";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { authMiddleware, optionalAuth, AuthRequest } from "../middleware/auth";
import { parsePagination, paginationResponse } from "../utils/helpers";

const router = Router();

// GET /api/community/posts - List community posts/reels
router.get("/posts", async (req, res: Response) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const { category } = req.query as any;

    let results;
    if (category) {
      results = await db.select().from(reels)
        .where(and(eq(reels.status, "published"), eq(reels.category, category)))
        .orderBy(desc(reels.createdAt))
        .limit(limit).offset(offset);
    } else {
      results = await db.select().from(reels)
        .where(eq(reels.status, "published"))
        .orderBy(desc(reels.createdAt))
        .limit(limit).offset(offset);
    }

    const [totalResult] = await db.select({ count: count() }).from(reels).where(eq(reels.status, "published"));

    res.json({
      data: results,
      pagination: paginationResponse(totalResult.count, { page, limit, offset }),
    });
  } catch (error: any) {
    console.error("Get posts error:", error);
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

// POST /api/community/posts - Create a community post
router.post("/posts", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const {
      contentType, mediaUrl, thumbnailUrl, duration,
      caption, hashtags, locationName, locationId, category,
    } = req.body;

    const [post] = await db.insert(reels).values({
      userId: req.user!.userId,
      userName: req.user!.phone, // Will be replaced with display name
      contentType: contentType || "photo",
      mediaUrl: mediaUrl || "",
      thumbnailUrl: thumbnailUrl || null,
      duration: duration || null,
      caption: caption || null,
      hashtags: hashtags || [],
      locationName: locationName || null,
      locationId: locationId || null,
      category: category || "community",
      status: "published",
    }).returning();

    res.status(201).json(post);
  } catch (error: any) {
    console.error("Create post error:", error);
    res.status(500).json({ error: "Failed to create post" });
  }
});

// GET /api/community/posts/:id - Get a single post
router.get("/posts/:id", async (req, res: Response) => {
  try {
    const result = await db.select().from(reels).where(eq(reels.id, req.params.id)).limit(1);
    if (result.length === 0) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    // Increment view count
    await db.update(reels)
      .set({ viewCount: sql`${reels.viewCount} + 1` })
      .where(eq(reels.id, req.params.id));

    const comments = await db.select().from(reelComments)
      .where(eq(reelComments.reelId, req.params.id))
      .orderBy(desc(reelComments.createdAt))
      .limit(50);

    res.json({ ...result[0], comments });
  } catch (error: any) {
    console.error("Get post error:", error);
    res.status(500).json({ error: "Failed to fetch post" });
  }
});

// POST /api/community/posts/:id/like - Like a post
router.post("/posts/:id/like", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Check if already liked
    const existing = await db.select().from(reelLikes)
      .where(and(eq(reelLikes.reelId, req.params.id), eq(reelLikes.userId, req.user!.userId)))
      .limit(1);

    if (existing.length > 0) {
      // Unlike
      await db.delete(reelLikes).where(eq(reelLikes.id, existing[0].id));
      await db.update(reels)
        .set({ likeCount: sql`GREATEST(${reels.likeCount} - 1, 0)` })
        .where(eq(reels.id, req.params.id));
      res.json({ liked: false });
    } else {
      // Like
      await db.insert(reelLikes).values({
        reelId: req.params.id,
        userId: req.user!.userId,
      });
      await db.update(reels)
        .set({ likeCount: sql`${reels.likeCount} + 1` })
        .where(eq(reels.id, req.params.id));
      res.json({ liked: true });
    }
  } catch (error: any) {
    console.error("Like error:", error);
    res.status(500).json({ error: "Failed to toggle like" });
  }
});

// POST /api/community/posts/:id/comment - Comment on a post
router.post("/posts/:id/comment", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { content, parentId } = req.body;

    if (!content) {
      res.status(400).json({ error: "Comment content is required" });
      return;
    }

    const [comment] = await db.insert(reelComments).values({
      reelId: req.params.id,
      userId: req.user!.userId,
      userName: req.user!.phone,
      content,
      parentId: parentId || null,
    }).returning();

    // Update comment count
    await db.update(reels)
      .set({ commentCount: sql`${reels.commentCount} + 1` })
      .where(eq(reels.id, req.params.id));

    res.status(201).json(comment);
  } catch (error: any) {
    console.error("Comment error:", error);
    res.status(500).json({ error: "Failed to add comment" });
  }
});

export default router;
