/**
 * TRPCEnv - Environment bindings required by tRPC routers.
 * Types flow from microservices → tRPC → server.
 */

import type { ImageWorkerService } from "cook-club-image-worker/service";
import type { RecipeParserService } from "cook-club-recipe-parser/service";
import type { DurableObjectNamespace } from "cook-club-server/service-types";

// Re-export service types for convenience
export type { ImageWorkerService } from "cook-club-image-worker/service";
export type { RecipeParserService } from "cook-club-recipe-parser/service";
export type {
  DurableObjectNamespace,
  DurableObjectId,
  DurableObjectStub,
} from "cook-club-server/service-types";

/**
 * Environment bindings required by tRPC routers.
 * The server's Env type extends this.
 */
export interface TRPCEnv {
  // Database
  DATABASE_URL: string;
  // Auth
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  FB_CLIENT_ID: string;
  FB_CLIENT_SECRET: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  // Service bindings
  RECIPE_PARSER: RecipeParserService;
  USER_FEED: DurableObjectNamespace;
  IMAGE_WORKER: ImageWorkerService;
  IMAGE_PUBLIC_URL: string;
}
