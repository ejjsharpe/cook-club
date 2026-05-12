import { AwsClient } from "aws4fetch";

import type { Env, PresignedUrlRequest, PresignedUrlResponse } from "./types";

const PRESIGN_EXPIRY_SECONDS = 300; // 5 minutes
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function getR2S3BucketUrl(env: Env): string {
  const configured = env.R2_S3_API_URL?.replace(/\/+$/, "");
  if (configured) {
    return configured;
  }

  const accountId = env.R2_ACCOUNT_ID;
  const bucketName = env.R2_BUCKET_NAME;

  if (!accountId) {
    throw new Error("R2 account ID not configured");
  }

  if (!bucketName) {
    throw new Error("R2 bucket name not configured");
  }

  return `https://${accountId}.r2.cloudflarestorage.com/${bucketName}`;
}

/**
 * Generate a presigned URL for uploading to R2.
 * Uses aws4fetch to sign the request with R2's S3-compatible API.
 * Returns the accepted max size so the caller can validate before uploading.
 * R2 presigned PUT URLs cannot enforce this by themselves; the Worker verifies
 * object size and content type before moving temp objects into permanent keys.
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

  const url = new URL(`${getR2S3BucketUrl(env)}/${key}`);

  // Add query parameters for presigned URL
  url.searchParams.set("X-Amz-Expires", expiresIn.toString());

  // Build headers for signing.
  const headers: Record<string, string> = {
    "Content-Type": contentType,
  };

  const signedRequest = await client.sign(
    new Request(url.toString(), {
      method: "PUT",
      headers,
    }),
    {
      aws: {
        signQuery: true,
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
    /^temp\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9-]+\.[a-z]+$/, // temp/{ownerId}/{uuid}.{ext}
    /^temp\/generated\/[a-zA-Z0-9-]+\.[a-z]+$/, // temp/generated/{uuid}.{ext}
    /^recipes\/covers\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+\.[a-z]+$/, // recipes/covers/{recipeId}/{imageId}.{ext}
    /^recipes\/instructions\/[a-zA-Z0-9-]+\/\d+\/[a-zA-Z0-9-]+\.[a-z]+$/, // recipes/instructions/{recipeId}/{stepIndex}/{imageId}.{ext}
    /^avatars\/[a-zA-Z0-9_-]+\.[a-z]+$/, // avatars/{userId}.{ext}
    /^social\/instagram\/[a-zA-Z0-9-]+\.[a-z]+$/, // social/instagram/{imageId}.{ext}
    /^social\/tiktok\/[a-zA-Z0-9-]+\.[a-z]+$/, // social/tiktok/{imageId}.{ext}
  ];

  return allowedPatterns.some((pattern) => pattern.test(key));
}

export function generateUserTempKey(ownerId: string, extension: string): string {
  return `temp/${sanitizeOwnerId(ownerId)}/${crypto.randomUUID()}.${extension}`;
}

export function sanitizeOwnerId(ownerId: string): string {
  return ownerId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function isOwnedTempKey(key: string, ownerId: string): boolean {
  return key.startsWith(`temp/${sanitizeOwnerId(ownerId)}/`);
}

/**
 * Generate a unique key for a trusted service-generated temp upload.
 */
export function generateGeneratedTempKey(extension: string): string {
  const uuid = crypto.randomUUID();
  return `temp/generated/${uuid}.${extension}`;
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
