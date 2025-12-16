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
