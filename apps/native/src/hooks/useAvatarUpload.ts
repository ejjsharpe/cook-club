import { useTRPC } from "@repo/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback } from "react";

export interface UseAvatarUploadOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Hook for uploading avatar images.
 * Handles the full flow: get presigned URL -> upload to R2 -> move to avatars/ -> update user.
 */
export function useAvatarUpload(options: UseAvatarUploadOptions = {}) {
  const { onSuccess, onError } = options;
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState(0);

  const requestUploadUrlMutation = useMutation(
    trpc.upload.requestUploadUrl.mutationOptions(),
  );

  const uploadAvatarMutation = useMutation(
    trpc.user.uploadAvatar.mutationOptions(),
  );

  const upload = useCallback(
    async (localUri: string): Promise<void> => {
      setProgress(10);

      // Determine content type from URI
      const extension = localUri.split(".").pop()?.toLowerCase();
      let contentType: "image/jpeg" | "image/png" | "image/webp" = "image/jpeg";
      if (extension === "png") {
        contentType = "image/png";
      } else if (extension === "webp") {
        contentType = "image/webp";
      }

      // Get presigned URL
      const { uploadUrl, key, maxFileSize } =
        await requestUploadUrlMutation.mutateAsync({
          contentType,
        });
      setProgress(25);

      // Fetch the local image as a blob
      const imageResponse = await fetch(localUri);
      const imageBlob = await imageResponse.blob();
      setProgress(40);

      // Validate file size
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
      setProgress(70);

      // Finalize: move to avatars/ and update DB
      await uploadAvatarMutation.mutateAsync({ imageKey: key });
      setProgress(90);

      // Invalidate user query to refresh avatar
      await queryClient.invalidateQueries({ queryKey: [["user", "getUser"]] });
      setProgress(100);
    },
    [requestUploadUrlMutation, uploadAvatarMutation, queryClient],
  );

  const uploadMutation = useMutation({
    mutationFn: upload,
    onSuccess: () => {
      setProgress(0);
      onSuccess?.();
    },
    onError: (error: Error) => {
      setProgress(0);
      onError?.(error);
    },
  });

  const reset = useCallback(() => {
    setProgress(0);
    uploadMutation.reset();
  }, [uploadMutation]);

  return {
    upload: uploadMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
    progress,
    error: uploadMutation.error,
    reset,
  };
}
