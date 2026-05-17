import { TRPCError } from "@trpc/server";

import type { Context } from "./context";

export type RateLimitBucket =
  | "recipe_parse_url"
  | "recipe_parse_url_basic"
  | "recipe_parse_text"
  | "recipe_parse_image"
  | "recipe_chat"
  | "recipe_personalize"
  | "recipe_generate_image"
  | "recipe_nutrition"
  | "upload_presign";

const IMAGE_BUCKETS = new Set<RateLimitBucket>([
  "recipe_parse_image",
  "recipe_generate_image",
]);

export async function enforceRateLimit(
  ctx: Context & { user: NonNullable<Context["user"]> },
  bucket: RateLimitBucket,
) {
  const key = `user:${ctx.user.id}`;

  if (bucket === "upload_presign") {
    await limitOrThrow(ctx.env.UPLOAD_RATE_LIMITER, key);
    return;
  }

  await limitOrThrow(ctx.env.AI_RATE_LIMITER, key);

  if (IMAGE_BUCKETS.has(bucket)) {
    await limitOrThrow(ctx.env.IMAGE_AI_RATE_LIMITER, key);
  }
}

async function limitOrThrow(
  limiter: Context["env"]["AI_RATE_LIMITER"],
  key: string,
) {
  if (!limiter) {
    return;
  }

  const outcome = await limiter.limit({ key });
  if (!outcome.success) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "You have hit the rate limit for this action. Try again later.",
    });
  }
}
