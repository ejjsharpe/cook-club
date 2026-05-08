import { Ionicons } from "@expo/vector-icons";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  useLayoutEffect,
} from "react";
import {
  View,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Modal,
  Alert,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
  TextInput,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  useAnimatedRef,
  useAnimatedScrollHandler,
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";

import { useCreateCookingReview } from "@/api/activity";
import {
  useRecipeDetail,
  useImportRecipe,
  useDeleteRecipe,
  useSaveRecipe,
  useUpdateRecipe,
  type ParsedRecipe,
  type Recipe,
} from "@/api/recipe";
import { useUser } from "@/api/user";
import {
  AdjustRecipeSheet,
  type AdjustRecipeSheetRef,
} from "@/components/AdjustRecipeSheet";
import {
  CollectionSelectorSheet,
  type CollectionSelectorSheetRef,
} from "@/components/CollectionSelectorSheet";
import {
  CookingReviewSheet,
  type CookingReviewSheetRef,
} from "@/components/CookingReviewSheet";
import { PageIndicator } from "@/components/PageIndicator";
import {
  ShoppingListSelectorSheet,
  type ShoppingListSelectorSheetRef,
} from "@/components/ShoppingListSelectorSheet";
import { Skeleton } from "@/components/Skeleton";
import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import {
  AddToMealPlanSheet,
  type AddToMealPlanSheetRef,
} from "@/components/mealPlan/AddToMealPlanSheet";
import { useImageUpload } from "@/hooks/useImageUpload";
import type { MeasurementSystem } from "@/lib/measurementPreferences";
import { getImageUrl } from "@/utils/imageUrl";
import {
  isCompactUnit,
  formatUnit,
  convertParsedIngredient,
} from "@/utils/measurementUtils";
import { transformParsedRecipeForPreview } from "@/utils/recipeTransform";
import { formatMinutesShort } from "@/utils/timeUtils";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const IMAGE_HEIGHT = SCREEN_WIDTH;

type RecipeDetailMode = "view" | "edit";

type RecipeDetailScreenParams = {
  RecipeDetail:
    | { recipeId: number; mode?: RecipeDetailMode }
    | { parsedRecipe: ParsedRecipe; mode?: RecipeDetailMode }
    | { draft: true; mode: "edit" };
};

type SourceType = "url" | "image" | "text" | "ai" | "manual" | "user";

type RecipeLike =
  | Recipe
  | NonNullable<ReturnType<typeof transformParsedRecipeForPreview>>;

interface RecipeImage {
  id: number;
  url: string;
}

interface DraftImage {
  id: string;
  uri: string;
  isRemote: boolean;
  uploadKey?: string;
}

interface DraftIngredient {
  id: string;
  text: string;
}

interface DraftIngredientSection {
  id: string;
  name: string;
  ingredients: DraftIngredient[];
}

interface DraftInstruction {
  id: string;
  instruction: string;
  imageUrl: string | null;
}

interface DraftInstructionSection {
  id: string;
  name: string;
  instructions: DraftInstruction[];
}

interface RecipeDraft {
  name: string;
  description: string;
  prepTime: number | null;
  cookTime: number | null;
  totalTime: number | null;
  servings: number;
  sourceUrl?: string;
  sourceType: SourceType;
  images: DraftImage[];
  ingredientSections: DraftIngredientSection[];
  instructionSections: DraftInstructionSection[];
}

function isPreviewParams(
  params: RecipeDetailScreenParams["RecipeDetail"],
): params is { parsedRecipe: ParsedRecipe; mode?: RecipeDetailMode } {
  return "parsedRecipe" in params;
}

function isBlankDraftParams(
  params: RecipeDetailScreenParams["RecipeDetail"],
): params is { draft: true; mode: "edit" } {
  return "draft" in params;
}

function createDraftId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function ingredientToText(ingredient: {
  quantity?: string | number | null;
  unit?: string | null;
  name?: string | null;
  preparation?: string | null;
}) {
  const text = [ingredient.quantity, ingredient.unit, ingredient.name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return ingredient.preparation ? `${text}, ${ingredient.preparation}` : text;
}

function draftFromRecipe(recipe: RecipeLike): RecipeDraft {
  return {
    name: recipe.name ?? "",
    description: recipe.description ?? "",
    prepTime: recipe.prepTime ?? null,
    cookTime: recipe.cookTime ?? null,
    totalTime: recipe.totalTime ?? null,
    servings: recipe.servings ?? 4,
    sourceUrl: recipe.sourceUrl ?? undefined,
    sourceType: (recipe.sourceType ?? "manual") as SourceType,
    images: (recipe.images ?? []).map((image, index) => ({
      id: `remote-${image.id ?? index}`,
      uri: image.url,
      isRemote: true,
    })),
    ingredientSections:
      recipe.ingredientSections.length > 0
        ? recipe.ingredientSections.map((section, sectionIndex) => ({
            id: `ingredient-section-${section.id ?? sectionIndex}`,
            name: section.name ?? "",
            ingredients:
              section.ingredients.length > 0
                ? section.ingredients.map((ingredient, ingredientIndex) => ({
                    id: `ingredient-${ingredient.id ?? `${sectionIndex}-${ingredientIndex}`}`,
                    text: ingredientToText(ingredient),
                  }))
                : [{ id: createDraftId("ingredient"), text: "" }],
          }))
        : [
            {
              id: createDraftId("ingredient-section"),
              name: "",
              ingredients: [{ id: createDraftId("ingredient"), text: "" }],
            },
          ],
    instructionSections:
      recipe.instructionSections.length > 0
        ? recipe.instructionSections.map((section, sectionIndex) => ({
            id: `instruction-section-${section.id ?? sectionIndex}`,
            name: section.name ?? "",
            instructions:
              section.instructions.length > 0
                ? section.instructions.map((instruction, instructionIndex) => ({
                    id: `instruction-${instruction.id ?? `${sectionIndex}-${instructionIndex}`}`,
                    instruction: instruction.instruction,
                    imageUrl: instruction.imageUrl ?? null,
                  }))
                : [
                    {
                      id: createDraftId("instruction"),
                      instruction: "",
                      imageUrl: null,
                    },
                  ],
          }))
        : [
            {
              id: createDraftId("instruction-section"),
              name: "",
              instructions: [
                {
                  id: createDraftId("instruction"),
                  instruction: "",
                  imageUrl: null,
                },
              ],
            },
          ],
  };
}

function draftFromParsedRecipe(parsedRecipe: ParsedRecipe): RecipeDraft | null {
  const previewRecipe = transformParsedRecipeForPreview(parsedRecipe);
  return previewRecipe ? draftFromRecipe(previewRecipe) : null;
}

function createBlankDraft(): RecipeDraft {
  return {
    name: "",
    description: "",
    prepTime: null,
    cookTime: null,
    totalTime: null,
    servings: 4,
    sourceType: "manual",
    images: [],
    ingredientSections: [
      {
        id: createDraftId("ingredient-section"),
        name: "",
        ingredients: [{ id: createDraftId("ingredient"), text: "" }],
      },
    ],
    instructionSections: [
      {
        id: createDraftId("instruction-section"),
        name: "",
        instructions: [
          {
            id: createDraftId("instruction"),
            instruction: "",
            imageUrl: null,
          },
        ],
      },
    ],
  };
}

function getDraftErrors(draft: RecipeDraft) {
  const errors: string[] = [];

  if (!draft.name.trim()) {
    errors.push("Recipe title is required.");
  }

  if (draft.images.length === 0) {
    errors.push("Add at least one recipe photo.");
  }

  const hasIngredients = draft.ingredientSections.some((section) =>
    section.ingredients.some((ingredient) => ingredient.text.trim()),
  );
  if (!hasIngredients) {
    errors.push("Add at least one ingredient.");
  }

  const hasInstructions = draft.instructionSections.some((section) =>
    section.instructions.some((instruction) => instruction.instruction.trim()),
  );
  if (!hasInstructions) {
    errors.push("Add at least one method step.");
  }

  if (draft.servings < 1) {
    errors.push("Servings must be at least 1.");
  }

  return errors;
}

function draftToMutationInput(draft: RecipeDraft) {
  const remoteImages = draft.images
    .filter((image) => image.isRemote)
    .map((image) => ({ url: image.uri }));
  const imageUploadIds = draft.images
    .filter((image) => !image.isRemote && image.uploadKey)
    .map((image) => image.uploadKey!);

  return {
    name: draft.name.trim(),
    description: draft.description.trim() || undefined,
    prepTime: draft.prepTime ?? undefined,
    cookTime: draft.cookTime ?? undefined,
    totalTime: draft.totalTime ?? undefined,
    servings: Math.max(1, draft.servings),
    ingredientSections: draft.ingredientSections
      .map((section) => ({
        name: section.name.trim() || null,
        ingredients: section.ingredients
          .filter((ingredient) => ingredient.text.trim())
          .map((ingredient, index) => ({
            index,
            ingredient: ingredient.text.trim(),
          })),
      }))
      .filter((section) => section.ingredients.length > 0),
    instructionSections: draft.instructionSections
      .map((section) => ({
        name: section.name.trim() || null,
        instructions: section.instructions
          .filter((instruction) => instruction.instruction.trim())
          .map((instruction, index) => ({
            index,
            instruction: instruction.instruction.trim(),
            imageUrl: instruction.imageUrl,
          })),
      }))
      .filter((section) => section.instructions.length > 0),
    ...(remoteImages.length > 0 && { images: remoteImages }),
    ...(imageUploadIds.length > 0 && { imageUploadIds }),
    ...(draft.sourceUrl && { sourceUrl: draft.sourceUrl }),
    sourceType: draft.sourceType,
  };
}

export const RecipeDetailScreen = () => {
  const route = useRoute<RecipeDetailScreenParams>("RecipeDetail");
  const navigation = useNavigation("RecipeDetail");
  const insets = useSafeAreaInsets();
  const params = route.params;

  const isPreviewMode = isPreviewParams(params);
  const isBlankDraftMode = isBlankDraftParams(params);
  const parsedRecipe = isPreviewMode ? params.parsedRecipe : null;
  const recipeId = "recipeId" in params ? params.recipeId : null;
  const shouldStartEditing =
    params.mode === "edit" || isBlankDraftMode || isPreviewMode;
  const isCreateMode = isPreviewMode || isBlankDraftMode;

  const {
    data: fetchedRecipe,
    isPending,
    error,
  } = useRecipeDetail({ recipeId });

  const previewRecipe = useMemo(() => {
    if (isPreviewMode && parsedRecipe) {
      return transformParsedRecipeForPreview(parsedRecipe);
    }
    return null;
  }, [isPreviewMode, parsedRecipe]);

  const recipe = isPreviewMode ? previewRecipe : fetchedRecipe;

  const { data: userData } = useUser();

  const saveRecipeMutation = useSaveRecipe();
  const updateRecipeMutation = useUpdateRecipe();
  const importMutation = useImportRecipe();
  const deleteMutation = useDeleteRecipe();
  const createCookingReviewMutation = useCreateCookingReview();

  const [servings, setServings] = useState(1);
  const [measurementSystem, setMeasurementSystem] = useState<MeasurementSystem>(
    (userData?.user?.measurementPreference as MeasurementSystem) ?? "auto",
  );
  const [isEditing, setIsEditing] = useState(shouldStartEditing);
  const [draft, setDraft] = useState<RecipeDraft | null>(() => {
    if (isBlankDraftMode) return createBlankDraft();
    if (parsedRecipe) return draftFromParsedRecipe(parsedRecipe);
    return null;
  });
  const initialDraftRef = useRef<RecipeDraft | null>(draft);
  const draftSourceRef = useRef<string | null>(null);
  const hasInitializedServings = useRef(false);
  const adjustRecipeSheetRef = useRef<AdjustRecipeSheetRef>(null);
  const addToMealPlanSheetRef = useRef<AddToMealPlanSheetRef>(null);
  const shoppingListSheetRef = useRef<ShoppingListSelectorSheetRef>(null);
  const collectionSheetRef = useRef<CollectionSelectorSheetRef>(null);
  const cookingReviewSheetRef = useRef<CookingReviewSheetRef>(null);
  const [shoppingListIngredients, setShoppingListIngredients] = useState<
    {
      id: number;
      quantity: string | null;
      unit: string | null;
      name: string;
      preparation?: string | null;
    }[]
  >([]);
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [ratingOverride, setRatingOverride] = useState<number | null>(null);

  const {
    uploadImages,
    isUploading: isUploadingImages,
    uploadProgress,
  } = useImageUpload({
    onError: (uploadError) => {
      Alert.alert("Upload Error", uploadError.message);
    },
  });

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const imageAnimatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(scrollY.value, [-200, 0], [2, 1], {
      extrapolateLeft: Extrapolation.EXTEND,
      extrapolateRight: Extrapolation.CLAMP,
    });
    const scaleCompensation = -(IMAGE_HEIGHT * (scale - 1)) / 2;
    const parallax = scrollY.value > 0 ? scrollY.value / 2 : 0;

    return {
      transform: [{ translateY: scaleCompensation + parallax }, { scale }],
    };
  });

  const sourceKey = isBlankDraftMode
    ? `blank-${route.key}`
    : isPreviewMode
      ? `parsed-${route.key}`
      : recipeId
        ? `recipe-${recipeId}`
        : null;

  useEffect(() => {
    setIsEditing(shouldStartEditing);
  }, [shouldStartEditing, sourceKey]);

  useEffect(() => {
    if (!sourceKey || draftSourceRef.current === sourceKey) return;

    let nextDraft: RecipeDraft | null = null;
    if (isBlankDraftMode) {
      nextDraft = createBlankDraft();
    } else if (parsedRecipe) {
      nextDraft = draftFromParsedRecipe(parsedRecipe);
    } else if (fetchedRecipe) {
      nextDraft = draftFromRecipe(fetchedRecipe);
    }

    if (!nextDraft) return;

    setDraft(nextDraft);
    initialDraftRef.current = nextDraft;
    draftSourceRef.current = sourceKey;
    setCurrentImageIndex(0);
  }, [fetchedRecipe, isBlankDraftMode, parsedRecipe, sourceKey]);

  useEffect(() => {
    if (recipe?.servings && !hasInitializedServings.current) {
      setServings(recipe.servings);
      hasInitializedServings.current = true;
    }
  }, [recipe?.servings]);

  useEffect(() => {
    setRatingOverride(null);
    hasInitializedServings.current = false;
  }, [recipeId]);

  useEffect(() => {
    const imageCount = isEditing
      ? (draft?.images.length ?? 0)
      : (recipe?.images.length ?? 0);
    if (imageCount > 0 && currentImageIndex > imageCount - 1) {
      setCurrentImageIndex(imageCount - 1);
    }
  }, [
    currentImageIndex,
    draft?.images.length,
    isEditing,
    recipe?.images.length,
  ]);

  const isOwnRecipe = recipe?.owner.id === userData?.user?.id;
  const displayedRating = ratingOverride ?? recipe?.userReviewRating ?? null;
  const servingMultiplier = recipe?.servings ? servings / recipe.servings : 1;
  const isSaving =
    saveRecipeMutation.isPending ||
    updateRecipeMutation.isPending ||
    isUploadingImages;

  const updateDraft = useCallback(
    (updater: (current: RecipeDraft) => RecipeDraft) => {
      setDraft((current) => (current ? updater(current) : current));
    },
    [],
  );

  const handleEnterEditMode = useCallback(() => {
    if (!recipe) return;
    const nextDraft = draftFromRecipe(recipe);
    setDraft(nextDraft);
    initialDraftRef.current = nextDraft;
    setIsEditing(true);
  }, [recipe]);

  const handleImageScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const newIndex = Math.round(offsetX / SCREEN_WIDTH);
      if (newIndex !== currentImageIndex) {
        setCurrentImageIndex(newIndex);
      }
    },
    [currentImageIndex],
  );

  const handleOpenAdjustSheet = () => {
    if (isEditing) return;
    adjustRecipeSheetRef.current?.present();
  };

  const handleOpenMealPlanSheet = () => {
    addToMealPlanSheetRef.current?.present();
  };

  const handleOpenShoppingListSheet = () => {
    if (!recipe) return;

    const allIngredients = recipe.ingredientSections.flatMap((section) =>
      section.ingredients.map((ing) => ({
        id: ing.id,
        quantity: ing.quantity
          ? (parseFloat(ing.quantity) * servingMultiplier).toString()
          : null,
        unit: ing.unit,
        name: ing.name,
        preparation: ing.preparation,
      })),
    );

    setShoppingListIngredients(allIngredients);
    shoppingListSheetRef.current?.present();
  };

  const handleOpenReviewSheet = () => {
    if (!recipe || !isOwnRecipe || isPreviewMode || isEditing) return;
    cookingReviewSheetRef.current?.present();
  };

  const handleStartCookMode = () => {
    if (!recipe) return;

    navigation.navigate("CookMode", {
      recipeName: recipe.name,
      ingredientSections: recipe.ingredientSections,
      instructionSections: recipe.instructionSections,
    });
  };

  const handleSubmitReview = async (data: {
    rating: number;
    reviewText?: string;
    imageUrls?: string[];
  }) => {
    if (!recipe) return;

    await createCookingReviewMutation.mutateAsync({
      recipeId: recipe.id,
      rating: data.rating,
      reviewText: data.reviewText,
      imageUrls: data.imageUrls,
    });
    setRatingOverride(data.rating);
  };

  const handleImportRecipe = async () => {
    if (!recipe) return;

    try {
      const newRecipe = await importMutation.mutateAsync({
        recipeId: recipe.id,
      });
      navigation.replace("RecipeDetail", { recipeId: newRecipe.id });
    } catch (err: any) {
      const message =
        err?.message || "Something went wrong while importing the recipe.";
      Alert.alert("Import Failed", message);
    }
  };

  const handlePickRecipeImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.85,
    });

    const pickedAsset = result.assets?.[0];
    if (result.canceled || !pickedAsset) return;

    const imageId = createDraftId("image");
    setDraft((current) =>
      current
        ? {
            ...current,
            images: [
              ...current.images,
              { id: imageId, uri: pickedAsset.uri, isRemote: false },
            ],
          }
        : current,
    );

    try {
      const [uploadResult] = await uploadImages([pickedAsset.uri]);
      if (!uploadResult) return;

      setDraft((current) =>
        current
          ? {
              ...current,
              images: current.images.map((image) =>
                image.id === imageId
                  ? { ...image, uploadKey: uploadResult.key }
                  : image,
              ),
            }
          : current,
      );
    } catch {
      setDraft((current) =>
        current
          ? {
              ...current,
              images: current.images.filter((image) => image.id !== imageId),
            }
          : current,
      );
    }
  }, [uploadImages]);

  const handleRemoveCurrentImage = useCallback(() => {
    updateDraft((current) => {
      const nextImages = current.images.filter(
        (_, index) => index !== currentImageIndex,
      );
      return { ...current, images: nextImages };
    });
    setCurrentImageIndex((index) => Math.max(0, index - 1));
  }, [currentImageIndex, updateDraft]);

  const addIngredient = useCallback(
    (sectionId: string) => {
      updateDraft((current) => ({
        ...current,
        ingredientSections: current.ingredientSections.map((section) =>
          section.id === sectionId
            ? {
                ...section,
                ingredients: [
                  ...section.ingredients,
                  { id: createDraftId("ingredient"), text: "" },
                ],
              }
            : section,
        ),
      }));
    },
    [updateDraft],
  );

  const updateIngredient = useCallback(
    (sectionId: string, ingredientId: string, text: string) => {
      updateDraft((current) => ({
        ...current,
        ingredientSections: current.ingredientSections.map((section) =>
          section.id === sectionId
            ? {
                ...section,
                ingredients: section.ingredients.map((ingredient) =>
                  ingredient.id === ingredientId
                    ? { ...ingredient, text }
                    : ingredient,
                ),
              }
            : section,
        ),
      }));
    },
    [updateDraft],
  );

  const removeIngredient = useCallback(
    (sectionId: string, ingredientId: string) => {
      updateDraft((current) => ({
        ...current,
        ingredientSections: current.ingredientSections.map((section) =>
          section.id === sectionId
            ? {
                ...section,
                ingredients:
                  section.ingredients.length > 1
                    ? section.ingredients.filter(
                        (ingredient) => ingredient.id !== ingredientId,
                      )
                    : [{ ...section.ingredients[0]!, text: "" }],
              }
            : section,
        ),
      }));
    },
    [updateDraft],
  );

  const addIngredientSection = useCallback(() => {
    updateDraft((current) => ({
      ...current,
      ingredientSections: [
        ...current.ingredientSections,
        {
          id: createDraftId("ingredient-section"),
          name: "",
          ingredients: [{ id: createDraftId("ingredient"), text: "" }],
        },
      ],
    }));
  }, [updateDraft]);

  const updateIngredientSectionName = useCallback(
    (sectionId: string, name: string) => {
      updateDraft((current) => ({
        ...current,
        ingredientSections: current.ingredientSections.map((section) =>
          section.id === sectionId ? { ...section, name } : section,
        ),
      }));
    },
    [updateDraft],
  );

  const removeIngredientSection = useCallback(
    (sectionId: string) => {
      updateDraft((current) => {
        const nextSections = current.ingredientSections.filter(
          (section) => section.id !== sectionId,
        );
        return {
          ...current,
          ingredientSections:
            nextSections.length > 0
              ? nextSections
              : [
                  {
                    id: createDraftId("ingredient-section"),
                    name: "",
                    ingredients: [
                      { id: createDraftId("ingredient"), text: "" },
                    ],
                  },
                ],
        };
      });
    },
    [updateDraft],
  );

  const addInstruction = useCallback(
    (sectionId: string) => {
      updateDraft((current) => ({
        ...current,
        instructionSections: current.instructionSections.map((section) =>
          section.id === sectionId
            ? {
                ...section,
                instructions: [
                  ...section.instructions,
                  {
                    id: createDraftId("instruction"),
                    instruction: "",
                    imageUrl: null,
                  },
                ],
              }
            : section,
        ),
      }));
    },
    [updateDraft],
  );

  const updateInstruction = useCallback(
    (sectionId: string, instructionId: string, instruction: string) => {
      updateDraft((current) => ({
        ...current,
        instructionSections: current.instructionSections.map((section) =>
          section.id === sectionId
            ? {
                ...section,
                instructions: section.instructions.map((item) =>
                  item.id === instructionId ? { ...item, instruction } : item,
                ),
              }
            : section,
        ),
      }));
    },
    [updateDraft],
  );

  const removeInstruction = useCallback(
    (sectionId: string, instructionId: string) => {
      updateDraft((current) => ({
        ...current,
        instructionSections: current.instructionSections.map((section) =>
          section.id === sectionId
            ? {
                ...section,
                instructions:
                  section.instructions.length > 1
                    ? section.instructions.filter(
                        (instruction) => instruction.id !== instructionId,
                      )
                    : [
                        {
                          ...section.instructions[0]!,
                          instruction: "",
                          imageUrl: null,
                        },
                      ],
              }
            : section,
        ),
      }));
    },
    [updateDraft],
  );

  const addInstructionSection = useCallback(() => {
    updateDraft((current) => ({
      ...current,
      instructionSections: [
        ...current.instructionSections,
        {
          id: createDraftId("instruction-section"),
          name: "",
          instructions: [
            {
              id: createDraftId("instruction"),
              instruction: "",
              imageUrl: null,
            },
          ],
        },
      ],
    }));
  }, [updateDraft]);

  const updateInstructionSectionName = useCallback(
    (sectionId: string, name: string) => {
      updateDraft((current) => ({
        ...current,
        instructionSections: current.instructionSections.map((section) =>
          section.id === sectionId ? { ...section, name } : section,
        ),
      }));
    },
    [updateDraft],
  );

  const removeInstructionSection = useCallback(
    (sectionId: string) => {
      updateDraft((current) => {
        const nextSections = current.instructionSections.filter(
          (section) => section.id !== sectionId,
        );
        return {
          ...current,
          instructionSections:
            nextSections.length > 0
              ? nextSections
              : [
                  {
                    id: createDraftId("instruction-section"),
                    name: "",
                    instructions: [
                      {
                        id: createDraftId("instruction"),
                        instruction: "",
                        imageUrl: null,
                      },
                    ],
                  },
                ],
        };
      });
    },
    [updateDraft],
  );

  const removeStepImage = useCallback(
    (sectionId: string, instructionId: string) => {
      updateDraft((current) => ({
        ...current,
        instructionSections: current.instructionSections.map((section) =>
          section.id === sectionId
            ? {
                ...section,
                instructions: section.instructions.map((instruction) =>
                  instruction.id === instructionId
                    ? { ...instruction, imageUrl: null }
                    : instruction,
                ),
              }
            : section,
        ),
      }));
    },
    [updateDraft],
  );

  const handleCancelEdit = useCallback(() => {
    const isDirty =
      JSON.stringify(draft) !== JSON.stringify(initialDraftRef.current);

    const cancel = () => {
      if (isCreateMode) {
        navigation.goBack();
        return;
      }

      if (initialDraftRef.current) {
        setDraft(initialDraftRef.current);
      }
      setIsEditing(false);
    };

    if (!isDirty) {
      cancel();
      return;
    }

    Alert.alert("Discard changes?", "Your recipe edits will be lost.", [
      { text: "Keep Editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: cancel },
    ]);
  }, [draft, isCreateMode, navigation]);

  const handleSaveDraft = useCallback(async () => {
    if (!draft) return;

    const errors = getDraftErrors(draft);
    if (errors.length > 0) {
      Alert.alert("Cannot Save Recipe", errors.join("\n"));
      return;
    }

    if (isUploadingImages) {
      Alert.alert("Please wait", "Recipe photos are still uploading.");
      return;
    }

    const pendingUploads = draft.images.filter(
      (image) => !image.isRemote && !image.uploadKey,
    );
    if (pendingUploads.length > 0) {
      Alert.alert("Upload Required", "Please remove or re-add failed photos.");
      return;
    }

    const recipeData = draftToMutationInput(draft);

    try {
      if (recipeId && !isCreateMode) {
        await updateRecipeMutation.mutateAsync({
          recipeId,
          ...recipeData,
        });
        initialDraftRef.current = draft;
        setServings(draft.servings);
        setIsEditing(false);
      } else {
        const { id } = await saveRecipeMutation.mutateAsync(recipeData);
        navigation.replace("RecipeDetail", { recipeId: id });
      }
    } catch (err: any) {
      Alert.alert(
        "Save Failed",
        err?.message || "Something went wrong while saving the recipe.",
      );
    }
  }, [
    draft,
    isCreateMode,
    isUploadingImages,
    navigation,
    recipeId,
    saveRecipeMutation,
    updateRecipeMutation,
  ]);

  useLayoutEffect(() => {
    const headerRightItems: any[] = [];

    if (!isEditing && !isPreviewMode && isOwnRecipe) {
      headerRightItems.push({
        type: "menu" as const,
        label: "Options",
        icon: {
          type: "sfSymbol" as const,
          name: "ellipsis",
        },
        menu: {
          items: [
            {
              type: "action" as const,
              label: "Edit Recipe",
              icon: {
                type: "sfSymbol" as const,
                name: "pencil",
              },
              onPress: handleEnterEditMode,
            },
            {
              type: "action" as const,
              label: "Manage Collections",
              icon: {
                type: "sfSymbol" as const,
                name: "bookmark",
              },
              onPress: () => {
                if (recipe) {
                  collectionSheetRef.current?.present();
                }
              },
            },
            {
              type: "action" as const,
              label: "Delete Recipe",
              icon: {
                type: "sfSymbol" as const,
                name: "trash",
              },
              destructive: true,
              onPress: () => {
                if (recipeId === null) return;
                const id = recipeId;
                Alert.alert(
                  "Delete Recipe",
                  "Are you sure you want to delete this recipe? This cannot be undone.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: async () => {
                        try {
                          await deleteMutation.mutateAsync({ recipeId: id });
                          navigation.goBack();
                        } catch (err: any) {
                          Alert.alert(
                            "Error",
                            err?.message || "Failed to delete recipe",
                          );
                        }
                      },
                    },
                  ],
                );
              },
            },
          ],
        },
      });
    }

    navigation.setOptions({
      headerTitle: "",
      unstable_headerRightItems: () => headerRightItems,
    });
  }, [
    deleteMutation,
    handleEnterEditMode,
    isEditing,
    isOwnRecipe,
    isPreviewMode,
    navigation,
    recipe,
    recipeId,
  ]);

  if (!isPreviewMode && !isBlankDraftMode && !isPending && (error || !recipe)) {
    const isForbidden = (error as any)?.data?.code === "FORBIDDEN";
    const sourceUrl = (error as any)?.data?.cause?.sourceUrl as
      | string
      | undefined;

    return (
      <View style={[styles.screen, styles.centered]}>
        <Text type="bodyFaded">
          {isForbidden
            ? "This recipe is from an external website"
            : "Recipe not found"}
        </Text>
        <VSpace size={16} />
        {isForbidden && sourceUrl ? (
          <>
            <PrimaryButton
              onPress={() => {
                import("expo-web-browser").then((WebBrowser) => {
                  WebBrowser.openBrowserAsync(sourceUrl);
                });
              }}
            >
              View on Original Site
            </PrimaryButton>
            <VSpace size={8} />
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text type="bodyFaded">Go Back</Text>
            </TouchableOpacity>
          </>
        ) : (
          <PrimaryButton onPress={() => navigation.goBack()}>
            Go Back
          </PrimaryButton>
        )}
      </View>
    );
  }

  const renderImage = ({ item }: { item: RecipeImage }) => {
    const imageUrl = getImageUrl(item.url, "recipe-hero") ?? item.url;
    return (
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: imageUrl }}
          style={styles.recipeImage}
          contentFit="cover"
          transition={200}
        />
      </View>
    );
  };

  const renderDraftImage = ({ item }: { item: DraftImage }) => {
    const progress = uploadProgress[item.uri];
    const isUploading =
      progress !== undefined && progress >= 0 && progress < 100;
    const imageUrl = item.isRemote
      ? (getImageUrl(item.uri, "recipe-hero") ?? item.uri)
      : item.uri;

    return (
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: imageUrl }}
          style={styles.recipeImage}
          contentFit="cover"
          transition={200}
        />
        {isUploading && (
          <View style={styles.imageUploadOverlay}>
            <ActivityIndicator color="white" />
          </View>
        )}
      </View>
    );
  };

  const renderImageEditOverlay = () => {
    if (!isEditing || !draft) return null;

    return (
      <View style={styles.heroEditRow}>
        <TouchableOpacity
          style={styles.heroEditButton}
          onPress={handlePickRecipeImage}
          activeOpacity={0.78}
        >
          <Ionicons name="camera-outline" size={17} color="white" />
          <Text style={styles.heroEditButtonText}>Photo</Text>
          <View style={styles.heroCountChip}>
            <Text style={styles.heroCountText}>{draft.images.length}</Text>
          </View>
        </TouchableOpacity>
        {draft.images.length > 0 ? (
          <TouchableOpacity
            style={styles.heroIconButton}
            onPress={handleRemoveCurrentImage}
            activeOpacity={0.78}
            accessibilityLabel="Remove current photo"
          >
            <Ionicons name="trash-outline" size={17} color="white" />
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  const renderHero = () => {
    if (isEditing && draft) {
      if (draft.images.length === 0) {
        return (
          <View style={styles.imageCarouselContainer}>
            <TouchableOpacity
              style={styles.emptyHero}
              onPress={handlePickRecipeImage}
              activeOpacity={0.82}
            >
              <Ionicons
                name="camera-outline"
                size={30}
                style={styles.emptyHeroIcon}
              />
              <Text style={styles.emptyHeroText}>Add recipe photo</Text>
            </TouchableOpacity>
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.58)"]}
              style={styles.imageOverlay}
            >
              <View style={styles.overlayTitleInputFrame}>
                <TextInput
                  value={draft.name}
                  onChangeText={(name) =>
                    updateDraft((current) => ({ ...current, name }))
                  }
                  placeholder="Recipe title"
                  placeholderTextColor="rgba(255,255,255,0.75)"
                  style={styles.overlayTitleInput}
                  multiline
                  textAlignVertical="top"
                />
              </View>
            </LinearGradient>
          </View>
        );
      }

      return (
        <View style={styles.imageCarouselContainer}>
          <Animated.View style={imageAnimatedStyle}>
            <FlatList
              data={draft.images}
              renderItem={renderDraftImage}
              keyExtractor={(item) => item.id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleImageScroll}
            />
          </Animated.View>
          <PageIndicator
            currentPage={currentImageIndex + 1}
            totalPages={draft.images.length}
          />
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.6)"]}
            style={styles.imageOverlay}
          >
            {renderImageEditOverlay()}
            <View style={styles.overlayTitleInputFrame}>
              <TextInput
                value={draft.name}
                onChangeText={(name) =>
                  updateDraft((current) => ({ ...current, name }))
                }
                placeholder="Recipe title"
                placeholderTextColor="rgba(255,255,255,0.75)"
                style={styles.overlayTitleInput}
                multiline
                textAlignVertical="top"
              />
            </View>
          </LinearGradient>
        </View>
      );
    }

    return (
      <View style={styles.imageCarouselContainer}>
        {recipe?.images && recipe.images.length > 0 ? (
          <>
            <Animated.View style={imageAnimatedStyle}>
              <FlatList
                data={recipe.images}
                renderItem={renderImage}
                keyExtractor={(item) => item.id.toString()}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={handleImageScroll}
              />
            </Animated.View>
            <PageIndicator
              currentPage={currentImageIndex + 1}
              totalPages={recipe.images.length}
            />
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.6)"]}
              style={styles.imageOverlay}
            >
              <Text type="title1" style={styles.overlayTitle} numberOfLines={2}>
                {recipe.name}
              </Text>
            </LinearGradient>
          </>
        ) : (
          <Skeleton
            width={SCREEN_WIDTH}
            height={IMAGE_HEIGHT}
            borderRadius={0}
          />
        )}
      </View>
    );
  };

  const renderIngredients = () => {
    if (!recipe) return null;
    return (
      <View style={styles.tabContent}>
        {recipe.ingredientSections.map((section, sectionIndex) => (
          <View
            key={section.id}
            style={sectionIndex > 0 ? styles.contentSectionGroup : null}
          >
            {section.name && (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{section.name}</Text>
              </View>
            )}

            {section.ingredients.map((item) => {
              let adjustedQuantity = item.quantity
                ? parseFloat(item.quantity) * servingMultiplier
                : null;
              let displayUnit = formatUnit(item.unit, adjustedQuantity);

              if (
                measurementSystem !== "auto" &&
                adjustedQuantity &&
                item.unit
              ) {
                const converted = convertParsedIngredient(
                  adjustedQuantity,
                  item.unit,
                  measurementSystem,
                  item.name,
                );
                if (converted) {
                  adjustedQuantity = converted.quantity;
                  displayUnit = formatUnit(converted.unit, converted.quantity);
                }
              }

              const formattedQuantity = adjustedQuantity
                ? adjustedQuantity % 1 === 0
                  ? adjustedQuantity.toString()
                  : adjustedQuantity.toFixed(2).replace(/\.?0+$/, "")
                : null;

              const needsSpace = displayUnit && !isCompactUnit(displayUnit);

              return (
                <View key={item.id} style={styles.ingredientItem}>
                  <View style={styles.ingredientContent}>
                    <Text style={styles.ingredientName}>
                      {(formattedQuantity || displayUnit) && (
                        <Text style={styles.ingredientQuantity}>
                          {formattedQuantity}
                          {formattedQuantity && displayUnit && needsSpace
                            ? " "
                            : ""}
                          {displayUnit}{" "}
                        </Text>
                      )}
                      {item.name}
                    </Text>
                    {item.preparation && (
                      <Text style={styles.ingredientPreparation}>
                        {item.preparation}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  const renderEditableIngredients = () => {
    if (!draft) return null;
    return (
      <View style={styles.tabContent}>
        {draft.ingredientSections.map((section, sectionIndex) => (
          <Animated.View
            key={section.id}
            layout={LinearTransition.duration(180)}
            style={sectionIndex > 0 ? styles.contentSectionGroup : null}
          >
            <View style={styles.editSectionHeader}>
              <View style={styles.editSectionTitleField}>
                <Ionicons
                  name="pencil-outline"
                  size={14}
                  style={styles.editSectionTitleIcon}
                />
                <TextInput
                  value={section.name}
                  onChangeText={(name) =>
                    updateIngredientSectionName(section.id, name)
                  }
                  placeholder="Section name"
                  placeholderTextColor={styles.placeholderText.color}
                  style={styles.editSectionInput}
                />
              </View>
              <TouchableOpacity
                style={styles.editRemoveIcon}
                onPress={() => removeIngredientSection(section.id)}
                accessibilityLabel="Remove ingredient section"
              >
                <Ionicons
                  name="trash-outline"
                  size={17}
                  style={styles.editIcon}
                />
              </TouchableOpacity>
            </View>

            {section.ingredients.map((ingredient) => (
              <Animated.View
                key={ingredient.id}
                layout={LinearTransition.duration(180)}
                entering={FadeIn.duration(150)}
                exiting={FadeOut.duration(120)}
                style={styles.editIngredientRow}
              >
                <TextInput
                  value={ingredient.text}
                  onChangeText={(text) =>
                    updateIngredient(section.id, ingredient.id, text)
                  }
                  placeholder="2 cups flour"
                  placeholderTextColor={styles.placeholderText.color}
                  style={styles.editIngredientInput}
                  multiline
                  scrollEnabled={false}
                />
                <TouchableOpacity
                  style={styles.editRemoveIcon}
                  onPress={() => removeIngredient(section.id, ingredient.id)}
                  accessibilityLabel="Remove ingredient"
                >
                  <Ionicons name="remove" size={18} style={styles.editIcon} />
                </TouchableOpacity>
              </Animated.View>
            ))}

            <TouchableOpacity
              style={styles.inlineAddButton}
              onPress={() => addIngredient(section.id)}
            >
              <Ionicons name="add" size={17} style={styles.inlineAddIcon} />
              <Text style={styles.inlineAddText}>Add ingredient</Text>
            </TouchableOpacity>
          </Animated.View>
        ))}

        <TouchableOpacity
          style={styles.addSectionButton}
          onPress={addIngredientSection}
        >
          <Ionicons
            name="add-circle-outline"
            size={18}
            style={styles.inlineAddIcon}
          />
          <Text style={styles.addSectionText}>Add ingredient section</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderMethod = () => {
    if (!recipe) return null;
    let globalStepIndex = 0;

    return (
      <View style={styles.tabContent}>
        {recipe.instructionSections.map((section, sectionIndex) => (
          <View
            key={section.id}
            style={sectionIndex > 0 ? styles.contentSectionGroup : null}
          >
            {section.name && (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{section.name}</Text>
              </View>
            )}

            {section.instructions.map((item) => {
              globalStepIndex++;
              return (
                <View key={item.id} style={styles.instructionItem}>
                  <View style={styles.stepMarkerColumn}>
                    <View style={styles.stepNumberBadge}>
                      <Text style={styles.stepNumber}>{globalStepIndex}</Text>
                    </View>
                  </View>
                  <View style={styles.instructionContent}>
                    <Text style={styles.instructionText}>
                      {item.instruction}
                    </Text>
                    {item.imageUrl && (
                      <>
                        <VSpace size={14} />
                        <TouchableOpacity
                          onPress={() => setExpandedImageUrl(item.imageUrl!)}
                          style={styles.stepImageThumbnail}
                        >
                          <Image
                            source={{
                              uri: getImageUrl(item.imageUrl, "step-thumb"),
                            }}
                            style={styles.stepImage}
                            contentFit="cover"
                          />
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  const renderEditableMethod = () => {
    if (!draft) return null;
    let globalStepIndex = 0;

    return (
      <View style={styles.tabContent}>
        {draft.instructionSections.map((section, sectionIndex) => (
          <Animated.View
            key={section.id}
            layout={LinearTransition.duration(180)}
            style={sectionIndex > 0 ? styles.contentSectionGroup : null}
          >
            <View style={styles.editSectionHeader}>
              <View style={styles.editSectionTitleField}>
                <Ionicons
                  name="pencil-outline"
                  size={14}
                  style={styles.editSectionTitleIcon}
                />
                <TextInput
                  value={section.name}
                  onChangeText={(name) =>
                    updateInstructionSectionName(section.id, name)
                  }
                  placeholder="Section name"
                  placeholderTextColor={styles.placeholderText.color}
                  style={styles.editSectionInput}
                />
              </View>
              <TouchableOpacity
                style={styles.editRemoveIcon}
                onPress={() => removeInstructionSection(section.id)}
                accessibilityLabel="Remove method section"
              >
                <Ionicons
                  name="trash-outline"
                  size={17}
                  style={styles.editIcon}
                />
              </TouchableOpacity>
            </View>

            {section.instructions.map((instruction) => {
              globalStepIndex++;
              return (
                <Animated.View
                  key={instruction.id}
                  layout={LinearTransition.duration(180)}
                  entering={FadeIn.duration(150)}
                  exiting={FadeOut.duration(120)}
                  style={styles.editInstructionItem}
                >
                  <View style={styles.stepMarkerColumn}>
                    <View style={styles.stepNumberBadgeEdit}>
                      <Text style={styles.stepNumber}>{globalStepIndex}</Text>
                    </View>
                  </View>
                  <View style={styles.instructionContent}>
                    <TextInput
                      value={instruction.instruction}
                      onChangeText={(text) =>
                        updateInstruction(section.id, instruction.id, text)
                      }
                      placeholder="Describe this step..."
                      placeholderTextColor={styles.placeholderText.color}
                      style={styles.editInstructionInput}
                      multiline
                    />
                    {instruction.imageUrl ? (
                      <View style={styles.editStepImageWrap}>
                        <Image
                          source={{
                            uri: getImageUrl(
                              instruction.imageUrl,
                              "step-thumb",
                            ),
                          }}
                          style={styles.stepImage}
                          contentFit="cover"
                        />
                        <TouchableOpacity
                          style={styles.removeStepImageButton}
                          onPress={() =>
                            removeStepImage(section.id, instruction.id)
                          }
                        >
                          <Ionicons name="close" size={18} color="white" />
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    style={styles.editRemoveIcon}
                    onPress={() =>
                      removeInstruction(section.id, instruction.id)
                    }
                    accessibilityLabel="Remove method step"
                  >
                    <Ionicons name="remove" size={18} style={styles.editIcon} />
                  </TouchableOpacity>
                </Animated.View>
              );
            })}

            <TouchableOpacity
              style={styles.inlineAddButton}
              onPress={() => addInstruction(section.id)}
            >
              <Ionicons name="add" size={17} style={styles.inlineAddIcon} />
              <Text style={styles.inlineAddText}>Add step</Text>
            </TouchableOpacity>
          </Animated.View>
        ))}

        <TouchableOpacity
          style={styles.addSectionButton}
          onPress={addInstructionSection}
        >
          <Ionicons
            name="add-circle-outline"
            size={18}
            style={styles.inlineAddIcon}
          />
          <Text style={styles.addSectionText}>Add method section</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderEditableMeta = () => {
    if (!draft) return null;

    return (
      <View style={styles.recipeMetaGroup}>
        <View style={styles.recipeMetaInputItem}>
          <Ionicons name="leaf-outline" size={16} style={styles.metaIcon} />
          <Text style={styles.recipeMetaLabel}>Prep</Text>
          <TextInput
            value={draft.prepTime?.toString() ?? ""}
            onChangeText={(value) =>
              updateDraft((current) => ({
                ...current,
                prepTime: value ? Math.max(0, Number(value) || 0) : null,
              }))
            }
            placeholder="min"
            placeholderTextColor={styles.placeholderText.color}
            keyboardType="number-pad"
            style={styles.metaTextInput}
          />
        </View>
        <View style={styles.recipeMetaInputItem}>
          <Ionicons name="flame-outline" size={16} style={styles.metaIcon} />
          <Text style={styles.recipeMetaLabel}>Cook</Text>
          <TextInput
            value={draft.cookTime?.toString() ?? ""}
            onChangeText={(value) =>
              updateDraft((current) => ({
                ...current,
                cookTime: value ? Math.max(0, Number(value) || 0) : null,
              }))
            }
            placeholder="min"
            placeholderTextColor={styles.placeholderText.color}
            keyboardType="number-pad"
            style={styles.metaTextInput}
          />
        </View>
        <View style={styles.recipeMetaInputItem}>
          <Ionicons name="people-outline" size={16} style={styles.metaIcon} />
          <Text style={styles.recipeMetaLabel}>Serves</Text>
          <TextInput
            value={draft.servings.toString()}
            onChangeText={(value) =>
              updateDraft((current) => ({
                ...current,
                servings: Math.max(1, Number(value) || 1),
              }))
            }
            keyboardType="number-pad"
            style={styles.metaTextInput}
          />
        </View>
      </View>
    );
  };

  const isLoading = !isPreviewMode && !isBlankDraftMode && isPending;
  const ingredientCount = isEditing
    ? (draft?.ingredientSections.reduce(
        (total, section) =>
          total +
          section.ingredients.filter((ingredient) => ingredient.text.trim())
            .length,
        0,
      ) ?? 0)
    : (recipe?.ingredientSections.reduce(
        (total, section) => total + section.ingredients.length,
        0,
      ) ?? 0);
  const instructionCount = isEditing
    ? (draft?.instructionSections.reduce(
        (total, section) =>
          total +
          section.instructions.filter((instruction) =>
            instruction.instruction.trim(),
          ).length,
        0,
      ) ?? 0)
    : (recipe?.instructionSections.reduce(
        (total, section) => total + section.instructions.length,
        0,
      ) ?? 0);

  return (
    <View style={styles.screen}>
      <Animated.ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {renderHero()}

        <View style={styles.whiteCard}>
          {isLoading ? (
            <>
              <View style={styles.summaryPanel}>
                <Skeleton width="88%" height={20} borderRadius={5} />
                <Skeleton width="62%" height={20} borderRadius={5} />

                <View style={styles.skeletonTagRow}>
                  <Skeleton width={82} height={16} borderRadius={4} />
                  <Skeleton width={64} height={16} borderRadius={4} />
                </View>

                <View style={styles.recipeMetaGroup}>
                  <Skeleton width={92} height={34} borderRadius={17} />
                  <Skeleton width={92} height={34} borderRadius={17} />
                  <Skeleton width={100} height={34} borderRadius={17} />
                </View>

                <Skeleton width={124} height={24} borderRadius={5} />
              </View>

              <View style={styles.recipeActionGroup}>
                <Skeleton width="60%" height={50} borderRadius={25} />
                <Skeleton width={50} height={50} borderRadius={25} />
                <Skeleton width={50} height={50} borderRadius={25} />
              </View>

              <View style={styles.pageDivider} />

              <View style={styles.recipeSection}>
                <View>
                  <Skeleton width={128} height={24} borderRadius={5} />
                  <VSpace size={4} />
                  <Skeleton width={48} height={13} borderRadius={4} />
                </View>
                <View style={styles.tabContent}>
                  {[1, 2, 3, 4].map((i) => (
                    <View key={i} style={styles.ingredientItemSkeleton}>
                      <Skeleton
                        width={i % 2 === 0 ? "72%" : "88%"}
                        height={18}
                        borderRadius={4}
                      />
                    </View>
                  ))}
                </View>
              </View>
            </>
          ) : recipe || draft ? (
            <>
              <Animated.View
                layout={LinearTransition.duration(200)}
                style={styles.summaryPanel}
              >
                {isEditing && draft ? (
                  <TextInput
                    value={draft.description}
                    onChangeText={(description) =>
                      updateDraft((current) => ({ ...current, description }))
                    }
                    placeholder="Add a short description..."
                    placeholderTextColor={styles.placeholderText.color}
                    style={styles.descriptionInput}
                    multiline
                  />
                ) : recipe?.description ? (
                  <Text type="body" style={styles.recipeDescription}>
                    {recipe.description}
                  </Text>
                ) : null}

                {!isEditing && recipe?.tags && recipe.tags.length > 0 && (
                  <Animated.View
                    entering={FadeIn.duration(160)}
                    exiting={FadeOut.duration(120)}
                    layout={LinearTransition.duration(180)}
                    style={styles.tagsRow}
                  >
                    <Ionicons
                      name="pricetag-outline"
                      size={14}
                      style={styles.tagsIcon}
                    />
                    {recipe.tags.slice(0, 4).map((tag) => (
                      <Text key={tag.name} style={styles.tagText}>
                        {tag.name}
                      </Text>
                    ))}
                  </Animated.View>
                )}

                {isEditing && draft ? (
                  renderEditableMeta()
                ) : (
                  <View style={styles.recipeMetaGroup}>
                    {recipe?.prepTime ? (
                      <View style={styles.recipeMetaItem}>
                        <Ionicons
                          name="leaf-outline"
                          size={16}
                          style={styles.metaIcon}
                        />
                        <Text style={styles.recipeMetaLabel}>Prep</Text>
                        <Text style={styles.recipeMetaValue}>
                          {formatMinutesShort(recipe.prepTime)}
                        </Text>
                      </View>
                    ) : null}
                    {recipe?.cookTime ? (
                      <View style={styles.recipeMetaItem}>
                        <Ionicons
                          name="flame-outline"
                          size={16}
                          style={styles.metaIcon}
                        />
                        <Text style={styles.recipeMetaLabel}>Cook</Text>
                        <Text style={styles.recipeMetaValue}>
                          {formatMinutesShort(recipe.cookTime)}
                        </Text>
                      </View>
                    ) : null}
                    {recipe ? (
                      <TouchableOpacity
                        style={styles.recipeMetaItem}
                        onPress={handleOpenAdjustSheet}
                        activeOpacity={0.76}
                        accessibilityLabel={`Adjust servings, currently ${servings}`}
                      >
                        <Ionicons
                          name="people-outline"
                          size={16}
                          style={styles.metaIcon}
                        />
                        <Text style={styles.recipeMetaLabel}>Serves</Text>
                        <Text style={styles.recipeMetaValue}>{servings}</Text>
                        <Ionicons
                          name="chevron-down"
                          size={13}
                          style={styles.recipeMetaButtonIcon}
                        />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                )}

                {!isEditing && isOwnRecipe && !isPreviewMode ? (
                  <Animated.View
                    entering={FadeIn.duration(160)}
                    exiting={FadeOut.duration(120)}
                    layout={LinearTransition.duration(180)}
                  >
                    <TouchableOpacity
                      style={styles.ratingInlineButton}
                      onPress={handleOpenReviewSheet}
                      activeOpacity={0.72}
                      accessibilityLabel={
                        displayedRating
                          ? `Rate recipe, current rating ${displayedRating} out of 5`
                          : "Rate recipe"
                      }
                    >
                      <Ionicons
                        name={displayedRating ? "star" : "star-outline"}
                        size={15}
                        style={
                          displayedRating
                            ? styles.starFilled
                            : styles.ratingIcon
                        }
                      />
                      <Text style={styles.ratingInlineText}>
                        {displayedRating
                          ? `Your rating ${displayedRating}/5`
                          : "Rate this recipe"}
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={13}
                        style={styles.ratingChevron}
                      />
                    </TouchableOpacity>
                  </Animated.View>
                ) : null}
              </Animated.View>

              {!isEditing && !isPreviewMode && (
                <Animated.View
                  entering={FadeIn.duration(180)}
                  exiting={FadeOut.duration(120)}
                  layout={LinearTransition.duration(200)}
                  style={styles.recipeActionGroup}
                >
                  {isOwnRecipe ? (
                    <>
                      <TouchableOpacity
                        style={styles.cookActionButton}
                        onPress={handleStartCookMode}
                        activeOpacity={0.82}
                      >
                        <Ionicons name="play" size={20} color="white" />
                        <Text style={styles.cookActionText}>Cook</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.recipeActionButton}
                        onPress={handleOpenMealPlanSheet}
                        activeOpacity={0.78}
                        accessibilityLabel="Add to meal plan"
                      >
                        <Ionicons
                          name="calendar-outline"
                          size={21}
                          style={styles.recipeActionIcon}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.recipeActionButton}
                        onPress={handleOpenShoppingListSheet}
                        activeOpacity={0.78}
                        accessibilityLabel="Add ingredients to shopping list"
                      >
                        <Ionicons
                          name="cart-outline"
                          size={21}
                          style={styles.recipeActionIcon}
                        />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity
                      style={styles.importActionButton}
                      onPress={handleImportRecipe}
                      disabled={importMutation.isPending}
                      activeOpacity={0.82}
                    >
                      {importMutation.isPending ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <Ionicons
                          name="download-outline"
                          size={20}
                          color="white"
                        />
                      )}
                      <Text style={styles.cookActionText}>Import</Text>
                    </TouchableOpacity>
                  )}
                </Animated.View>
              )}

              {!isEditing && !isPreviewMode && !isOwnRecipe && recipe && (
                <Animated.View
                  entering={FadeIn.duration(180)}
                  exiting={FadeOut.duration(120)}
                  layout={LinearTransition.duration(200)}
                  style={styles.actionRail}
                >
                  <TouchableOpacity
                    style={styles.authorCompact}
                    onPress={() =>
                      navigation.navigate("UserProfile", {
                        userId: recipe.owner.id,
                      })
                    }
                    activeOpacity={0.7}
                  >
                    {recipe.owner.image ? (
                      <Image
                        source={{
                          uri: getImageUrl(recipe.owner.image, "avatar-sm"),
                        }}
                        style={styles.authorAvatarImage}
                      />
                    ) : (
                      <View style={styles.authorAvatarPlaceholder}>
                        <Text style={styles.authorAvatarText}>
                          {recipe.owner.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={styles.authorInfo}>
                      <Text style={styles.authorLabel}>By</Text>
                      <Text style={styles.authorName} numberOfLines={1}>
                        {recipe.owner.name}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              )}

              <View style={styles.pageDivider} />

              <View style={styles.recipeSection}>
                <View style={styles.sectionHeadingRow}>
                  <View>
                    <Text style={styles.sectionHeading}>Ingredients</Text>
                    <Text style={styles.sectionSubheading}>
                      {ingredientCount} items
                    </Text>
                  </View>
                </View>
                {isEditing ? renderEditableIngredients() : renderIngredients()}
              </View>

              <View style={styles.pageDivider} />

              <View style={styles.recipeSection}>
                <View style={styles.sectionHeadingRow}>
                  <View>
                    <Text style={styles.sectionHeading}>Method</Text>
                    <Text style={styles.sectionSubheading}>
                      {instructionCount} steps
                    </Text>
                  </View>
                </View>
                {isEditing ? renderEditableMethod() : renderMethod()}
              </View>

              <VSpace
                size={
                  isEditing ? 120 : isPreviewMode || !isOwnRecipe ? 100 : 40
                }
              />
            </>
          ) : null}
        </View>
      </Animated.ScrollView>

      <AdjustRecipeSheet
        ref={adjustRecipeSheetRef}
        servings={servings}
        originalServings={recipe?.servings}
        onServingsChange={setServings}
        measurementSystem={measurementSystem}
        onMeasurementSystemChange={setMeasurementSystem}
      />

      <AddToMealPlanSheet
        ref={addToMealPlanSheetRef}
        recipeId={recipe?.id}
        recipeName={recipe?.name}
      />

      <ShoppingListSelectorSheet
        ref={shoppingListSheetRef}
        recipeId={recipe?.id}
        recipeName={recipe?.name}
        ingredients={shoppingListIngredients}
        servings={servings}
      />

      <CollectionSelectorSheet ref={collectionSheetRef} recipeId={recipe?.id} />

      <CookingReviewSheet
        ref={cookingReviewSheetRef}
        recipeName={recipe?.name}
        onSubmit={handleSubmitReview}
      />

      {isEditing && draft ? (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(120)}
          style={[
            styles.stickyFooter,
            styles.editFooter,
            { paddingBottom: insets.bottom + 12 },
          ]}
        >
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancelEdit}
            disabled={isSaving}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.buttonDisabled]}
            onPress={handleSaveDraft}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons
                  name="checkmark"
                  size={20}
                  style={styles.saveButtonIcon}
                />
                <Text style={styles.saveButtonText}>Save</Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>
      ) : null}

      <Modal
        visible={expandedImageUrl !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setExpandedImageUrl(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setExpandedImageUrl(null)}
        >
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setExpandedImageUrl(null)}
            >
              <Ionicons name="close" size={32} color="#fff" />
            </TouchableOpacity>

            {expandedImageUrl && (
              <Image
                source={{ uri: getImageUrl(expandedImageUrl, "step-full") }}
                style={styles.expandedImage}
                contentFit="contain"
              />
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  imageCarouselContainer: {
    height: IMAGE_HEIGHT,
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: IMAGE_HEIGHT,
  },
  recipeImage: {
    width: "100%",
    height: "100%",
    backgroundColor: theme.colors.border,
  },
  imageUploadOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyHero: {
    flex: 1,
    backgroundColor: theme.colors.inputBackground,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  emptyHeroIcon: {
    color: theme.colors.textSecondary,
  },
  emptyHeroText: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    fontFamily: theme.fonts.semiBold,
  },
  imageOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 70,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  overlayTitle: {
    color: "white",
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  overlayTitleInputFrame: {
    marginVertical: -6,
    marginHorizontal: -10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.42)",
    backgroundColor: "rgba(0,0,0,0.14)",
  },
  overlayTitleInput: {
    minHeight: 34,
    maxHeight: 102,
    color: "white",
    fontSize: 28,
    lineHeight: 34,
    fontFamily: theme.fonts.black,
    letterSpacing: -1,
    paddingVertical: 0,
    paddingHorizontal: 0,
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    backgroundColor: "transparent",
  },
  heroEditRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  heroEditButton: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.45)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  heroEditButtonText: {
    color: "white",
    fontSize: 13,
    fontFamily: theme.fonts.semiBold,
  },
  heroCountChip: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 0,
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.16)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 2,
  },
  heroCountText: {
    color: "white",
    fontSize: 11,
    lineHeight: 18,
    fontFamily: theme.fonts.semiBold,
    includeFontPadding: false,
  },
  heroIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  whiteCard: {
    backgroundColor: theme.colors.background,
    paddingTop: 18,
    paddingBottom: 20,
    paddingHorizontal: 20,
    minHeight: 400,
  },
  tagsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  tagText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.semiBold,
  },
  tagsIcon: {
    color: theme.colors.textSecondary,
  },
  recipeDescription: {
    lineHeight: 22,
    fontFamily: theme.fonts.regular,
  },
  descriptionInput: {
    minHeight: 96,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 25,
    backgroundColor: theme.colors.inputBackground,
    color: theme.colors.text,
    fontSize: 17,
    lineHeight: 24,
    fontFamily: theme.fonts.regular,
    textAlignVertical: "top",
  },
  summaryPanel: {
    gap: 14,
  },
  recipeMetaGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  recipeMetaItem: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: 17,
    backgroundColor: theme.colors.inputBackground,
  },
  recipeMetaInputItem: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingLeft: 10,
    paddingRight: 8,
    borderRadius: 17,
    backgroundColor: theme.colors.inputBackground,
  },
  recipeMetaButtonIcon: {
    marginLeft: -1,
    color: theme.colors.textSecondary,
  },
  recipeMetaLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.semiBold,
  },
  recipeMetaValue: {
    fontSize: 12,
    color: theme.colors.text,
    fontFamily: theme.fonts.semiBold,
  },
  metaTextInput: {
    minWidth: 44,
    paddingVertical: 0,
    color: theme.colors.text,
    fontSize: 12,
    fontFamily: theme.fonts.semiBold,
  },
  ratingInlineButton: {
    alignSelf: "flex-start",
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  ratingIcon: {
    color: theme.colors.textSecondary,
  },
  ratingInlineText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.semiBold,
  },
  ratingChevron: {
    color: theme.colors.textSecondary,
  },
  metaIcon: {
    color: theme.colors.textSecondary,
  },
  starFilled: {
    color: theme.colors.primary,
  },
  ingredientItemSkeleton: {
    paddingVertical: 10,
  },
  skeletonTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  recipeActionGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 14,
  },
  actionRail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 12,
  },
  cookActionButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  importActionButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  cookActionText: {
    color: "white",
    fontSize: 17,
    fontFamily: theme.fonts.semiBold,
  },
  recipeActionButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.inputBackground,
    justifyContent: "center",
    alignItems: "center",
  },
  recipeActionIcon: {
    color: theme.colors.text,
  },
  authorAvatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    flexShrink: 0,
  },
  authorAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  authorAvatarText: {
    fontSize: 15,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.buttonText,
  },
  authorInfo: {
    flex: 1,
    minWidth: 0,
  },
  authorCompact: {
    flex: 1,
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    borderRadius: 25,
    backgroundColor: theme.colors.inputBackground,
  },
  authorLabel: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.semiBold,
    textTransform: "uppercase",
  },
  authorName: {
    fontSize: 15,
    color: theme.colors.text,
    fontFamily: theme.fonts.semiBold,
  },
  tabContent: {
    paddingTop: 16,
  },
  contentSectionGroup: {
    paddingTop: 18,
  },
  sectionHeader: {
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    lineHeight: 20,
    color: theme.colors.text,
    fontFamily: theme.fonts.semiBold,
  },
  sectionHeadingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingBottom: 2,
  },
  sectionHeading: {
    fontSize: 22,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  sectionSubheading: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.semiBold,
    marginTop: 2,
  },
  recipeSection: {
    gap: 8,
  },
  pageDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginTop: 30,
    marginBottom: 24,
    opacity: 0.4,
  },
  ingredientItem: {
    paddingVertical: 10,
  },
  ingredientContent: {
    flex: 1,
  },
  ingredientQuantity: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  ingredientName: {
    fontSize: 17,
    color: theme.colors.text,
    lineHeight: 24,
  },
  ingredientPreparation: {
    fontSize: 14,
    fontStyle: "italic",
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  instructionItem: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 16,
  },
  stepMarkerColumn: {
    width: 30,
    alignItems: "center",
  },
  stepNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.inputBackground,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 0,
  },
  stepNumberBadgeEdit: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.inputBackground,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  stepNumber: {
    fontSize: 13,
    lineHeight: 17,
    fontFamily: theme.fonts.bold,
    color: theme.colors.primary,
  },
  instructionContent: {
    flex: 1,
    minWidth: 0,
  },
  instructionText: {
    fontSize: 17,
    lineHeight: 27,
    color: theme.colors.text,
  },
  stepImageThumbnail: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 16,
    overflow: "hidden",
  },
  stepImage: {
    width: "100%",
    height: "100%",
  },
  editSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 10,
  },
  editSectionTitleField: {
    flex: 1,
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: theme.colors.inputBackground,
  },
  editSectionTitleIcon: {
    color: theme.colors.textSecondary,
  },
  editSectionInput: {
    flex: 1,
    minHeight: 40,
    color: theme.colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontFamily: theme.fonts.semiBold,
    paddingVertical: 0,
    paddingHorizontal: 0,
    textAlignVertical: "center",
    includeFontPadding: false,
  },
  editIngredientRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 5,
  },
  editIngredientInput: {
    flex: 1,
    minHeight: 50,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 25,
    backgroundColor: theme.colors.inputBackground,
    color: theme.colors.text,
    fontSize: 17,
    lineHeight: 24,
    fontFamily: theme.fonts.regular,
  },
  editInstructionItem: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 8,
  },
  editInstructionInput: {
    minHeight: 104,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 25,
    backgroundColor: theme.colors.inputBackground,
    color: theme.colors.text,
    fontSize: 17,
    lineHeight: 27,
    fontFamily: theme.fonts.regular,
    textAlignVertical: "top",
  },
  editStepImageWrap: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 10,
  },
  removeStepImageButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
  },
  editRemoveIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.inputBackground,
    marginTop: 6,
  },
  editIcon: {
    color: theme.colors.textSecondary,
  },
  inlineAddButton: {
    minHeight: 38,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    borderRadius: 19,
    marginTop: 8,
    backgroundColor: theme.colors.inputBackground,
  },
  inlineAddIcon: {
    color: theme.colors.primary,
  },
  inlineAddText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontFamily: theme.fonts.semiBold,
  },
  addSectionButton: {
    minHeight: 42,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 21,
    marginTop: 16,
    backgroundColor: theme.colors.primary + "12",
  },
  addSectionText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontFamily: theme.fonts.semiBold,
  },
  stickyFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.background,
    paddingTop: 12,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  editFooter: {
    flexDirection: "row",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 50,
    backgroundColor: theme.colors.inputBackground,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cancelButtonText: {
    color: theme.colors.text,
    fontSize: 17,
    fontFamily: theme.fonts.semiBold,
  },
  saveButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    backgroundColor: theme.colors.primary,
    borderRadius: 25,
  },
  buttonDisabled: {
    opacity: 0.62,
  },
  saveButtonIcon: {
    color: theme.colors.buttonText,
  },
  saveButtonText: {
    color: theme.colors.buttonText,
    fontSize: 17,
    fontFamily: theme.fonts.semiBold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButton: {
    position: "absolute",
    top: 60,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  expandedImage: {
    width: "90%",
    height: "80%",
  },
  placeholderText: {
    color: theme.colors.placeholderText,
  },
}));
