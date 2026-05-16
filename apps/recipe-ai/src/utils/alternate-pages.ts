import * as cheerio from "cheerio";

function addUrl(
  urls: string[],
  seen: Set<string>,
  href: string | undefined,
  sourceUrl: string,
) {
  if (!href) return;

  try {
    const source = new URL(sourceUrl);
    const candidate = new URL(href, sourceUrl);
    candidate.hash = "";

    if (!["http:", "https:"].includes(candidate.protocol)) return;
    if (candidate.hostname !== source.hostname) return;
    if (candidate.toString() === source.toString()) return;

    const key = candidate.toString();
    if (seen.has(key)) return;

    seen.add(key);
    urls.push(key);
  } catch {
    // Ignore invalid alternate URLs.
  }
}

export function discoverAlternateRecipeUrls(
  html: string,
  sourceUrl: string,
): string[] {
  const $ = cheerio.load(html);
  const urls: string[] = [];
  const seen = new Set<string>();

  $('link[rel~="amphtml"], link[rel~="alternate"]').each((_i, el) => {
    const href = $(el).attr("href");
    const rel = ($(el).attr("rel") || "").toLowerCase();
    const media = ($(el).attr("media") || "").toLowerCase();
    const type = ($(el).attr("type") || "").toLowerCase();
    const lowerHref = (href || "").toLowerCase();

    if (
      rel.includes("amphtml") ||
      lowerHref.includes("/amp") ||
      lowerHref.includes("amp=1") ||
      media.includes("print") ||
      type.includes("amp")
    ) {
      addUrl(urls, seen, href, sourceUrl);
    }
  });

  $("a[href]").each((_i, el) => {
    const href = $(el).attr("href");
    const lowerHref = (href || "").toLowerCase();
    const label = [
      $(el).text(),
      $(el).attr("aria-label"),
      $(el).attr("title"),
      $(el).attr("class"),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (
      label.includes("print") ||
      lowerHref.includes("print") ||
      lowerHref.includes("output=1")
    ) {
      addUrl(urls, seen, href, sourceUrl);
    }
  });

  return urls.slice(0, 4);
}

export function getWordPressRestPostUrl(
  html: string,
  sourceUrl: string,
): string | null {
  const lowerHtml = html.toLowerCase();
  if (
    !lowerHtml.includes("wp-content") &&
    !lowerHtml.includes("wp-json") &&
    !lowerHtml.includes("wordpress") &&
    !lowerHtml.includes("wp-block")
  ) {
    return null;
  }

  try {
    const source = new URL(sourceUrl);
    const slug = source.pathname
      .split("/")
      .filter(Boolean)
      .at(-1)
      ?.replace(/\.html?$/i, "");

    if (!slug) return null;

    const restUrl = new URL("/wp-json/wp/v2/posts", source.origin);
    restUrl.searchParams.set("slug", slug);
    restUrl.searchParams.set(
      "_fields",
      "content,excerpt,title,yoast_head_json",
    );

    return restUrl.toString();
  } catch {
    return null;
  }
}
