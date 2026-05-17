import {
  getCurrentSubscriptionStatus,
  refreshAdaptyEntitlement,
} from "../services/subscription.service";
import { router, authedProcedure } from "../trpc";

export const subscriptionRouter = router({
  getStatus: authedProcedure.query(async ({ ctx }) => {
    return getCurrentSubscriptionStatus(ctx);
  }),

  refreshEntitlement: authedProcedure.mutation(async ({ ctx }) => {
    return refreshAdaptyEntitlement(ctx);
  }),
});
