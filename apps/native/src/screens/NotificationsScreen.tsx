import { useNavigation } from "@react-navigation/native";
import { useTRPC } from "@repo/trpc/client";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

import {
  useGetPendingMealPlanInvitations,
  useAcceptMealPlanInvitation,
  useDeclineMealPlanInvitation,
} from "@/api/mealPlan";
import {
  useNotifications,
  useMarkNotificationsAsRead,
  type NotificationItem,
  type NotificationsResponse,
} from "@/api/notification";
import {
  useGetPendingShoppingListInvitations,
  useAcceptShoppingListInvitation,
  useDeclineShoppingListInvitation,
} from "@/api/shopping";
import { NavigationHeader } from "@/components/NavigationHeader";
import { NotificationCard } from "@/components/NotificationCard";
import { SafeAreaView } from "@/components/SafeAreaView";
import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";
import { setSelectedMealPlan } from "@/lib/mealPlanPreferences";

export const NotificationsScreen = () => {
  const navigation = useNavigation();
  const insets = UnistylesRuntime.insets;
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const {
    data,
    isPending,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    isRefetching,
  } = useNotifications();

  const markAsRead = useMarkNotificationsAsRead();

  // Pending invitations for lookup
  const { data: pendingMealPlanInvitations } =
    useGetPendingMealPlanInvitations();
  const { data: pendingShoppingListInvitations } =
    useGetPendingShoppingListInvitations();

  // Mutation hooks
  const acceptMealPlan = useAcceptMealPlanInvitation();
  const declineMealPlan = useDeclineMealPlanInvitation();
  const acceptShoppingList = useAcceptShoppingListInvitation();
  const declineShoppingList = useDeclineShoppingListInvitation();

  // Track which notification is being acted on
  const [activeNotificationId, setActiveNotificationId] = useState<
    number | null
  >(null);
  const [activeAction, setActiveAction] = useState<"accept" | "decline" | null>(
    null,
  );

  // Build lookup maps: entityId → invitation
  const mealPlanInvitationMap = useMemo(() => {
    const map = new Map<number, { id: number; mealPlanName: string }>();
    pendingMealPlanInvitations?.forEach((inv) => {
      map.set(inv.mealPlanId, { id: inv.id, mealPlanName: inv.mealPlanName });
    });
    return map;
  }, [pendingMealPlanInvitations]);

  const shoppingListInvitationMap = useMemo(() => {
    const map = new Map<number, { id: number; shoppingListName: string }>();
    pendingShoppingListInvitations?.forEach((inv) => {
      map.set(inv.shoppingListId, {
        id: inv.id,
        shoppingListName: inv.shoppingListName,
      });
    });
    return map;
  }, [pendingShoppingListInvitations]);

  // Flatten pages into single array
  const notifications = useMemo(() => {
    return data?.pages.flatMap((page) => page?.items ?? []) ?? [];
  }, [data]);

  // Mark all as read when screen is opened
  useEffect(() => {
    const hasUnread = notifications.some((n) => !n.isRead);
    if (hasUnread && !isPending) {
      markAsRead.mutate({});
    }
  }, [notifications, isPending]);

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Remove a notification from the infinite query cache
  const removeNotificationFromCache = useCallback(
    (notificationId: number) => {
      const filter = trpc.notification.getNotifications.pathFilter();
      queryClient.setQueriesData<{
        pages: NotificationsResponse[];
        pageParams: unknown[];
      }>(filter, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.filter((item) => item.id !== notificationId),
          })),
        };
      });
    },
    [queryClient, trpc],
  );

  // Handle accept for meal plan invitations
  const handleAcceptMealPlan = useCallback(
    async (notification: NotificationItem) => {
      if (!notification.mealPlanId) return;
      const invitation = mealPlanInvitationMap.get(notification.mealPlanId);
      if (!invitation) return;

      setActiveNotificationId(notification.id);
      setActiveAction("accept");
      try {
        await acceptMealPlan.mutateAsync({ invitationId: invitation.id });
        setSelectedMealPlan(notification.mealPlanId, invitation.mealPlanName);
        navigation.navigate("Tabs", { screen: "Meal Plan" } as never);
      } catch {
        // Error handled by mutation
      } finally {
        setActiveNotificationId(null);
        setActiveAction(null);
      }
    },
    [mealPlanInvitationMap, acceptMealPlan, navigation],
  );

  // Handle decline for meal plan invitations
  const handleDeclineMealPlan = useCallback(
    async (notification: NotificationItem) => {
      if (!notification.mealPlanId) return;
      const invitation = mealPlanInvitationMap.get(notification.mealPlanId);
      if (!invitation) return;

      setActiveNotificationId(notification.id);
      setActiveAction("decline");
      try {
        await declineMealPlan.mutateAsync({ invitationId: invitation.id });
        removeNotificationFromCache(notification.id);
      } catch {
        // Error handled by mutation
      } finally {
        setActiveNotificationId(null);
        setActiveAction(null);
      }
    },
    [mealPlanInvitationMap, declineMealPlan, removeNotificationFromCache],
  );

  // Handle accept for shopping list invitations
  const handleAcceptShoppingList = useCallback(
    async (notification: NotificationItem) => {
      if (!notification.shoppingListId) return;
      const invitation = shoppingListInvitationMap.get(
        notification.shoppingListId,
      );
      if (!invitation) return;

      setActiveNotificationId(notification.id);
      setActiveAction("accept");
      try {
        await acceptShoppingList.mutateAsync({ invitationId: invitation.id });
        navigation.navigate("Tabs", { screen: "Shopping List" } as never);
      } catch {
        // Error handled by mutation
      } finally {
        setActiveNotificationId(null);
        setActiveAction(null);
      }
    },
    [shoppingListInvitationMap, acceptShoppingList, navigation],
  );

  // Handle decline for shopping list invitations
  const handleDeclineShoppingList = useCallback(
    async (notification: NotificationItem) => {
      if (!notification.shoppingListId) return;
      const invitation = shoppingListInvitationMap.get(
        notification.shoppingListId,
      );
      if (!invitation) return;

      setActiveNotificationId(notification.id);
      setActiveAction("decline");
      try {
        await declineShoppingList.mutateAsync({ invitationId: invitation.id });
        removeNotificationFromCache(notification.id);
      } catch {
        // Error handled by mutation
      } finally {
        setActiveNotificationId(null);
        setActiveAction(null);
      }
    },
    [
      shoppingListInvitationMap,
      declineShoppingList,
      removeNotificationFromCache,
    ],
  );

  const handleNotificationPress = useCallback(
    (notification: NotificationItem) => {
      switch (notification.type) {
        case "follow":
          navigation.navigate("UserProfile", { userId: notification.actorId });
          break;
        case "meal_plan_share":
          navigation.navigate("Tabs", { screen: "Meal Plan" } as never);
          break;
        case "activity_like":
        case "activity_comment":
        case "comment_reply":
          navigation.navigate("UserProfile", { userId: notification.actorId });
          break;
        default:
          break;
      }
    },
    [navigation],
  );

  const renderNotification = useCallback(
    ({ item }: { item: NotificationItem }) => {
      const isActive = activeNotificationId === item.id;

      // Check if this invitation has a matching pending invitation
      if (item.type === "meal_plan_invite" && item.mealPlanId) {
        const invitation = mealPlanInvitationMap.get(item.mealPlanId);
        if (invitation) {
          return (
            <NotificationCard
              notification={item}
              onAccept={() => handleAcceptMealPlan(item)}
              onDecline={() => handleDeclineMealPlan(item)}
              isAccepting={isActive && activeAction === "accept"}
              isDeclining={isActive && activeAction === "decline"}
            />
          );
        }
      }

      if (item.type === "shopping_list_invite" && item.shoppingListId) {
        const invitation = shoppingListInvitationMap.get(item.shoppingListId);
        if (invitation) {
          return (
            <NotificationCard
              notification={item}
              onAccept={() => handleAcceptShoppingList(item)}
              onDecline={() => handleDeclineShoppingList(item)}
              isAccepting={isActive && activeAction === "accept"}
              isDeclining={isActive && activeAction === "decline"}
            />
          );
        }
      }

      return (
        <NotificationCard
          notification={item}
          onPress={() => handleNotificationPress(item)}
        />
      );
    },
    [
      handleNotificationPress,
      handleAcceptMealPlan,
      handleDeclineMealPlan,
      handleAcceptShoppingList,
      handleDeclineShoppingList,
      mealPlanInvitationMap,
      shoppingListInvitationMap,
      activeNotificationId,
      activeAction,
    ],
  );

  const keyExtractor = useCallback(
    (item: NotificationItem) => item.id.toString(),
    [],
  );

  const renderEmpty = useCallback(() => {
    if (isPending) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Text type="title3" style={styles.emptyTitle}>
          No notifications yet
        </Text>
        <Text type="body" style={styles.emptySubtext}>
          When someone follows you, shares a meal plan, or interacts with your
          activity, you'll see it here.
        </Text>
      </View>
    );
  }, [isPending]);

  const renderFooter = useCallback(() => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" />
        <VSpace size={20} />
      </View>
    );
  }, [isFetchingNextPage]);

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.container}>
        <NavigationHeader title="Notifications" />

        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={keyExtractor}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom },
          ]}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
        />
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    marginBottom: 8,
  },
  emptySubtext: {
    color: theme.colors.textSecondary,
    textAlign: "center",
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: "center",
  },
}));
