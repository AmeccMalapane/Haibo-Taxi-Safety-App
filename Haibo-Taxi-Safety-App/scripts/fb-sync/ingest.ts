import { db } from "../../server/db";
import { reels, reelComments } from "../../shared/schema";
import { v4 as uuidv4 } from "uuid";
import * as fs from "fs";
import * as path from "path";

interface ScrapedPost {
  author: string;
  content: string;
  timestamp: string;
  source: string;
}

async function runIngestion() {
  const dataPath = path.join(__dirname, "scraped_posts.json");
  if (!fs.existsSync(dataPath)) {
    console.error("No scraped data found at", dataPath);
    return;
  }

  const rawData = fs.readFileSync(dataPath, "utf-8");
  const posts: ScrapedPost[] = JSON.parse(rawData);

  console.log(`Syncing ${posts.length} posts to database...`);

  for (const post of posts) {
    try {
      // Check for existing post to avoid duplicates
      // Using content hash or just exact content match for now
      const existing = await db.select().from(reels).where(eq(reels.caption, post.content)).limit(1);
      
      if (existing.length > 0) {
        console.log(`Skipping duplicate post from ${post.author}`);
        continue;
      }

      const reelId = uuidv4();
      
      // Insert into reels table (Community Feed)
      await db.insert(reels).values({
        id: reelId,
        userId: "system_fb_sync",
        userName: post.author,
        userAvatar: "https://ui-avatars.com/api/?name=" + encodeURIComponent(post.author),
        contentType: "text",
        mediaUrl: "none", // Placeholder for text-only posts
        caption: post.content,
        category: "community",
        status: "published",
        publishedAt: new Date(post.timestamp),
      });

      console.log(`Inserted post from ${post.author}`);
    } catch (error) {
      console.error(`Failed to ingest post from ${post.author}:`, error);
    }
  }

  console.log("Sync complete.");
}

// Helper for 'eq' if not imported
import { eq } from "drizzle-orm";

runIngestion().catch(console.error);
