import { describe, expect, it, vi } from "vitest";

import {
  buildEnrichedSocialRecipeText,
  enrichSocialMediaRecipeText,
} from "../../../src/utils/social-media-enrichment";

describe("social-media-enrichment", () => {
  it("builds combined caption, transcript, and frame text", () => {
    const text = buildEnrichedSocialRecipeText({
      caption: "Caption ingredients",
      transcript: "Mix the batter and bake.",
      frameText: "Bake at 350F for 25 minutes.",
    });

    expect(text).toContain("Caption:\nCaption ingredients");
    expect(text).toContain("Audio transcript:\nMix the batter and bake.");
    expect(text).toContain(
      "On-screen text from video frames:\nBake at 350F for 25 minutes.",
    );
  });

  it("transcribes fetchable media and OCRs frame images", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-length": "4" }),
      arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3, 4]).buffer),
    });

    const ai = {
      run: vi.fn((model: string) => {
        if (model === "@cf/openai/whisper") {
          return Promise.resolve({ text: "Whisk until glossy. Bake." });
        }

        return Promise.resolve({
          response: "Bake at 350F for 25 minutes.",
        });
      }),
    };

    const result = await enrichSocialMediaRecipeText(ai as any, {
      caption: "Brownies: 1 cup sugar",
      videoUrls: ["https://cdn.example.com/video.mp4"],
      frameImages: [new Uint8Array([5, 6, 7])],
    });

    expect(result.transcript).toBe("Whisk until glossy. Bake.");
    expect(result.frameText).toBe("Bake at 350F for 25 minutes.");
    expect(result.enrichedText).toContain("Audio transcript:");
    expect(result.enrichedText).toContain("On-screen text from video frames:");
    expect(ai.run).toHaveBeenCalledWith(
      "@cf/openai/whisper",
      expect.objectContaining({ audio: [1, 2, 3, 4] }),
    );
    expect(ai.run).toHaveBeenCalledWith(
      "@cf/meta/llama-3.2-11b-vision-instruct",
      expect.objectContaining({ image: [5, 6, 7] }),
    );
  });
});
