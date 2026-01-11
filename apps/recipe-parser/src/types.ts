import type { ImageWorkerService } from "cook-club-image-worker/service";

export interface Env {
  AI: Ai;
  BROWSER: Fetcher;
  RECIPE_CACHE: KVNamespace;
  IMAGE_WORKER: ImageWorkerService;
  IMAGE_PUBLIC_URL: string;
}

// Re-export service types for convenience
export type {
  RecipeParserService,
  ParseInput,
  ParseMetadata,
  ParseResponse,
  ChatMessage,
  RecipeConversationState,
  ChatInput,
  ChatResponse,
} from "./service";

// Alias for backwards compatibility
export type ParseResult = import("./service").ParseResponse;
export type ParseError = Extract<ParseResult, { success: false }>;
