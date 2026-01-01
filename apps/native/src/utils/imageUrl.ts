/**
 * Image URL transformation utility.
 * Appends Cloudflare Image Resizing parameters to image URLs.
 */

export type ImagePreset =
  | "avatar-sm" // 100x100 (for 40-50px display)
  | "avatar-lg" // 200x200 (for 100px display)
  | "recipe-thumb" // 200x200 (compact cards)
  | "recipe-card" // 800x533 (feed cards)
  | "recipe-hero" // 1200x800 (detail screen carousel)
  | "step-thumb" // 240x180 (instruction thumbnails)
  | "step-full" // 1600 max (expanded step images)
  | "full"; // No transformation

const PRESETS: Record<Exclude<ImagePreset, "full">, string> = {
  "avatar-sm": "w=100&h=100&fit=cover&format=auto",
  "avatar-lg": "w=200&h=200&fit=cover&format=auto",
  "recipe-thumb": "w=200&h=200&fit=cover&format=auto",
  "recipe-card": "w=800&h=533&fit=cover&format=auto",
  "recipe-hero": "w=1200&h=800&fit=cover&format=auto",
  "step-thumb": "w=240&h=180&fit=cover&format=auto",
  "step-full": "w=1600&fit=scale-down&format=auto",
};

// Image hosts that support Cloudflare Image Resizing
const TRANSFORMABLE_HOSTS = [
  "images.cook-club.app", // Production
  "pub-f28c31fccf774b38b72b758fe11b56bb.r2.dev", // Dev R2 bucket
];

/**
 * Transforms an image URL by appending Cloudflare Image Resizing parameters.
 *
 * @param url - The original image URL (can be null/undefined)
 * @param preset - The size preset to apply
 * @returns The transformed URL, or undefined if url is null/undefined
 *
 * @example
 * getImageUrl(recipe.coverImage, 'recipe-card')
 * // => "https://images.cook-club.app/recipes/covers/123/abc.jpg?w=800&h=533&fit=cover&format=auto"
 */
export function getImageUrl(
  url: string | null | undefined,
  preset: ImagePreset,
): string | undefined {
  if (!url) return undefined;
  if (preset === "full") return url;

  // Only transform our own images
  const isTransformable = TRANSFORMABLE_HOSTS.some((host) =>
    url.includes(host),
  );
  if (!isTransformable) return url;

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${PRESETS[preset]}`;
}
