import puppeteer from "@cloudflare/puppeteer";

const BROWSER_REQUIRED_DOMAINS = ["instagram.com", "tiktok.com"];

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

export async function fetchHtmlWithBrowser(
  browser: Fetcher,
  url: string,
): Promise<string> {
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
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });

    try {
      const closeButton = await page.$('[aria-label="Close"]');
      if (closeButton) {
        await closeButton.click();
      }
    } catch {
      // Ignore popup dismissal errors
    }

    return await page.content();
  } finally {
    await instance.close();
  }
}

export async function extractInstagramContent(
  browser: Fetcher,
  url: string,
): Promise<{ html: string; caption: string | null; images: string[] }> {
  const instance = await puppeteer.launch(browser);

  try {
    const page = await instance.newPage();

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

    try {
      await page.waitForSelector('meta[property="og:title"]', {
        timeout: 3000,
      });
    } catch {
      // Continue - we'll check what's available
    }

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
