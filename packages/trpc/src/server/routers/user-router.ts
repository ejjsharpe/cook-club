import { userRecipes, recipes } from "@repo/db/schemas";
import { TRPCError } from "@trpc/server";
import { type } from "arktype";
import { eq } from "drizzle-orm";

import { router, authedProcedure, paginatedProcedure } from "../trpc";

export const userRouter = router({
  getUser: authedProcedure.query(({ ctx }) => {
    return {
      user: ctx.user,
    };
  }),

  getUsersRecipes: paginatedProcedure.query(async ({ input, ctx }) => {
    if (input instanceof type.errors) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: input.summary,
      });
    }

    const usersRecipes = await ctx.db
      .select()
      .from(userRecipes)
      .innerJoin(recipes, eq(userRecipes.recipeId, recipes.id))
      .where(eq(userRecipes.userId, ctx.user.id))
      .limit(input.limit ?? 10)
      .offset((input.page ?? 0) * (input.limit ?? 10));

    const allUsersRecipes = await ctx.db
      .select()
      .from(userRecipes)
      .innerJoin(recipes, eq(userRecipes.recipeId, recipes.id))
      .where(eq(userRecipes.userId, ctx.user.id));

    return {
      recipes: usersRecipes,
      total: allUsersRecipes.length,
      page: input.page ?? 0,
      limit: input.limit ?? 10,
    };
  }),
});
