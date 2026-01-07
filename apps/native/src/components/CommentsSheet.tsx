import { Ionicons } from "@expo/vector-icons";
import { useState, useCallback } from "react";
import {
  View,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Keyboard,
  Alert,
} from "react-native";
import ActionSheet, {
  SheetManager,
  SheetProps,
} from "react-native-actions-sheet";
import {
  KeyboardStickyView,
  useReanimatedKeyboardAnimation,
} from "react-native-keyboard-controller";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { CommentCard } from "./CommentCard";
import { Text } from "./Text";

import {
  useComments,
  useCreateComment,
  useDeleteComment,
  type Comment,
} from "@/api/comment";
import { useSessionContext } from "@/lib/sessionContext";

export const CommentsSheet = (props: SheetProps<"comments-sheet">) => {
  const { activityEventId } = props.payload || { activityEventId: 0 };
  const session = useSessionContext();
  const currentUserId = session?.user?.id;
  const unistyles = useUnistyles();

  const [commentText, setCommentText] = useState("");
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);

  const { data: comments, isLoading } = useComments(activityEventId);
  const createCommentMutation = useCreateComment();
  const deleteCommentMutation = useDeleteComment(activityEventId);

  // Keyboard height for animating empty state
  const { height: keyboardHeight } = useReanimatedKeyboardAnimation();

  const emptyStateAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: keyboardHeight.value / 2.5 }],
  }));

  const handleSubmit = useCallback(async () => {
    if (!commentText.trim()) return;

    Keyboard.dismiss();

    try {
      await createCommentMutation.mutateAsync({
        activityEventId,
        parentCommentId: replyingTo?.id,
        content: commentText.trim(),
      });
      setCommentText("");
      setReplyingTo(null);
    } catch {
      Alert.alert("Error", "Failed to post comment. Please try again.");
    }
  }, [commentText, activityEventId, replyingTo, createCommentMutation]);

  const handleReply = useCallback((comment: Comment) => {
    setReplyingTo(comment);
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyingTo(null);
  }, []);

  const handleDelete = useCallback(
    async (commentId: number) => {
      try {
        await deleteCommentMutation.mutateAsync({ commentId });
      } catch {
        Alert.alert("Error", "Failed to delete comment. Please try again.");
      }
    },
    [deleteCommentMutation],
  );

  const canSubmit =
    commentText.trim().length > 0 && !createCommentMutation.isPending;

  return (
    <ActionSheet
      id={props.sheetId}
      initialSnapIndex={0}
      snapPoints={[100]}
      gestureEnabled
      enableGesturesInScrollView={false}
      indicatorStyle={styles.indicator}
      containerStyle={{ flex: 0.8 }}
      keyboardHandlerEnabled={false}
    >
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <Text type="title2">Comments</Text>
          <TouchableOpacity onPress={() => SheetManager.hide("comments-sheet")}>
            <Ionicons name="close" size={28} style={styles.closeIcon} />
          </TouchableOpacity>
        </View>

        {/* Comments List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator />
          </View>
        ) : comments && comments.length > 0 ? (
          <FlatList
            data={comments}
            style={styles.list}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <View>
                <CommentCard
                  comment={item}
                  isOwnComment={item.user.id === currentUserId}
                  onReply={handleReply}
                  onDelete={handleDelete}
                />
                {/* Render replies */}
                {item.replies?.map((reply) => (
                  <CommentCard
                    key={reply.id}
                    comment={reply}
                    isReply
                    isOwnComment={reply.user.id === currentUserId}
                    onReply={handleReply}
                    onDelete={handleDelete}
                  />
                ))}
              </View>
            )}
          />
        ) : (
          <Animated.View
            style={[styles.emptyContainer, emptyStateAnimatedStyle]}
          >
            <Ionicons
              name="chatbubble-outline"
              size={48}
              style={styles.emptyIcon}
            />
            <Text type="body" style={styles.emptyText}>
              No comments yet
            </Text>
            <Text type="footnote" style={styles.emptySubtext}>
              Be the first to comment!
            </Text>
          </Animated.View>
        )}
      </View>

      {/* Input Area */}
      <KeyboardStickyView
        offset={{
          opened: unistyles.rt.insets.bottom + 20,
          closed: unistyles.rt.insets.bottom,
        }}
      >
        <View style={styles.inputArea}>
          {replyingTo && (
            <View style={styles.replyingToBar}>
              <Text type="footnote" style={styles.replyingToText}>
                Replying to {replyingTo.user.name}
              </Text>
              <TouchableOpacity onPress={handleCancelReply}>
                <Ionicons
                  name="close"
                  size={18}
                  style={styles.cancelReplyIcon}
                />
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder={replyingTo ? "Write a reply..." : "Add a comment..."}
              placeholderTextColor="#999"
              value={commentText}
              onChangeText={setCommentText}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                !canSubmit && styles.sendButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!canSubmit}
              activeOpacity={0.7}
            >
              {createCommentMutation.isPending ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Ionicons name="send" size={18} style={styles.sendIcon} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardStickyView>
    </ActionSheet>
  );
};

const styles = StyleSheet.create((theme) => ({
  indicator: {
    backgroundColor: theme.colors.border,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  closeIcon: {
    color: theme.colors.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  emptyIcon: {
    color: theme.colors.border,
    marginBottom: 12,
  },
  emptyText: {
    color: theme.colors.textSecondary,
  },
  emptySubtext: {
    color: theme.colors.textSecondary,
  },
  inputArea: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 34,
    backgroundColor: theme.colors.background,
  },
  replyingToBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.borderRadius.small,
  },
  replyingToText: {
    color: theme.colors.textSecondary,
  },
  cancelReplyIcon: {
    color: theme.colors.textSecondary,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.borderRadius.extraLarge,
    paddingHorizontal: 20,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.colors.text,
    fontFamily: theme.fonts.albertRegular,
    maxHeight: 100,
    minHeight: 44,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendIcon: {
    color: theme.colors.buttonText,
  },
}));
