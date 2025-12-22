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
  prepTime?: string | null;
  cookTime?: string | null;
  totalTime?: string | null;
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

export interface RecipeParserService {
  parse(input: ParseInput): Promise<ParseResponse>;
}

export interface Env {
  DATABASE_URL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  FB_CLIENT_ID: string;
  FB_CLIENT_SECRET: string;
  RECIPE_PARSER: RecipeParserService;
}
