import type { ParsedRecipe } from "./recipe";

export type ParseInput =
  | { type: "url"; data: string; structuredOnly?: boolean }
  | { type: "text"; data: string }
  | {
      type: "image";
      data: string;
      mimeType: "image/jpeg" | "image/png" | "image/webp";
    };

export type PersonalizationGoal =
  | "vegetarian"
  | "vegan"
  | "gluten_free"
  | "dairy_free"
  | "low_carb"
  | "high_protein"
  | "budget"
  | "healthier"
  | "kid_friendly"
  | "batch_cook"
  | "meal_prep";

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

export interface PersonalizeRecipeInput {
  recipe: ParsedRecipe;
  goals: PersonalizationGoal[];
  allergyNotes?: string | null;
  customNotes?: string | null;
}

export interface GenerateRecipeImageInput {
  name: string;
  description?: string | null;
  ingredients?: string[];
  instructions?: string[];
  ownerId?: string;
}

export type GenerateRecipeImageResponse =
  | {
      success: true;
      imageUploadId: string;
      publicUrl: string;
    }
  | {
      success: false;
      error: {
        code: string;
        message: string;
      };
    };

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

export interface RecipeAIService {
  parse(input: ParseInput): Promise<ParseResponse>;
  chat(input: ChatInput): Promise<ChatResponse>;
  personalize(input: PersonalizeRecipeInput): Promise<ParseResponse>;
  generateImage(
    input: GenerateRecipeImageInput,
  ): Promise<GenerateRecipeImageResponse>;
}
