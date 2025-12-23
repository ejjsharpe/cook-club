/**
 * Browser-based HTML Fetcher
 *
 * Uses Cloudflare Browser Rendering to fetch fully-rendered HTML
 * from JavaScript-heavy sites like Instagram, TikTok, etc.
 */

import puppeteer from "@cloudflare/puppeteer";

/**
 * Domains that require browser rendering due to heavy JavaScript usage
 */
const BROWSER_REQUIRED_DOMAINS = ["instagram.com", "tiktok.com"];

/**
 * Check if a URL requires browser rendering
 */
export function requiresBrowserRendering(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return BROWSER_REQUIRED_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}

/**
 * Fetch fully-rendered HTML using headless browser
 *
 * This is more expensive than a simple fetch, so only use for sites
 * that require JavaScript rendering.
 */
export async function fetchHtmlWithBrowser(
  browser: Fetcher,
  url: string,
): Promise<string> {
  const instance = await puppeteer.launch(browser);

  try {
    const page = await instance.newPage();

    // Set a mobile user agent (Instagram shows more content on mobile)
    await page.setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    );

    // Set viewport to mobile dimensions
    await page.setViewport({
      width: 390,
      height: 844,
      isMobile: true,
      hasTouch: true,
    });

    // Use domcontentloaded for faster loading - we don't need all resources
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });

    // Try to dismiss any login popups or modals (no extra sleep)
    try {
      const closeButton = await page.$('[aria-label="Close"]');
      if (closeButton) {
        await closeButton.click();
      }
    } catch {
      // Ignore errors from popup dismissal
    }

    // Get the fully rendered HTML
    const html = await page.content();

    return html;
  } finally {
    await instance.close();
  }
}

/**
 * Extract recipe content from Instagram page
 *
 * Uses desktop view where Instagram shows full captions in og:title meta tag.
 */
export async function extractInstagramContent(
  browser: Fetcher,
  url: string,
): Promise<{ html: string; caption: string | null; images: string[] }> {
  const instance = await puppeteer.launch(browser);

  try {
    const page = await instance.newPage();

    // Use desktop user agent - Instagram shows full captions on desktop view
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    );

    await page.setViewport({
      width: 1280,
      height: 800,
      isMobile: false,
      hasTouch: false,
    });

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });

    // Wait briefly for meta tags to be populated by JavaScript
    try {
      await page.waitForSelector('meta[property="og:title"]', {
        timeout: 3000,
      });
    } catch {
      // Continue anyway - we'll check what's available
    }

    // Extract caption from og:title (contains full caption on desktop)
    // Fall back to og:description if needed
    const caption = await page.evaluate(`
      (function() {
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle && ogTitle.content && ogTitle.content.length > 100) {
          return ogTitle.content;
        }

        const ogDesc = document.querySelector('meta[property="og:description"]');
        if (ogDesc && ogDesc.content) {
          return ogDesc.content;
        }

        return null;
      })()
    `);

    // Extract main post image (first high-quality image, skip profile pics)
    const images = (await page.evaluate(`
      (function() {
        const imgUrls = [];
        const seen = new Set();

        document.querySelectorAll("img").forEach(function(img) {
          const src = img.src;
          if (
            src &&
            !seen.has(src) &&
            !src.includes("s150x150") &&
            (src.includes("cdninstagram") || src.includes("fbcdn"))
          ) {
            seen.add(src);
            imgUrls.push(src);
          }
        });

        // Check for video poster images
        document.querySelectorAll("video").forEach(function(video) {
          const poster = video.poster;
          if (poster && !seen.has(poster)) {
            seen.add(poster);
            imgUrls.push(poster);
          }
        });

        return imgUrls;
      })()
    `)) as string[];

    const html = await page.content();

    return { html, caption: caption as string | null, images };
  } finally {
    await instance.close();
  }
}
