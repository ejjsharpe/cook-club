import type { Outputs } from "@repo/trpc/client";
import { useTRPC } from "@repo/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// API Response Types
export type CommentWithReplies = Outputs["comment"]["getComments"][number];
export type Comment = Omit<CommentWithReplies, "replies">;

// Get comments for an activity event
export const useComments = (activityEventId: number) => {
  const trpc = useTRPC();

  return useQuery(trpc.comment.getComments.queryOptions({ activityEventId }));
};

// Create a new comment
export const useCreateComment = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.comment.createComment.mutationOptions({
      onSuccess: (_data, variables) => {
        // Invalidate comments query for this activity event
        queryClient.invalidateQueries({
          queryKey: trpc.comment.getComments.queryKey({
            activityEventId: variables.activityEventId,
          }),
        });
      },
    }),
  );
};

// Delete a comment
export const useDeleteComment = (activityEventId: number) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.comment.deleteComment.mutationOptions({
      onSuccess: () => {
        // Invalidate comments query for this activity event
        queryClient.invalidateQueries({
          queryKey: trpc.comment.getComments.queryKey({ activityEventId }),
        });
      },
    }),
  );
};
