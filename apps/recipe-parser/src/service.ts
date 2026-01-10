/**
 * Service binding interface for the recipe parser.
 * Used by other workers to call this service.
 * This file has no Cloudflare dependencies.
 */

import type { ParsedRecipe } from "./schema";

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

// Fridge Snap types
export interface IdentifyIngredientsInput {
  imageBase64: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
}

export type IdentifyIngredientsResponse =
  | {
      success: true;
      ingredients: string[];
      confidence: "high" | "medium" | "low";
    }
  | {
      success: false;
      error: { code: string; message: string };
    };

export interface RecipeSuggestion {
  id: string;
  name: string;
  description: string;
  estimatedTime: number;
  difficulty: "easy" | "medium" | "hard";
  matchedIngredients: string[];
  additionalIngredients: string[];
}

export interface SuggestRecipesInput {
  ingredients: string[];
  count: number;
}

export type SuggestRecipesResponse =
  | {
      success: true;
      suggestions: RecipeSuggestion[];
    }
  | {
      success: false;
      error: { code: string; message: string };
    };

export interface GenerateFromSuggestionInput {
  suggestion: RecipeSuggestion;
  availableIngredients: string[];
}

export interface RecipeParserService {
  parse(input: ParseInput): Promise<ParseResponse>;
  chat(input: ChatInput): Promise<ChatResponse>;
  identifyIngredients(
    input: IdentifyIngredientsInput,
  ): Promise<IdentifyIngredientsResponse>;
  suggestRecipes(input: SuggestRecipesInput): Promise<SuggestRecipesResponse>;
  generateFromSuggestion(
    input: GenerateFromSuggestionInput,
  ): Promise<ParseResponse>;
}
