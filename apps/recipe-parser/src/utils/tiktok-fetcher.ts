interface TikTokOembedResponse {
  title?: string;
  author_name?: string;
  author_url?: string;
  thumbnail_url?: string;
}

/**
 * Extract recipe content from TikTok using the oembed API.
 */
export async function extractTikTokContent(
  url: string,
): Promise<{ caption: string | null; images: string[] }> {
  // Normalize URL - oembed API only accepts /video/ format
  const normalizedUrl = url.replace(/\/(photo|reel)\//, "/video/");
  const cleanUrl = normalizedUrl.split("?")[0] ?? normalizedUrl;

  const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(cleanUrl)}`;

  const response = await fetch(oembedUrl, {
    headers: {
      Accept: "application/json",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`TikTok oembed API returned ${response.status}`);
  }

  const data = (await response.json()) as TikTokOembedResponse;

  const images: string[] = [];
  if (data.thumbnail_url) {
    images.push(data.thumbnail_url);
  }

  return {
    caption: data.title || null,
    images,
  };
}
