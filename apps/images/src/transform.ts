import type { TransformOptions } from "./types";

const TRANSFORM_PARAM_NAMES = new Set(["w", "h", "fit", "format", "q"]);

const ALLOWED_TRANSFORMS: TransformOptions[] = [
  { width: 100, height: 100, fit: "cover", format: "auto" },
  { width: 200, height: 200, fit: "cover", format: "auto" },
  { width: 900, height: 675, fit: "cover", format: "auto", quality: 78 },
  { width: 800, height: 533, fit: "cover", format: "auto" },
  { width: 1200, height: 800, fit: "cover", format: "auto" },
  { width: 240, height: 180, fit: "cover", format: "auto" },
  { width: 1600, fit: "scale-down", format: "auto" },
];

export function hasTransformParams(searchParams: URLSearchParams): boolean {
  return Array.from(searchParams.keys()).some((key) =>
    TRANSFORM_PARAM_NAMES.has(key),
  );
}

export function isAllowedTransform(options: TransformOptions): boolean {
  return ALLOWED_TRANSFORMS.some(
    (allowed) =>
      options.width === allowed.width &&
      options.height === allowed.height &&
      options.fit === allowed.fit &&
      options.format === allowed.format &&
      options.quality === allowed.quality,
  );
}

/**
 * Parse transformation options from URL query parameters.
 */
export function parseTransformOptions(
  searchParams: URLSearchParams,
): TransformOptions | null {
  const width = searchParams.get("w");
  const height = searchParams.get("h");
  const fit = searchParams.get("fit");
  const format = searchParams.get("format");
  const quality = searchParams.get("q");

  // If no transform params, return null
  if (!width && !height && !fit && !format && !quality) {
    return null;
  }

  const options: TransformOptions = {};

  if (width) {
    const w = parseInt(width, 10);
    if (w > 0 && w <= 4000) {
      options.width = w;
    }
  }

  if (height) {
    const h = parseInt(height, 10);
    if (h > 0 && h <= 4000) {
      options.height = h;
    }
  }

  if (fit && ["cover", "contain", "scale-down"].includes(fit)) {
    options.fit = fit as TransformOptions["fit"];
  }

  if (format && ["auto", "webp", "avif", "jpeg", "png"].includes(format)) {
    options.format = format as TransformOptions["format"];
  }

  if (quality) {
    const q = parseInt(quality, 10);
    if (q >= 1 && q <= 100) {
      options.quality = q;
    }
  }

  return Object.keys(options).length > 0 ? options : null;
}

/**
 * Build Cloudflare image transformation options for fetch.
 */
export function buildCfImageOptions(
  options: TransformOptions,
  acceptHeader: string | null,
): RequestInitCfPropertiesImage {
  const cfImage: RequestInitCfPropertiesImage = {};

  if (options.width) {
    cfImage.width = options.width;
  }

  if (options.height) {
    cfImage.height = options.height;
  }

  if (options.fit) {
    cfImage.fit = options.fit;
  }

  if (options.quality) {
    cfImage.quality = options.quality;
  } else {
    cfImage.quality = 85; // Default quality
  }

  // Handle format - "auto" means pick best based on Accept header
  if (options.format === "auto" || !options.format) {
    if (acceptHeader?.includes("image/avif")) {
      cfImage.format = "avif";
    } else if (acceptHeader?.includes("image/webp")) {
      cfImage.format = "webp";
    }
    // else keep original format
  } else {
    cfImage.format = options.format;
  }

  return cfImage;
}
