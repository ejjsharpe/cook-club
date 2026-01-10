import { readAsStringAsync, EncodingType } from "expo-file-system/legacy";
import {
  manipulateAsync,
  SaveFormat,
  ImageResult,
} from "expo-image-manipulator";

const MAX_IMAGE_DIMENSION = 480;
const MIN_IMAGE_DIMENSION = 224; // Minimum size for vision models

export interface ResizedImage {
  base64: string;
  mimeType: "image/jpeg";
}

/**
 * Resizes an image and converts it to base64.
 * Always outputs JPEG for optimal size/quality for vision models.
 */
export async function imageToBase64(
  uri: string,
  options?: { maxDimension?: number },
): Promise<ResizedImage> {
  const maxDimension = options?.maxDimension ?? MAX_IMAGE_DIMENSION;

  // First get image dimensions to resize proportionally
  const original = await manipulateAsync(uri, []);
  const { width, height } = original;

  // Calculate new dimensions maintaining aspect ratio
  let newWidth: number;
  let newHeight: number;

  if (width > height) {
    newWidth = Math.min(width, maxDimension);
    newHeight = Math.round((newWidth / width) * height);
    // Ensure minimum height
    if (newHeight < MIN_IMAGE_DIMENSION) {
      newHeight = MIN_IMAGE_DIMENSION;
      newWidth = Math.round((newHeight / height) * width);
    }
  } else {
    newHeight = Math.min(height, maxDimension);
    newWidth = Math.round((newHeight / height) * width);
    // Ensure minimum width
    if (newWidth < MIN_IMAGE_DIMENSION) {
      newWidth = MIN_IMAGE_DIMENSION;
      newHeight = Math.round((newWidth / width) * height);
    }
  }

  // Resize the image
  const resized: ImageResult = await manipulateAsync(
    uri,
    [{ resize: { width: newWidth, height: newHeight } }],
    { compress: 0.5, format: SaveFormat.JPEG },
  );

  const base64 = await readAsStringAsync(resized.uri, {
    encoding: EncodingType.Base64,
  });

  return { base64, mimeType: "image/jpeg" };
}

export function getMimeTypeFromUri(
  uri: string,
): "image/jpeg" | "image/png" | "image/webp" {
  const ext = uri.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}
