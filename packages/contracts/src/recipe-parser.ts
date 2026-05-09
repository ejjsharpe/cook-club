import type { ParsedRecipe } from "./recipe";

export type ParseInput =
  | { type: "url"; data: string; structuredOnly?: boolean }
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

export type ParseResponse =
  | {
      success: true;
      data: ParsedRecipe;
      metadata: ParseMetadata;
    }
  | {
      success: false;
      error: {
        code: string;
        message: string;
      };
    };

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
      recipe: ParsedRecipe;
      isComplete: true;
    }
  | {
      type: "error";
      error: { code: string; message: string };
    };

export interface RecipeParserService {
  parse(input: ParseInput): Promise<ParseResponse>;
  chat(input: ChatInput): Promise<ChatResponse>;
}
