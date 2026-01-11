import { WorkerEntrypoint } from "cloudflare:workers";
import { Hono } from "hono";
import { cors } from "hono/cors";

import {
  extensionFromContentType,
  generatePresignedUploadUrl,
  generateTempKey,
  validateKey,
} from "./presign";
import type { UploadFromUrlResponse } from "./service";
import { buildCfImageOptions, parseTransformOptions } from "./transform";
import type {
  Env,
  PresignedUrlResponse,
  VerifyResponse,
  MoveResult,
  MoveResponse,
} from "./types";

// Re-export types for consumers
export type {
  PresignedUrlResponse,
  VerifyResponse,
  MoveResult,
  MoveResponse,
} from "./types";
export type { UploadFromUrlResponse } from "./service";

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Image Worker RPC Entrypoint
 *
 * Provides RPC methods for image upload management.
 * Called via Service Bindings from the main server.
 */
export class ImageWorker extends WorkerEntrypoint<Env> {
  /**
   * Generate a presigned URL for uploading an image to R2.
   *
   * @param contentType - The MIME type of the image
   * @param maxFileSize - Maximum allowed file size in bytes (default: 10MB)
   * @returns Presigned upload URL, public URL, and storage key
   */
  async presign(
    contentType: "image/jpeg" | "image/png" | "image/webp",
    maxFileSize: number = MAX_FILE_SIZE,
  ): Promise<PresignedUrlResponse> {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(contentType)) {
      throw new Error("Invalid content type");
    }

    if (maxFileSize > MAX_FILE_SIZE) {
      throw new Error(`Maximum file size is ${MAX_FILE_SIZE} bytes`);
    }

    const extension = extensionFromContentType(contentType);
    const key = generateTempKey(extension);

