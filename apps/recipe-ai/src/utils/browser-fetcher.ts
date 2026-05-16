import puppeteer from "@cloudflare/puppeteer";

import { validateFetchUrl } from "./html-fetcher";

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
  validateFetchUrl(url);
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
  validateFetchUrl(url);
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

export interface TikTokBrowserContent {
  html: string;
  caption: string | null;
  images: string[];
  videoUrls: string[];
  frameImages: Uint8Array[];
}

function toUint8Array(value: unknown): Uint8Array | null {
  if (!value) return null;
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    const view = value as ArrayBufferView;
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  }
  return null;
}

export async function extractTikTokBrowserContent(
  browser: Fetcher,
  url: string,
): Promise<TikTokBrowserContent> {
  validateFetchUrl(url);
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
      await page.waitForSelector('meta[property="og:title"], video', {
        timeout: 5000,
      });
    } catch {
      // Continue with the DOM we have.
    }

    try {
      const closeButton = await page.$('[aria-label="Close"]');
      if (closeButton) {
        await closeButton.click();
      }
    } catch {
      // Ignore popup dismissal errors.
    }

    try {
      await page.evaluate(`
        (function() {
          document.querySelectorAll("video").forEach(function(video) {
            try {
              video.muted = true;
              video.currentTime = Math.min(2, video.duration || 2);
              video.play().catch(function() {});
            } catch {}
          });
        })()
      `);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch {
      // Video playback is best effort only.
    }

    const media = (await page.evaluate(`
      (function() {
        const images = [];
        const videoUrls = [];
        const seenImages = new Set();
        const seenVideos = new Set();

        function addImage(url) {
          if (!url || seenImages.has(url) || url.startsWith("data:")) return;
          seenImages.add(url);
          images.push(url);
        }

        function addVideo(url) {
          if (!url || seenVideos.has(url) || url.startsWith("blob:")) return;
          seenVideos.add(url);
          videoUrls.push(url);
        }

        document.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"]').forEach(function(meta) {
          addImage(meta.content);
        });

        document.querySelectorAll('meta[property="og:video"], meta[property="og:video:url"], meta[property="og:video:secure_url"]').forEach(function(meta) {
          addVideo(meta.content);
        });

        document.querySelectorAll("img").forEach(function(img) {
          addImage(img.currentSrc || img.src);
        });

        document.querySelectorAll("video").forEach(function(video) {
          addImage(video.poster);
          addVideo(video.currentSrc || video.src);
          video.querySelectorAll("source").forEach(function(source) {
            addVideo(source.src);
          });
        });

        Array.from(document.scripts).forEach(function(script) {
          const text = script.textContent || "";
          const matches = text.match(/https?:\\\\/\\\\/[^"'\\\\s]+(?:\\\\.mp4|mime_type=video_mp4|video_mp4)[^"'\\\\s]*/g) || [];
          matches.forEach(function(match) {
            addVideo(match.replace(/\\\\u002F/g, "/").replace(/\\\\&/g, "&"));
          });
        });

        const ogTitle = document.querySelector('meta[property="og:title"]');
        const ogDescription = document.querySelector('meta[property="og:description"]');
        const description = document.querySelector('meta[name="description"]');

        return {
          caption: (ogTitle && ogTitle.content) || (ogDescription && ogDescription.content) || (description && description.content) || null,
          images,
          videoUrls
        };
      })()
    `)) as {
      caption: string | null;
      images: string[];
      videoUrls: string[];
    };

    const frameImages: Uint8Array[] = [];
    try {
      const screenshot = toUint8Array(
        await page.screenshot({
          type: "jpeg",
          quality: 70,
          fullPage: false,
        }),
      );
      if (screenshot) frameImages.push(screenshot);
    } catch {
      // Screenshot capture is best effort.
    }

    const html = await page.content();

    return {
      html,
      caption: media.caption,
      images: media.images,
      videoUrls: media.videoUrls,
      frameImages,
    };
  } finally {
    await instance.close();
  }
}
