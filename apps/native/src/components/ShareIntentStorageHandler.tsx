import { useShareIntentContext } from "expo-share-intent";
import { useEffect, useRef } from "react";
import { Alert } from "react-native";

import {
  setPendingShareIntent,
  type PendingShareIntent,
} from "@/lib/pendingShareIntent";
import { useIsSignedIn } from "@/lib/signedInContext";
import { imageToBase64, getMimeTypeFromUri } from "@/utils/imageUtils";

/**
 * This component handles share intents when the user is NOT signed in.
 * It stores the intent to MMKV so it can be processed after login.
 *
 * This runs at the App level (outside NavigationContainer) so it can
 * capture share intents even before the user signs in.
 */
export function ShareIntentStorageHandler() {
  const { hasShareIntent, shareIntent, resetShareIntent } =
    useShareIntentContext();
  const isSignedIn = useIsSignedIn();
  const hasProcessedRef = useRef(false);

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

  // Only handle share intents when NOT signed in
  // When signed in, the ShareIntentHandler inside TabNavigator handles it
  useEffect(() => {
    if (isSignedIn) return; // Let the other handler deal with it
    if (!hasShareIntent || !shareIntent || hasProcessedRef.current) return;

    const detectedIntent = detectContentType(shareIntent);
    if (!detectedIntent) {
      resetShareIntent();
      return;
    }

    hasProcessedRef.current = true;

    // Store for later processing after login
    if (detectedIntent.type === "image") {
      // For images, we need to convert to base64 before storing
      (async () => {
        try {
          const base64 = await imageToBase64(detectedIntent.content);
          const mimeType = getMimeTypeFromUri(detectedIntent.content);
          setPendingShareIntent({
            ...detectedIntent,
            content: base64,
            mimeType,
          });
        } catch (error) {
          console.error("Error storing image intent:", error);
        }
      })();
    } else {
      setPendingShareIntent(detectedIntent);
    }

    Alert.alert(
      "Sign in required",
      "Please sign in to import this recipe. It will be processed automatically after you sign in.",
      [{ text: "OK" }],
    );
    resetShareIntent();
  }, [hasShareIntent, shareIntent, isSignedIn]);

  // Reset the processed flag when share intent is cleared
  useEffect(() => {
    if (!hasShareIntent) {
      hasProcessedRef.current = false;
    }
  }, [hasShareIntent]);

  return null;
}
