import { useTRPC } from "@repo/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { useState, useCallback } from "react";

export interface UploadResult {
  key: string;
  publicUrl: string;
}

export interface UseImageUploadOptions {
  onSuccess?: (results: UploadResult[]) => void;
  onError?: (error: Error) => void;
  /** Maximum concurrent uploads (default: 3) */
  maxConcurrent?: number;
}

/**
 * Hook for uploading images to R2 via presigned URLs.
 * Handles the full flow: get presigned URL -> upload to R2 -> return keys.
 * Uploads run in parallel with configurable concurrency.
 */
export function useImageUpload(options: UseImageUploadOptions = {}) {
  const { onSuccess, onError, maxConcurrent = 3 } = options;
  const trpc = useTRPC();
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>(
    {},
  );

  const requestUploadUrlMutation = useMutation(
    trpc.upload.requestUploadUrl.mutationOptions(),
  );

  const uploadSingleImage = useCallback(
    async (localUri: string): Promise<UploadResult> => {
      // Update progress
      setUploadProgress((prev) => ({ ...prev, [localUri]: 0 }));

      // Determine content type from URI
      const extension = localUri.split(".").pop()?.toLowerCase();
      let contentType: "image/jpeg" | "image/png" | "image/webp" = "image/jpeg";
      if (extension === "png") {
        contentType = "image/png";
      } else if (extension === "webp") {
        contentType = "image/webp";
      }

      // Get presigned URL
      const { uploadUrl, publicUrl, key, maxFileSize } =
        await requestUploadUrlMutation.mutateAsync({
          contentType,
        });

      // Fetch the local image as a blob
      const imageResponse = await fetch(localUri);
      const imageBlob = await imageResponse.blob();

      // Validate file size on client before uploading
      if (imageBlob.size > maxFileSize) {
        throw new Error(
          `File size (${Math.round(imageBlob.size / 1024 / 1024)}MB) exceeds maximum allowed (${Math.round(maxFileSize / 1024 / 1024)}MB)`,
        );
      }

      // Upload to R2
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: imageBlob,
        headers: {
          "Content-Type": contentType,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed with status ${uploadResponse.status}`);
      }

      // Update progress to complete
      setUploadProgress((prev) => ({ ...prev, [localUri]: 100 }));

      return { key, publicUrl };
    },
    [requestUploadUrlMutation],
  );

  const uploadImages = useCallback(
    async (localUris: string[]): Promise<UploadResult[]> => {
      const validUris = localUris.filter(Boolean);
      if (validUris.length === 0) return [];

      // Initialize progress for all images
      setUploadProgress(
        validUris.reduce((acc, uri) => ({ ...acc, [uri]: 0 }), {}),
      );

      // Process in batches for controlled concurrency
      const results: UploadResult[] = [];

      for (let i = 0; i < validUris.length; i += maxConcurrent) {
        const batch = validUris.slice(i, i + maxConcurrent);

        const batchResults = await Promise.all(
          batch.map(async (uri) => {
            try {
              return await uploadSingleImage(uri);
            } catch (error) {
              console.error(`Failed to upload image ${uri}:`, error);
              setUploadProgress((prev) => ({ ...prev, [uri]: -1 }));
              throw error;
            }
          }),
        );

        results.push(...batchResults);
      }

      return results;
    },
    [uploadSingleImage, maxConcurrent],
  );

  const uploadMutation = useMutation({
    mutationFn: uploadImages,
    onSuccess: (data) => {
      setUploadProgress({});
      onSuccess?.(data);
    },
    onError: (error: Error) => {
      setUploadProgress({});
      onError?.(error);
    },
  });

  const reset = useCallback(() => {
    setUploadProgress({});
    uploadMutation.reset();
  }, [uploadMutation]);

  return {
    uploadImages: uploadMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
    uploadProgress,
    error: uploadMutation.error,
    reset,
  };
}
