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

export function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]!;
}

/**
 * Fetch HTML content from a URL with retry logic
 */
export async function fetchHtml(url: string, retries = 2): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENTS[attempt % USER_AGENTS.length]!,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        redirect: "follow",
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch URL: ${response.status} ${response.statusText}`,
        );
      }

      return response.text();
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
