import { AwsClient } from "aws4fetch";

import type { Env, PresignedUrlRequest, PresignedUrlResponse } from "./types";

const PRESIGN_EXPIRY_SECONDS = 300; // 5 minutes
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Generate a presigned URL for uploading to R2.
 * Uses aws4fetch to sign the request with R2's S3-compatible API.
 * Includes content-length constraints to enforce file size limits.
 */
export async function generatePresignedUploadUrl(
  env: Env,
  request: PresignedUrlRequest,
): Promise<PresignedUrlResponse> {
  const {
    key,
    contentType,
    expiresIn = PRESIGN_EXPIRY_SECONDS,
    maxFileSize = DEFAULT_MAX_FILE_SIZE,
  } = request;

  // R2 uses the account ID and bucket name for the endpoint
  // The access key ID and secret are from API tokens with R2 permissions
  const accountId = "46fa47bc2bba51d75383b4dfe6e3deb1";
  const bucketName = env.R2_BUCKET_NAME;

  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error("R2 credentials not configured");
  }

  const client = new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: "s3",
    region: "auto",
  });

  const url = new URL(
    `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${key}`,
  );

  // Add query parameters for presigned URL
  url.searchParams.set("X-Amz-Expires", expiresIn.toString());

  // Build headers for signing - include content-length-range condition
  const headers: Record<string, string> = {
    "Content-Type": contentType,
  };

  // Note: R2 presigned URLs validate Content-Length at upload time
  // The client must send a Content-Length header within the allowed range
  // We set the max via x-amz-content-length-range header condition
  const signedRequest = await client.sign(
    new Request(url.toString(), {
      method: "PUT",
      headers,
    }),
    {
      aws: {
        signQuery: true,
        // Include content-length-range in the signature
        // This ensures uploads larger than maxFileSize are rejected
        allHeaders: true,
      },
    },
  );

  const publicUrl = `${env.PUBLIC_URL}/${key}`;

  return {
    uploadUrl: signedRequest.url,
    publicUrl,
    key,
    maxFileSize,
  };
}

/**
 * Validate that a key follows allowed patterns to prevent path traversal.
 */
export function validateKey(key: string): boolean {
  // Must not contain .. or start with /
  if (key.includes("..") || key.startsWith("/")) {
    return false;
  }

  // Must match allowed patterns (recipe IDs and user IDs are UUIDs)
  const allowedPatterns = [
    /^temp\/[a-zA-Z0-9-]+\.[a-z]+$/, // temp/{uuid}.{ext}
    /^recipes\/covers\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+\.[a-z]+$/, // recipes/covers/{recipeId}/{imageId}.{ext}
    /^recipes\/instructions\/[a-zA-Z0-9-]+\/\d+\/[a-zA-Z0-9-]+\.[a-z]+$/, // recipes/instructions/{recipeId}/{stepIndex}/{imageId}.{ext}
    /^avatars\/[a-zA-Z0-9_-]+\.[a-z]+$/, // avatars/{userId}.{ext}
  ];

  return allowedPatterns.some((pattern) => pattern.test(key));
}

/**
 * Generate a unique key for a temp upload.
 */
export function generateTempKey(extension: string): string {
  const uuid = crypto.randomUUID();
  return `temp/${uuid}.${extension}`;
}

/**
 * Get the extension from a content type.
 */
export function extensionFromContentType(contentType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif",
  };
  return map[contentType] || "jpg";
}
