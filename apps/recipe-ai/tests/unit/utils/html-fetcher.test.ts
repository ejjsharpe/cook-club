import { describe, it, expect, vi, beforeEach } from "vitest";

import { getRandomUserAgent, fetchHtml } from "../../../src/utils/html-fetcher";

describe("getRandomUserAgent", () => {
  it("returns a string", () => {
    const ua = getRandomUserAgent();
    expect(typeof ua).toBe("string");
  });

  it("returns a browser user agent", () => {
    const ua = getRandomUserAgent();
    expect(ua).toMatch(/Mozilla/);
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
        status: 200,
        headers: new Headers({ "content-type": "text/html" }),
        arrayBuffer: () =>
          Promise.resolve(new TextEncoder().encode(mockHtml).buffer),
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
        headers: new Headers({ "content-type": "text/html" }),
      }),
    );

    await expect(fetchHtml("https://example.com/404", 0)).rejects.toThrow(
      "Failed to fetch URL: 404 Not Found",
    );
  });

  it("sends browser user agent header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "text/html" }),
      arrayBuffer: () =>
        Promise.resolve(new TextEncoder().encode("<html></html>").buffer),
      text: () => Promise.resolve("<html></html>"),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchHtml("https://example.com");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/",
      expect.objectContaining({
        headers: expect.objectContaining({
          "User-Agent": expect.stringMatching(/Mozilla/),
        }),
        redirect: "manual",
      }),
    );
  });

  it("rejects local hosts", async () => {
    await expect(fetchHtml("http://localhost/test", 0)).rejects.toThrow(
      "This URL host is not supported",
    );
  });
});
