import { createContext } from "./context";
import { recipeRouter } from "./routers/recipe-router";
import { userRouter } from "./routers/user-router";
import { followsRouter } from "./routers/follows-router";
import { router } from "./trpc";

export { createContext };
export type Context = Awaited<ReturnType<typeof createContext>>;

export const appRouter = router({
  user: userRouter,
  recipe: recipeRouter,
  follows: followsRouter,
});

export type AppRouter = typeof appRouter;
