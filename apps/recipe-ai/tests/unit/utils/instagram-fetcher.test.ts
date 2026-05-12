import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  extractInstagramContent,
  normalizeInstagramUrl,
  isInstagramUrl,
  extractShortcode,
} from "../../../src/utils/instagram-fetcher";

describe("instagram-fetcher", () => {
  describe("normalizeInstagramUrl", () => {
    it("should remove query parameters", () => {
      const url =
        "https://www.instagram.com/reel/ABC123/?igsh=MWtuYWxyODkyZDQ0dA==";
      expect(normalizeInstagramUrl(url)).toBe(
        "https://www.instagram.com/reel/ABC123/",
      );
    });

    it("should add trailing slash", () => {
      const url = "https://www.instagram.com/reel/ABC123";
      expect(normalizeInstagramUrl(url)).toBe(
        "https://www.instagram.com/reel/ABC123/",
      );
    });

    it("should convert /reels/ to /reel/", () => {
      const url = "https://www.instagram.com/reels/ABC123/";
      expect(normalizeInstagramUrl(url)).toBe(
        "https://www.instagram.com/reel/ABC123/",
      );
    });

    it("should handle /p/ posts", () => {
      const url = "https://www.instagram.com/p/ABC123?utm_source=test";
      expect(normalizeInstagramUrl(url)).toBe(
        "https://www.instagram.com/p/ABC123/",
      );
    });
  });

  describe("isInstagramUrl", () => {
    it("should return true for instagram.com reel URLs", () => {
      expect(isInstagramUrl("https://www.instagram.com/reel/ABC123/")).toBe(
        true,
      );
      expect(isInstagramUrl("https://instagram.com/reel/ABC123/")).toBe(true);
    });

    it("should return true for instagram.com post URLs", () => {
      expect(isInstagramUrl("https://www.instagram.com/p/ABC123/")).toBe(true);
    });

    it("should return true for instagram.com reels URLs", () => {
      expect(isInstagramUrl("https://www.instagram.com/reels/ABC123/")).toBe(
        true,
      );
    });

    it("should return false for non-instagram URLs", () => {
      expect(isInstagramUrl("https://www.tiktok.com/@user/video/123")).toBe(
        false,
      );
      expect(isInstagramUrl("https://www.example.com/reel/ABC123/")).toBe(
        false,
      );
    });

    it("should return false for instagram profile URLs", () => {
      expect(isInstagramUrl("https://www.instagram.com/username/")).toBe(false);
    });

    it("should return false for invalid URLs", () => {
      expect(isInstagramUrl("not a url")).toBe(false);
    });
  });

  describe("extractShortcode", () => {
    it("should extract shortcode from reel URL", () => {
      expect(
        extractShortcode("https://www.instagram.com/reel/DTXVlH2DPub/"),
      ).toBe("DTXVlH2DPub");
    });

    it("should extract shortcode from post URL", () => {
      expect(extractShortcode("https://www.instagram.com/p/ABC123/")).toBe(
        "ABC123",
      );
    });

    it("should extract shortcode from URL with query params", () => {
      expect(
        extractShortcode("https://www.instagram.com/reel/ABC123/?igsh=test123"),
      ).toBe("ABC123");
    });

    it("should return null for invalid URLs", () => {
      expect(extractShortcode("https://www.instagram.com/username/")).toBe(
        null,
      );
    });
  });

  describe("extractInstagramContent", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("should extract content via oembed API", async () => {
      const mockResponse = {
        title: "Test recipe caption with ingredients and instructions",
        author_name: "testuser",
        author_url: "https://www.instagram.com/testuser",
        thumbnail_url: "https://example.com/thumb.jpg",
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await extractInstagramContent(
        "https://www.instagram.com/reel/ABC123/",
      );

      expect(result.caption).toBe(mockResponse.title);
      expect(result.authorName).toBe("testuser");
      expect(result.images).toContain("https://example.com/thumb.jpg");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("instagram.com/api/v1/oembed"),
        expect.any(Object),
      );
    });

    it("should throw error on API failure", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      await expect(
        extractInstagramContent("https://www.instagram.com/reel/ABC123/"),
      ).rejects.toThrow("Instagram oembed API returned 404");
    });

    it("should handle null caption", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ author_name: "testuser" }),
      });

      const result = await extractInstagramContent(
        "https://www.instagram.com/reel/ABC123/",
      );

      expect(result.caption).toBe(null);
      expect(result.images).toEqual([]);
    });
  });
});
