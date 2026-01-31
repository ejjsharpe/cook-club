import { useNavigation } from "@react-navigation/native";
import { useCallback, useEffect, useMemo } from "react";
import { View, FlatList, ActivityIndicator, RefreshControl } from "react-native";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

import {
  useNotifications,
  useMarkNotificationsAsRead,
  type NotificationItem,
} from "@/api/notification";
import { NavigationHeader } from "@/components/NavigationHeader";
import { NotificationCard } from "@/components/NotificationCard";
import { SafeAreaView } from "@/components/SafeAreaView";
import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";

export const NotificationsScreen = () => {
  const navigation = useNavigation();
  const insets = UnistylesRuntime.insets;

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

  const handleNotificationPress = useCallback(
    (notification: NotificationItem) => {
      switch (notification.type) {
        case "follow":
          navigation.navigate("UserProfile", { userId: notification.actorId });
          break;
        case "meal_plan_share":
          // Navigate to meal plan tab
          navigation.navigate("Tabs", { screen: "Meal Plan" } as never);
          break;
        case "activity_like":
        case "activity_comment":
        case "comment_reply":
          // Navigate to the user's profile to see their activity
          navigation.navigate("UserProfile", { userId: notification.actorId });
          break;
        default:
          break;
      }
    },
    [navigation]
  );

  const renderNotification = useCallback(
    ({ item }: { item: NotificationItem }) => (
      <NotificationCard
        notification={item}
        onPress={() => handleNotificationPress(item)}
      />
    ),
    [handleNotificationPress]
  );

  const keyExtractor = useCallback(
    (item: NotificationItem) => item.id.toString(),
    []
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
