import { userRecipes, recipes } from "@repo/db/schemas";
import { type } from "arktype";
import { eq, lt, desc, and, ilike } from "drizzle-orm";

import { router, authedProcedure } from "../trpc";

export const userRouter = router({
  getUser: authedProcedure.query(({ ctx }) => {
    return {
      user: ctx.user,
    };
  }),

  getUserRecipes: authedProcedure
    .input(
      type({
        limit: "number = 20",
        cursor: "number?",
        search: "string?",
      })
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor, search } = input;

      const userRecipesList = await ctx.db
        .select({
          recipe: recipes,
          userRecipe: userRecipes,
        })
        .from(userRecipes)
        .innerJoin(recipes, eq(userRecipes.recipeId, recipes.id))
        .where(
          and(
            eq(userRecipes.userId, ctx.user.id),
            cursor ? lt(userRecipes.createdAt, new Date(cursor)) : undefined,
            search ? ilike(recipes.name, `%${search}%`) : undefined
          )
        )
        .orderBy(desc(userRecipes.createdAt))
        .limit(limit + 1);

      const items = userRecipesList.map((item) => ({
        ...item.recipe,
        addedAt: item.userRecipe.createdAt,
      }));

      let nextCursor: number | undefined = undefined;
      if (items.length > limit) {
        const nextItem = items.pop();
        nextCursor = nextItem?.addedAt.getTime();
      }

      return {
        items,
        nextCursor,
      };
    }),
});
