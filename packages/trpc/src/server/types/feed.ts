export type SourceType = "url" | "image" | "text" | "ai" | "manual" | "user";

// ─── Recipe Metadata ──────────────────────────────────────────────────────────

/**
 * Recipe metadata for URL-sourced recipes.
 * These recipes can only be viewed on the original site.
 */
interface UrlSourcedRecipe {
  id: number;
  name: string;
  image: string | null;
  sourceType: "url";
  sourceUrl: string;
  sourceDomain: string;
}

/**
 * Recipe metadata for non-URL recipes.
 * These recipes can be viewed in full within the app.
 */
interface AppSourcedRecipe {
  id: number;
  name: string;
  image: string | null;
  sourceType: Exclude<SourceType, "url">;
}

/**
 * Union type for recipe metadata based on source type.
 */
export type RecipeMetadata = UrlSourcedRecipe | AppSourcedRecipe;

// ─── Actor ────────────────────────────────────────────────────────────────────

interface Actor {
  id: string;
  name: string;
  image: string | null;
}

// ─── Base Feed Item ───────────────────────────────────────────────────────────

interface BaseFeedItem {
  id: string;
  actor: Actor;
  createdAt: number;
  // Engagement data (denormalized from DB)
  likeCount: number;
  commentCount: number;
  isLiked: boolean;
}

// ─── Recipe Import Activity ───────────────────────────────────────────────────

/**
 * Feed item for when a user imports a recipe.
 */
export interface RecipeImportFeedItem extends BaseFeedItem {
  type: "recipe_import";
  recipe: RecipeMetadata;
}

// ─── Cooking Review Activity ──────────────────────────────────────────────────

/**
 * Feed item for when a user posts a cooking review.
 */
export interface CookingReviewFeedItem extends BaseFeedItem {
  type: "cooking_review";
  recipe: RecipeMetadata;
  review: {
    rating: number;
    text: string | null;
    images: string[];
  };
}

// ─── Feed Item Union ──────────────────────────────────────────────────────────

/**
 * Discriminated union of all feed item types.
 * Use TypeScript's discriminant on the 'type' field for type narrowing.
 */
export type FeedItem = RecipeImportFeedItem | CookingReviewFeedItem;

// ─── Response Types ───────────────────────────────────────────────────────────

export interface GetFeedResponse {
  items: FeedItem[];
  nextCursor: string | null;
}
