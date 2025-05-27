import { createContext } from "./context";
import { recipeRouter } from "./routers/recipe-router";
import { userRouter } from "./routers/user-router";
import { publicProcedure, router, t } from "./trpc";

export { createContext };
export type Context = Awaited<ReturnType<typeof createContext>>;

export const appRouter = router({
  user: userRouter,
  recipe: recipeRouter,
});

export type AppRouter = typeof appRouter;
