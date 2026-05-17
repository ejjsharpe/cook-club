import type { Outputs } from "@repo/trpc/client";
import { useTRPC } from "@repo/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type SubscriptionStatus = Outputs["subscription"]["getStatus"];

export const useSubscriptionStatus = (enabled = true) => {
  const trpc = useTRPC();

  return useQuery({
    ...trpc.subscription.getStatus.queryOptions(),
    enabled,
  });
};

export const useRefreshSubscriptionEntitlement = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation({
    ...trpc.subscription.refreshEntitlement.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries(
        trpc.subscription.getStatus.pathFilter(),
      );
    },
  });
};
