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
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
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
import { imageToBase64 } from "@/utils/imageUtils";

type ImportMode = "url" | "text" | "image";

const ModeOption = ({
  icon,
  label,
  selected,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  selected: boolean;
  onPress: () => void;
}) => (
  <TouchableOpacity
    style={[modeStyles.option, selected && modeStyles.optionSelected]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View
      style={[
        modeStyles.iconContainer,
        selected && modeStyles.iconContainerSelected,
      ]}
    >
      <Ionicons
        name={icon}
        size={18}
        style={selected ? modeStyles.iconSelected : modeStyles.icon}
      />
    </View>
    <Text
      type="subheadline"
      style={selected ? modeStyles.labelSelected : modeStyles.label}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

const modeStyles = StyleSheet.create((theme) => ({
  option: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 50,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.inputBackground,
    gap: 8,
  },
  optionSelected: {
    backgroundColor: theme.colors.primary + "20",
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  iconContainerSelected: {
    backgroundColor: theme.colors.primary + "30",
  },
  icon: {
    color: theme.colors.textSecondary,
  },
  iconSelected: {
    color: theme.colors.primary,
  },
  label: {
    color: theme.colors.textSecondary,
  },
  labelSelected: {
    color: theme.colors.primary,
    fontWeight: "500",
  },
}));

export const SmartImportSheet = (props: SheetProps<"smart-import-sheet">) => {
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
    SheetManager.hide("smart-import-sheet");
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

  const handleTakePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission Required",
        "Please allow camera access to take photos",
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
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
        const { base64, mimeType } = await imageToBase64(imageUri);
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

  const getButtonLabel = () => {
    if (isLoading) return "Processing...";
    switch (mode) {
      case "url":
        return "Import from URL";
      case "text":
        return "Import from Text";
      case "image":
        return "Import from Image";
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
          <Text type="headline">Smart Import</Text>
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
            {/* Mode Selector */}
            <View style={styles.modeSelector}>
              <ModeOption
                icon="link-outline"
                label="URL"
                selected={mode === "url"}
                onPress={() => setMode("url")}
              />
              <ModeOption
                icon="document-text-outline"
                label="Text"
                selected={mode === "text"}
                onPress={() => setMode("text")}
              />
              <ModeOption
                icon="image-outline"
                label="Image"
                selected={mode === "image"}
                onPress={() => setMode("image")}
              />
            </View>

            <VSpace size={24} />

            {mode === "url" && (
              <Animated.View entering={FadeIn.duration(200)}>
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
                  Works with most recipe websites and social media links
                </Text>
              </Animated.View>
            )}

            {mode === "text" && (
              <Animated.View entering={FadeIn.duration(200)}>
                <Text type="subheadline" style={styles.label}>
                  Recipe Text
                </Text>
                <VSpace size={8} />
                <TextInput
                  style={styles.textArea}
                  placeholder="Paste ingredients, instructions, or a full recipe..."
                  placeholderTextColor="rgba(0,0,0,0.35)"
                  value={text}
                  onChangeText={setText}
                  multiline
                  numberOfLines={10}
                  textAlignVertical="top"
                  editable={!isLoading}
                />
                <VSpace size={8} />
                <Text type="caption" style={styles.hint}>
                  {text.length} characters (minimum 50)
                </Text>
              </Animated.View>
            )}

            {mode === "image" && (
              <Animated.View entering={FadeIn.duration(200)}>
                <Text type="subheadline" style={styles.label}>
                  Recipe Image
                </Text>
                <VSpace size={8} />
                {imageUri ? (
                  <View style={styles.imagePreviewContainer}>
                    <Image
                      source={{ uri: imageUri }}
                      style={styles.imagePreview}
                    />
                    <View style={styles.changeImageButtons}>
                      <TouchableOpacity
                        style={styles.changeImageButton}
                        onPress={handleTakePhoto}
                        disabled={isLoading}
                      >
                        <Ionicons name="camera" size={16} color="white" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.changeImageButton}
                        onPress={handlePickImage}
                        disabled={isLoading}
                      >
                        <Ionicons name="images" size={16} color="white" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.imagePickerOptions}>
                    <TouchableOpacity
                      style={styles.imagePickerOption}
                      onPress={handleTakePhoto}
                      disabled={isLoading}
                    >
                      <Ionicons
                        name="camera-outline"
                        size={28}
                        style={styles.imagePickerIcon}
                      />
                      <VSpace size={6} />
                      <Text type="subheadline" style={styles.imagePickerText}>
                        Take Photo
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.imagePickerOption}
                      onPress={handlePickImage}
                      disabled={isLoading}
                    >
                      <Ionicons
                        name="images-outline"
                        size={28}
                        style={styles.imagePickerIcon}
                      />
                      <VSpace size={6} />
                      <Text type="subheadline" style={styles.imagePickerText}>
                        Choose Photo
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
                <VSpace size={8} />
                <Text type="caption" style={styles.hint}>
                  Upload a photo of a recipe card, cookbook page, or screenshot
                </Text>
              </Animated.View>
            )}

            <Animated.View layout={LinearTransition.duration(200)}>
              <VSpace size={24} />

              <PrimaryButton onPress={handleImport} disabled={isLoading}>
                {getButtonLabel()}
              </PrimaryButton>
            </Animated.View>

            {isLoading && (
              <View style={styles.loadingContainer}>
                <VSpace size={16} />
                <ActivityIndicator size="small" />
                <VSpace size={8} />
                <Text type="caption" style={styles.loadingText}>
                  Analyzing with AI...
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
    maxHeight: 500,
  },
  content: {
    paddingHorizontal: 20,
  },
  modeSelector: {
    flexDirection: "row",
    gap: 12,
  },
  label: {
    color: theme.colors.textSecondary,
    marginLeft: 4,
  },
  hint: {
    color: theme.colors.textTertiary,
    marginLeft: 4,
  },
  textArea: {
    width: "100%",
    height: 180,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.large,
    backgroundColor: theme.colors.inputBackground,
    fontFamily: theme.fonts.regular,
    fontSize: 16,
    color: theme.colors.text,
  },
  imagePickerOptions: {
    flexDirection: "row",
    gap: 12,
  },
  imagePickerOption: {
    flex: 1,
    height: 120,
    borderRadius: theme.borderRadius.large,
    backgroundColor: theme.colors.inputBackground,
    alignItems: "center",
    justifyContent: "center",
  },
  imagePickerIcon: {
    color: theme.colors.textTertiary,
  },
  imagePickerText: {
    color: theme.colors.textSecondary,
  },
  imagePreviewContainer: {
    position: "relative",
    width: "100%",
    height: 200,
    borderRadius: theme.borderRadius.large,
    overflow: "hidden",
  },
  imagePreview: {
    width: "100%",
    height: "100%",
  },
  changeImageButtons: {
    position: "absolute",
    bottom: 12,
    right: 12,
    flexDirection: "row",
    gap: 8,
  },
  changeImageButton: {
    backgroundColor: "rgba(0,0,0,0.6)",
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingContainer: {
    alignItems: "center",
  },
  loadingText: {
    color: theme.colors.textSecondary,
  },
}));
