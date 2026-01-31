import { Ionicons } from "@expo/vector-icons";
import { formatDistanceToNow } from "date-fns";
import { Image } from "expo-image";
import { memo, useMemo } from "react";
import { View, TouchableOpacity } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { Text } from "./Text";

import type { NotificationItem } from "@/api/notification";

interface Props {
  notification: NotificationItem;
  onPress?: () => void;
}

const getInitials = (name: string): string => {
  const words = name
    .trim()
    .split(" ")
    .filter((w) => w.length > 0);
  if (words.length >= 2) {
    const firstWord = words[0];
    const lastWord = words[words.length - 1];
    if (firstWord && lastWord && firstWord[0] && lastWord[0]) {
      return (firstWord[0] + lastWord[0]).toUpperCase();
    }
  }
  return name.substring(0, 2).toUpperCase();
};

const getNotificationMessage = (type: NotificationItem["type"]): string => {
  switch (type) {
    case "follow":
      return "started following you";
    case "meal_plan_share":
      return "shared a meal plan with you";
    case "activity_like":
      return "liked your activity";
    case "activity_comment":
      return "commented on your activity";
    case "comment_reply":
      return "replied to your comment";
    default:
      return "interacted with you";
  }
};

const getNotificationIcon = (
  type: NotificationItem["type"],
): keyof typeof Ionicons.glyphMap => {
  switch (type) {
    case "follow":
      return "person-add";
    case "meal_plan_share":
      return "calendar";
    case "activity_like":
      return "heart";
    case "activity_comment":
    case "comment_reply":
      return "chatbubble";
    default:
      return "notifications";
  }
};

export const NotificationCard = memo(({ notification, onPress }: Props) => {
  const timeAgo = useMemo(
    () =>
      formatDistanceToNow(new Date(notification.createdAt), {
        addSuffix: true,
      }),
    [notification.createdAt],
  );

  const userInitials = useMemo(
    () => getInitials(notification.actorName),
    [notification.actorName],
  );

  const message = getNotificationMessage(notification.type);
  const iconName = getNotificationIcon(notification.type);

  return (
    <TouchableOpacity
      style={[styles.card, !notification.isRead && styles.unreadCard]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.avatarContainer}>
        {notification.actorImage ? (
          <Image
            source={{ uri: notification.actorImage }}
            style={styles.avatarImage}
            cachePolicy="memory-disk"
            transition={100}
          />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitials}>{userInitials}</Text>
          </View>
        )}
        <View style={styles.iconBadge}>
          <Ionicons name={iconName} size={10} style={styles.iconBadgeIcon} />
        </View>
      </View>
      <View style={styles.content}>
        <Text type="subheadline" style={styles.messageText}>
          <Text type="headline" style={styles.actorName}>
            {notification.actorName}
          </Text>{" "}
          {message}
        </Text>
        <Text type="caption" style={styles.timeAgo}>
          {timeAgo}
        </Text>
      </View>
      {!notification.isRead && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create((theme) => ({
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 12,
    backgroundColor: theme.colors.background,
  },
  unreadCard: {
    backgroundColor: theme.colors.inputBackground,
  },
  avatarContainer: {
    width: 48,
    height: 48,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitials: {
    color: theme.colors.buttonText,
    fontSize: 18,
    fontFamily: theme.fonts.semiBold,
  },
  iconBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: theme.colors.background,
  },
  iconBadgeIcon: {
    color: theme.colors.buttonText,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  messageText: {
    color: theme.colors.text,
  },
  actorName: {
    color: theme.colors.text,
  },
  timeAgo: {
    color: theme.colors.textSecondary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
  },
}));
