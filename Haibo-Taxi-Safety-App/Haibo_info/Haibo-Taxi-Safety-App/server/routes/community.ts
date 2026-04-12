import { Router } from "express";
import { eq, sql, desc } from "drizzle-orm";
import * as schema from "../../shared/schema";

export function communityRoutes(db: any) {
  const router = Router();

  // Get community posts (replaces AsyncStorage mock)
  router.get("/posts", async (req, res) => {
    try {
      const { category, limit: limitParam } = req.query;
      const limit = parseInt(limitParam as string) || 20;

      const posts = await db.select().from(schema.reels)
        .where(eq(schema.reels.status, "published"))
        .orderBy(desc(schema.reels.createdAt))
        .limit(limit);

      res.json(posts);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch posts", message: error.message });
    }
  });

  // Create a community post
  router.post("/posts", async (req, res) => {
    try {
      const { userId, userName, caption, mediaUrl, category, locationName, hashtags } = req.body;

      if (!userId || !caption) {
        return res.status(400).json({ error: "userId and caption are required" });
      }

      const [post] = await db.insert(schema.reels).values({
        userId,
        userName: userName || "Anonymous",
        contentType: mediaUrl ? "photo" : "text",
        mediaUrl: mediaUrl || "",
        caption,
        category: category || "community",
        locationName: locationName || null,
        hashtags: hashtags || [],
        status: "published",
      }).returning();

      res.status(201).json(post);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create post", message: error.message });
    }
  });

  // Like a post
  router.post("/posts/:postId/like", async (req, res) => {
    try {
      const { postId } = req.params;
      const { userId } = req.body;

      // Check if already liked
      const [existing] = await db.select().from(schema.reelLikes)
        .where(eq(schema.reelLikes.reelId, postId))
        .limit(1);

      if (existing) {
        // Unlike
        await db.delete(schema.reelLikes).where(eq(schema.reelLikes.id, existing.id));
        await db.update(schema.reels).set({
          likeCount: sql`like_count - 1`,
        }).where(eq(schema.reels.id, postId));
        return res.json({ liked: false });
      }

      // Like
      await db.insert(schema.reelLikes).values({ reelId: postId, userId });
      await db.update(schema.reels).set({
        likeCount: sql`like_count + 1`,
      }).where(eq(schema.reels.id, postId));

      res.json({ liked: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to toggle like", message: error.message });
    }
  });

  // Comment on a post
  router.post("/posts/:postId/comment", async (req, res) => {
    try {
      const { postId } = req.params;
      const { userId, userName, content } = req.body;

      if (!content) {
        return res.status(400).json({ error: "Comment content is required" });
      }

      const [comment] = await db.insert(schema.reelComments).values({
        reelId: postId,
        userId,
        userName: userName || "Anonymous",
        content,
      }).returning();

      // Increment comment count
      await db.update(schema.reels).set({
        commentCount: sql`comment_count + 1`,
      }).where(eq(schema.reels.id, postId));

      res.status(201).json(comment);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to add comment", message: error.message });
    }
  });

  // Get comments for a post
  router.get("/posts/:postId/comments", async (req, res) => {
    try {
      const { postId } = req.params;

      const comments = await db.select().from(schema.reelComments)
        .where(eq(schema.reelComments.reelId, postId))
        .orderBy(desc(schema.reelComments.createdAt));

      res.json(comments);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch comments", message: error.message });
    }
  });

  // Lost & Found endpoints
  router.get("/lost-found", async (req, res) => {
    try {
      const items = await db.select().from(schema.lostFoundItems)
        .where(eq(schema.lostFoundItems.status, "active"))
        .orderBy(desc(schema.lostFoundItems.createdAt))
        .limit(50);

      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch lost & found items", message: error.message });
    }
  });

  router.post("/lost-found", async (req, res) => {
    try {
      const [item] = await db.insert(schema.lostFoundItems).values(req.body).returning();
      res.status(201).json(item);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to post item", message: error.message });
    }
  });

  return router;
}
