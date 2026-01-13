// DB-only activity functions (hydration from activity IDs)
export { hydrateActivityIds, buildFeedItem } from "./activity-propagation.service";

// Feed types for activity items
export type {
  FeedItem,
  RecipeMetadata,
  SourceType,
  RecipeImportFeedItem,
  CookingReviewFeedItem,
  GetFeedResponse,
} from "./feed-types";
