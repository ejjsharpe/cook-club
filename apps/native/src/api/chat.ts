import { useTRPC } from "@repo/trpc/client";
import { useMutation } from "@tanstack/react-query";

import type { ConversationState, ChatMessage } from "@/types/chat";

// Generate recipe via AI chat conversation
export const useGenerateRecipeChat = () => {
  const trpc = useTRPC();

  return useMutation(
    trpc.recipe.generateRecipeChat.mutationOptions({
      retry: false,
    }),
  );
};

// Helper type for the chat input
export interface ChatInput {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  conversationState: ConversationState;
}
