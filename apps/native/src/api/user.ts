import type { Outputs } from "@repo/trpc/client";
import { useTRPC } from "@repo/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// API Response Types
export type User = Outputs["user"]["getUser"]["user"];

export const useUser = (
  { enabled = true }: { enabled?: boolean } = { enabled: true },
) => {
  const trpc = useTRPC();

  return useQuery({ ...trpc.user.getUser.queryOptions(), enabled });
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

export const useUpdatePreferences = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation({
    ...trpc.user.updatePreferences.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries(trpc.user.getUser.queryFilter());
    },
  });
};
