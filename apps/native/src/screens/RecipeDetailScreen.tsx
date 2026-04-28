import { Ionicons } from "@expo/vector-icons";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
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
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  useAnimatedRef,
  useAnimatedScrollHandler,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";

import { useCreateCookingReview } from "@/api/activity";
import {
  useRecipeDetail,
  useImportRecipe,
  useDeleteRecipe,
  useSaveRecipe,
  type ParsedRecipe,
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
import type { MeasurementSystem } from "@/lib/measurementPreferences";
import { getImageUrl } from "@/utils/imageUrl";
import {
  isCompactUnit,
  formatUnit,
  convertParsedIngredient,
} from "@/utils/measurementUtils";
import {
  transformParsedRecipeForPreview,
  transformParsedRecipeForSave,
  validateRecipeForSave,
} from "@/utils/recipeTransform";
import { formatMinutesShort } from "@/utils/timeUtils";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const IMAGE_HEIGHT = SCREEN_WIDTH;

type RecipeDetailScreenParams = {
  RecipeDetail: { recipeId: number } | { parsedRecipe: ParsedRecipe };
};

// Type guard for preview mode
function isPreviewParams(
  params: RecipeDetailScreenParams["RecipeDetail"],
): params is { parsedRecipe: ParsedRecipe } {
  return "parsedRecipe" in params;
}

interface RecipeImage {
  id: number;
  url: string;
}

export const RecipeDetailScreen = () => {
  const route = useRoute<RecipeDetailScreenParams>("RecipeDetail");
  const navigation = useNavigation("RecipeDetail");
  const insets = useSafeAreaInsets();
  const params = route.params;

  // Determine if we're in preview mode
  const isPreviewMode = isPreviewParams(params);
  const parsedRecipe = isPreviewMode ? params.parsedRecipe : null;
  const recipeId = "recipeId" in params ? params.recipeId : null;

  // Only fetch if we have a recipeId (not preview mode)
  const {
    data: fetchedRecipe,
    isPending,
    error,
  } = useRecipeDetail({ recipeId });

  // Transform parsed recipe for display in preview mode
  const previewRecipe = useMemo(() => {
    if (isPreviewMode && parsedRecipe) {
      return transformParsedRecipeForPreview(parsedRecipe);
    }
    return null;
  }, [isPreviewMode, parsedRecipe]);

  // Use either fetched or preview recipe
  const recipe = isPreviewMode ? previewRecipe : fetchedRecipe;

  const { data: userData } = useUser();

  // For preview mode: save recipe mutation
  const saveRecipeMutation = useSaveRecipe();

  const [servings, setServings] = useState(1);
  const [measurementSystem, setMeasurementSystem] = useState<MeasurementSystem>(
    (userData?.user?.measurementPreference as MeasurementSystem) ?? "auto",
  );
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

  // Handler for image carousel page changes
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

  // Ref and scroll offset for parallax effects
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // Animated style for image carousel (scale on overscroll, parallax on scroll)
  const imageAnimatedStyle = useAnimatedStyle(() => {
    // Scale up when overscrolling (pulling down)
    const scale = interpolate(scrollY.value, [-200, 0], [2, 1], {
      extrapolateLeft: Extrapolation.EXTEND,
      extrapolateRight: Extrapolation.CLAMP,
    });

    // Anchor scaling to bottom edge: translate UP to compensate for scale growth
    // When scale > 1, the bottom edge moves down - translate up to keep it fixed
    const scaleCompensation = -(IMAGE_HEIGHT * (scale - 1)) / 2;

    // Parallax: only apply when scrolling down, not during pull-to-refresh
    const parallax = scrollY.value > 0 ? scrollY.value / 2 : 0;

    return {
      transform: [{ translateY: scaleCompensation + parallax }, { scale }],
    };
  });

  // Mutations
  const importMutation = useImportRecipe();
  const deleteMutation = useDeleteRecipe();
  const createCookingReviewMutation = useCreateCookingReview();

  // Check if the current user owns this recipe
  const isOwnRecipe = recipe?.owner.id === userData?.user?.id;
  const displayedRating = ratingOverride ?? recipe?.userReviewRating ?? null;

  useEffect(() => {
    if (recipe?.servings && !hasInitializedServings.current) {
      setServings(recipe.servings);
      hasInitializedServings.current = true;
    }
  }, [recipe?.servings]);

  useEffect(() => {
    setRatingOverride(null);
  }, [recipeId]);

  // Configure native header items
  useLayoutEffect(() => {
    const headerRightItems: any[] = [];

    // Show menu only when viewing own recipe (not in preview mode)
    if (!isPreviewMode && isOwnRecipe) {
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
              onPress: () => {
                Alert.alert(
                  "Coming Soon",
                  "Edit functionality will be available soon.",
                );
              },
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
      unstable_headerRightItems: () => headerRightItems,
    });
  }, [
    navigation,
    isPreviewMode,
    isOwnRecipe,
    recipe,
    recipeId,
    deleteMutation,
  ]);

  const servingMultiplier = recipe?.servings ? servings / recipe.servings : 1;

  // Handler for Adjust button - opens adjust sheet
  const handleOpenAdjustSheet = () => {
    adjustRecipeSheetRef.current?.present();
  };

  // Handler for Plan button - opens meal plan sheet
  const handleOpenMealPlanSheet = () => {
    addToMealPlanSheetRef.current?.present();
  };

  // Handler for Shop button - opens shopping list selector
  const handleOpenShoppingListSheet = () => {
    if (!recipe) return;

    // Flatten ingredients from all sections
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
    if (!recipe || !isOwnRecipe || isPreviewMode) return;
    cookingReviewSheetRef.current?.present();
  };

  // Handler for Cook Mode button
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

  // Preview mode handlers
  const handleSavePreviewRecipe = async () => {
    if (!parsedRecipe) return;

    // Validate required fields
    const validation = validateRecipeForSave(parsedRecipe);
    if (!validation.isValid) {
      Alert.alert("Cannot Save Recipe", validation.errors.join("\n"), [
        { text: "OK" },
      ]);
      return;
    }

    try {
      const recipeData = transformParsedRecipeForSave(parsedRecipe);
      const { id } = await saveRecipeMutation.mutateAsync(recipeData);
      // Navigate to the saved recipe (replace to prevent going back to preview)
      navigation.replace("RecipeDetail", { recipeId: id });
    } catch (err: any) {
      Alert.alert(
        "Save Failed",
        err?.message || "Something went wrong while saving the recipe.",
      );
    }
  };

  const handleEditPreviewRecipe = () => {
    if (!parsedRecipe) return;
    navigation.navigate("EditRecipe", { parsedRecipe });
  };

  // Show error state only when not loading, not in preview mode, and there's an error or no recipe
  if (!isPreviewMode && !isPending && (error || !recipe)) {
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
          onError={(e) => {
            console.log("Image load error:", imageUrl, e.error);
          }}
        />
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

  const isLoading = !isPreviewMode && isPending;

  return (
    <View style={styles.screen}>
      <Animated.ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
      >
        {/* Image Carousel */}
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
              {/* Image Overlay */}
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.6)"]}
                style={styles.imageOverlay}
              >
                <Text
                  type="title1"
                  style={styles.overlayTitle}
                  numberOfLines={2}
                >
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

        {/* White Card Section */}
        <View style={styles.whiteCard}>
          {isLoading ? (
            // Loading skeleton content
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

              <View style={styles.pageDivider} />

              <View style={styles.recipeSection}>
                <View>
                  <Skeleton width={92} height={24} borderRadius={5} />
                  <VSpace size={4} />
                  <Skeleton width={46} height={13} borderRadius={4} />
                </View>
                <View style={styles.tabContent}>
                  {[1, 2, 3].map((i) => (
                    <View key={i} style={styles.instructionItemSkeleton}>
                      <Skeleton width={28} height={28} borderRadius={14} />
                      <View style={styles.instructionSkeletonContent}>
                        <Skeleton width="94%" height={18} borderRadius={4} />
                        <Skeleton
                          width={i === 2 ? "68%" : "82%"}
                          height={18}
                          borderRadius={4}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </>
          ) : recipe ? (
            // Loaded recipe content
            <>
              <View style={styles.summaryPanel}>
                {recipe.description && (
                  <Text type="body" style={styles.recipeDescription}>
                    {recipe.description}
                  </Text>
                )}

                {recipe.tags && recipe.tags.length > 0 && (
                  <View style={styles.tagsRow}>
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
                  </View>
                )}

                <View style={styles.recipeMetaGroup}>
                  {recipe.prepTime ? (
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
                  {recipe.cookTime ? (
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
                  </TouchableOpacity>
                </View>
                {isOwnRecipe && !isPreviewMode ? (
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
                        displayedRating ? styles.starFilled : styles.ratingIcon
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
                ) : null}
              </View>

              {!isPreviewMode && (
                <View style={styles.recipeActionGroup}>
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
                </View>
              )}

              {!isPreviewMode && !isOwnRecipe && (
                <View style={styles.actionRail}>
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
                </View>
              )}

              <View style={styles.pageDivider} />

              <View style={styles.recipeSection}>
                <View style={styles.sectionHeadingRow}>
                  <View>
                    <Text style={styles.sectionHeading}>Ingredients</Text>
                    <Text style={styles.sectionSubheading}>
                      {recipe.ingredientSections.reduce(
                        (total, section) => total + section.ingredients.length,
                        0,
                      )}{" "}
                      items
                    </Text>
                  </View>
                </View>
                {renderIngredients()}
              </View>

              <View style={styles.pageDivider} />

              <View style={styles.recipeSection}>
                <View style={styles.sectionHeadingRow}>
                  <View>
                    <Text style={styles.sectionHeading}>Method</Text>
                    <Text style={styles.sectionSubheading}>
                      {recipe.instructionSections.reduce(
                        (total, section) => total + section.instructions.length,
                        0,
                      )}{" "}
                      steps
                    </Text>
                  </View>
                </View>
                {renderMethod()}
              </View>

              <VSpace size={isPreviewMode || !isOwnRecipe ? 100 : 40} />
            </>
          ) : null}
        </View>
      </Animated.ScrollView>

      {/* Adjust Recipe Sheet */}
      <AdjustRecipeSheet
        ref={adjustRecipeSheetRef}
        servings={servings}
        onServingsChange={setServings}
        measurementSystem={measurementSystem}
        onMeasurementSystemChange={setMeasurementSystem}
      />

      {/* Add to Meal Plan Sheet */}
      <AddToMealPlanSheet
        ref={addToMealPlanSheetRef}
        recipeId={recipe?.id}
        recipeName={recipe?.name}
      />

      {/* Shopping List Selector Sheet */}
      <ShoppingListSelectorSheet
        ref={shoppingListSheetRef}
        recipeId={recipe?.id}
        recipeName={recipe?.name}
        ingredients={shoppingListIngredients}
        servings={servings}
      />

      {/* Collection Selector Sheet */}
      <CollectionSelectorSheet ref={collectionSheetRef} recipeId={recipe?.id} />

      {/* Cooking Review Sheet */}
      <CookingReviewSheet
        ref={cookingReviewSheetRef}
        recipeName={recipe?.name}
        onSubmit={handleSubmitReview}
      />

      {/* Sticky Footer */}
      {isPreviewMode && recipe ? (
        // Preview mode: Save and Edit buttons
        <View
          style={[
            styles.stickyFooter,
            styles.previewFooter,
            { paddingBottom: insets.bottom + 12 },
          ]}
        >
          <TouchableOpacity
            style={styles.editButton}
            onPress={handleEditPreviewRecipe}
          >
            <Ionicons
              name="create-outline"
              size={20}
              style={styles.editButtonIcon}
            />
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSavePreviewRecipe}
            disabled={saveRecipeMutation.isPending}
          >
            {saveRecipeMutation.isPending ? (
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
        </View>
      ) : null}

      {/* Full-screen image modal */}
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

  // Image carousel container
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

  // Image Overlay
  imageOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  overlayTitle: {
    color: "white",
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // White Card
  whiteCard: {
    backgroundColor: theme.colors.background,
    paddingTop: 18,
    paddingBottom: 20,
    paddingHorizontal: 20,
    minHeight: 400,
  },
  recipeTitle: {},
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  statsSeparator: {
    width: 1,
    height: 20,
    backgroundColor: theme.colors.border,
  },
  timeItem: {
    flex: 1,
    alignItems: "center",
  },
  timeLabel: {
    fontSize: 13,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  timeValue: {
    fontSize: 17,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.text,
    marginTop: 2,
  },
  starsContainer: {
    flexDirection: "row",
    gap: 2,
    marginTop: 2,
  },
  starFilled: {
    color: theme.colors.primary,
  },
  starEmpty: {
    color: theme.colors.border,
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
  tagsText: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.semiBold,
  },
  recipeDescription: {
    lineHeight: 22,
    fontFamily: theme.fonts.regular,
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
  // Loading skeleton styles
  ingredientItemSkeleton: {
    paddingVertical: 10,
  },
  ingredientContentSkeleton: {
    flex: 1,
    gap: 6,
  },
  skeletonTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  instructionItemSkeleton: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 16,
  },
  instructionSkeletonContent: {
    flex: 1,
    gap: 8,
    paddingTop: 4,
  },

  // Action Buttons
  actionButtonsRow: {
    flexDirection: "row",
    gap: 12,
  },
  actionRail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 12,
  },
  recipeActionGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 14,
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

  // Author Card
  authorCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.inputBackground,
    borderRadius: 28,
    height: 56,
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
  attributionText: {
    color: theme.colors.textSecondary,
  },

  // Servings Row
  servingsRow: {
    flexDirection: "row",
    gap: 12,
  },
  servingsLabel: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  servingsStepper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.inputBackground,
    borderRadius: 28,
    overflow: "hidden",
  },
  stepperButton: {
    width: 50,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
  },
  stepperIcon: {
    color: theme.colors.text,
  },
  servingsDisplay: {
    flex: 1,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
  },
  servingsNumber: {
    fontSize: 20,
    fontFamily: theme.fonts.semiBold,
  },
  reviewButton: {
    flex: 1,
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: 28,
  },
  starRatingContainer: {
    flexDirection: "row",
    gap: 2,
  },
  reviewIcon: {
    color: theme.colors.buttonText,
  },
  reviewText: {
    color: theme.colors.buttonText,
    fontSize: 17,
    fontFamily: theme.fonts.semiBold,
  },

  // Tab Content
  tabContent: {
    paddingTop: 16,
  },
  contentSectionGroup: {
    paddingTop: 18,
  },
  sectionHeader: {
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    textTransform: "uppercase",
    color: theme.colors.textSecondary,
    letterSpacing: 0.4,
    fontFamily: theme.fonts.semiBold,
  },

  // Section Headings
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
  adjustInlineButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: theme.colors.inputBackground,
  },
  adjustInlineIcon: {
    color: theme.colors.textSecondary,
  },
  adjustInlineText: {
    fontSize: 14,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.textSecondary,
  },

  // Ingredients
  ingredientItem: {
    paddingVertical: 10,
  },
  ingredientBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
    marginTop: 7,
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

  // Instructions
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

  // Sticky Footer
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
  importButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    backgroundColor: theme.colors.primary,
    borderRadius: 25,
  },
  importIcon: {
    color: theme.colors.buttonText,
  },
  importText: {
    color: theme.colors.buttonText,
    fontSize: 17,
    fontFamily: theme.fonts.semiBold,
  },

  // Preview Mode
  previewBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primary + "15",
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 8,
  },
  previewBannerIcon: {
    color: theme.colors.primary,
  },
  previewBannerText: {
    color: theme.colors.primary,
    fontFamily: theme.fonts.semiBold,
    fontSize: 15,
  },
  previewBannerSubtext: {
    color: theme.colors.primary + "80",
    fontSize: 13,
  },
  previewFooter: {
    flexDirection: "row",
    gap: 12,
  },
  editButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    backgroundColor: theme.colors.inputBackground,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  editButtonIcon: {
    color: theme.colors.text,
  },
  editButtonText: {
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
  saveButtonIcon: {
    color: theme.colors.buttonText,
  },
  saveButtonText: {
    color: theme.colors.buttonText,
    fontSize: 17,
    fontFamily: theme.fonts.semiBold,
  },
  previewAuthorPlaceholder: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.inputBackground,
    borderRadius: 28,
    height: 56,
  },
  previewPlaceholderIcon: {
    color: theme.colors.textSecondary,
  },
  previewPlaceholderText: {
    color: theme.colors.textSecondary,
  },

  // Modal
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
}));
