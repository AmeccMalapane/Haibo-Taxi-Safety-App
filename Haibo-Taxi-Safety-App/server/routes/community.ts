import { Router, Response } from "express";
import { db } from "../db";
import { reels, reelLikes, reelComments } from "../../shared/schema";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { authMiddleware, optionalAuth, AuthRequest, publicUserLabel } from "../middleware/auth";
import { parsePagination, paginationResponse } from "../utils/helpers";

const router = Router();

// GET /api/community/posts - List community posts/reels (public social wall)
router.get("/posts", optionalAuth, async (req: AuthRequest, res: Response) => {
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
// Per-field caps — the global express.json() limit is 10 MB but any
// single caption or location name at that size would DoS the feed read
// path. Cap caption at 2000 chars (enough for a long post, refuses
// wall-of-text abuse) and hashtags at 30 entries of 50 chars each.
const MAX_CAPTION = 2000;
const MAX_HASHTAGS = 30;
const MAX_HASHTAG_LENGTH = 50;
const MAX_NAME = 200;

router.post("/posts", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const {
      contentType, mediaUrl, thumbnailUrl, duration,
      caption, hashtags, locationName, locationId, category,
    } = req.body;

    if (typeof caption === "string" && caption.length > MAX_CAPTION) {
      res.status(400).json({
        error: `Caption must be ${MAX_CAPTION} characters or fewer`,
      });
      return;
    }
    if (typeof locationName === "string" && locationName.length > MAX_NAME) {
      res.status(400).json({ error: "Location name is too long" });
      return;
    }
    if (hashtags !== undefined) {
      if (!Array.isArray(hashtags)) {
        res.status(400).json({ error: "Hashtags must be an array" });
        return;
      }
      if (hashtags.length > MAX_HASHTAGS) {
        res
          .status(400)
          .json({ error: `Max ${MAX_HASHTAGS} hashtags per post` });
        return;
      }
      if (
        hashtags.some(
          (h) => typeof h !== "string" || h.length > MAX_HASHTAG_LENGTH,
        )
      ) {
        res.status(400).json({
          error: `Each hashtag must be a string ≤ ${MAX_HASHTAG_LENGTH} characters`,
        });
        return;
      }
    }

    const [post] = await db.insert(reels).values({
      userId: req.user!.userId,
      userName: publicUserLabel(req.user),
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
router.get("/posts/:id", optionalAuth, async (req: AuthRequest, res: Response) => {
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
// Same class of race as location votes — SELECT then INSERT/DELETE
// lets two concurrent likes from the same user both pass the existence
// check and either double-like (2 rows + counter+=2) or double-unlike
// (counter underflows, saved only by GREATEST clamp). Wrapped in a
// transaction with a row-level lock so the existence check and the
// mutation are atomic.
const MAX_COMMENT_CONTENT = 1000;

router.post("/posts/:id/like", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const reelId = req.params.id;
    const userId = req.user!.userId;

    let liked = false;
    await db.transaction(async (tx) => {
      // Lock the reel row so concurrent likes from the same user serialize.
      // (Can't FOR UPDATE a row that may not be the target of a later
      // UPDATE cleanly on pg, but locking reels.id is enough here since
      // every path in this handler updates that row.)
      const [existing] = await tx
        .select({ id: reelLikes.id })
        .from(reelLikes)
        .where(
          and(eq(reelLikes.reelId, reelId), eq(reelLikes.userId, userId)),
        )
        .limit(1);

      if (existing) {
        await tx.delete(reelLikes).where(eq(reelLikes.id, existing.id));
        await tx
          .update(reels)
          .set({ likeCount: sql`GREATEST(${reels.likeCount} - 1, 0)` })
          .where(eq(reels.id, reelId));
        liked = false;
      } else {
        await tx.insert(reelLikes).values({ reelId, userId });
        await tx
          .update(reels)
          .set({ likeCount: sql`${reels.likeCount} + 1` })
          .where(eq(reels.id, reelId));
        liked = true;
      }
    });

    res.json({ liked });
  } catch (error: any) {
    console.error("Like error:", error);
    res.status(500).json({ error: "Failed to toggle like" });
  }
});

// GET /api/community/posts/:id/comments - List comments for a post
// Ordered newest-first, paginated via ?limit=&offset=. Returns flat array
// — nesting (parentId) is preserved on each row for the client to thread.
router.get("/posts/:id/comments", optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const params = parsePagination(req.query);

    const rows = await db
      .select()
      .from(reelComments)
      .where(eq(reelComments.reelId, req.params.id))
      .orderBy(desc(reelComments.createdAt))
      .limit(params.limit)
      .offset(params.offset);

    const [{ total }] = await db
      .select({ total: count() })
      .from(reelComments)
      .where(eq(reelComments.reelId, req.params.id));

    res.json({ data: rows, ...paginationResponse(Number(total), params) });
  } catch (error: any) {
    console.error("List comments error:", error);
    res.status(500).json({ error: "Failed to load comments" });
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
    if (typeof content !== "string" || content.trim().length === 0) {
      res.status(400).json({ error: "Comment content must be a non-empty string" });
      return;
    }
    if (content.length > MAX_COMMENT_CONTENT) {
      res.status(400).json({
        error: `Comment must be ≤ ${MAX_COMMENT_CONTENT} characters`,
      });
      return;
    }
    if (parentId !== undefined && parentId !== null &&
        (typeof parentId !== "string" || parentId.length > 64)) {
      res.status(400).json({ error: "parentId must be a short string id" });
      return;
    }

    // Verify the parent reel exists before inserting. Without this the
    // comment can land in an orphan state that neither surfaces in the
    // feed nor triggers the count increment meaningfully.
    const [parentReel] = await db
      .select({ id: reels.id })
      .from(reels)
      .where(eq(reels.id, req.params.id))
      .limit(1);
    if (!parentReel) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    const [comment] = await db.insert(reelComments).values({
      reelId: req.params.id,
      userId: req.user!.userId,
      userName: publicUserLabel(req.user),
      content: content.trim(),
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
