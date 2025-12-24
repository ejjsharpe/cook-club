import { useTRPC } from "@repo/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export const useUser = () => {
  const trpc = useTRPC();

  return useQuery(trpc.user.getUser.queryOptions());
};

export const useUpdateProfile = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation({
    ...trpc.user.updateProfile.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries(trpc.user.getUser.queryFilter());
    },
  });
};

export const useCompleteOnboarding = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation({
    ...trpc.user.completeOnboarding.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries(trpc.user.getUser.queryFilter());
    },
  });
};
