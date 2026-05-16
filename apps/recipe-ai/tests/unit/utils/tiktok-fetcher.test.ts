import { describe, expect, it, vi } from "vitest";

import { extractTikTokContent } from "../../../src/utils/tiktok-fetcher";

describe("extractTikTokContent", () => {
  it("extracts hydration subtitles before audio/OCR fallbacks", async () => {
    const hydration = {
      __DEFAULT_SCOPE__: {
        "webapp.reflow.video.detail": {
          itemInfo: {
            itemStruct: {
              desc: "Brownies: 1 cup sugar #brownies",
              video: {
                cover: "https://example.com/cover.jpg",
                playAddr: "https://example.com/video.mp4",
                subtitleInfos: [
                  {
                    Url: "https://subtitle.example.com/brownies.vtt",
                    Format: "webvtt",
                    Source: "ASR",
                  },
                ],
              },
            },
          },
        },
      },
    };
    const html = `
      <script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">
        ${JSON.stringify(hydration)}
      </script>
    `;
    const vtt = `
WEBVTT

00:00:00.000 --> 00:00:02.000
Start by adding melted butter and sugar into a bowl.

00:00:02.001 --> 00:00:04.000
Whisk until combined and bake.
    `;

    global.fetch = vi.fn((requestUrl: string | URL) => {
      const url = String(requestUrl);
      if (url.startsWith("https://www.tiktok.com/oembed")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              title: "Oembed title",
              thumbnail_url: "https://example.com/thumb.jpg",
            }),
        });
      }

      if (url === "https://www.tiktok.com/@user/video/123") {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(html),
        });
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(vtt),
      });
    }) as any;

    const result = await extractTikTokContent(
      "https://www.tiktok.com/@user/video/123",
    );

    expect(result.caption).toBe("Brownies: 1 cup sugar #brownies");
    expect(result.images).toEqual(["https://example.com/thumb.jpg"]);
    expect(result.videoUrls).toEqual(["https://example.com/video.mp4"]);
    expect(result.subtitleUrls).toEqual([
      "https://subtitle.example.com/brownies.vtt",
    ]);
    expect(result.transcript).toBe(
      "Start by adding melted butter and sugar into a bowl. Whisk until combined and bake.",
    );
  });

  it("uses one hydration image when oEmbed has no thumbnail", async () => {
    const hydration = {
      __DEFAULT_SCOPE__: {
        "webapp.reflow.video.detail": {
          itemInfo: {
            itemStruct: {
              desc: "Brownies: 1 cup sugar #brownies",
              video: {
                cover: "https://example.com/cover.jpg",
                originCover: "https://example.com/origin-cover.jpg",
                dynamicCover: "https://example.com/dynamic-cover.jpg",
              },
            },
          },
        },
      },
    };

    global.fetch = vi.fn((requestUrl: string | URL) => {
      const url = String(requestUrl);
      if (url.startsWith("https://www.tiktok.com/oembed")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              title: "Oembed title",
            }),
        });
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(`
            <script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">
              ${JSON.stringify(hydration)}
            </script>
          `),
      });
    }) as any;

    const result = await extractTikTokContent(
      "https://www.tiktok.com/@user/video/123",
    );

    expect(result.images).toEqual(["https://example.com/cover.jpg"]);
  });
});
