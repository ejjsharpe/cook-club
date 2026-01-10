import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { View, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import ActionSheet, {
  SheetManager,
  SheetProps,
  ScrollView,
} from "react-native-actions-sheet";
import { StyleSheet } from "react-native-unistyles";

import { Input } from "./Input";
import { VSpace } from "./Space";
import { Text } from "./Text";
import { PrimaryButton } from "./buttons/PrimaryButton";

import { useParseRecipeFromUrlBasic } from "@/api/recipe";

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

export const BasicImportSheet = (props: SheetProps<"basic-import-sheet">) => {
  const { onRecipeParsed } = props.payload || {};

  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { refetch: fetchFromUrl } = useParseRecipeFromUrlBasic({ url });

  const handleClose = () => {
    SheetManager.hide("basic-import-sheet");
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
    <ActionSheet
      id={props.sheetId}
      snapPoints={[100]}
      initialSnapIndex={0}
      gestureEnabled={!isLoading}
      closable={!isLoading}
      indicatorStyle={styles.indicator}
    >
      <View>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <Text type="headline">Basic Import</Text>
          <TouchableOpacity
            onPress={handleClose}
            disabled={isLoading}
            style={styles.closeButton}
          >
            <View style={styles.closeButtonCircle}>
              <Ionicons name="close" size={16} style={styles.closeIcon} />
            </View>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          keyboardShouldPersistTaps="handled"
        >
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
      </View>
    </ActionSheet>
  );
};

const styles = StyleSheet.create((theme) => ({
  indicator: {
    backgroundColor: theme.colors.border,
    width: 36,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 16,
  },
  headerSpacer: {
    width: 30,
  },
  closeButton: {
    padding: 4,
  },
  closeButtonCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.inputBackground,
    justifyContent: "center",
    alignItems: "center",
  },
  closeIcon: {
    color: theme.colors.textSecondary,
  },
  scrollView: {
    maxHeight: 300,
  },
  content: {
    paddingHorizontal: 20,
  },
  label: {
    color: theme.colors.textSecondary,
    marginLeft: 4,
  },
  hint: {
    color: theme.colors.textTertiary,
    marginLeft: 4,
  },
  loadingContainer: {
    alignItems: "center",
  },
  loadingText: {
    color: theme.colors.textSecondary,
  },
}));
