import { createContext } from "./context";
import { activityRouter } from "./routers/activity-router";
import { collectionRouter } from "./routers/collection-router";
import { followsRouter } from "./routers/follows-router";
import { recipeRouter } from "./routers/recipe-router";
import { shoppingRouter } from "./routers/shopping-router";
import { userRouter } from "./routers/user-router";
import { router } from "./trpc";

export { createContext };
export type Context = Awaited<ReturnType<typeof createContext>>;

// Re-export service types for use in frontend
export type { UserCollectionWithMetadata } from "./services/collection";
export type { FeedItem } from "./types/feed";

export const appRouter = router({
  user: userRouter,
  recipe: recipeRouter,
  follows: followsRouter,
  collection: collectionRouter,
  shopping: shoppingRouter,
  activity: activityRouter,
});

export type AppRouter = typeof appRouter;
