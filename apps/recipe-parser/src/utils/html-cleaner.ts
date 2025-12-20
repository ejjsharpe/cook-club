import * as cheerio from "cheerio";

/**
 * Clean HTML content for AI processing
 *
 * Removes noise elements (scripts, styles, nav, ads, comments) and extracts
 * the main content text. Limits output to 15,000 characters for AI context.
 */
export function cleanHtml(rawHtml: string): string {
  const $ = cheerio.load(rawHtml);

  $("script, style, nav, footer, header, aside, noscript, iframe").remove();
  $(".ads, .comments, .sidebar, .related-posts, .social-share").remove();
  $('[class*="advertisement"], [class*="promo"], [id*="ad-"]').remove();
  $('[role="navigation"], [role="banner"], [role="contentinfo"]').remove();

  const mainContent = $(
    'article, main, [role="main"], .recipe, .post-content',
  ).first();

  const text = (mainContent.length ? mainContent : $("body")).text();

  return text.replace(/\s+/g, " ").trim().slice(0, 15000);
}

/**
 * Extract raw text from HTML without aggressive cleaning
 * Useful when structured data extraction fails and we need more context
 */
export function extractText(rawHtml: string): string {
  const $ = cheerio.load(rawHtml);

  $("script, style, noscript").remove();

  return $("body").text().replace(/\s+/g, " ").trim();
}

/**
 * Extract image URLs from HTML
 *
 * Focuses on content images and filters out common non-content images
 * like logos, icons, social media buttons, etc.
 */
export function extractImageUrls(rawHtml: string, baseUrl: string): string[] {
  const $ = cheerio.load(rawHtml);

  // Remove non-content sections first
  $("script, style, nav, footer, header, aside, noscript, iframe").remove();
  $(".ads, .comments, .sidebar, .social-share").remove();
  $('[class*="advertisement"], [class*="promo"], [id*="ad-"]').remove();

  const imageUrls: string[] = [];
  const seen = new Set<string>();

  // Focus on main content area
  const mainContent = $(
    'article, main, [role="main"], .recipe, .post-content',
  ).first();
  const searchContext = mainContent.length ? mainContent : $("body");

  // Extract from img tags
  searchContext.find("img").each((_, el) => {
    // Try multiple attributes for lazy-loaded images
    const src =
      $(el).attr("data-src") ||
      $(el).attr("data-lazy-src") ||
      $(el).attr("data-original") ||
      $(el).attr("data-srcset")?.split(",")[0]?.trim().split(" ")[0] ||
      $(el).attr("srcset")?.split(",")[0]?.trim().split(" ")[0] ||
      $(el).attr("src");

    if (!src) return;

    // Skip data URLs (base64, SVG placeholders, etc.)
    if (src.startsWith("data:")) {
      return;
    }

    const absoluteUrl = makeAbsoluteUrl(src, baseUrl);
    if (!absoluteUrl) return;

    // Filter out tiny images (likely icons/logos)
    const width = parseInt($(el).attr("width") || "0", 10);
    const height = parseInt($(el).attr("height") || "0", 10);

    // Skip if clearly too small (< 100px in either dimension, if specified)
    if ((width > 0 && width < 100) || (height > 0 && height < 100)) {
      return;
    }

    // Filter out common icon/logo patterns
    if (
      src.includes("logo") ||
      src.includes("icon") ||
      src.includes("avatar") ||
      src.includes("social") ||
      src.includes("badge") ||
      src.includes("placeholder")
    ) {
      return;
    }

    if (!seen.has(absoluteUrl)) {
      seen.add(absoluteUrl);
      imageUrls.push(absoluteUrl);
    }
  });

  // Also check for images in JSON-LD schema
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const jsonText = $(el).html();
      if (!jsonText) return;

      const data = JSON.parse(jsonText);
      const images = extractImagesFromJsonLd(data);

      for (const imgUrl of images) {
        const absoluteUrl = makeAbsoluteUrl(imgUrl, baseUrl);
        if (absoluteUrl && !seen.has(absoluteUrl)) {
          seen.add(absoluteUrl);
          imageUrls.push(absoluteUrl);
        }
      }
    } catch {
      // Ignore invalid JSON
    }
  });

  return imageUrls;
}

/**
 * Extract image URLs from JSON-LD structured data
 */
