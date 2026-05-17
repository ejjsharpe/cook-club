/**
 * TRPCEnv - Environment bindings required by tRPC routers.
 * Types flow from microservices → tRPC → server.
 */

import type { AuthEnv } from "@repo/auth";
import type {
  DurableObjectNamespace,
  ImageService,
  RecipeAIService,
} from "@repo/contracts";

export interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

// Re-export service types for convenience
export type { ImageService, RecipeAIService } from "@repo/contracts";
export type {
  DurableObjectNamespace,
  DurableObjectId,
  DurableObjectStub,
} from "@repo/contracts";

/**
 * Environment bindings required by tRPC routers.
 * The server's Env type extends this.
 */
export interface TRPCEnv extends AuthEnv {
  // Service bindings
  RECIPE_AI: RecipeAIService;
  USER_FEED: DurableObjectNamespace;
  IMAGE_SERVICE: ImageService;
  IMAGE_PUBLIC_URL: string;
  EXPO_ACCESS_TOKEN?: string;
  API_RATE_LIMITER?: RateLimitBinding;
  AI_RATE_LIMITER?: RateLimitBinding;
  IMAGE_AI_RATE_LIMITER?: RateLimitBinding;
  UPLOAD_RATE_LIMITER?: RateLimitBinding;
}
