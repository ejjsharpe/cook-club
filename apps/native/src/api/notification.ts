import type { Outputs } from "@repo/trpc/client";
import { useTRPC } from "@repo/trpc/client";
import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";

// API Response Types
export type NotificationItem =
  Outputs["notification"]["getNotifications"]["items"][number];
export type NotificationsResponse = Outputs["notification"]["getNotifications"];

// Infinite query for paginated notifications
export const useNotifications = () => {
  const trpc = useTRPC();

  return useInfiniteQuery({
    ...trpc.notification.getNotifications.infiniteQueryOptions(
      { limit: 20 },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      },
    ),
  });
};

// Simple query for unread count (for badge)
export const useUnreadNotificationCount = (options?: {
  refetchInterval?: number;
}) => {
  const trpc = useTRPC();

  return useQuery({
    ...trpc.notification.getUnreadCount.queryOptions(),
    refetchInterval: options?.refetchInterval,
  });
};

// Mutation to mark notifications as read
export const useMarkNotificationsAsRead = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation({
    ...trpc.notification.markAsRead.mutationOptions(),
    onSuccess: () => {
      // Invalidate both notifications list and unread count
      queryClient.invalidateQueries({ queryKey: ["notification"] });
    },
  });
};
