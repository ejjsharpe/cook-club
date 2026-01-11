interface InstagramOembedResponse {
  version?: string;
  title?: string;
  author_name?: string;
  author_url?: string;
  author_id?: number;
  media_id?: string;
  provider_name?: string;
  provider_url?: string;
  type?: string;
  width?: number;
  height?: number;
  html?: string;
  thumbnail_url?: string;
  thumbnail_width?: number;
  thumbnail_height?: number;
}

/**
 * Extract recipe content from Instagram using the oembed API.
 *
 * This is much more reliable than browser rendering because:
 * - No login walls
 * - No JavaScript rendering required
 * - Returns full, clean caption text
 * - Returns thumbnail image
 * - Much faster (no Puppeteer overhead)
 */
export async function extractInstagramContent(
  url: string,
): Promise<{ caption: string | null; images: string[]; authorName?: string }> {
  // Clean the URL - remove query params and tracking
  const cleanUrl = normalizeInstagramUrl(url);
  const oembedUrl = `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(cleanUrl)}`;

  const response = await fetch(oembedUrl, {
    headers: {
      Accept: "application/json",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Instagram oembed API returned ${response.status}: ${response.statusText}`,
    );
  }

  const data = (await response.json()) as InstagramOembedResponse;

  const images: string[] = [];
  if (data.thumbnail_url) {
    images.push(data.thumbnail_url);
  }

  return {
    caption: data.title || null,
    images,
    authorName: data.author_name,
  };
}

/**
 * Normalize Instagram URL to canonical form for oembed API.
 *
 * Handles various URL formats:
 * - https://www.instagram.com/reel/ABC123/
 * - https://instagram.com/p/ABC123/?igsh=...
 * - https://www.instagram.com/reels/ABC123/
 */
export function normalizeInstagramUrl(url: string): string {
  // Remove query params
  let cleanUrl = url.split("?")[0] ?? url;

  // Ensure trailing slash
  if (!cleanUrl.endsWith("/")) {
    cleanUrl += "/";
  }

  // Convert /reels/ to /reel/ (oembed API prefers /reel/)
  cleanUrl = cleanUrl.replace("/reels/", "/reel/");

  return cleanUrl;
}

/**
 * Check if URL is a valid Instagram post/reel URL.
 */
export function isInstagramUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    const isInstagram =
      hostname === "instagram.com" || hostname.endsWith(".instagram.com");

    if (!isInstagram) return false;

    // Check for valid post/reel path
    const path = new URL(url).pathname;
    return /^\/(p|reel|reels)\/[A-Za-z0-9_-]+/.test(path);
  } catch {
    return false;
  }
}

/**
 * Extract shortcode from Instagram URL for logging/debugging.
 */
export function extractShortcode(url: string): string | null {
  const match = url.match(/\/(p|reel|reels)\/([A-Za-z0-9_-]+)/);
  return match?.[2] || null;
}
