import { router, authedProcedure } from "../trpc";

export const userRouter = router({
  getUser: authedProcedure.query(({ ctx }) => {
    return {
      user: ctx.user,
    };
  }),
});
