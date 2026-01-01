/**
 * Service binding interface for the image worker.
 * Used by other workers to call this service via RPC.
 * This file has no Cloudflare dependencies so it can be imported anywhere.
 */

export interface PresignedUrlResponse {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  maxFileSize: number;
}

export interface VerifyResponse {
  valid: boolean;
  results: { key: string; exists: boolean }[];
}

export interface MoveResult {
  from: string;
  to: string;
  success: boolean;
  error?: string;
}

export interface MoveResponse {
  success: boolean;
  results: MoveResult[];
}

export interface ImageWorkerService {
  presign(
    contentType: "image/jpeg" | "image/png" | "image/webp",
  ): Promise<PresignedUrlResponse>;

  verify(keys: string[]): Promise<VerifyResponse>;

  move(moves: { from: string; to: string }[]): Promise<MoveResponse>;

  delete(keys: string[]): Promise<void>;
}
