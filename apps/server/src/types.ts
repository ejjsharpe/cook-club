import type { TRPCEnv } from "@repo/trpc/server/env";

/**
 * Server environment bindings.
 * Extends TRPCEnv with Cloudflare-specific types.
 */
export interface Env extends TRPCEnv {
  // R2 bucket (only used directly in server, not exposed to tRPC)
  IMAGES: R2Bucket;
}
