import { formatDistanceToNow } from "date-fns";
import { Image } from "expo-image";
import { memo, useMemo } from "react";
import { View, TouchableOpacity, Alert } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { Text } from "./Text";

import type { Comment } from "@/api/comment";

interface Props {
  comment: Comment;
  isReply?: boolean;
  isOwnComment: boolean;
  onReply: (comment: Comment) => void;
  onDelete: (commentId: number) => void;
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

export const CommentCard = memo(
  ({ comment, isReply = false, isOwnComment, onReply, onDelete }: Props) => {
    const timeAgo = useMemo(
      () =>
        formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true }),
      [comment.createdAt],
    );

    const userInitials = useMemo(
      () => getInitials(comment.user.name),
      [comment.user.name],
    );

    const handleDelete = () => {
      Alert.alert(
        "Delete Comment",
        "Are you sure you want to delete this comment?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => onDelete(comment.id),
          },
        ],
      );
    };

    return (
      <View style={[styles.container, isReply && styles.replyContainer]}>
        {/* User Avatar */}
        <View style={[styles.avatar, isReply && styles.replyAvatar]}>
          {comment.user.image ? (
            <Image
              source={{ uri: comment.user.image }}
              style={styles.avatarImage}
              cachePolicy="memory-disk"
              transition={100}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text
                style={[
                  styles.avatarInitials,
                  isReply && styles.replyAvatarInitials,
                ]}
              >
                {userInitials}
              </Text>
            </View>
          )}
        </View>

        {/* Comment Content */}
        <View style={styles.content}>
          <View style={styles.header}>
            <Text type="headline" style={styles.userName}>
              {comment.user.name}
            </Text>
            <Text type="footnote" style={styles.timeAgo}>
              {timeAgo}
            </Text>
          </View>

          <Text type="body" style={styles.commentText}>
            {comment.content}
          </Text>

          {/* Actions */}
          <View style={styles.actions}>
            {!isReply && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => onReply(comment)}
                activeOpacity={0.7}
              >
                <Text type="footnote" style={styles.actionText}>
                  Reply
                </Text>
              </TouchableOpacity>
            )}
            {isOwnComment && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleDelete}
                activeOpacity={0.7}
              >
                <Text type="footnote" style={styles.deleteText}>
                  Delete
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create((theme) => ({
  container: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 12,
  },
  replyContainer: {
    marginLeft: 44,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: "hidden",
  },
  replyAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitials: {
    color: theme.colors.buttonText,
    fontSize: 14,
    fontFamily: theme.fonts.albertSemiBold,
  },
  replyAvatarInitials: {
    fontSize: 11,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  userName: {
    fontSize: 14,
  },
  timeAgo: {
    color: theme.colors.textSecondary,
  },
  commentText: {
    lineHeight: 20,
  },
  actions: {
    flexDirection: "row",
    gap: 16,
    marginTop: 4,
  },
  actionButton: {
    paddingVertical: 4,
  },
  actionText: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.albertSemiBold,
  },
  deleteText: {
    color: theme.colors.destructive,
    fontFamily: theme.fonts.albertSemiBold,
  },
}));
