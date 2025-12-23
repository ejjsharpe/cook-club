export interface Env {
  AI: Ai;
  BROWSER: Fetcher;
  RECIPE_CACHE: KVNamespace;
}

export type ParseInput =
  | { type: "url"; data: string }
  | { type: "text"; data: string }
  | {
      type: "image";
      data: string;
      mimeType: "image/jpeg" | "image/png" | "image/webp";
    };

export interface ParseMetadata {
  source: "url" | "text" | "image";
  parseMethod?: "structured_data" | "ai_enhanced" | "ai_only";
  confidence: "high" | "medium" | "low";
  cached?: boolean;
}

export type ParseResult =
  | {
      success: true;
      data: import("./schema").ParsedRecipe;
      metadata: ParseMetadata;
    }
  | {
      success: false;
      error: {
        code: string;
        message: string;
      };
    };

// Alias for backwards compatibility
export type ParseResponse = ParseResult;
export type ParseError = Extract<ParseResult, { success: false }>;

// Chat types for AI recipe generation
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface RecipeConversationState {
  ingredients: string[] | null;
  cuisinePreference: string | null;
  willingToShop: boolean | null;
  maxCookingTime: string | null;
}

export interface ChatInput {
  messages: ChatMessage[];
  conversationState: RecipeConversationState;
}

export type ChatResponse =
  | {
      type: "message";
      message: string;
      suggestedReplies?: string[];
      updatedState: RecipeConversationState;
      isComplete: false;
    }
  | {
      type: "recipe";
      recipe: import("./schema").ParsedRecipe;
      isComplete: true;
    }
  | {
      type: "error";
      error: { code: string; message: string };
    };
