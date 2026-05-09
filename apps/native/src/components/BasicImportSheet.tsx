import { TrueSheet } from "@lodev09/react-native-true-sheet";
import { forwardRef, useState, useImperativeHandle, useRef } from "react";
import { View, ActivityIndicator, Alert, ScrollView } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { AppSheet } from "./AppSheet";
import { Input } from "./Input";
import { VSpace } from "./Space";
import { Text } from "./Text";
import { PrimaryButton } from "./buttons/PrimaryButton";

import { useParseRecipeFromUrlBasic, type ParsedRecipe } from "@/api/recipe";

// Domains that don't have structured recipe data
const UNSUPPORTED_DOMAINS = [
  "instagram.com",
  "www.instagram.com",
  "tiktok.com",
  "www.tiktok.com",
  "facebook.com",
  "www.facebook.com",
  "fb.com",
  "www.fb.com",
];

function isUnsupportedUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return UNSUPPORTED_DOMAINS.some(
      (domain) =>
        urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}

export interface BasicImportSheetProps {
  onRecipeParsed?: (data: ParsedRecipe) => void;
}

export interface BasicImportSheetRef {
  present: () => void;
  dismiss: () => void;
}

export const BasicImportSheet = forwardRef<
  BasicImportSheetRef,
  BasicImportSheetProps
>(({ onRecipeParsed }, ref) => {
  const sheetRef = useRef<TrueSheet>(null);
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { refetch: fetchFromUrl } = useParseRecipeFromUrlBasic({ url });

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const handleClose = () => {
    sheetRef.current?.dismiss();
  };

  const handleImport = async () => {
    if (!url.trim()) {
      Alert.alert("Error", "Please enter a URL");
      return;
    }

    // Check for unsupported social media URLs before making API call
    if (isUnsupportedUrl(url)) {
      Alert.alert(
        "Unsupported Link",
        "Social media links aren't supported with Basic Import. They don't contain structured recipe data.",
      );
      return;
    }

    setIsLoading(true);

    try {
      const result = await fetchFromUrl();
      if (result.data?.success) {
        onRecipeParsed?.(result.data);
        handleClose();
      } else {
        // Show error message from the API or a default message
        const errorMessage =
          result.error?.message ||
          "This website doesn't have recipe data we can read. Try a different recipe website.";
        Alert.alert("Import Failed", errorMessage);
      }
    } catch (error) {
      console.error("Import error:", error);
      Alert.alert(
        "Error",
        "Couldn't access this URL. Please check the link and try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppSheet
      ref={sheetRef}
      title="Basic Import"
      detents={["auto"]}
      dismissible={!isLoading}
      closeDisabled={isLoading}
    >
      <ScrollView keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <Text type="subheadline" style={styles.label}>
            Recipe URL
          </Text>
          <VSpace size={8} />
          <Input
            placeholder="https://example.com/recipe"
            value={url}
            onChangeText={setUrl}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
          />
          <VSpace size={8} />
          <Text type="caption" style={styles.hint}>
            Works with most recipe websites that use standard recipe markup
          </Text>

          <VSpace size={24} />

          <PrimaryButton onPress={handleImport} disabled={isLoading}>
            {isLoading ? "Importing..." : "Import Recipe"}
          </PrimaryButton>
          {isLoading && (
            <View style={styles.loadingContainer}>
              <VSpace size={16} />
              <ActivityIndicator size="small" />
              <VSpace size={8} />
              <Text type="caption" style={styles.loadingText}>
                Fetching recipe data...
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </AppSheet>
  );
});

const styles = StyleSheet.create((theme) => ({
  content: {
    paddingHorizontal: 20,
  },
  label: {
    color: theme.colors.text,
    marginLeft: 4,
  },
  hint: {
    color: theme.colors.textSecondary,
    marginLeft: 4,
  },
  loadingContainer: {
    alignItems: "center",
  },
  loadingText: {
    color: theme.colors.textSecondary,
  },
}));
