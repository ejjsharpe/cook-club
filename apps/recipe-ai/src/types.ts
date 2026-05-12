import type { ImageService } from "@repo/contracts/images";

export interface Env {
  AI: Ai;
  BROWSER: Fetcher;
  RECIPE_CACHE: KVNamespace;
  IMAGE_SERVICE: ImageService;
  IMAGE_PUBLIC_URL: string;
  ENVIRONMENT?: string;
}

// Re-export service types for convenience
export type {
  RecipeAIService,
  ParseInput,
  ParseMetadata,
  ParseResponse,
  ChatMessage,
  RecipeConversationState,
  ChatInput,
  ChatResponse,
  GenerateRecipeImageInput,
  GenerateRecipeImageResponse,
  PersonalizationGoal,
  PersonalizeRecipeInput,
} from "./service";

// Alias for backwards compatibility
export type ParseResult = import("./service").ParseResponse;
export type ParseError = Extract<ParseResult, { success: false }>;
