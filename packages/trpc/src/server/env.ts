/**
 * TRPCEnv - Environment bindings required by tRPC routers.
 * Types flow from microservices → tRPC → server.
 */

import type {
  DurableObjectNamespace,
  ImageWorkerService,
  RecipeParserService,
} from "@repo/contracts";
import type { AuthEnv } from "@repo/auth";

// Re-export service types for convenience
export type { ImageWorkerService, RecipeParserService } from "@repo/contracts";
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
  RECIPE_PARSER: RecipeParserService;
  USER_FEED: DurableObjectNamespace;
  IMAGE_WORKER: ImageWorkerService;
  IMAGE_PUBLIC_URL: string;
}
