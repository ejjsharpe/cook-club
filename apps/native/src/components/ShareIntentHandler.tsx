import { useNavigation } from "@react-navigation/native";
import { useShareIntentContext } from "expo-share-intent";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Modal, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { VSpace } from "./Space";
import { Text } from "./Text";

import {
  useParseRecipeFromUrl,
  useParseRecipeFromText,
  useParseRecipeFromImage,
} from "@/api/recipe";
import {
  getPendingShareIntent,
  clearPendingShareIntent,
  type PendingShareIntent,
} from "@/lib/pendingShareIntent";
import { imageToBase64, getMimeTypeFromUri } from "@/utils/imageUtils";

type ParsedRecipeResult = NonNullable<
  ReactNavigation.RootParamList["EditRecipe"]["parsedRecipe"]
>;

export function ShareIntentHandler() {
  const { hasShareIntent, shareIntent, resetShareIntent } =
    useShareIntentContext();
  const navigation = useNavigation();

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState("");
  const hasProcessedRef = useRef(false);
  const hasCheckedPendingRef = useRef(false);

  // Parse hooks - we'll use refetch for URL and text
  const [pendingUrl, setPendingUrl] = useState("");
  const [pendingText, setPendingText] = useState("");

  const { refetch: fetchFromUrl } = useParseRecipeFromUrl({ url: pendingUrl });
  const { refetch: fetchFromText } = useParseRecipeFromText({
    text: pendingText,
  });
  const parseFromImage = useParseRecipeFromImage();

  // Process a share intent (either new or pending)
  const processShareIntent = async (intent: PendingShareIntent) => {
    setIsProcessing(true);

    try {
      let result: ParsedRecipeResult | null = null;

      if (intent.type === "url") {
        setProcessingMessage("Fetching recipe from URL...");
        setPendingUrl(intent.content);
        // Need to wait for the state to update, then refetch
        await new Promise((resolve) => setTimeout(resolve, 100));
        const urlResult = await fetchFromUrl();
        if (urlResult.data?.success) {
          result = urlResult.data;
        }
      } else if (intent.type === "text") {
        setProcessingMessage("Parsing recipe from text...");
        setPendingText(intent.content);
        await new Promise((resolve) => setTimeout(resolve, 100));
        const textResult = await fetchFromText();
        if (textResult.data?.success) {
          result = textResult.data;
        }
      } else if (intent.type === "image") {
        setProcessingMessage("Analyzing recipe image...");
        const mimeType = (intent.mimeType || "image/jpeg") as
          | "image/jpeg"
          | "image/png"
          | "image/webp";
        const imageResult = await parseFromImage.mutateAsync({
          imageBase64: intent.content,
          mimeType,
        });
        if (imageResult.success) {
          result = imageResult;
        }
      }

      if (result) {
        clearPendingShareIntent();
        navigation.navigate("EditRecipe", { parsedRecipe: result });
      } else {
        Alert.alert(
          "Couldn't parse recipe",
          "We couldn't extract a recipe from the shared content. Please try again or enter the recipe manually.",
          [{ text: "OK" }],
        );
        clearPendingShareIntent();
      }
    } catch (error) {
      console.error("Error processing share intent:", error);
      Alert.alert(
        "Error",
        "Something went wrong while processing the shared content. Please try again.",
        [{ text: "OK" }],
      );
      clearPendingShareIntent();
    } finally {
      setIsProcessing(false);
      setProcessingMessage("");
      resetShareIntent();
    }
  };

  // Detect content type from share intent
  const detectContentType = (
    intent: typeof shareIntent,
  ): PendingShareIntent | null => {
    // Check for URL first
    if (intent?.webUrl) {
      return { type: "url", content: intent.webUrl, timestamp: Date.now() };
    }

    // Check for image files
    if (intent?.files && intent.files.length > 0) {
      const file = intent.files[0];
      if (file?.mimeType?.startsWith("image/")) {
        return {
          type: "image",
          content: file.path,
          mimeType: file.mimeType,
          timestamp: Date.now(),
        };
      }
    }

    // Check for text content
    if (intent?.text) {
      // Check if the text contains a URL
      const urlMatch = intent.text.match(/https?:\/\/[^\s<>"{}|\\^`[\]]+/i);
      if (urlMatch) {
        return { type: "url", content: urlMatch[0], timestamp: Date.now() };
      }

      // Otherwise treat as recipe text
      if (intent.text.length >= 50) {
        return { type: "text", content: intent.text, timestamp: Date.now() };
      }
    }

    return null;
  };

  // Check for pending share intent on mount (from previous session or pre-login)
  useEffect(() => {
    if (hasCheckedPendingRef.current) return;
    hasCheckedPendingRef.current = true;

    const pendingIntent = getPendingShareIntent();
    if (pendingIntent) {
      // Small delay to ensure navigation is ready
      setTimeout(() => {
        processShareIntent(pendingIntent);
      }, 500);
    }
  }, []);

  // Handle new share intents
  useEffect(() => {
    if (!hasShareIntent || !shareIntent || hasProcessedRef.current) return;

    const detectedIntent = detectContentType(shareIntent);
    if (!detectedIntent) {
      resetShareIntent();
      return;
    }

    hasProcessedRef.current = true;

    // For image type, we need to convert file path to base64 first
    if (detectedIntent.type === "image") {
      (async () => {
        try {
          const base64 = await imageToBase64(detectedIntent.content);
          const mimeType = getMimeTypeFromUri(detectedIntent.content);
          await processShareIntent({
            ...detectedIntent,
            content: base64,
            mimeType,
          });
        } catch (error) {
          console.error("Error converting image:", error);
          Alert.alert("Error", "Failed to process the shared image.");
          resetShareIntent();
        }
      })();
    } else {
      processShareIntent(detectedIntent);
    }
  }, [hasShareIntent, shareIntent]);

  // Reset the processed flag when share intent is cleared
  useEffect(() => {
    if (!hasShareIntent) {
      hasProcessedRef.current = false;
    }
  }, [hasShareIntent]);

  // Loading modal
  if (isProcessing) {
    return (
      <Modal transparent visible={isProcessing} animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#000" />
            <VSpace size={16} />
            <Text type="heading">Importing Recipe</Text>
            <VSpace size={8} />
            <Text type="bodyFaded" style={styles.message}>
              {processingMessage || "Processing..."}
            </Text>
          </View>
        </View>
      </Modal>
    );
  }

  return null;
}

const styles = StyleSheet.create((theme) => ({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContainer: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.large,
    padding: 32,
    alignItems: "center",
    minWidth: 200,
  },
  message: {
    textAlign: "center",
  },
}));
