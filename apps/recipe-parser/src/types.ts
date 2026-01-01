export interface Env {
  AI: Ai;
  BROWSER: Fetcher;
  RECIPE_CACHE: KVNamespace;
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
