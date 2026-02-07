import { Ionicons } from "@expo/vector-icons";
import { formatDistanceToNow, differenceInDays } from "date-fns";
import { Image } from "expo-image";
import { memo, useMemo } from "react";
import { View, TouchableOpacity, ActivityIndicator } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { Text } from "./Text";

import type { NotificationItem } from "@/api/notification";

const INVITATION_EXPIRY_DAYS = 7;

interface Props {
  notification: NotificationItem;
  onPress?: () => void;
  onAccept?: () => void;
  onDecline?: () => void;
  isAccepting?: boolean;
  isDeclining?: boolean;
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

const isInvitationType = (type: NotificationItem["type"]): boolean =>
  type === "meal_plan_invite" || type === "shopping_list_invite";

const isExpiredInvitation = (notification: NotificationItem): boolean => {
  if (!isInvitationType(notification.type)) return false;
  return (
    differenceInDays(new Date(), new Date(notification.createdAt)) >=
    INVITATION_EXPIRY_DAYS
  );
};

const getNotificationMessage = (
  type: NotificationItem["type"],
  expired: boolean,
): string => {
  if (expired) {
    return type === "meal_plan_invite"
      ? "meal plan invitation expired"
      : "shopping list invitation expired";
  }
  switch (type) {
    case "follow":
      return "started following you";
    case "meal_plan_share":
      return "shared a meal plan with you";
    case "meal_plan_invite":
      return "invited you to a meal plan";
    case "shopping_list_invite":
      return "invited you to a shopping list";
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
    case "meal_plan_invite":
      return "calendar";
    case "shopping_list_invite":
      return "cart";
    case "activity_like":
      return "heart";
    case "activity_comment":
    case "comment_reply":
      return "chatbubble";
    default:
      return "notifications";
  }
};

export const NotificationCard = memo(
  ({
    notification,
    onPress,
    onAccept,
    onDecline,
    isAccepting,
    isDeclining,
  }: Props) => {
    const expired = useMemo(
      () => isExpiredInvitation(notification),
      [notification],
    );

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

    const message = getNotificationMessage(notification.type, expired);
    const iconName = getNotificationIcon(notification.type);
    const hasActions = !expired && !!(onAccept || onDecline);
    const isPending = isAccepting || isDeclining;

    return (
      <View
        style={[
          styles.card,
          !notification.isRead && styles.unreadCard,
          expired && styles.expiredCard,
        ]}
      >
        <TouchableOpacity
          style={styles.cardRow}
          onPress={hasActions ? undefined : expired ? undefined : onPress}
          activeOpacity={hasActions || expired ? 1 : 0.7}
          disabled={hasActions || expired}
        >
          <View
            style={[styles.avatarContainer, expired && styles.expiredAvatar]}
          >
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
              <Ionicons
                name={iconName}
                size={10}
                style={styles.iconBadgeIcon}
              />
            </View>
          </View>
          <View style={styles.content}>
            <Text
              type="subheadline"
              style={[styles.messageText, expired && styles.expiredText]}
            >
              <Text
                type="headline"
                style={[styles.actorName, expired && styles.expiredText]}
              >
                {notification.actorName}
              </Text>{" "}
              {message}
            </Text>
            <Text type="caption" style={styles.timeAgo}>
              {expired ? "Expired" : timeAgo}
            </Text>
          </View>
          {!notification.isRead && !expired && !hasActions && (
            <View style={styles.unreadDot} />
          )}
        </TouchableOpacity>
        {hasActions && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.declineButton}
              onPress={onDecline}
              disabled={isPending}
            >
              {isDeclining ? (
                <ActivityIndicator size="small" />
              ) : (
                <Text type="body" style={styles.declineText}>
                  Decline
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={onAccept}
              disabled={isPending}
            >
              {isAccepting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text type="body" style={styles.acceptText}>
                  Accept
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  },
);

const styles = StyleSheet.create((theme) => ({
  card: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 10,
    backgroundColor: theme.colors.background,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
  expiredCard: {
    opacity: 0.5,
  },
  expiredAvatar: {
    opacity: 0.6,
  },
  expiredText: {
    color: theme.colors.textSecondary,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    paddingLeft: 60,
  },
  declineButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.medium,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
  },
  declineText: {
    color: theme.colors.textSecondary,
  },
  acceptButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.medium,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
  },
  acceptText: {
    color: "#fff",
  },
}));
