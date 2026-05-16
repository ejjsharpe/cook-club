import type { Outputs } from "@repo/trpc/client";
import { useTRPC } from "@repo/trpc/client";
import { formatDistanceToNow } from "date-fns";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  useQuery,
} from "@tanstack/react-query";
import { useRef } from "react";

// API Response Types
export type FeedItem = Outputs["activity"]["getFeed"]["items"][number];
export type RecipeImportFeedItem = Extract<FeedItem, { type: "recipe_import" }>;
export type CookingReviewFeedItem = Extract<
  FeedItem,
  { type: "cooking_review" }
>;
export type ActivityFeedListItem = FeedItem & {
  _display: {
    timeAgo: string;
    userInitials: string;
    sourceDescription?: string;
  };
};

const ACTIVITY_FEED_STALE_TIME = 1000 * 60 * 5;

// Get activity feed with infinite scroll
interface UseActivityFeedParams {
  limit?: number;
}

type ActivityPage = { items: FeedItem[] };

const getInitials = (name: string): string => {
  const words = name
    .trim()
    .split(" ")
    .filter((word) => word.length > 0);
  if (words.length >= 2) {
    const firstWord = words[0];
    const lastWord = words[words.length - 1];
    if (firstWord && lastWord && firstWord[0] && lastWord[0]) {
      return (firstWord[0] + lastWord[0]).toUpperCase();
    }
  }
  return name.substring(0, 2).toUpperCase();
};

const getSourceDescription = (item: FeedItem): string | undefined => {
  if (item.type !== "recipe_import") return undefined;
  if (item.recipe.sourceType === "url") {
    return item.recipe.sourceDomain;
  }
  switch (item.recipe.sourceType) {
    case "text":
      return "text";
    case "image":
      return "an image";
    case "ai":
      return "AI";
    case "user":
      return "another user";
    case "manual":
      return "scratch";
    default:
      return "their collection";
  }
};

function useActivityItemsSelector<TPage extends ActivityPage>() {
  const lastSelectionRef = useRef<{
    pages: TPage[];
    items: ActivityFeedListItem[];
  } | null>(null);
  const itemSelectionCache = useRef<WeakMap<FeedItem, ActivityFeedListItem>>(
    new WeakMap(),
  );

  return (data: InfiniteData<TPage>) => {
    const previous = lastSelectionRef.current;
    if (
      previous &&
      previous.pages.length === data.pages.length &&
      previous.pages.every((page, index) => page === data.pages[index])
    ) {
      return previous.items;
    }

    const items = data.pages.flatMap((page) =>
      (page?.items ?? []).map((item) => {
        const cached = itemSelectionCache.current.get(item);
        if (cached) return cached;

        const selectedItem = {
          ...item,
          _display: {
            timeAgo: formatDistanceToNow(new Date(item.createdAt), {
              addSuffix: true,
            }),
            userInitials: getInitials(item.actor.name),
            sourceDescription: getSourceDescription(item),
          },
        } as ActivityFeedListItem;
        itemSelectionCache.current.set(item, selectedItem);
        return selectedItem;
      }),
    );
    lastSelectionRef.current = {
      pages: data.pages,
      items,
    };
    return items;
  };
}

export const useActivityFeed = ({ limit = 20 }: UseActivityFeedParams = {}) => {
  const trpc = useTRPC();
  const selectActivityItems = useActivityItemsSelector<FeedPage>();

  const infiniteQueryOptions = trpc.activity.getFeed.infiniteQueryOptions(
    { limit },
    { getNextPageParam: (lastPage) => lastPage?.nextCursor },
  );

  return useInfiniteQuery({
    ...infiniteQueryOptions,
    staleTime: ACTIVITY_FEED_STALE_TIME,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    select: selectActivityItems,
  });
};

// Create cooking review mutation
export const useCreateCookingReview = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.activity.createCookingReview.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.activity.getFeed.pathFilter());
        queryClient.invalidateQueries(
          trpc.activity.getUserActivities.pathFilter(),
        );
        queryClient.invalidateQueries(
          trpc.activity.getRecipeReviews.pathFilter(),
        );
        queryClient.invalidateQueries(
          trpc.activity.getRecipeRating.pathFilter(),
        );
        queryClient.invalidateQueries(trpc.recipe.getRecipeDetail.pathFilter());
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
  const selectActivityItems = useActivityItemsSelector<UserActivitiesPage>();

  const infiniteQueryOptions =
    trpc.activity.getUserActivities.infiniteQueryOptions(
      { userId, limit },
      { getNextPageParam: (lastPage) => lastPage?.nextCursor },
    );

  return useInfiniteQuery({
    ...infiniteQueryOptions,
    staleTime: ACTIVITY_FEED_STALE_TIME,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    select: selectActivityItems,
  });
};

// Infinite query data structure
interface InfiniteData<T> {
  pages: T[];
  pageParams: unknown[];
}

type FeedPage = ActivityPage & { nextCursor: string | null };
type UserActivitiesPage = ActivityPage & { nextCursor: number | null };

function updateActivityPages<TPage extends { items: FeedItem[] }>(
  old: InfiniteData<TPage> | undefined,
  activityEventId: number,
  updateItem: (item: FeedItem) => FeedItem,
): InfiniteData<TPage> | undefined {
  if (!old?.pages) return old;

  const targetId = String(activityEventId);
  let didChange = false;
  const pages = old.pages.map((page) => {
    const itemIndex = page.items.findIndex((item) => item.id === targetId);
    if (itemIndex === -1) return page;

    const nextItem = updateItem(page.items[itemIndex]!);
    if (nextItem === page.items[itemIndex]) return page;

    didChange = true;
    const items = page.items.slice();
    items[itemIndex] = nextItem;
    return {
      ...page,
      items,
    };
  });

  if (!didChange) return old;
  return {
    ...old,
    pages,
  };
}

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
        const updateFeedItem = (item: FeedItem): FeedItem => ({
          ...item,
          isLiked: !item.isLiked,
          likeCount: item.isLiked ? item.likeCount - 1 : item.likeCount + 1,
        });

        // Optimistically update getFeed queries
        queryClient.setQueriesData<InfiniteData<FeedPage>>(
          trpc.activity.getFeed.pathFilter(),
          (old) => updateActivityPages(old, activityEventId, updateFeedItem),
        );

        // Optimistically update getUserActivities queries
        queryClient.setQueriesData<InfiniteData<UserActivitiesPage>>(
          trpc.activity.getUserActivities.pathFilter(),
          (old) => updateActivityPages(old, activityEventId, updateFeedItem),
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
          if (item.isLiked === data.liked && item.likeCount === data.likeCount) {
            return item;
          }
          return {
            ...item,
            isLiked: data.liked,
            likeCount: data.likeCount,
          };
        };

        queryClient.setQueriesData<InfiniteData<FeedPage>>(
          trpc.activity.getFeed.pathFilter(),
          (old) =>
            updateActivityPages(old, activityEventId, updateWithServerData),
        );

        queryClient.setQueriesData<InfiniteData<UserActivitiesPage>>(
          trpc.activity.getUserActivities.pathFilter(),
          (old) =>
            updateActivityPages(old, activityEventId, updateWithServerData),
        );
      },
    }),
  );
};
