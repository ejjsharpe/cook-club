import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useState, useEffect } from "react";
import {
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Keyboard,
} from "react-native";
import ActionSheet, {
  SheetManager,
  SheetProps,
  ScrollView,
} from "react-native-actions-sheet";
import { StyleSheet } from "react-native-unistyles";

import { VSpace } from "./Space";
import { Text } from "./Text";

interface CookingReviewSheetPayload {
  recipeName: string;
  onSubmit: (data: {
    rating: number;
    reviewText?: string;
    imageUrls?: string[];
  }) => Promise<void>;
}

const MAX_IMAGES = 5;

export const CookingReviewSheet = (
  props: SheetProps<"cooking-review-sheet">,
) => {
  const { recipeName = "", onSubmit } = props.payload || {};

  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when sheet opens
  useEffect(() => {
    setRating(0);
    setReviewText("");
    setImages([]);
    setIsSubmitting(false);
  }, [recipeName]);

  const handlePickImages = async () => {
    if (images.length >= MAX_IMAGES) {
      Alert.alert(
        "Maximum images",
        `You can only add up to ${MAX_IMAGES} images`,
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES - images.length,
      quality: 0.8,
    });

    if (!result.canceled) {
      const newImages = result.assets.map((asset) => asset.uri);
      setImages((prev) => [...prev, ...newImages].slice(0, MAX_IMAGES));
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert("Rating required", "Please select a star rating");
      return;
    }

    if (!onSubmit) return;

    Keyboard.dismiss();
    setIsSubmitting(true);

    try {
      await onSubmit({
        rating,
        reviewText: reviewText.trim() || undefined,
        imageUrls: images.length > 0 ? images : undefined,
      });
      SheetManager.hide("cooking-review-sheet");
    } catch (error) {
      Alert.alert("Error", "Failed to submit review. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = rating > 0 && !isSubmitting;

  return (
    <ActionSheet
      id={props.sheetId}
      snapPoints={[100]}
      initialSnapIndex={0}
      gestureEnabled
      enableGesturesInScrollView={false}
      indicatorStyle={styles.indicator}
    >
      <View>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text type="title2">I made this!</Text>
            <Text type="bodyFaded" style={styles.recipeName}>
              {recipeName}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => SheetManager.hide("cooking-review-sheet")}
          >
            <Ionicons name="close" size={28} style={styles.closeIcon} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView}>
          <View style={styles.scrollContent}>
            {/* Star Rating */}
            <View style={styles.section}>
              <Text type="body" style={styles.sectionLabel}>
                How was it?
              </Text>
              <View style={styles.starRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setRating(star)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={star <= rating ? "star" : "star-outline"}
                      size={40}
                      style={
                        star <= rating ? styles.starFilled : styles.starEmpty
                      }
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <VSpace size={24} />

            {/* Review Text */}
            <View style={styles.section}>
              <Text type="body" style={styles.sectionLabel}>
                Add a note (optional)
              </Text>
              <TextInput
                style={styles.textInput}
                placeholder="Share your thoughts about this recipe..."
                placeholderTextColor="#999"
                value={reviewText}
                onChangeText={setReviewText}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <VSpace size={24} />

            {/* Photos */}
            <View style={styles.section}>
              <Text type="body" style={styles.sectionLabel}>
                Add photos (optional)
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.imagesRow}
              >
                {images.map((uri, index) => (
                  <View key={index} style={styles.imageContainer}>
                    <Image
                      source={{ uri }}
                      style={styles.image}
                      cachePolicy="memory-disk"
                    />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => handleRemoveImage(index)}
                    >
                      <Ionicons name="close-circle" size={24} color="white" />
                    </TouchableOpacity>
                  </View>
                ))}
                {images.length < MAX_IMAGES && (
                  <TouchableOpacity
                    style={styles.addImageButton}
                    onPress={handlePickImages}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="camera-outline"
                      size={32}
                      style={styles.addImageIcon}
                    />
                    <Text type="bodyFaded" style={styles.addImageText}>
                      Add photo
                    </Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>
          </View>
        </ScrollView>

        {/* Submit Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.submitButton,
              !canSubmit && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.submitButtonText}>Post Review</Text>
            )}
          </TouchableOpacity>
        </View>
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
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  recipeName: {
    fontSize: 14,
    marginTop: 4,
  },
  closeIcon: {
    color: theme.colors.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    gap: 12,
  },
  sectionLabel: {
    fontWeight: "600",
  },
  starRow: {
    flexDirection: "row",
    gap: 8,
  },
  starFilled: {
    color: theme.colors.primary,
  },
  starEmpty: {
    color: theme.colors.border,
  },
  textInput: {
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: theme.colors.text,
    minHeight: 100,
    fontFamily: theme.fonts.albertRegular,
  },
  imagesRow: {
    gap: 12,
  },
  imageContainer: {
    position: "relative",
  },
  image: {
    width: 100,
    height: 100,
    borderRadius: 12,
  },
  removeImageButton: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 12,
  },
  addImageButton: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  addImageIcon: {
    color: theme.colors.border,
  },
  addImageText: {
    fontSize: 12,
  },
  footer: {
    padding: 20,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  submitButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: theme.colors.buttonText,
    fontSize: 16,
    fontWeight: "600",
  },
}));
