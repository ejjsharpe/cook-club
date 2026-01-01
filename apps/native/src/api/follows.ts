import type { Outputs } from "@repo/trpc/client";
import { useTRPC } from "@repo/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// API Response Types
export type SearchUser = Outputs["follows"]["searchUsers"][number];
export type UserProfile = Outputs["follows"]["getUserProfile"];
export type FollowItem = Outputs["follows"]["getFollowing"][number];

export const useFollowing = () => {
  const trpc = useTRPC();
  return useQuery(trpc.follows.getFollowing.queryOptions());
};

export const useFollowers = () => {
  const trpc = useTRPC();
  return useQuery(trpc.follows.getFollowers.queryOptions());
};

interface UseSearchUsersParams {
  query: string;
  limit?: number;
}

export const useSearchUsers = ({ query, limit = 10 }: UseSearchUsersParams) => {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.follows.searchUsers.queryOptions({ query, limit }),
    enabled: query.length >= 2, // Only search when query is long enough
  });
};

interface UseUserProfileParams {
  userId: string;
}

export const useUserProfile = ({ userId }: UseUserProfileParams) => {
  const trpc = useTRPC();

  return useQuery(trpc.follows.getUserProfile.queryOptions({ userId }));
};

// Mutations
export const useFollowUser = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const mutationOptions = trpc.follows.followUser.mutationOptions({
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["follows"] });
    },
  });

  return useMutation(mutationOptions);
};

export const useUnfollowUser = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation({
    ...trpc.follows.unfollowUser.mutationOptions(),
    onSuccess: () => {
      // Invalidate all follow-related queries
      queryClient.invalidateQueries({ queryKey: ["follows"] });
    },
  });
};

// Get a specific user's followers
interface UseUserFollowersParams {
  userId: string;
}

export const useUserFollowers = ({ userId }: UseUserFollowersParams) => {
  const trpc = useTRPC();
  return useQuery(trpc.follows.getUserFollowers.queryOptions({ userId }));
};

// Get a specific user's following
interface UseUserFollowingParams {
  userId: string;
}

export const useUserFollowing = ({ userId }: UseUserFollowingParams) => {
  const trpc = useTRPC();
  return useQuery(trpc.follows.getUserFollowing.queryOptions({ userId }));
};
