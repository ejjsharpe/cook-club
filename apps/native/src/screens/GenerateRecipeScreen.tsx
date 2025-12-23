import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useCallback, useRef, useState } from "react";
import {
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import Animated, { FadeInUp, FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";

import { useGenerateRecipeChat } from "@/api/chat";
import { BackButton } from "@/components/buttons/BackButton";
import { HSpace, VSpace } from "@/components/Space";
import { Text } from "@/components/Text";
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

export const GenerateRecipeScreen = () => {
  const { navigate } = useNavigation();
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
          // Recipe generated - navigate to edit screen
          setStatus("idle");
          navigate("EditRecipe", {
            parsedRecipe: {
              success: true,
              data: result.recipe,
              metadata: {
                source: "text" as const,
                parseMethod: "ai_only" as const,
                confidence: "high" as const,
              },
            },
          });
        }
      } catch (error) {
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
            styles.messageBubble,
            isUser ? styles.userBubble : styles.assistantBubble,
          ]}
        >
          <Text style={isUser ? styles.userText : styles.assistantText}>
            {item.content}
          </Text>

          {item.suggestedReplies && item.suggestedReplies.length > 0 && (
            <View style={styles.suggestedReplies}>
              {item.suggestedReplies.map((reply, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.suggestionChip}
                  onPress={() => sendMessage(reply)}
                  disabled={status !== "idle"}
                  activeOpacity={0.7}
                >
                  <Text style={styles.suggestionText}>{reply}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Animated.View>
      );
    },
    [sendMessage, status],
  );

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <BackButton />
        <Text type="title2">Create with AI</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Chat Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
        keyboardShouldPersistTaps="handled"
      />

      {/* Loading Indicator */}
      {status !== "idle" && (
        <Animated.View
          entering={FadeInDown.duration(200)}
          style={styles.loadingContainer}
        >
          <ActivityIndicator size="small" />
          <HSpace size={8} />
          <Text type="caption">
            {status === "generating"
              ? "Creating your recipe..."
              : "Thinking..."}
          </Text>
        </Animated.View>
      )}

      {/* Input Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={10}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type your message..."
            placeholderTextColor="#999"
            multiline
            maxLength={500}
            editable={status === "idle"}
            onSubmitEditing={() => sendMessage(inputText)}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || status !== "idle") &&
                styles.sendButtonDisabled,
            ]}
            onPress={() => sendMessage(inputText)}
            disabled={!inputText.trim() || status !== "idle"}
            activeOpacity={0.7}
          >
            <Ionicons
              name="arrow-up"
              size={20}
              color={inputText.trim() && status === "idle" ? "#fff" : "#999"}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerSpacer: {
    width: 24,
  },
  messageList: {
    padding: 16,
    paddingBottom: 8,
    flexGrow: 1,
  },
  messageBubble: {
    maxWidth: "85%",
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: theme.colors.primary,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor:
      theme.colors.background === "#FFFFFF"
        ? "rgba(0,0,0,0.06)"
        : "rgba(255,255,255,0.1)",
    borderBottomLeftRadius: 4,
  },
  userText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: theme.fonts.albertRegular,
    lineHeight: 22,
  },
  assistantText: {
    color: theme.colors.text,
    fontSize: 16,
    fontFamily: theme.fonts.albertRegular,
    lineHeight: 22,
  },
  suggestedReplies: {
    marginTop: 12,
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  suggestionText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontFamily: theme.fonts.albertMedium,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    gap: 8,
  },
  textInput: {
    flex: 1,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor:
      theme.colors.background === "#FFFFFF"
        ? "rgba(0,0,0,0.04)"
        : "rgba(255,255,255,0.06)",
    fontSize: 16,
    fontFamily: theme.fonts.albertRegular,
    color: theme.colors.text,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor:
      theme.colors.background === "#FFFFFF"
        ? "rgba(0,0,0,0.1)"
        : "rgba(255,255,255,0.1)",
  },
}));

export default GenerateRecipeScreen;
