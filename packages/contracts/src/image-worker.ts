export type ImageContentType = "image/jpeg" | "image/png" | "image/webp";

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

export interface UploadFromUrlResponse {
  success: boolean;
  publicUrl?: string;
  key?: string;
  error?: string;
}

export interface ImageWorkerService {
  presign(contentType: ImageContentType): Promise<PresignedUrlResponse>;
  verify(keys: string[]): Promise<VerifyResponse>;
  move(moves: { from: string; to: string }[]): Promise<MoveResponse>;
  delete(keys: string[]): Promise<void>;
  uploadFromUrl(
    sourceUrl: string,
    destinationKey: string,
  ): Promise<UploadFromUrlResponse>;
}
