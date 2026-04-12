# Haibo App: Facebook Group Scraping & Data Integration Design

## 1. Objective
Automatically extract directions and taxi fare information from the Facebook group "[Where can I get a taxi to?](https://www.facebook.com/groups/1034488700317989)" and populate the Haibo app's community feed and QA forum.

## 2. Data Source Analysis
- **Target:** Public Facebook Group (110k+ members).
- **Content Type:** User posts (questions about directions/fares) and comments (answers/advice).
- **Frequency:** High-volume daily activity.

## 3. Scraping Strategy
Since the official Meta Groups API is restricted, we will use a hybrid approach:

### Option A: Browser Automation (Recommended for Prototype)
- **Tool:** Playwright or Selenium with Python.
- **Method:** 
  1. Navigate to the group's "Discussion" tab.
  2. Scroll to load recent posts.
  3. Extract post text, author, timestamp, and top-level comments.
  4. Use a headless browser with a dedicated "scraper" account to avoid personal account flags.

### Option B: 3rd Party Scraper APIs (Recommended for Production)
- **Tool:** Apify (Facebook Groups Scraper) or Bright Data.
- **Benefits:** Handles anti-scraping measures, provides structured JSON, and offers scheduled runs.

## 4. Data Mapping & Schema Integration
We will map the scraped data to the Haibo database schema defined in `shared/schema.ts`.

| Facebook Field | Haibo Table | Haibo Field | Transformation |
| :--- | :--- | :--- | :--- |
| Post Content | `events` or `reels` | `description` / `caption` | Map to community category |
| Post Author | `users` | `displayName` | Create "Shadow Users" or use a "FB Community" bot account |
| Post Timestamp | `events` | `createdAt` | Convert FB timestamp to ISO |
| Comment Content | `reel_comments` | `content` | Link to the created post |
| Comment Author | `reel_comments` | `userName` | |

### Database Integration Logic
1. **Deduplication:** Check if `fb_post_id` (stored in metadata) already exists before inserting.
2. **Categorization:** Use simple keyword matching (e.g., "how much", "fare", "rank") to tag posts.
3. **Verification:** Mark these posts with a "Facebook Community" badge in the UI.

## 5. Prototype Implementation Plan
1. **Script:** A Python script using `playwright` to scrape the first 20-50 posts.
2. **Processing:** Clean the text and extract potential fare/route info using regex or LLM.
3. **Ingestion:** A Node.js script or SQL migration to insert the data into the PostgreSQL database via Drizzle ORM.

## 6. Automation & Maintenance
- **Schedule:** Run the scraper every 6 hours via GitHub Actions or a Cron job.
- **Monitoring:** Log success/failure rates and monitor for Facebook layout changes.
