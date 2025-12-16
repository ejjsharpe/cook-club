export interface Env {
  AI: Ai;
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
