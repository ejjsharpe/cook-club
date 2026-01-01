export interface Env {
  IMAGES: R2Bucket;
  // R2 API credentials for presigned URLs
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  // Public URL base for the image worker (e.g., https://images.cook-club.app)
  // This is used for generating public URLs returned to clients
  PUBLIC_URL: string;
  // R2 bucket's public URL for image transformations origin
  // (e.g., https://pub-{hash}.r2.dev or custom domain pointing to R2)
  R2_ORIGIN_URL: string;
}

// Re-export service types for convenience
export type {
  ImageWorkerService,
  PresignedUrlResponse,
  VerifyResponse,
  MoveResult,
  MoveResponse,
} from "./service";

export interface TransformOptions {
  width?: number;
  height?: number;
  fit?: "cover" | "contain" | "scale-down";
  format?: "auto" | "webp" | "avif" | "jpeg" | "png";
  quality?: number;
}

export interface PresignedUrlRequest {
  key: string;
  contentType: string;
  expiresIn?: number;
  maxFileSize?: number;
}
