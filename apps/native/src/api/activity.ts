import { useTRPC } from "@repo/trpc/client";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  useQuery,
} from "@tanstack/react-query";

// Get activity feed with infinite scroll
interface UseActivityFeedParams {
  limit?: number;
}

export const useActivityFeed = ({ limit = 20 }: UseActivityFeedParams = {}) => {
  const trpc = useTRPC();

  const infiniteQueryOptions = trpc.activity.getFeed.infiniteQueryOptions(
    { limit },
    { getNextPageParam: (lastPage) => lastPage?.nextCursor },
  );

  return useInfiniteQuery({
    ...infiniteQueryOptions,
    staleTime: 0,
  });
};

// Create cooking review mutation
export const useCreateCookingReview = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.activity.createCookingReview.mutationOptions({
      onSuccess: () => {
        // Invalidate feed queries to show the new review
        queryClient.invalidateQueries(trpc.activity.getFeed.pathFilter());
      },
    }),
  );
};

// Get reviews for a recipe
interface UseRecipeReviewsParams {
  recipeId: number;
  limit?: number;
}

export const useRecipeReviews = ({
  recipeId,
  limit = 20,
}: UseRecipeReviewsParams) => {
  const trpc = useTRPC();

  const infiniteQueryOptions =
    trpc.activity.getRecipeReviews.infiniteQueryOptions(
      { recipeId, limit },
      { getNextPageParam: (lastPage) => lastPage?.nextCursor },
    );

  return useInfiniteQuery(infiniteQueryOptions);
};

// Get recipe rating
interface UseRecipeRatingParams {
  recipeId: number;
}

export const useRecipeRating = ({ recipeId }: UseRecipeRatingParams) => {
  const trpc = useTRPC();

  return useQuery(trpc.activity.getRecipeRating.queryOptions({ recipeId }));
};

// Get activities for a specific user (for profile pages)
interface UseUserActivitiesParams {
  userId: string;
  limit?: number;
}

export const useUserActivities = ({
  userId,
  limit = 20,
}: UseUserActivitiesParams) => {
  const trpc = useTRPC();

  const infiniteQueryOptions =
    trpc.activity.getUserActivities.infiniteQueryOptions(
      { userId, limit },
      { getNextPageParam: (lastPage) => lastPage?.nextCursor },
    );

  return useInfiniteQuery({
    ...infiniteQueryOptions,
    staleTime: 0,
  });
};
