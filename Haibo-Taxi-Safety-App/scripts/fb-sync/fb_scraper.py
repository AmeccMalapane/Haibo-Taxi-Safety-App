import asyncio
from playwright.async_api import async_playwright
import json
import datetime
import os

async def scrape_fb_group(group_url, num_scrolls=5, output_file='scraped_posts.json'):
    async with async_playwright() as p:
        print("Launching browser...")
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
        )
        page = await context.new_page()
        
        print(f"Navigating to {group_url}...")
        try:
            await page.goto(group_url, wait_until="networkidle", timeout=60000)
        except Exception as e:
            print(f"Error navigating to page: {e}")
            await browser.close()
            return []
        
        # Wait for posts to load
        try:
            await page.wait_for_selector('div[role="article"]', timeout=30000)
        except Exception as e:
            print(f"Could not find posts on the page. It might be a private group or requires login. Error: {e}")
            # Take a screenshot for debugging if possible
            await page.screenshot(path="fb_error.png")
            await browser.close()
            return []
        
        posts_data = []
        
        for i in range(num_scrolls):
            print(f"Scrolling {i+1}/{num_scrolls}...")
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await asyncio.sleep(3)
            
            # Extract posts visible in the viewport
            posts = await page.query_selector_all('div[role="article"]')
            print(f"Found {len(posts)} articles in this scroll.")
            
            for post in posts:
                try:
                    # Facebook's DOM is highly dynamic, trying multiple selector strategies
                    content = ""
                    # Strategy 1: Look for post message
                    text_elem = await post.query_selector('div[data-ad-preview="message"]')
                    if not text_elem:
                        # Strategy 2: Look for generic auto-dir text
                        text_elem = await post.query_selector('div[dir="auto"]')
                    
                    if text_elem:
                        content = await text_elem.inner_text()
                    
                    if not content:
                        continue

                    # Get author
                    author = "Anonymous"
                    author_elem = await post.query_selector('h2 span a')
                    if author_elem:
                        author = await author_elem.inner_text()
                    
                    # Simple deduplication
                    if content and not any(p['content'] == content for p in posts_data):
                        posts_data.append({
                            "author": author,
                            "content": content,
                            "timestamp": datetime.datetime.now().isoformat(),
                            "source": "Facebook Group"
                        })
                except Exception as e:
                    # print(f"Error parsing post: {e}")
                    continue

        await browser.close()
        
        # Save to file
        with open(output_file, 'w') as f:
            json.dump(posts_data, f, indent=2)
            
        print(f"Successfully scraped {len(posts_data)} unique posts.")
        return posts_data

if __name__ == "__main__":
    GROUP_URL = "https://www.facebook.com/groups/1034488700317989"
    # Ensure the directory exists
    current_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(current_dir, 'scraped_posts.json')
    asyncio.run(scrape_fb_group(GROUP_URL, output_file=output_path))
