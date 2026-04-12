# Haibo App: Automation & Maintenance Plan for Community Feed

To keep the Haibo app's community feed fresh with data from the Facebook group, we have set up an automatic daily synchronization.

## 1. Execution Environment
### Option A: GitHub Actions (Recommended)
The workflow file is located at `.github/workflows/fb-community-sync.yml`.
- **Schedule:** Daily at midnight (`0 0 * * *`).
- **Steps:**
  1. Checkout repository.
  2. Setup Python & Playwright.
  3. Run `scripts/fb-sync/fb_scraper.py`.
  4. Run `scripts/fb-sync/ingest.ts` using `tsx`.
- **Requirements:** 
  - Set `DATABASE_URL` in GitHub Repository Secrets.
  - Set `FB_COOKIES` in GitHub Repository Secrets (optional but recommended to avoid login walls).

### Option B: Local Server / VPS (Alternative)
A shell script is provided at `scripts/fb-sync/sync_daily.sh`.
- **Setup:** Add to your crontab.
```bash
0 0 * * * /bin/bash /path/to/haibo-app/scripts/fb-sync/sync_daily.sh
```

## 2. Maintenance & Monitoring
- **Selector Updates:** Facebook changes its DOM frequently. If the scraper stops finding posts, update the CSS selectors in `fb_scraper.py`.
- **Rate Limiting:** To avoid IP bans, we recommend using a proxy service if you increase the frequency beyond daily sync.
- **Data Quality:** The current script marks posts as `status: 'published'`. You can change this to `pending_review` in `ingest.ts` if you want to moderate the feed.

## 3. Scaling
As the app grows, consider moving from a custom scraper to a professional service like **Apify**. This will provide:
- Managed infrastructure and automatic CAPTCHA handling.
- Webhook support to push data directly to your backend API.

## 4. Legal & Ethical Considerations
- **Public Data:** Only scrape data from the "Public" section of the group.
- **Privacy:** Consider anonymizing user names if required by local privacy laws (POPIA in South Africa).
- **Attribution:** The script automatically attributes posts to their original authors with a "Facebook Community" source.
