import type { Outputs } from "@repo/trpc/client";
import { useTRPC } from "@repo/trpc/client";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  useQuery,
} from "@tanstack/react-query";

// API Response Types
export type FeedItem = Outputs["activity"]["getFeed"]["items"][number];
export type RecipeImportFeedItem = Extract<FeedItem, { type: "recipe_import" }>;
export type CookingReviewFeedItem = Extract<
  FeedItem,
  { type: "cooking_review" }
>;

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

// Infinite query data structure
interface InfiniteData<T> {
  pages: T[];
  pageParams: unknown[];
}

type FeedPage = { items: FeedItem[]; nextCursor: string | null };
type UserActivitiesPage = { items: FeedItem[]; nextCursor: number | null };

// Toggle like mutation with optimistic updates on feed items
export const useToggleActivityLike = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.activity.toggleLike.mutationOptions({
      onMutate: async ({ activityEventId }) => {
        // Cancel outgoing feed refetches
        await queryClient.cancelQueries(trpc.activity.getFeed.pathFilter());
        await queryClient.cancelQueries(
          trpc.activity.getUserActivities.pathFilter(),
        );

        // Snapshot previous feed data
        const previousFeedData = queryClient.getQueriesData<
          InfiniteData<FeedPage>
        >(trpc.activity.getFeed.pathFilter());
        const previousUserActivitiesData = queryClient.getQueriesData<
          InfiniteData<UserActivitiesPage>
        >(trpc.activity.getUserActivities.pathFilter());

        // Helper to update feed items
        const updateFeedItem = (item: FeedItem): FeedItem => {
          if (item.id !== String(activityEventId)) return item;
          return {
            ...item,
            isLiked: !item.isLiked,
            likeCount: item.isLiked ? item.likeCount - 1 : item.likeCount + 1,
          };
        };

        // Optimistically update getFeed queries
        queryClient.setQueriesData<InfiniteData<FeedPage>>(
          trpc.activity.getFeed.pathFilter(),
          (old) => {
            if (!old?.pages) return old;
            return {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                items: page.items.map(updateFeedItem),
              })),
            };
          },
        );

        // Optimistically update getUserActivities queries
        queryClient.setQueriesData<InfiniteData<UserActivitiesPage>>(
          trpc.activity.getUserActivities.pathFilter(),
          (old) => {
            if (!old?.pages) return old;
            return {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                items: page.items.map(updateFeedItem),
              })),
            };
          },
        );

        return { previousFeedData, previousUserActivitiesData };
      },
      onError: (_err, _variables, context) => {
        // Rollback on error
        if (context?.previousFeedData) {
          for (const [queryKey, data] of context.previousFeedData) {
            queryClient.setQueryData(queryKey, data);
          }
        }
        if (context?.previousUserActivitiesData) {
          for (const [queryKey, data] of context.previousUserActivitiesData) {
            queryClient.setQueryData(queryKey, data);
          }
        }
      },
      onSuccess: (data, { activityEventId }) => {
        // Sync server-returned count with cache (in case of race conditions)
        const updateWithServerData = (item: FeedItem): FeedItem => {
          if (item.id !== String(activityEventId)) return item;
          return {
            ...item,
            isLiked: data.liked,
            likeCount: data.likeCount,
          };
        };

        queryClient.setQueriesData<InfiniteData<FeedPage>>(
          trpc.activity.getFeed.pathFilter(),
          (old) => {
            if (!old?.pages) return old;
            return {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                items: page.items.map(updateWithServerData),
              })),
            };
          },
        );

        queryClient.setQueriesData<InfiniteData<UserActivitiesPage>>(
          trpc.activity.getUserActivities.pathFilter(),
          (old) => {
            if (!old?.pages) return old;
            return {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                items: page.items.map(updateWithServerData),
              })),
            };
          },
        );
      },
    }),
  );
};
