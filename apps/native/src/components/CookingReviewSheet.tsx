import { TrueSheet } from "@lodev09/react-native-true-sheet";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { AppSheet } from "./AppSheet";
import { VSpace } from "./Space";
import { Text } from "./Text";

import { Ionicons } from "@/components/Ionicons";

const MAX_IMAGES = 5;

interface ReviewData {
  rating: number;
  reviewText?: string;
  imageUrls?: string[];
}

export interface CookingReviewSheetProps {
  recipeName?: string;
  initialRating?: number | null;
  isSubmitting?: boolean;
  onSubmit?: (data: ReviewData) => Promise<void>;
}

export interface CookingReviewSheetRef {
  present: () => void;
  dismiss: () => void;
}

export const CookingReviewSheet = forwardRef<
  CookingReviewSheetRef,
  CookingReviewSheetProps
>(
  (
    { recipeName = "", initialRating = null, isSubmitting = false, onSubmit },
    ref,
  ) => {
    const sheetRef = useRef<TrueSheet>(null);
    const [rating, setRating] = useState(initialRating ?? 0);
    const [reviewText, setReviewText] = useState("");
    const [images, setImages] = useState<string[]>([]);
    const [isSubmittingLocal, setIsSubmittingLocal] = useState(false);
    const isBusy = isSubmitting || isSubmittingLocal;

    const resetForm = useCallback(() => {
      setRating(initialRating ?? 0);
      setReviewText("");
      setImages([]);
      setIsSubmittingLocal(false);
    }, [initialRating]);

    useImperativeHandle(
      ref,
      () => ({
        present: () => {
          resetForm();
          sheetRef.current?.present();
        },
        dismiss: () => sheetRef.current?.dismiss(),
      }),
      [resetForm],
    );

    useEffect(() => {
      resetForm();
    }, [recipeName, resetForm]);

    const handleDismiss = () => {
      sheetRef.current?.dismiss();
    };

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
      setIsSubmittingLocal(true);

      try {
        await onSubmit({
          rating,
          reviewText: reviewText.trim() || undefined,
          imageUrls: images.length > 0 ? images : undefined,
        });
        handleDismiss();
      } catch {
        Alert.alert("Could not post rating", "Please try again.");
      } finally {
        setIsSubmittingLocal(false);
      }
    };

    const canSubmit = rating > 0 && !isBusy;
    const ratingLabel =
      rating === 0
        ? "Tap to rate"
        : rating === 1
          ? "1 star"
          : `${rating} stars`;

    return (
      <AppSheet
        ref={sheetRef}
        title="Rate recipe"
        subtitle={recipeName}
        detents={[0.8]}
        scrollable
        closeDisabled={isBusy}
        footer={
          <View style={styles.footer}>
            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                !canSubmit && styles.submitButtonDisabled,
                pressed && canSubmit && styles.submitButtonPressed,
              ]}
              onPress={handleSubmit}
              disabled={!canSubmit}
              accessibilityRole="button"
              accessibilityLabel="Post recipe rating"
            >
              {isBusy ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Text style={styles.submitButtonText}>Post rating</Text>
                  <Ionicons
                    name="arrow-up"
                    size={18}
                    style={styles.submitButtonIcon}
                  />
                </>
              )}
            </Pressable>
          </View>
        }
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.ratingPanel}>
            <View style={styles.ratingHeader}>
              <Text type="headline" style={styles.ratingTitle}>
                How was it?
              </Text>
              <Text type="caption" style={styles.ratingValue}>
                {ratingLabel}
              </Text>
            </View>

            <View style={styles.starRow} accessibilityRole="radiogroup">
              {[1, 2, 3, 4, 5].map((star) => {
                const selected = star <= rating;

                return (
                  <Pressable
                    key={star}
                    onPress={() => setRating(star)}
                    disabled={isBusy}
                    hitSlop={10}
                    style={({ pressed }) => [
                      styles.starButton,
                      selected && styles.starButtonSelected,
                      pressed && !isBusy && styles.starButtonPressed,
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: star === rating }}
                    accessibilityLabel={`${star} star${star === 1 ? "" : "s"}`}
                  >
                    <Ionicons
                      name={selected ? "star" : "star-outline"}
                      size={32}
                      style={selected ? styles.starFilled : styles.starEmpty}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>

          <VSpace size={18} />

          <View style={styles.section}>
            <Text type="body" style={styles.sectionLabel}>
              Add a note
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="What stood out?"
              placeholderTextColor="#8E8E93"
              value={reviewText}
              onChangeText={setReviewText}
              editable={!isBusy}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <VSpace size={18} />

          <View style={styles.section}>
            <Text type="body" style={styles.sectionLabel}>
              Photos
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.imagesRow}
              keyboardShouldPersistTaps="handled"
            >
              {images.map((uri, index) => (
                <View key={`${uri}-${index}`} style={styles.imageContainer}>
                  <Image
                    source={{ uri }}
                    style={styles.image}
                    cachePolicy="memory-disk"
                  />
                  <Pressable
                    style={styles.removeImageButton}
                    onPress={() => handleRemoveImage(index)}
                    disabled={isBusy}
                    accessibilityRole="button"
                    accessibilityLabel="Remove photo"
                  >
                    <Ionicons name="close" size={16} color="white" />
                  </Pressable>
                </View>
              ))}

              {images.length < MAX_IMAGES && (
                <Pressable
                  style={({ pressed }) => [
                    styles.addImageButton,
                    pressed && !isBusy && styles.addImageButtonPressed,
                  ]}
                  onPress={handlePickImages}
                  disabled={isBusy}
                  accessibilityRole="button"
                  accessibilityLabel="Add photo"
                >
                  <Ionicons
                    name="camera-outline"
                    size={26}
                    style={styles.addImageIcon}
                  />
                  <Text type="bodyFaded" style={styles.addImageText}>
                    Add photo
                  </Text>
                </Pressable>
              )}
            </ScrollView>
          </View>
        </ScrollView>
      </AppSheet>
    );
  },
);

