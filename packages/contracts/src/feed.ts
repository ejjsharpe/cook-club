export type FeedSourceType = "url" | "image" | "text" | "ai" | "manual" | "user";

interface UrlSourcedRecipe {
  id: number;
  name: string;
  image: string | null;
  sourceType: "url";
  sourceUrl: string;
  sourceDomain: string;
}

interface AppSourcedRecipe {
  id: number;
  name: string;
  image: string | null;
  sourceType: Exclude<FeedSourceType, "url">;
}

export type RecipeMetadata = UrlSourcedRecipe | AppSourcedRecipe;

interface Actor {
  id: string;
  name: string;
  username: string | null;
  image: string | null;
}

interface BaseFeedItem {
  id: string;
  actor: Actor;
  createdAt: number;
  likeCount: number;
  commentCount: number;
  isLiked: boolean;
}

export interface RecipeImportFeedItem extends BaseFeedItem {
  type: "recipe_import";
  recipe: RecipeMetadata;
}

export interface CookingReviewFeedItem extends BaseFeedItem {
  type: "cooking_review";
  recipe: RecipeMetadata;
  review: {
    rating: number;
    text: string | null;
    images: string[];
  };
}

export type FeedItem = RecipeImportFeedItem | CookingReviewFeedItem;

export interface GetFeedResponse {
  items: FeedItem[];
  nextCursor: string | null;
}

export interface DurableObjectId {
  toString(): string;
}

export interface DurableObjectStub {
  fetch(request: Request): Promise<Response>;
}

export interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}

export interface ActivityServiceEnv {
  USER_FEED: DurableObjectNamespace;
}
