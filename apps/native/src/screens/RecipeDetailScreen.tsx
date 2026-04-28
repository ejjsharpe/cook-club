import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import { BlurView } from "expo-blur";
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
import { PageIndicator } from "@/components/PageIndicator";
import {
  ShoppingListSelectorSheet,
  type ShoppingListSelectorSheetRef,
} from "@/components/ShoppingListSelectorSheet";
import { Skeleton } from "@/components/Skeleton";
import { VSpace, HSpace } from "@/components/Space";
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

type RecipeDetailScreenRouteProp = RouteProp<
  RecipeDetailScreenParams,
  "RecipeDetail"
>;

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

  // Check if the current user owns this recipe
  const isOwnRecipe = recipe?.owner.id === userData?.user?.id;

  useEffect(() => {
    if (recipe?.servings && !hasInitializedServings.current) {
      setServings(recipe.servings);
      hasInitializedServings.current = true;
    }
  }, [recipe?.servings]);

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

  // Handler for Cook Mode button
  const handleStartCookMode = () => {
    if (!recipe) return;

    navigation.navigate("CookMode", {
      recipeName: recipe.name,
      ingredientSections: recipe.ingredientSections,
      instructionSections: recipe.instructionSections,
    });
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
        {recipe.ingredientSections.map((section) => (
          <View key={section.id}>
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

              // Apply measurement system conversion
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
                  <View style={styles.ingredientBullet} />
                  <HSpace size={12} />
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
        {recipe.instructionSections.map((section) => (
          <View key={section.id}>
            {section.name && (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{section.name}</Text>
              </View>
            )}

            {section.instructions.map((item) => {
              globalStepIndex++;
              return (
                <View key={item.id} style={styles.instructionItem}>
                  <Text style={styles.stepNumber}>{globalStepIndex}</Text>
                  <VSpace size={8} />
                  <Text style={styles.instructionText}>{item.instruction}</Text>
                  {item.imageUrl && (
                    <>
                      <VSpace size={16} />
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
              {/* Image Overlay - Title and Action Button */}
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.6)"]}
                style={styles.imageOverlay}
              >
                {/* Title - bottom left */}
                <Text
                  type="title1"
                  style={styles.overlayTitle}
                  numberOfLines={2}
                >
                  {recipe.name}
                </Text>

                {/* Action Button - bottom right */}
                {!isPreviewMode &&
                  (isOwnRecipe ? (
                    // Cook Button for owned recipes
                    <TouchableOpacity
                      style={styles.cookButton}
                      onPress={handleStartCookMode}
                    >
                      <Ionicons name="play" size={20} color="white" />
                      <Text style={styles.cookButtonText}>Cook</Text>
                    </TouchableOpacity>
                  ) : (
                    // Import Button for non-owned recipes
                    <TouchableOpacity
                      style={styles.importOverlayButton}
                      onPress={handleImportRecipe}
                      disabled={importMutation.isPending}
                    >
                      <BlurView
                        intensity={80}
                        tint="dark"
                        style={styles.importOverlayButtonBlur}
                      >
                        {importMutation.isPending ? (
                          <ActivityIndicator size="small" color="white" />
                        ) : (
                          <Ionicons
                            name="download-outline"
                            size={24}
                            color="white"
                          />
                        )}
                      </BlurView>
                    </TouchableOpacity>
                  ))}
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
              {/* Times Row skeleton */}
              <View style={styles.statsRow}>
                <Skeleton width={100} height={18} borderRadius={4} />
                <Skeleton width={100} height={18} borderRadius={4} />
              </View>

              <VSpace size={16} />

              {/* Action buttons skeleton */}
              <View style={styles.actionButtonsRow}>
                <Skeleton width="48%" height={50} borderRadius={25} />
                <Skeleton width="48%" height={50} borderRadius={25} />
              </View>

              <VSpace size={16} />

              {/* Section heading skeleton */}
              <Skeleton width={120} height={24} borderRadius={4} />

              <VSpace size={24} />

              {/* Ingredients skeleton */}
              {[1, 2, 3, 4, 5].map((i) => (
                <View key={i} style={styles.ingredientItemSkeleton}>
                  <Skeleton width={8} height={8} borderRadius={4} />
                  <View style={styles.ingredientContentSkeleton}>
                    <Skeleton width={60} height={15} borderRadius={4} />
                    <Skeleton width="70%" height={17} borderRadius={4} />
                  </View>
                </View>
              ))}
            </>
          ) : recipe ? (
            // Loaded recipe content
            <>
              {/* Description (if exists) */}
              {recipe.description && (
                <>
                  <Text type="body" style={styles.recipeDescription}>
                    {recipe.description}
                  </Text>
                  <VSpace size={8} />
                </>
              )}

              {/* Tags */}
              {recipe.tags && recipe.tags.length > 0 && (
                <>
                  <View style={styles.tagsRow}>
                    <Ionicons
                      name="pricetag-outline"
                      size={14}
                      style={styles.tagsIcon}
                    />
                    <Text style={styles.tagsText}>
                      {recipe.tags.map((tag) => tag.name).join(", ")}
                    </Text>
                  </View>
                  <VSpace size={24} />
                </>
              )}

              {/* Stats Row */}
              <View style={styles.statsRow}>
                {(() => {
                  const items: React.ReactNode[] = [];
                  if (recipe.prepTime) {
                    items.push(
                      <View key="prep" style={styles.timeItem}>
                        <Text style={styles.timeLabel}>Prep</Text>
                        <Text style={styles.timeValue}>
                          {formatMinutesShort(recipe.prepTime)}
                        </Text>
                      </View>,
                    );
                  }
                  if (recipe.cookTime) {
                    items.push(
                      <View key="cook" style={styles.timeItem}>
                        <Text style={styles.timeLabel}>Cook</Text>
                        <Text style={styles.timeValue}>
                          {formatMinutesShort(recipe.cookTime)}
                        </Text>
                      </View>,
                    );
                  }
                  if (isOwnRecipe && !isPreviewMode) {
                    items.push(
                      <View key="rating" style={styles.timeItem}>
                        <Text style={styles.timeLabel}>Rating</Text>
                        <View style={styles.starsContainer}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Ionicons
                              key={star}
                              name={
                                recipe.userReviewRating &&
                                star <= recipe.userReviewRating
                                  ? "star"
                                  : "star-outline"
                              }
                              size={14}
                              style={
                                recipe.userReviewRating &&
                                star <= recipe.userReviewRating
                                  ? styles.starFilled
                                  : styles.starEmpty
                              }
                            />
                          ))}
                        </View>
                      </View>,
                    );
                  }

                  return items.flatMap((item, i) =>
                    i === 0
                      ? [item]
                      : [
                          <View
                            key={`sep-${i}`}
                            style={styles.statsSeparator}
                          />,
                          item,
                        ],
                  );
                })()}
              </View>
              <VSpace size={24} />

              {/* Action Buttons Row - Own recipes only */}
              {isOwnRecipe && !isPreviewMode && (
                <>
                  <View style={styles.actionButtonsRow}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={handleOpenMealPlanSheet}
                    >
                      <Ionicons
                        name="calendar-outline"
                        size={22}
                        style={styles.actionButtonIcon}
                      />
                      <Text style={styles.actionButtonText}>Plan</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={handleOpenShoppingListSheet}
                    >
                      <Ionicons
                        name="cart-outline"
                        size={22}
                        style={styles.actionButtonIcon}
                      />
                      <Text style={styles.actionButtonText}>Shop</Text>
                    </TouchableOpacity>
                  </View>
                  <VSpace size={16} />
                </>
              )}

              {/* Author card for non-owned recipes */}
              {!isOwnRecipe && !isPreviewMode && (
                <>
                  <TouchableOpacity
                    style={styles.authorCard}
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
                      <Text type="headline" numberOfLines={1}>
                        {recipe.owner.name}
                      </Text>
                      <Text type="caption">
                        {recipe.userRecipesCount} recipes
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <VSpace size={16} />
                </>
              )}

              {/* Ingredients Section */}
              <View style={styles.sectionHeadingRow}>
                <Text style={styles.sectionHeading}>Ingredients</Text>
                {isOwnRecipe && !isPreviewMode && (
                  <TouchableOpacity
                    style={styles.adjustInlineButton}
                    onPress={handleOpenAdjustSheet}
                  >
                    <Ionicons
                      name="options-outline"
                      size={18}
                      style={styles.adjustInlineIcon}
                    />
                    <Text style={styles.adjustInlineText}>Adjust</Text>
                  </TouchableOpacity>
                )}
              </View>
              {renderIngredients()}

              <VSpace size={32} />

              {/* Method Section */}
              <Text style={styles.sectionHeading}>Method</Text>
              {renderMethod()}

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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  overlayTitle: {
    flex: 1,
    color: "white",
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  cookButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    marginLeft: 12,
  },
  cookButtonText: {
    color: "white",
    fontSize: 15,
    fontFamily: theme.fonts.semiBold,
  },
  importOverlayButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    marginLeft: 12,
  },
  importOverlayButtonBlur: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.2)",
  },

  // White Card
  whiteCard: {
    backgroundColor: theme.colors.background,
    paddingVertical: 20,
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
    gap: 6,
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

  // Loading skeleton styles
  ingredientItemSkeleton: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 12,
  },
  ingredientContentSkeleton: {
    flex: 1,
    gap: 6,
  },

  // Action Buttons
  actionButtonsRow: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 25,
    backgroundColor: theme.colors.inputBackground,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  actionButtonIcon: {
    color: theme.colors.text,
  },
  actionButtonText: {
    fontSize: 15,
    fontFamily: theme.fonts.semiBold,
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
  authorName: {},
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
    minHeight: 200,
  },
  sectionHeader: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    textTransform: "uppercase",
    color: theme.colors.textSecondary,
    letterSpacing: 0.5,
    fontFamily: theme.fonts.semiBold,
  },

  // Section Headings
  sectionHeadingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionHeading: {
    fontSize: 22,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
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
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
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
  },
  ingredientName: {
    fontSize: 17,
    color: theme.colors.text,
  },
  ingredientPreparation: {
    fontSize: 14,
    fontStyle: "italic",
    color: theme.colors.textTertiary,
    marginTop: 2,
  },

  // Instructions
  instructionItem: {
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  stepNumber: {
    fontSize: 34,
    lineHeight: 40,
    fontFamily: theme.fonts.bold,
    color: theme.colors.primary,
    opacity: 0.3,
  },
  instructionText: {
    fontSize: 17,
    lineHeight: 26,
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
