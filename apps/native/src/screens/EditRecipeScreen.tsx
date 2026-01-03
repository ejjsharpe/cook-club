import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import { useTRPC } from "@repo/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import React, { useState, useCallback } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  FlatList,
  Modal,
  ActivityIndicator,
} from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { Input } from "@/components/Input";
import { SafeAreaView } from "@/components/SafeAreaView";
import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";
import { TimePicker } from "@/components/TimePicker";
import { BackButton } from "@/components/buttons/BackButton";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { useImageUpload } from "@/hooks/useImageUpload";

interface ParsedIngredient {
  quantity: number | null;
  unit: string | null;
  name: string;
  confidence: "high" | "medium" | "low";
  originalText: string;
}

interface IngredientSection {
  name: string | null;
  index: number;
  items: string[];
}

interface MethodSection {
  name: string | null;
  index: number;
  items: { text: string; imageUrl: string | null }[];
}

export default function EditRecipeScreen() {
  const route =
    useRoute<RouteProp<ReactNavigation.RootParamList, "EditRecipe">>();
  const parsedRecipe = route.params?.parsedRecipe;
  // Extract the recipe data if parsing was successful
  const prefill = parsedRecipe?.success ? parsedRecipe.data : undefined;
  // Extract source type from metadata (url, text, image)
  const sourceType = parsedRecipe?.success
    ? parsedRecipe.metadata.source
    : undefined;
  const navigation = useNavigation();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Convert structured ingredients to section-aware format for editing
  const getIngredientSections = (): IngredientSection[] => {
    if (
      !prefill?.ingredientSections ||
      prefill.ingredientSections.length === 0
    ) {
      return [{ name: null, index: 0, items: [""] }];
    }

    return prefill.ingredientSections.map((section, sectionIdx) => {
      const items = section.ingredients.map((ing) => {
        const parts = [];
        if (ing.quantity) parts.push(ing.quantity.toString());
        if (ing.unit) parts.push(ing.unit);
        parts.push(ing.name);
        return parts.join(" ");
      });
      return {
        name: section.name,
        index: sectionIdx,
        // Ensure section always has at least one item for editing
        items: items.length > 0 ? items : [""],
      };
    });
  };

  // Convert structured instructions to section-aware format for editing
  const getMethodSections = (): MethodSection[] => {
    if (
      !prefill?.instructionSections ||
      prefill.instructionSections.length === 0
    ) {
      return [{ name: null, index: 0, items: [{ text: "", imageUrl: null }] }];
    }

    return prefill.instructionSections.map((section, sectionIdx) => {
      const items = section.instructions.map((inst) => ({
        text: inst.instruction,
        imageUrl: inst.imageUrl ?? null,
      }));
      return {
        name: section.name,
        index: sectionIdx,
        // Ensure section always has at least one item for editing
        items: items.length > 0 ? items : [{ text: "", imageUrl: null }],
      };
    });
  };

  const [title, setTitle] = useState(prefill?.name || "");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState(prefill?.description || "");
  const [prepTime, setPrepTime] = useState<number | null>(
    prefill?.prepTime ?? null,
  );
  const [cookTime, setCookTime] = useState<number | null>(
    prefill?.cookTime ?? null,
  );
  const [servings, setServings] = useState<number>(prefill?.servings || 4);

  // Section-aware state for ingredients and method
  const [ingredientSections, setIngredientSections] = useState<
    IngredientSection[]
  >(getIngredientSections);
  const [methodSections, setMethodSections] =
    useState<MethodSection[]>(getMethodSections);
  // Track images with their upload state
  // For new uploads: { uri, key } where key is set after upload completes
  // For prefill images: { uri } where uri is already a remote URL
  const [images, setImages] = useState<{ uri: string; key?: string }[]>(
    () => prefill?.images?.map((uri) => ({ uri })) || [],
  );
  const [showParsePreview, setShowParsePreview] = useState(false);
  const [parsedIngredients, setParsedIngredients] = useState<
    ParsedIngredient[]
  >([]);

  // Image upload hook
  const {
    uploadImages,
    isUploading: isUploadingImages,
    uploadProgress,
  } = useImageUpload({
    onError: (error) => {
      Alert.alert("Upload Error", error.message);
    },
  });

  // Ingredient section management
  const updateIngredient = (
    sectionIdx: number,
    itemIdx: number,
    value: string,
  ) => {
    setIngredientSections((prev) =>
      prev.map((section, si) =>
        si === sectionIdx
          ? {
              ...section,
              items: section.items.map((item, ii) =>
                ii === itemIdx ? value : item,
              ),
            }
          : section,
      ),
    );
  };

  const addIngredient = (sectionIdx: number) => {
    setIngredientSections((prev) =>
      prev.map((section, si) =>
        si === sectionIdx
          ? { ...section, items: [...section.items, ""] }
          : section,
      ),
    );
  };

  const removeIngredient = (sectionIdx: number, itemIdx: number) => {
    setIngredientSections((prev) =>
      prev.map((section, si) =>
        si === sectionIdx
          ? {
              ...section,
              items: section.items.filter((_, ii) => ii !== itemIdx),
            }
          : section,
      ),
    );
  };

  const addIngredientSection = () => {
    const newIndex = ingredientSections.length;
    setIngredientSections((prev) => [
      ...prev,
      { name: "", index: newIndex, items: [""] },
    ]);
  };

  const updateIngredientSectionName = (sectionIdx: number, name: string) => {
    setIngredientSections((prev) =>
      prev.map((section, si) =>
        si === sectionIdx ? { ...section, name: name || null } : section,
      ),
    );
  };

  const removeIngredientSection = (sectionIdx: number) => {
    setIngredientSections((prev) => prev.filter((_, si) => si !== sectionIdx));
  };

  // Method section management
  const updateMethod = (sectionIdx: number, itemIdx: number, value: string) => {
    setMethodSections((prev) =>
      prev.map((section, si) =>
        si === sectionIdx
          ? {
              ...section,
              items: section.items.map((item, ii) =>
                ii === itemIdx ? { ...item, text: value } : item,
              ),
            }
          : section,
      ),
    );
  };

  const addMethod = (sectionIdx: number) => {
    setMethodSections((prev) =>
      prev.map((section, si) =>
        si === sectionIdx
          ? {
              ...section,
              items: [...section.items, { text: "", imageUrl: null }],
            }
          : section,
      ),
    );
  };

  const removeMethod = (sectionIdx: number, itemIdx: number) => {
    setMethodSections((prev) =>
      prev.map((section, si) =>
        si === sectionIdx
          ? {
              ...section,
              items: section.items.filter((_, ii) => ii !== itemIdx),
            }
          : section,
      ),
    );
  };

  const addMethodSection = () => {
    const newIndex = methodSections.length;
    setMethodSections((prev) => [
      ...prev,
      { name: "", index: newIndex, items: [{ text: "", imageUrl: null }] },
    ]);
  };

  const updateMethodSectionName = (sectionIdx: number, name: string) => {
    setMethodSections((prev) =>
      prev.map((section, si) =>
        si === sectionIdx ? { ...section, name: name || null } : section,
      ),
    );
  };

  const removeMethodSection = (sectionIdx: number) => {
    setMethodSections((prev) => prev.filter((_, si) => si !== sectionIdx));
  };

  const pickStepImage = async (sectionIdx: number, stepIdx: number) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    const pickedAsset = result.assets?.[0];
    if (!result.canceled && pickedAsset) {
      setMethodSections((prev) =>
        prev.map((section, si) =>
          si === sectionIdx
            ? {
                ...section,
                items: section.items.map((item, ii) =>
                  ii === stepIdx
                    ? { ...item, imageUrl: pickedAsset.uri }
                    : item,
                ),
              }
            : section,
        ),
      );
    }
  };

  const removeStepImage = (sectionIdx: number, stepIdx: number) => {
    setMethodSections((prev) =>
      prev.map((section, si) =>
        si === sectionIdx
          ? {
              ...section,
              items: section.items.map((item, ii) =>
                ii === stepIdx ? { ...item, imageUrl: null } : item,
              ),
            }
          : section,
      ),
    );
  };

  const pickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const newUris = result.assets.map((item) => item.uri);

      // Add to display immediately (without keys yet)
      setImages((prev) => [...prev, ...newUris.map((uri) => ({ uri }))]);

      try {
        // Upload in background
        const uploadResults = await uploadImages(newUris);

        // Build a map of URI -> key for efficient lookup
        const uriToKey = new Map(
          uploadResults.map((result, i) => [newUris[i], result.key]),
        );

        // Update images with their keys
        setImages((prev) =>
          prev.map((img) => {
            const key = uriToKey.get(img.uri);
            return key ? { ...img, key } : img;
          }),
        );
      } catch {
        // Remove from display if upload fails
        setImages((prev) => prev.filter((img) => !newUris.includes(img.uri)));
      }
    }
  }, [uploadImages]);

  const removeImage = useCallback((idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const saveRecipeMutation = useMutation({
    ...trpc.recipe.postRecipe.mutationOptions(),
    onSuccess: ({ id }) => {
      navigation.navigate("RecipeDetail", { recipeId: id });
    },
  });

  const handlePreviewParsing = async () => {
    // Flatten all ingredients from all sections
    const validIngredients = ingredientSections
      .flatMap((section) => section.items)
      .filter((ing) => ing.trim());

    if (validIngredients.length === 0) {
      Alert.alert("Error", "Please add at least one ingredient first");
      return;
    }

    try {
      const parsed = await queryClient.fetchQuery(
        trpc.recipe.parseIngredients.queryOptions({
          ingredients: validIngredients,
        }),
      );

      if (parsed) {
        setParsedIngredients(parsed);
        setShowParsePreview(true);
      } else {
        Alert.alert(
          "Error",
          "Parsing service unavailable. Please try again later.",
        );
      }
    } catch (error) {
      Alert.alert("Error", "Failed to parse ingredients. Please try again.");
    }
  };

  const onSave = () => {
    // Validate required fields
    if (!title.trim()) {
      Alert.alert("Error", "Please enter a recipe title");
      return;
    }

    // Flatten ingredients with section info
    const allIngredients = ingredientSections.flatMap((section) =>
      section.items.filter((ing) => ing.trim()),
    );
    if (allIngredients.length === 0) {
      Alert.alert("Error", "Please add at least one ingredient");
      return;
    }

    // Flatten method steps with section info
    const allSteps = methodSections.flatMap((section) =>
      section.items.filter((step) => step.text.trim()),
    );
    if (allSteps.length === 0) {
      Alert.alert("Error", "Please add at least one cooking step");
      return;
    }

    if (images.length === 0) {
      Alert.alert("Error", "Please add at least one image");
      return;
    }

    // Check if images are still uploading
    if (isUploadingImages) {
      Alert.alert("Please wait", "Images are still uploading...");
      return;
    }

    // Separate images into new uploads (with keys) and existing URLs (prefill without keys)
    const newUploadKeys = images
      .filter((img) => img.key)
      .map((img) => img.key!);
    const existingImageUrls = images
      .filter((img) => !img.key && img.uri.startsWith("http"))
      .map((img) => img.uri);

    // Check if we have any valid images
    if (newUploadKeys.length === 0 && existingImageUrls.length === 0) {
      Alert.alert("Error", "Please wait for images to finish uploading");
      return;
    }

    // Build nested ingredient sections
    const ingredientSectionsData = ingredientSections
      .map((section) => ({
        name: section.name,
        ingredients: section.items
          .filter((ing) => ing.trim())
          .map((ing, index) => ({
            index,
            ingredient: ing.trim(),
          })),
      }))
      .filter((section) => section.ingredients.length > 0);

    // Build nested instruction sections
    const instructionSectionsData = methodSections
      .map((section) => ({
        name: section.name,
        instructions: section.items
          .filter((step) => step.text.trim())
          .map((step, index) => ({
            index,
            instruction: step.text.trim(),
            imageUrl: step.imageUrl || null,
          })),
      }))
      .filter((section) => section.instructions.length > 0);

    // Prepare recipe data
    const recipeData = {
      name: title.trim(),
      description: description.trim() || undefined,
      prepTime: prepTime ?? undefined,
      cookTime: cookTime ?? undefined,
      servings,
      ingredientSections: ingredientSectionsData,
      instructionSections: instructionSectionsData,
      // Include new upload keys if any
      ...(newUploadKeys.length > 0 && { imageUploadIds: newUploadKeys }),
      // Include existing image URLs if any
      ...(existingImageUrls.length > 0 && {
        images: existingImageUrls.map((url) => ({ url })),
      }),
      // Include source URL if present (from URL parsing)
      ...(prefill?.sourceUrl && { sourceUrl: prefill.sourceUrl }),
      // Include source type from metadata (url, text, image) or default to manual
      sourceType: (sourceType ?? "manual") as
        | "url"
        | "text"
        | "image"
        | "manual"
        | "ai"
        | "user",
      // Use author from form for all recipes
      author: author.trim() || undefined,
    };

    saveRecipeMutation.mutate(recipeData);
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <SafeAreaView>
          <View style={styles.padded}>
            <VSpace size={16} />
            <View style={styles.header}>
              <BackButton color="black" />
              <Text type="title2">Add your recipe</Text>
              <View style={styles.headerSpacer} />
            </View>
          </View>
          <VSpace size={32} />
          {images.length > 0 ? (
            <>
              <View style={styles.padded}>
                <View style={styles.imageHeader}>
                  <Text type="body" style={styles.photoCount}>
                    {images.length} photo{images.length !== 1 ? "s" : ""}
                  </Text>
                </View>
              </View>
              <FlatList
                horizontal
                data={images}
                keyExtractor={(item, index) => item.uri + index}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.imageList}
                renderItem={({ item, index }) => {
                  const progress = uploadProgress[item.uri];
                  const isUploading =
                    progress !== undefined && progress >= 0 && progress < 100;
                  const uploadFailed = progress === -1;

                  return (
                    <View style={styles.imageContainer}>
                      <Image source={{ uri: item.uri }} style={styles.image} />
                      {isUploading && (
                        <View style={styles.uploadOverlay}>
                          <ActivityIndicator color="white" size="large" />
                        </View>
                      )}
                      {uploadFailed && (
                        <View
                          style={[styles.uploadOverlay, styles.uploadFailed]}
                        >
                          <Text style={styles.uploadFailedText}>!</Text>
                        </View>
                      )}
                      <TouchableOpacity
                        style={styles.imageRemoveButton}
                        onPress={() => removeImage(index)}
                      >
                        <Text style={styles.removeButtonText}>×</Text>
                      </TouchableOpacity>
                    </View>
                  );
                }}
              />
              <View style={styles.padded}>
                <TouchableOpacity style={styles.addButton} onPress={pickImage}>
                  <Text type="highlight">+ Add another photo</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <TouchableOpacity
              style={styles.imagePlaceholder}
              onPress={pickImage}
            >
              <Text type="body" style={styles.placeholderText}>
                Tap to add photo
              </Text>
            </TouchableOpacity>
          )}
          <View style={styles.padded}>
            <VSpace size={16} />
            <Text type="heading">Recipe title</Text>
            <VSpace size={8} />
            <Input
              value={title}
              onChangeText={setTitle}
              placeholder="Sausage tray bake"
            />
            <VSpace size={20} />
            <Text type="heading">Author</Text>
            <VSpace size={8} />
            <Input
              value={author}
              onChangeText={setAuthor}
              placeholder="Your name"
            />
            <VSpace size={20} />
            <Text type="heading">Description</Text>
            <VSpace size={8} />
            <Input
              value={description}
              onChangeText={setDescription}
              placeholder="A quick and easy tray bake..."
              multiline
            />
            <VSpace size={12} />
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <TimePicker
                  label="Prep time"
                  value={prepTime}
                  onValueChange={setPrepTime}
                  placeholder="Tap to set prep time"
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <TimePicker
                  label="Cook time"
                  value={cookTime}
                  onValueChange={setCookTime}
                  placeholder="Tap to set cook time"
                />
              </View>
            </View>
            <VSpace size={12} />
            <View style={styles.row}>
              <Text type="heading" style={{ marginRight: 8 }}>
                Servings
              </Text>
              <TouchableOpacity
                onPress={() => setServings(Math.max(1, servings - 1))}
                style={styles.servingButton}
              >
                <Text type="heading">-</Text>
              </TouchableOpacity>
              <Text style={{ marginHorizontal: 8 }}>{servings}</Text>
              <TouchableOpacity
                onPress={() => setServings(servings + 1)}
                style={styles.servingButton}
              >
                <Text type="heading">+</Text>
              </TouchableOpacity>
            </View>
            <VSpace size={20} />
            {/* Ingredients */}
            <Text type="heading">Ingredients</Text>
            <VSpace size={8} />
            {ingredientSections.map((section, sectionIdx) => (
              <View key={sectionIdx} style={styles.sectionContainer}>
                {/* Section header - only show for named sections */}
                {section.name !== null && (
                  <View style={styles.sectionHeaderRow}>
                    <Input
                      value={section.name}
                      onChangeText={(name) =>
                        updateIngredientSectionName(sectionIdx, name)
                      }
                      placeholder="Section name (e.g., For the Sauce)"
                      style={styles.sectionNameInput}
                    />
                    <TouchableOpacity
                      onPress={() => removeIngredientSection(sectionIdx)}
                      style={styles.removeSectionButton}
                    >
                      <Text type="heading" style={styles.removeStepText}>
                        ×
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Ingredients in this section */}
                {section.items.map((ing, itemIdx) => (
                  <View key={itemIdx} style={styles.ingredientRow}>
                    <Input
                      value={ing}
                      onChangeText={(v) =>
                        updateIngredient(sectionIdx, itemIdx, v)
                      }
                      placeholder="e.g. 2 Carrots"
                      style={{ flex: 1 }}
                      multiline
                    />
                    {section.items.length > 1 && (
                      <TouchableOpacity
                        onPress={() => removeIngredient(sectionIdx, itemIdx)}
                        style={styles.removeButton}
                      >
                        <Text type="heading">×</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                <TouchableOpacity
                  onPress={() => addIngredient(sectionIdx)}
                  style={styles.addButton}
                >
                  <Text type="highlight">+ Add ingredient</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              onPress={addIngredientSection}
              style={styles.addSectionButton}
            >
              <Text type="body" style={styles.addSectionText}>
                + Add section
              </Text>
            </TouchableOpacity>
            {ingredientSections.some((s) =>
              s.items.some((ing) => ing.trim()),
            ) && (
              <TouchableOpacity
                onPress={handlePreviewParsing}
                style={styles.previewButton}
              >
                <Text type="body" style={styles.previewButtonText}>
                  Preview how ingredients will be parsed
                </Text>
              </TouchableOpacity>
            )}
            <VSpace size={20} />
            {/* Method */}
            <Text type="heading">Method</Text>
            <VSpace size={8} />
            {(() => {
              let globalStepIndex = 0;
              return methodSections.map((section, sectionIdx) => (
                <View key={sectionIdx} style={styles.sectionContainer}>
                  {/* Section header - only show for named sections */}
                  {section.name !== null && (
                    <View style={styles.sectionHeaderRow}>
                      <Input
                        value={section.name}
                        onChangeText={(name) =>
                          updateMethodSectionName(sectionIdx, name)
                        }
                        placeholder="Section name (e.g., Make the Sauce)"
                        style={styles.sectionNameInput}
                      />
                      <TouchableOpacity
                        onPress={() => removeMethodSection(sectionIdx)}
                        style={styles.removeSectionButton}
                      >
                        <Text type="heading" style={styles.removeStepText}>
                          ×
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Steps in this section */}
                  {section.items.map((step, itemIdx) => {
                    globalStepIndex++;
                    return (
                      <View key={itemIdx} style={styles.methodStep}>
                        <View style={styles.methodStepHeader}>
                          <Text type="bodyFaded">Step {globalStepIndex}</Text>
                          {section.items.length > 1 && (
                            <TouchableOpacity
                              onPress={() => removeMethod(sectionIdx, itemIdx)}
                            >
                              <Text
                                type="heading"
                                style={styles.removeStepText}
                              >
                                ×
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                        <VSpace size={8} />
                        <Input
                          value={step.text}
                          onChangeText={(v) =>
                            updateMethod(sectionIdx, itemIdx, v)
                          }
                          placeholder="Describe this step..."
                          multiline
                        />
                        <VSpace size={8} />
                        {step.imageUrl ? (
                          <View style={styles.stepImageContainer}>
                            <Image
                              source={{ uri: step.imageUrl }}
                              style={styles.stepImagePreview}
                            />
                            <TouchableOpacity
                              style={styles.removeStepImageButton}
                              onPress={() =>
                                removeStepImage(sectionIdx, itemIdx)
                              }
                            >
                              <Text style={styles.removeButtonText}>×</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={styles.addStepImageButton}
                            onPress={() => pickStepImage(sectionIdx, itemIdx)}
                          >
                            <Text type="body" style={styles.addStepImageText}>
                              + Add step image (optional)
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                  <TouchableOpacity
                    onPress={() => addMethod(sectionIdx)}
                    style={styles.addButton}
                  >
                    <Text type="highlight">+ Add step</Text>
                  </TouchableOpacity>
                </View>
              ));
            })()}
            <TouchableOpacity
              onPress={addMethodSection}
              style={styles.addSectionButton}
            >
              <Text type="body" style={styles.addSectionText}>
                + Add section
              </Text>
            </TouchableOpacity>
            <VSpace size={32} />
            <PrimaryButton
              onPress={onSave}
              disabled={saveRecipeMutation.isPending || isUploadingImages}
            >
              {isUploadingImages
                ? "Uploading images..."
                : saveRecipeMutation.isPending
                  ? "Saving..."
                  : "Save recipe"}
            </PrimaryButton>
            <VSpace size={32} />
          </View>
        </SafeAreaView>
      </ScrollView>

      {/* Ingredient Parsing Preview Modal */}
      <Modal
        visible={showParsePreview}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowParsePreview(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text type="title2">Parsed Ingredients</Text>
            <TouchableOpacity onPress={() => setShowParsePreview(false)}>
              <Text type="heading">Done</Text>
            </TouchableOpacity>
          </View>
          <VSpace size={16} />
          <Text type="body" style={styles.modalDescription}>
            Here's how your ingredients will be stored. Check that quantities
            and units are parsed correctly:
          </Text>
          <VSpace size={16} />
          <ScrollView style={styles.modalScroll}>
            {parsedIngredients.map((parsed, idx) => (
              <View key={idx} style={styles.parsedItem}>
                <View style={styles.parsedItemHeader}>
                  <Text type="body" style={styles.originalText}>
                    Original: "{parsed.originalText}"
                  </Text>
                  <View
                    style={[
                      styles.confidenceBadge,
                      parsed.confidence === "high" && styles.confidenceHigh,
                      parsed.confidence === "medium" && styles.confidenceMedium,
                      parsed.confidence === "low" && styles.confidenceLow,
                    ]}
                  >
                    <Text style={styles.confidenceText}>
                      {parsed.confidence}
                    </Text>
                  </View>
                </View>
                <VSpace size={8} />
                <View style={styles.parsedFields}>
                  <View style={styles.parsedField}>
                    <Text type="bodyFaded">Quantity:</Text>
                    <Text type="body">{parsed.quantity ?? "none"}</Text>
                  </View>
                  <View style={styles.parsedField}>
                    <Text type="bodyFaded">Unit:</Text>
                    <Text type="body">{parsed.unit || "none"}</Text>
                  </View>
                  <View style={styles.parsedField}>
                    <Text type="bodyFaded">Ingredient:</Text>
                    <Text type="body">{parsed.name}</Text>
                  </View>
                </View>
              </View>
            ))}
            <VSpace size={80} />
          </ScrollView>
          <View style={styles.modalFooter}>
            <Text type="bodyFaded" style={styles.modalFooterText}>
              If parsing looks incorrect, edit your ingredient text and preview
              again. The recipe will be saved with these parsed values.
            </Text>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: "#fff",
  },
  padded: {
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerSpacer: {
    width: 24, // Same width as back button for centering
  },
  imageSection: {
    paddingBottom: 12,
  },
  imageHeader: {
    paddingBottom: 4,
  },
  photoCount: {
    color: "#666",
    fontSize: 14,
  },
  imageList: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  imageContainer: {
    marginRight: 12,
    position: "relative",
  },
  image: {
    width: 180,
    height: 180,
    borderRadius: 12,
    backgroundColor: "#eee",
  },
  uploadOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadFailed: {
    backgroundColor: "rgba(255, 68, 68, 0.7)",
  },
  uploadFailedText: {
    color: "white",
    fontSize: 32,
    fontWeight: "bold",
  },
  imageRemoveButton: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#ff4444",
    alignItems: "center",
    justifyContent: "center",
  },
  removeButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    lineHeight: 20,
  },
  imagePlaceholder: {
    width: "100%",
    height: 220,
    backgroundColor: "#eee",
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    color: "#666",
  },
  scrollContent: {
    paddingBottom: 40,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  servingButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  ingredientRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  removeButton: {
    marginLeft: 8,
    padding: 4,
  },
  addButton: {
    marginTop: 4,
    marginBottom: 8,
  },
  sectionContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionNameInput: {
    flex: 1,
    fontWeight: "600",
  },
  removeSectionButton: {
    marginLeft: 8,
    padding: 4,
  },
  addSectionButton: {
    marginTop: 8,
    marginBottom: 8,
    padding: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: theme.colors.border,
    borderRadius: 8,
    alignItems: "center",
  },
  addSectionText: {
    color: "#666",
  },
  previewButton: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: theme.colors.border + "30",
    alignItems: "center",
  },
  previewButtonText: {
    color: theme.colors.text,
    fontSize: 14,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalDescription: {
    color: "#666",
    lineHeight: 20,
  },
  modalScroll: {
    flex: 1,
  },
  parsedItem: {
    padding: 16,
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  parsedItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  originalText: {
    flex: 1,
    fontStyle: "italic",
    color: "#666",
    fontSize: 13,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  confidenceHigh: {
    backgroundColor: "#4CAF50",
  },
  confidenceMedium: {
    backgroundColor: "#FF9800",
  },
  confidenceLow: {
    backgroundColor: "#F44336",
  },
  confidenceText: {
    color: "white",
    fontSize: 11,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  parsedFields: {
    gap: 6,
  },
  parsedField: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  modalFooter: {
    padding: 16,
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    marginTop: 8,
  },
  modalFooterText: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  methodStep: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  methodStepHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  removeStepText: {
    color: "#ff4444",
    fontSize: 20,
  },
  stepImageContainer: {
    width: 150,
    height: 100,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  stepImagePreview: {
    width: "100%",
    height: "100%",
    backgroundColor: "#eee",
  },
  removeStepImageButton: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#ff4444",
    alignItems: "center",
    justifyContent: "center",
  },
  addStepImageButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: theme.colors.border,
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  addStepImageText: {
    color: "#666",
    fontSize: 14,
  },
}));