const styles = StyleSheet.create((theme) => ({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 18,
  },
  ratingPanel: {
    borderRadius: 24,
    backgroundColor: theme.colors.inputBackground,
    padding: 16,
    gap: 16,
  },
  ratingHeader: {
    alignItems: "center",
    gap: 4,
  },
  ratingTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  ratingValue: {
    color: theme.colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  section: {
    gap: 12,
  },
  sectionLabel: {
    fontWeight: "600",
    color: theme.colors.text,
  },
  starRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  starButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
  },
  starButtonSelected: {
    backgroundColor: "rgba(249, 0, 0, 0.1)",
  },
  starButtonPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.96 }],
  },
  starFilled: {
    color: theme.colors.primary,
  },
  starEmpty: {
    color: "rgba(120, 120, 128, 0.45)",
  },
  textInput: {
    backgroundColor: theme.colors.inputBackground,
    borderRadius: 18,
    padding: 16,
    fontSize: 16,
    color: theme.colors.text,
    minHeight: 112,
    fontFamily: theme.fonts.regular,
  },
  imagesRow: {
    gap: 12,
    paddingRight: 20,
  },
  imageContainer: {
    position: "relative",
  },
  image: {
    width: 100,
    height: 100,
    borderRadius: 16,
  },
  removeImageButton: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  addImageButton: {
    width: 100,
    height: 100,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.inputBackground,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  addImageButtonPressed: {
    opacity: 0.72,
  },
  addImageIcon: {
    color: theme.colors.textSecondary,
  },
  addImageText: {
    fontSize: 12,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  submitButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  submitButtonText: {
    color: theme.colors.buttonText,
    fontSize: 16,
    fontWeight: "700",
  },
  submitButtonIcon: {
    color: theme.colors.buttonText,
  },
}));
