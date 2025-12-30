// Fallback type declaration for when Cloudflare types aren't available
// (e.g., when this file is imported from a non-Cloudflare environment like React Native)
// These will be overridden by @cloudflare/workers-types when available
type FallbackDurableObjectId = {
  toString(): string;
};
type FallbackDurableObjectStub = {
  fetch(request: Request): Promise<Response>;
};
type FallbackDurableObjectNamespace = {
  idFromName(name: string): FallbackDurableObjectId;
  get(id: FallbackDurableObjectId): FallbackDurableObjectStub;
};

// Type for the recipe parser service binding
// This matches the ParseInput/ParseResponse types from cook-club-recipe-parser
type ParseInput =
  | { type: "url"; data: string }
  | { type: "text"; data: string }
  | {
      type: "image";
      data: string;
      mimeType: "image/jpeg" | "image/png" | "image/webp";
    };

interface ParsedRecipe {
  name: string;
  description?: string | null;
  prepTime?: number | null; // minutes
  cookTime?: number | null; // minutes
  totalTime?: number | null; // minutes
  servings?: number | null;
  sourceUrl?: string | null;
  ingredients: {
    index: number;
    quantity?: number | null;
    unit?: string | null;
    name: string;
  }[];
  instructions: {
    index: number;
    instruction: string;
    imageUrl?: string | null;
  }[];
  images?: string[];
  suggestedTags?: {
    type: "cuisine" | "meal_type" | "occasion";
    name: string;
  }[];
}

interface ParseMetadata {
  source: "url" | "text" | "image";
  parseMethod?: "structured_data" | "ai_enhanced" | "ai_only";
  confidence: "high" | "medium" | "low";
  cached?: boolean;
}

type ParseResponse =
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

// Chat types for AI recipe generation
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface RecipeConversationState {
  ingredients: string[] | null;
  cuisinePreference: string | null;
  willingToShop: boolean | null;
  maxCookingTime: string | null;
}

interface ChatInput {
  messages: ChatMessage[];
  conversationState: RecipeConversationState;
}

type ChatResponse =
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

// Use the Cloudflare type if available, otherwise use fallback
type DurableObjectNamespaceType = typeof globalThis extends {
  DurableObjectNamespace: infer T;
}
  ? T
  : FallbackDurableObjectNamespace;

export interface Env {
  DATABASE_URL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  FB_CLIENT_ID: string;
  FB_CLIENT_SECRET: string;
  RECIPE_PARSER: RecipeParserService;
  USER_FEED: DurableObjectNamespaceType;
}
