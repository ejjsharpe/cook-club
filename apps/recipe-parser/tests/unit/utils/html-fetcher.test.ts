import { describe, it, expect, vi, beforeEach } from "vitest";

import { getRandomUserAgent, fetchHtml } from "../../../src/utils/html-fetcher";

describe("getRandomUserAgent", () => {
  it("returns a string", () => {
    const ua = getRandomUserAgent();
    expect(typeof ua).toBe("string");
  });

  it("returns a mobile user agent", () => {
    const ua = getRandomUserAgent();
    expect(ua).toMatch(/Mobile|iPhone|Android/);
  });
});

describe("fetchHtml", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches HTML from a URL", async () => {
    const mockHtml = "<html><body>Test</body></html>";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockHtml),
      }),
    );

    const result = await fetchHtml("https://example.com");
    expect(result).toBe(mockHtml);
  });

  it("throws on HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      }),
    );

    await expect(fetchHtml("https://example.com/404")).rejects.toThrow(
      "Failed to fetch URL: 404 Not Found",
    );
  });

  it("sends mobile user agent header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("<html></html>"),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchHtml("https://example.com");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com",
      expect.objectContaining({
        headers: expect.objectContaining({
          "User-Agent": expect.stringMatching(/Mobile|iPhone|Android/),
        }),
      }),
    );
  });
});
