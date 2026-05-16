import type { Env } from "../types";

const SPEECH_MODEL = "@cf/openai/whisper" as const;
const VISION_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct" as const;
const MAX_MEDIA_BYTES = 15 * 1024 * 1024;
const MAX_FRAMES_TO_OCR = 3;

export interface SocialMediaEnrichmentInput {
  caption: string | null;
  transcript?: string | null;
  videoUrls?: string[];
  frameText?: string | null;
  frameImages?: Uint8Array[];
}

export interface SocialMediaEnrichmentResult {
  transcript: string | null;
  frameText: string | null;
  enrichedText: string;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function uniqueTexts(values: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = normalizeText(value || "");
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) continue;

    seen.add(key);
    result.push(normalized);
  }

  return result;
}

function uint8ArrayToNumbers(value: Uint8Array): number[] {
  return Array.from(value);
}

async function fetchMediaBytes(url: string): Promise<Uint8Array | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(12_000),
      headers: {
        Accept: "audio/*,video/*,*/*;q=0.8",
        Referer: "https://www.tiktok.com/",
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      },
    });

    if (!response.ok) return null;

    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_MEDIA_BYTES) return null;

    const body = await response.arrayBuffer();
    if (body.byteLength > MAX_MEDIA_BYTES) return null;

    return new Uint8Array(body);
  } catch (error) {
    console.log(
      "Social media fetch for transcript failed:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

function transcriptFromAiResponse(response: unknown): string | null {
  if (typeof response === "string") return normalizeText(response) || null;
  if (!response || typeof response !== "object") return null;

  const text = (response as Record<string, unknown>).text;
  return typeof text === "string" ? normalizeText(text) || null : null;
}

export async function transcribeSocialMediaUrls(
  ai: Env["AI"],
  videoUrls: string[] = [],
): Promise<string | null> {
  const transcripts: string[] = [];

  for (const videoUrl of videoUrls.slice(0, 2)) {
    const bytes = await fetchMediaBytes(videoUrl);
    if (!bytes) continue;

    try {
      const response = await (ai as any).run(SPEECH_MODEL, {
        audio: uint8ArrayToNumbers(bytes),
      });
      const transcript = transcriptFromAiResponse(response);
      if (transcript) transcripts.push(transcript);
    } catch (error) {
      console.log(
        "Social media transcription failed:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  return uniqueTexts(transcripts).join("\n") || null;
}

function frameTextFromAiResponse(response: unknown): string | null {
  if (typeof response === "string") return normalizeText(response) || null;
  if (!response || typeof response !== "object") return null;

  const text =
    (response as Record<string, unknown>).response ??
    (response as Record<string, unknown>).text;
  if (typeof text !== "string") return null;

  const normalized = normalizeText(text);
  if (/^(none|no text|no readable text|empty)$/i.test(normalized)) return null;
  return normalized || null;
}

export async function extractRecipeTextFromFrames(
  ai: Env["AI"],
  frameImages: Uint8Array[] = [],
): Promise<string | null> {
  const frameTexts: string[] = [];

  for (const frame of frameImages.slice(0, MAX_FRAMES_TO_OCR)) {
    try {
      const response = await (ai as any).run(VISION_MODEL, {
        prompt:
          "Extract only visible recipe instructions, cooking steps, ingredient text, times, temperatures, or measurements from this food video frame. Return plain text. If no recipe text is visible, return empty text.",
        image: uint8ArrayToNumbers(frame),
        max_tokens: 512,
        temperature: 0,
      });
      const frameText = frameTextFromAiResponse(response);
      if (frameText) frameTexts.push(frameText);
    } catch (error) {
      console.log(
        "Social media frame OCR failed:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  return uniqueTexts(frameTexts).join("\n") || null;
}

export function buildEnrichedSocialRecipeText(
  input: Pick<SocialMediaEnrichmentInput, "caption"> & {
    transcript?: string | null;
    frameText?: string | null;
  },
): string {
  const parts: string[] = [];

  if (input.caption) {
    parts.push(`Caption:\n${input.caption}`);
  }
  if (input.transcript) {
    parts.push(`Audio transcript:\n${input.transcript}`);
  }
  if (input.frameText) {
    parts.push(`On-screen text from video frames:\n${input.frameText}`);
  }

  return parts.join("\n\n");
}

export async function enrichSocialMediaRecipeText(
  ai: Env["AI"],
  input: SocialMediaEnrichmentInput,
): Promise<SocialMediaEnrichmentResult> {
  const [transcript, frameText] = await Promise.all([
    input.transcript
      ? Promise.resolve(input.transcript)
      : transcribeSocialMediaUrls(ai, input.videoUrls),
    input.frameText
      ? Promise.resolve(input.frameText)
      : extractRecipeTextFromFrames(ai, input.frameImages),
  ]);

  return {
    transcript,
    frameText,
    enrichedText: buildEnrichedSocialRecipeText({
      caption: input.caption,
      transcript,
      frameText,
    }),
  };
}
