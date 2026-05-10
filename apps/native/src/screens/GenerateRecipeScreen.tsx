import { useNavigation } from "@react-navigation/native";
import { useCallback, useRef, useState } from "react";
import {
  View,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import Animated, { FadeInUp, FadeInDown } from "react-native-reanimated";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

import { useGenerateRecipeChat } from "@/api/chat";
import { Ionicons } from "@/components/Ionicons";
import { SafeAreaView } from "@/components/SafeAreaView";
import { Text } from "@/components/Text";
import { BackButton } from "@/components/buttons/BackButton";
import type { ChatMessage, ConversationState, ChatStatus } from "@/types/chat";

const INITIAL_MESSAGE: ChatMessage = {
  id: "initial",
  role: "assistant",
  content:
    "Hi! I'm here to help you create a delicious recipe. What ingredients do you have available to cook with today?",
  suggestedReplies: [
    "Chicken, rice, and vegetables",
    "Pasta and tomatoes",
    "I'll tell you what I have",
  ],
  timestamp: new Date(),
};

const INITIAL_STATE: ConversationState = {
  ingredients: null,
  cuisinePreference: null,
  willingToShop: null,
  maxCookingTime: null,
};

const RECIPE_PROMPTS = [
  "High-protein dinner in 30 minutes",
  "Use up herbs and vegetables",
  "Something cozy for two",
];

export const GenerateRecipeScreen = () => {
  const { navigate } = useNavigation();
  const theme = UnistylesRuntime.getTheme();
  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [inputText, setInputText] = useState("");
  const [conversationState, setConversationState] =
    useState<ConversationState>(INITIAL_STATE);
  const [status, setStatus] = useState<ChatStatus>("idle");

  const chatMutation = useGenerateRecipeChat();

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || status !== "idle") return;

      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInputText("");
      setStatus("sending");

      try {
        const result = await chatMutation.mutateAsync({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          conversationState,
        });

        if (result.type === "message") {
          const assistantMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: result.message,
            suggestedReplies: result.suggestedReplies,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, assistantMessage]);
          setConversationState(result.updatedState);
          setStatus("idle");
        } else if (result.type === "recipe") {
          // Recipe generated - navigate to detail editor
          setStatus("idle");
          navigate("RecipeDetail", {
            parsedRecipe: {
              success: true,
              data: result.recipe,
              metadata: {
                source: "text" as const,
                parseMethod: "ai_only" as const,
                confidence: "high" as const,
              },
            },
            mode: "edit",
          });
        }
      } catch {
        const errorMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        setStatus("idle");
      }
    },
    [messages, conversationState, status, chatMutation, navigate],
  );

  const renderMessage = useCallback(
    ({ item, index }: { item: ChatMessage; index: number }) => {
      const isUser = item.role === "user";
      const isFirst = index === 0;

      return (
        <Animated.View
          entering={isFirst ? undefined : FadeInUp.duration(300).springify()}
          style={[
            styles.messageRow,
            isUser ? styles.userMessageRow : styles.assistantMessageRow,
          ]}
        >
          {!isUser && (
            <View style={styles.avatar}>
              <Ionicons name="restaurant" size={18} style={styles.avatarIcon} />
            </View>
          )}

          <View style={styles.messageStack}>
            {!isUser && (
              <Text type="caption" style={styles.senderLabel}>
                AI Chef
              </Text>
            )}
            <View
              style={[
                styles.messageBubble,
                isUser ? styles.userBubble : styles.assistantBubble,
              ]}
            >
              <Text style={isUser ? styles.userText : styles.assistantText}>
                {item.content}
              </Text>
            </View>

            {item.suggestedReplies && item.suggestedReplies.length > 0 && (
              <View style={styles.suggestedReplies}>
                {item.suggestedReplies.map((reply) => (
                  <Pressable
                    key={reply}
                    style={({ pressed }) => [
                      styles.suggestionChip,
                      pressed && status === "idle" && styles.pressedChip,
                      status !== "idle" && styles.disabledChip,
                    ]}
                    onPress={() => sendMessage(reply)}
                    disabled={status !== "idle"}
                  >
                    <Text style={styles.suggestionText}>{reply}</Text>
                    <Ionicons
                      name="arrow-forward"
                      size={14}
                      style={styles.suggestionIcon}
                    />
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </Animated.View>
      );
    },
    [sendMessage, status],
  );

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <BackButton />
        <View style={styles.headerTitleWrap}>
          <Text type="headline" style={styles.headerTitle}>
            AI Chef
          </Text>
          <Text type="caption" style={styles.headerSubtitle}>
            Recipe builder
          </Text>
        </View>
        <View style={styles.headerAction}>
          <Ionicons name="sparkles" size={18} style={styles.headerIcon} />
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.messageList}
        ListHeaderComponent={
          <Animated.View entering={FadeInDown.duration(240)}>
            <View style={styles.heroCard}>
              <View style={styles.heroIcon}>
                <Ionicons
                  name="sparkles"
                  size={22}
                  style={styles.heroIconGlyph}
                />
              </View>
              <View style={styles.heroText}>
                <Text type="headline">Build a recipe from what you have</Text>
                <Text type="subheadline" style={styles.heroSubtitle}>
                  Share ingredients, time, cravings, or dietary needs. I will
                  narrow it down before creating the recipe.
                </Text>
              </View>
            </View>
            <View style={styles.promptRow}>
              {RECIPE_PROMPTS.map((prompt) => (
                <Pressable
                  key={prompt}
                  style={({ pressed }) => [
                    styles.promptChip,
                    pressed && status === "idle" && styles.pressedChip,
                    status !== "idle" && styles.disabledChip,
                  ]}
                  onPress={() => sendMessage(prompt)}
                  disabled={status !== "idle"}
                >
                  <Text type="caption" style={styles.promptText}>
                    {prompt}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        }
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />

      {status !== "idle" && (
        <Animated.View
          entering={FadeInDown.duration(200)}
          style={styles.loadingContainer}
        >
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text type="caption" style={styles.loadingText}>
            {status === "generating"
              ? "Creating your recipe..."
              : "Thinking through the next step..."}
          </Text>
        </Animated.View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={10}
      >
        <View style={styles.inputContainer}>
          <View style={styles.inputPill}>
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ask for a recipe..."
              placeholderTextColor={theme.colors.placeholderText}
              multiline
              maxLength={500}
              editable={status === "idle"}
              onSubmitEditing={() => sendMessage(inputText)}
              blurOnSubmit={false}
            />
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.sendButton,
              pressed &&
                inputText.trim() &&
                status === "idle" &&
                styles.sendButtonPressed,
              (!inputText.trim() || status !== "idle") &&
                styles.sendButtonDisabled,
            ]}
            onPress={() => sendMessage(inputText)}
            disabled={!inputText.trim() || status !== "idle"}
          >
            <Ionicons
              name="arrow-up"
              size={20}
              color={inputText.trim() && status === "idle" ? "#fff" : "#9A9A9A"}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create((theme, rt) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 12,
    gap: 12,
    backgroundColor: "transparent",
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: "center",
    gap: 1,
    marginLeft: -36,
  },
  headerTitle: {
    color: theme.colors.text,
  },
  headerSubtitle: {
    color: theme.colors.textSecondary,
  },
  headerAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primary + "12",
  },
  headerIcon: {
    color: theme.colors.primary,
  },
  messageList: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    flexGrow: 1,
    gap: 14,
  },
  heroCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    borderRadius: theme.borderRadius.large,
    backgroundColor: theme.colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  heroIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primary + "12",
  },
  heroIconGlyph: {
    color: theme.colors.primary,
  },
  heroText: {
    flex: 1,
    gap: 4,
  },
  heroSubtitle: {
    color: theme.colors.textSecondary,
  },
  promptRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingTop: 12,
    paddingBottom: 2,
  },
  promptChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  promptText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.medium,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  userMessageRow: {
    justifyContent: "flex-end",
  },
  assistantMessageRow: {
    justifyContent: "flex-start",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  avatarIcon: {
    color: theme.colors.primary,
  },
  messageStack: {
    maxWidth: "82%",
    gap: 5,
  },
  senderLabel: {
    color: theme.colors.textSecondary,
    paddingLeft: 4,
  },
  messageBubble: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 20,
    borderCurve: "continuous",
  },
  userBubble: {
    backgroundColor: theme.colors.primary,
    borderBottomRightRadius: 6,
  },
  assistantBubble: {
    backgroundColor: theme.colors.inputBackground,
    borderBottomLeftRadius: 6,
  },
  userText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: theme.fonts.regular,
    lineHeight: 22,
  },
  assistantText: {
    color: theme.colors.text,
    fontSize: 16,
    fontFamily: theme.fonts.regular,
    lineHeight: 22,
  },
  suggestedReplies: {
    paddingTop: 2,
    gap: 8,
  },
  suggestionChip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.primary + "66",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: theme.borderRadius.full,
  },
  pressedChip: {
    opacity: 0.65,
    transform: [{ scale: 0.98 }],
  },
  disabledChip: {
    opacity: 0.5,
  },
  suggestionText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontFamily: theme.fonts.medium,
  },
  suggestionIcon: {
    color: theme.colors.primary,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 13,
    marginBottom: 8,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  loadingText: {
    color: theme.colors.textSecondary,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: rt.insets.bottom + 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    gap: 8,
  },
  inputPill: {
    flex: 1,
    minHeight: 44,
    maxHeight: 108,
    justifyContent: "center",
    borderRadius: 22,
    borderCurve: "continuous",
    backgroundColor: theme.colors.inputBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  textInput: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    lineHeight: 21,
    includeFontPadding: false,
    textAlignVertical: "center",
    fontFamily: theme.fonts.regular,
    color: theme.colors.text,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.96 }],
  },
  sendButtonDisabled: {
    backgroundColor: theme.colors.inputBackground,
  },
}));

export default GenerateRecipeScreen;
