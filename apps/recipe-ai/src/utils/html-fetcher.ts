/**
 * HTML Fetcher Utility
 *
 * Fetches HTML content from URLs with mobile user agent rotation.
 */

const USER_AGENTS = [
  // Desktop browsers (more likely to succeed with some sites)
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  // Mobile browsers
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
];

const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 10_000;

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "0.0.0.0",
]);

export function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]!;
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false;
  }

  const a = parts[0]!;
  const b = parts[1]!;
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    BLOCKED_HOSTNAMES.has(normalized) ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal") ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:") ||
    isPrivateIpv4(normalized)
  );
}

export function validateFetchUrl(url: string): URL {
  const parsed = new URL(url);

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Only HTTP and HTTPS URLs are supported");
  }

  if (isBlockedHostname(parsed.hostname)) {
    throw new Error("This URL host is not supported");
  }

  return parsed;
}

function validateContentType(response: Response) {
  const contentType = response.headers.get("content-type");
  if (!contentType) return;

  const mediaType = contentType.toLowerCase().split(";")[0]?.trim();
  const allowed = new Set([
    "text/html",
    "application/xhtml+xml",
    "application/xml",
    "text/xml",
    "text/plain",
  ]);

  if (!mediaType || !allowed.has(mediaType)) {
    throw new Error(`Unsupported content type: ${contentType}`);
  }
}

async function readLimitedText(response: Response): Promise<string> {
  const contentLength = response.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_HTML_BYTES) {
    throw new Error(`HTML response too large: ${contentLength} bytes`);
  }

  const body = await response.arrayBuffer();
  if (body.byteLength > MAX_HTML_BYTES) {
    throw new Error(`HTML response too large: ${body.byteLength} bytes`);
  }

  return new TextDecoder().decode(body);
}

/**
 * Fetch HTML content from a URL with retry logic
 */
export async function fetchHtml(url: string, retries = 2): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      let currentUrl = validateFetchUrl(url);
      let response: Response | null = null;

      for (
        let redirectCount = 0;
        redirectCount <= MAX_REDIRECTS;
        redirectCount++
      ) {
        response = await fetch(currentUrl.toString(), {
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          headers: {
            "User-Agent": USER_AGENTS[attempt % USER_AGENTS.length]!,
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
          },
          redirect: "manual",
        });

        if (
          response.status >= 300 &&
          response.status < 400 &&
          response.headers.has("location")
        ) {
          if (redirectCount === MAX_REDIRECTS) {
            throw new Error("Too many redirects");
          }

          currentUrl = validateFetchUrl(
            new URL(response.headers.get("location")!, currentUrl).toString(),
          );
          continue;
        }

        break;
      }

      if (!response) {
        throw new Error("Failed to fetch URL");
      }

      if (!response.ok) {
        throw new Error(
          `Failed to fetch URL: ${response.status} ${response.statusText}`,
        );
      }

      validateContentType(response);
      return readLimitedText(response);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Fetch attempt ${attempt + 1} failed:`, lastError.message);

      // Wait before retrying (exponential backoff)
      if (attempt < retries) {
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 500),
        );
      }
    }
  }

  throw lastError || new Error("Failed to fetch URL after retries");
}
