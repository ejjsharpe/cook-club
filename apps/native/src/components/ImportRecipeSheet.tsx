import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import {
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
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

import {
  useParseRecipeFromUrl,
  useParseRecipeFromText,
  useParseRecipeFromImage,
} from "@/api/recipe";
import { imageToBase64, getMimeTypeFromUri } from "@/utils/imageUtils";

type ImportMode = "url" | "text" | "image";

// Use the navigation param type for the result
type ParsedRecipeResult = NonNullable<
  ReactNavigation.RootParamList["EditRecipe"]["parsedRecipe"]
>;

interface ImportRecipeSheetPayload {
  onRecipeParsed: (result: ParsedRecipeResult) => void;
}

export const ImportRecipeSheet = (props: SheetProps<"import-recipe-sheet">) => {
  const { onRecipeParsed } = props.payload || {};

  const [mode, setMode] = useState<ImportMode>("url");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { refetch: fetchFromUrl } = useParseRecipeFromUrl({ url });
  const { refetch: fetchFromText } = useParseRecipeFromText({ text });
  const parseFromImage = useParseRecipeFromImage();

  const handleClose = () => {
    SheetManager.hide("import-recipe-sheet");
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleImport = async () => {
    setIsLoading(true);

    try {
      if (mode === "url") {
        if (!url.trim()) {
          Alert.alert("Error", "Please enter a URL");
          return;
        }
        const result = await fetchFromUrl();
        if (result.data?.success) {
          onRecipeParsed?.(result.data);
          handleClose();
        } else {
          Alert.alert("Error", "Failed to parse recipe from URL");
        }
      } else if (mode === "text") {
        if (!text.trim() || text.length < 50) {
          Alert.alert(
            "Error",
            "Please enter at least 50 characters of recipe text",
          );
          return;
        }
        const result = await fetchFromText();
        if (result.data?.success) {
          onRecipeParsed?.(result.data);
          handleClose();
        } else {
          Alert.alert("Error", "Failed to parse recipe from text");
        }
      } else if (mode === "image") {
        if (!imageUri) {
          Alert.alert("Error", "Please select an image");
          return;
        }
        const base64 = await imageToBase64(imageUri);
        const mimeType = getMimeTypeFromUri(imageUri);
        const result = await parseFromImage.mutateAsync({
          imageBase64: base64,
          mimeType,
        });
        if (result.success) {
          onRecipeParsed?.(result);
          handleClose();
        } else {
          Alert.alert("Error", "Failed to parse recipe from image");
        }
      }
    } catch (error) {
      console.error("Import error:", error);
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const renderModeButton = (m: ImportMode, icon: string, label: string) => (
    <TouchableOpacity
      key={m}
      style={[styles.modeButton, mode === m && styles.modeButtonActive]}
      onPress={() => setMode(m)}
    >
      <Ionicons
        name={icon as keyof typeof Ionicons.glyphMap}
        size={20}
        style={[styles.modeIcon, mode === m && styles.modeIconActive]}
      />
      <Text style={[styles.modeLabel, mode === m && styles.modeLabelActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

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
          <Text type="title2">Import Recipe</Text>
          <TouchableOpacity onPress={handleClose} disabled={isLoading}>
            <Ionicons name="close" size={28} style={styles.closeIcon} />
          </TouchableOpacity>
        </View>

        {/* Mode Selector */}
        <View style={styles.modeSelector}>
          {renderModeButton("url", "globe-outline", "URL")}
          {renderModeButton("text", "document-text-outline", "Text")}
          {renderModeButton("image", "camera-outline", "Image")}
        </View>

        <ScrollView
          style={styles.scrollView}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            {mode === "url" && (
              <>
                <Text type="body" style={styles.description}>
                  Enter the URL of a recipe from any website
                </Text>
                <VSpace size={16} />
                <Input
                  placeholder="https://example.com/recipe"
                  value={url}
                  onChangeText={setUrl}
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />
              </>
            )}

            {mode === "text" && (
              <>
                <Text type="body" style={styles.description}>
                  Paste your recipe text (ingredients, instructions, etc.)
                </Text>
                <VSpace size={16} />
                <TextInput
                  style={styles.textArea}
                  placeholder="Paste your recipe here..."
                  value={text}
                  onChangeText={setText}
                  multiline
                  numberOfLines={10}
                  textAlignVertical="top"
                  editable={!isLoading}
                />
                <Text type="bodyFaded" style={styles.charCount}>
                  {text.length} / 10,000 characters (min 50)
                </Text>
              </>
            )}

            {mode === "image" && (
              <>
                <Text type="body" style={styles.description}>
                  Take a photo or select an image of a recipe
                </Text>
                <VSpace size={16} />
                {imageUri ? (
                  <View style={styles.imagePreviewContainer}>
                    <Image
                      source={{ uri: imageUri }}
                      style={styles.imagePreview}
                    />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => setImageUri(null)}
                      disabled={isLoading}
                    >
                      <Ionicons name="close-circle" size={28} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.imagePicker}
                    onPress={handlePickImage}
                    disabled={isLoading}
                  >
                    <Ionicons
                      name="image-outline"
                      size={48}
                      style={styles.imagePickerIcon}
                    />
                    <VSpace size={8} />
                    <Text type="bodyFaded">Tap to select an image</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            <VSpace size={24} />

            <PrimaryButton onPress={handleImport} disabled={isLoading}>
              {isLoading ? "Processing..." : "Import Recipe"}
            </PrimaryButton>

            {isLoading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" />
                <VSpace size={12} />
                <Text type="body">Analyzing recipe with AI...</Text>
                <Text type="bodyFaded">This may take a few seconds</Text>
              </View>
            )}

            <VSpace size={20} />
          </View>
        </ScrollView>
      </View>
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
  modeSelector: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: theme.borderRadius.medium,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 6,
  },
  modeButtonActive: {
    borderColor: theme.colors.primary,
    backgroundColor: `${theme.colors.primary}15`,
  },
  modeIcon: {
    color: `${theme.colors.text}80`,
  },
  modeIconActive: {
    color: theme.colors.primary,
  },
  modeLabel: {
    fontSize: 14,
    color: `${theme.colors.text}80`,
  },
  modeLabelActive: {
    color: theme.colors.primary,
    fontWeight: "600",
  },
  scrollView: {
    maxHeight: 450,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  description: {
    textAlign: "center",
  },
  textArea: {
    width: "100%",
    height: 200,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.medium,
    borderColor: theme.colors.border,
    borderWidth: 1,
    fontFamily: theme.fonts.albertRegular,
    fontSize: 16,
  },
  charCount: {
    textAlign: "right",
    marginTop: 8,
    fontSize: 12,
  },
  imagePicker: {
    width: "100%",
    height: 200,
    borderRadius: theme.borderRadius.medium,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  imagePickerIcon: {
    color: `${theme.colors.text}80`,
  },
  imagePreviewContainer: {
    position: "relative",
    width: "100%",
    height: 250,
    borderRadius: theme.borderRadius.medium,
    overflow: "hidden",
  },
  imagePreview: {
    width: "100%",
    height: "100%",
  },
  removeImageButton: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 14,
  },
  loadingOverlay: {
    marginTop: 20,
    alignItems: "center",
  },
}));