function extractImagesFromJsonLd(data: any): string[] {
  const images: string[] = [];

  if (!data) return images;

  // Handle arrays
  if (Array.isArray(data)) {
    for (const item of data) {
      images.push(...extractImagesFromJsonLd(item));
    }
    return images;
  }

  // Handle objects
  if (typeof data === "object") {
    // Direct image property
    if (data.image) {
      if (typeof data.image === "string") {
        images.push(data.image);
      } else if (Array.isArray(data.image)) {
        for (const img of data.image) {
          if (typeof img === "string") {
            images.push(img);
          } else if (img?.url) {
            images.push(img.url);
          }
        }
      } else if (data.image.url) {
        images.push(data.image.url);
      }
    }

    // Recursively search other properties
    for (const value of Object.values(data)) {
      if (typeof value === "object" && value !== null) {
        images.push(...extractImagesFromJsonLd(value));
      }
    }
  }

  return images;
}

/**
 * Extract step-associated images from HTML structure
 *
 * Looks for images within or near instruction steps (ol li, .step, .instruction elements)
 * and returns context that can be appended to the AI prompt
 */
export function extractStepImageContext(
  rawHtml: string,
  baseUrl: string,
): string {
  const $ = cheerio.load(rawHtml);

  // Remove non-content sections first
  $("script, style, nav, footer, header, aside, noscript, iframe").remove();
  $(".ads, .comments, .sidebar, .social-share").remove();
  $('[class*="advertisement"], [class*="promo"], [id*="ad-"]').remove();

  const mainContent = $(
    'article, main, [role="main"], .recipe, .post-content',
  ).first();
  const searchContext = mainContent.length ? mainContent : $("body");

  const stepImageHints: string[] = [];

  // Helper to extract image src from various attributes
  const extractImageSrc = ($img: ReturnType<typeof $>): string | null => {
    const src =
      $img.attr("data-src") ||
      $img.attr("data-lazy-src") ||
      $img.attr("data-original") ||
      $img.attr("data-srcset")?.split(",")[0]?.trim().split(" ")[0] ||
      $img.attr("srcset")?.split(",")[0]?.trim().split(" ")[0] ||
      $img.attr("src");

    if (!src || src.startsWith("data:")) return null;

    // Filter out non-content images
    if (
      src.includes("logo") ||
      src.includes("icon") ||
      src.includes("avatar") ||
      src.includes("social") ||
      src.includes("badge") ||
      src.includes("placeholder")
    ) {
      return null;
    }

    return makeAbsoluteUrl(src, baseUrl);
  };

  // Look for ordered lists (common for instructions) with nearby images
  searchContext
    .find(
      'ol, .instructions, .method, .steps, [class*="instruction"], [class*="direction"], [class*="step"]',
    )
    .each((_, container) => {
      $(container)
        .find("li, .step, [class*='step']")
        .each((stepIdx, stepEl) => {
          const stepText = $(stepEl).text().trim().slice(0, 100);
          if (!stepText) return;

          // Find images within this step element
          $(stepEl)
            .find("img")
            .each((_, img) => {
              const src = extractImageSrc($(img));
              if (src) {
                stepImageHints.push(
                  `Step ${stepIdx + 1} ("${stepText.slice(0, 50)}..."): ${src}`,
                );
              }
            });

          // Also check for figure/image immediately after the step
          const nextEl = $(stepEl).next();
          if (
            nextEl.is("figure") ||
            nextEl.is("img") ||
            nextEl.hasClass("image")
          ) {
            nextEl.find("img").addBack("img").each((_, img) => {
              const src = extractImageSrc($(img));
              if (src) {
                stepImageHints.push(
                  `Step ${stepIdx + 1} ("${stepText.slice(0, 50)}..."): ${src}`,
                );
              }
            });
          }
        });
    });

  if (stepImageHints.length === 0) {
    return "";
  }

  return `\n\n[STEP IMAGES FOUND IN HTML]:\n${stepImageHints.join("\n")}`;
}

/**
 * Convert relative URL to absolute URL
 */
function makeAbsoluteUrl(url: string, baseUrl: string): string | null {
  try {
    // Already absolute
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }

    // Protocol-relative
    if (url.startsWith("//")) {
      const baseProtocol = new URL(baseUrl).protocol;
      return `${baseProtocol}${url}`;
    }

    // Relative URL
    return new URL(url, baseUrl).href;
  } catch {
    return null;
  }
}
