export type SourceType = "url" | "image" | "text" | "ai" | "manual" | "user";

export interface FeedItem {
  id: string;
  type: "recipe_import" | "cooking_review";
  actorId: string;
  actorName: string;
  actorImage: string | null;
  recipeId: number | null;
  recipeName: string | null;
  recipeImage: string | null;
  sourceUrl: string | null;
  sourceDomain: string | null;
  sourceType: SourceType;
  isExternalRecipe: boolean;
  canViewFullRecipe: boolean;
  batchCount: number | null;
  batchSource: string | null;
  rating: number | null;
  reviewText: string | null;
  reviewImages: string[];
  createdAt: number;
}

export interface GetFeedResponse {
  items: FeedItem[];
  nextCursor: string | null;
}