    return await generatePresignedUploadUrl(this.env, {
      key,
      contentType,
      maxFileSize,
    });
  }

  /**
   * Verify that uploaded images exist in storage.
   *
   * @param keys - Array of storage keys to verify
   * @returns Verification results for each key
   */
  async verify(keys: string[]): Promise<VerifyResponse> {
    const results = await Promise.all(
      keys.map(async (key) => {
        const object = await this.env.IMAGES.head(key);
        return { key, exists: !!object };
      }),
    );

    const valid = results.every((r) => r.exists);
    return { valid, results };
  }

  /**
   * Move images from temp to permanent location.
   *
   * @param moves - Array of { from, to } key pairs
   * @returns Move results for each operation
   */
  async move(moves: { from: string; to: string }[]): Promise<MoveResponse> {
    const results = await Promise.all(
      moves.map(async ({ from, to }): Promise<MoveResult> => {
        try {
          // Validate source key is from temp/
          if (!from.startsWith("temp/")) {
            return {
              from,
              to,
              success: false,
              error: "Invalid source key: must be in temp/",
            };
          }

          // Validate destination key
          if (!validateKey(to)) {
            return {
              from,
              to,
              success: false,
              error: "Invalid destination key",
            };
          }

          // Get the source object
          const source = await this.env.IMAGES.get(from);
          if (!source) {
            return { from, to, success: false, error: "Source not found" };
          }

          // Copy to new location
          await this.env.IMAGES.put(to, source.body, {
            httpMetadata: source.httpMetadata,
            customMetadata: source.customMetadata,
          });

          // Delete source
          await this.env.IMAGES.delete(from);

          return { from, to, success: true };
        } catch (error) {
          return {
            from,
            to,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      }),
    );

    const success = results.every((r) => r.success);
    return { success, results };
  }

  /**
   * Delete images from storage.
   *
   * @param keys - Array of storage keys to delete
   */
  async delete(keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => this.env.IMAGES.delete(key)));
  }

  /**
   * Download an image from a URL and upload it to R2.
   * Used for re-hosting external images (e.g., from Instagram CDN).
   *
   * @param sourceUrl - The URL to download the image from
   * @param destinationKey - The R2 key to store the image at
   * @returns Upload result with public URL
   */
  async uploadFromUrl(
    sourceUrl: string,
    destinationKey: string,
  ): Promise<UploadFromUrlResponse> {
    try {
      // Validate destination key
      if (!validateKey(destinationKey)) {
        return {
          success: false,
          error: "Invalid destination key",
        };
      }

      // Fetch the image from the source URL
      const response = await fetch(sourceUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "image/*",
        },
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch image: ${response.status} ${response.statusText}`,
        };
      }

      // Validate content type
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.startsWith("image/")) {
        return {
          success: false,
          error: `Invalid content type: ${contentType}`,
        };
      }

      // Check content length if available
      const contentLength = response.headers.get("content-length");
      if (contentLength && parseInt(contentLength) > MAX_FILE_SIZE) {
        return {
          success: false,
          error: `Image too large: ${contentLength} bytes (max ${MAX_FILE_SIZE})`,
        };
      }

      // Read the image data
      const imageData = await response.arrayBuffer();

      if (imageData.byteLength > MAX_FILE_SIZE) {
        return {
          success: false,
          error: `Image too large: ${imageData.byteLength} bytes (max ${MAX_FILE_SIZE})`,
        };
      }

      // Upload to R2
      await this.env.IMAGES.put(destinationKey, imageData, {
        httpMetadata: {
          contentType,
        },
      });

      // Generate public URL
      const publicUrl = `${this.env.PUBLIC_URL}/${destinationKey}`;

      return {
        success: true,
        publicUrl,
        key: destinationKey,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

/**
 * HTTP app for public image serving with transformations
 */
const app = new Hono<{ Bindings: Env }>();

// CORS for image requests
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    maxAge: 3600,
  }),
);

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

/**
 * Serve images with optional transformations.
 * GET /{key}?w=400&h=300&fit=cover&format=auto
 *
 * Cloudflare Image Resizing requires fetching from an origin URL.
 * We use the R2 bucket's S3-compatible URL as the origin.
 */
app.get("/*", async (c) => {
  const url = new URL(c.req.url);
  const key = url.pathname.slice(1); // Remove leading /

  if (!key || key === "health") {
    return c.json({ error: "Image key required" }, 400);
  }

  // Parse transformation options
  const transformOptions = parseTransformOptions(url.searchParams);

  // If transformations requested, use Cloudflare Image Resizing via R2 origin
  if (transformOptions) {
    const acceptHeader = c.req.header("Accept") ?? null;
    const cfImageOptions = buildCfImageOptions(transformOptions, acceptHeader);

    // Fetch from R2's S3-compatible URL (the actual origin)
    // This avoids recursive fetches to our own worker
    const r2OriginUrl = `${c.env.R2_ORIGIN_URL}/${key}`;

    try {
      const transformedResponse = await fetch(r2OriginUrl, {
        cf: {
          image: cfImageOptions,
          cacheEverything: true,
          cacheTtl: 31536000, // 1 year
        },
      });

      if (transformedResponse.ok) {
        const headers = new Headers(transformedResponse.headers);
        headers.set("Cache-Control", "public, max-age=31536000, immutable");
        return new Response(transformedResponse.body, { headers });
      }
      // Fall through to serve original if transformation fails
    } catch {
      // Fall through to serve original
    }
  }

  // Serve original from R2 (no transformation or transformation failed)
  const object = await c.env.IMAGES.get(key);

  if (!object) {
    return c.json({ error: "Image not found" }, 404);
  }

  const contentType =
    object.httpMetadata?.contentType || "application/octet-stream";

  return new Response(object.body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: object.etag,
    },
  });
});

/**
 * Scheduled cleanup of orphaned temp images.
 * Runs daily at 3 AM UTC.
 */
const scheduled: ExportedHandlerScheduledHandler<Env> = async (
  _event,
  env,
  _ctx,
) => {
  const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
  const keysToDelete: string[] = [];

  // Paginate through all temp objects (R2 list returns max 1000 per call)
  let cursor: string | undefined;
  do {
    const listed = await env.IMAGES.list({ prefix: "temp/", cursor });

    for (const object of listed.objects) {
      if (object.uploaded.getTime() < twentyFourHoursAgo) {
        keysToDelete.push(object.key);
      }
    }

    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  if (keysToDelete.length > 0) {
    // Delete in batches of 100
    for (let i = 0; i < keysToDelete.length; i += 100) {
      const batch = keysToDelete.slice(i, i + 100);
      await Promise.all(batch.map((key) => env.IMAGES.delete(key)));
    }

    console.log(`Cleaned up ${keysToDelete.length} orphaned temp images`);
  }
};

export default {
  fetch: app.fetch,
  scheduled,
};
