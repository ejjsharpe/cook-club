import { validateFetchUrl } from "./html-fetcher";

const READER_TIMEOUT_MS = 15_000;

export function getReaderUrl(url: string): string {
  const parsed = validateFetchUrl(url);
  return `https://r.jina.ai/http://${parsed.toString()}`;
}

export async function fetchReaderMarkdown(url: string): Promise<string> {
  const readerUrl = getReaderUrl(url);
  const response = await fetch(readerUrl, {
    signal: AbortSignal.timeout(READER_TIMEOUT_MS),
    headers: {
      Accept: "text/plain,text/markdown,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch reader URL: ${response.status} ${response.statusText}`,
    );
  }

  return response.text();
}
