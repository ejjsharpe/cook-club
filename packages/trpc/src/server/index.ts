import { createContext } from "./context";
import { activityRouter } from "./routers/activity-router";
import { collectionRouter } from "./routers/collection-router";
import { followsRouter } from "./routers/follows-router";
import { recipeRouter } from "./routers/recipe-router";
import { shoppingRouter } from "./routers/shopping-router";
import { uploadRouter } from "./routers/upload-router";
import { userRouter } from "./routers/user-router";
import { router } from "./trpc";

export { createContext };
export type Context = Awaited<ReturnType<typeof createContext>>;

export const appRouter = router({
  user: userRouter,
  recipe: recipeRouter,
  follows: followsRouter,
  collection: collectionRouter,
  shopping: shoppingRouter,
  activity: activityRouter,
  upload: uploadRouter,
});

export type AppRouter = typeof appRouter;
