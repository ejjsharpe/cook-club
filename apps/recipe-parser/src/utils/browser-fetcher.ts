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
 * Sleep helper for waiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

    // Navigate to the page with a timeout
    await page.goto(url, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    // Wait a bit for any dynamic content to load
    await sleep(2000);

    // Try to dismiss any login popups or modals that might block content
    try {
      // Instagram-specific: close login modal if present
      const closeButton = await page.$('[aria-label="Close"]');
      if (closeButton) {
        await closeButton.click();
        await sleep(500);
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
 * Extract text content from Instagram page
 *
 * Instagram has specific DOM structure for captions and descriptions
 */
export async function extractInstagramContent(
  browser: Fetcher,
  url: string,
): Promise<{ html: string; caption: string | null; images: string[] }> {
  const instance = await puppeteer.launch(browser);

  try {
    const page = await instance.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    );

    await page.setViewport({
      width: 390,
      height: 844,
      isMobile: true,
      hasTouch: true,
    });

    await page.goto(url, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    await sleep(3000);

    // Try to dismiss login modal
    try {
      const closeButton = await page.$('[aria-label="Close"]');
      if (closeButton) {
        await closeButton.click();
        await sleep(500);
      }
    } catch {
      // Ignore
    }

    // Extract caption text using page.evaluate
    // Note: page.evaluate runs in browser context where document is available
    // We use Function constructor to avoid TypeScript complaining about browser globals
    const caption = await page.evaluate(`
      (function() {
        // First try meta tags
        const ogDesc = document.querySelector('meta[property="og:description"]');
        if (ogDesc && ogDesc.content) {
          return ogDesc.content;
        }

        const desc = document.querySelector('meta[name="description"]');
        if (desc && desc.content) {
          return desc.content;
        }

        // Try to find the main caption in the page
        const article = document.querySelector("article");
        if (article) {
          // Get all text spans that might contain the caption
          const spans = article.querySelectorAll("span");
          let longestText = "";
          spans.forEach(function(span) {
            const text = span.textContent || "";
            if (text.length > longestText.length && text.length > 50) {
              longestText = text;
            }
          });
          if (longestText) {
            return longestText;
          }
        }

        return null;
      })()
    `);

    // Extract image URLs
    const images = (await page.evaluate(`
      (function() {
        const imgUrls = [];
        const seen = new Set();

        // Get all images
        document.querySelectorAll("img").forEach(function(img) {
          const src = img.src;
          if (
            src &&
            !seen.has(src) &&
            !src.includes("profile") &&
            !src.includes("avatar") &&
            (src.includes("cdninstagram") || src.includes("fbcdn"))
          ) {
            seen.add(src);
            imgUrls.push(src);
          }
        });

        // Also check for video poster images
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
