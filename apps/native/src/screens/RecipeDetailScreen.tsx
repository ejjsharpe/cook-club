import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import { useTRPC } from "@repo/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Modal,
  Alert,
} from "react-native";
import { SheetManager } from "react-native-actions-sheet";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  useAnimatedRef,
  scrollTo,
  runOnJS,
  withSpring,
  useAnimatedReaction,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";

import { useCreateCookingReview } from "@/api/activity";
import {
  useRecipeDetail,
  useImportRecipe,
  useDeleteRecipe,
  type ParsedRecipe,
} from "@/api/recipe";
import {
  useAddRecipeToShoppingList,
  useRemoveRecipeFromList,
} from "@/api/shopping";
import { useUser } from "@/api/user";
import { DropdownMenu, DropdownMenuItem } from "@/components/DropdownMenu";
import { PageIndicator } from "@/components/PageIndicator";
import { SegmentedControl, TabOption } from "@/components/SegmentedControl";
import { RecipeDetailSkeleton, SkeletonContainer } from "@/components/Skeleton";
import { VSpace, HSpace } from "@/components/Space";
import { SwipeableTabView } from "@/components/SwipeableTabView";
import { Text } from "@/components/Text";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { getImageUrl } from "@/utils/imageUrl";
import {
  transformParsedRecipeForPreview,
  transformParsedRecipeForSave,
  validateRecipeForSave,
} from "@/utils/recipeTransform";
import { formatMinutesShort } from "@/utils/timeUtils";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const IMAGE_HEIGHT = 400;

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

type TabType = "ingredients" | "method";

const TAB_OPTIONS: TabOption<TabType>[] = [
  { value: "ingredients", label: "Ingredients" },
  { value: "method", label: "Method" },
];

export const RecipeDetailScreen = () => {
  const route = useRoute<RecipeDetailScreenRouteProp>();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const params = route.params;

  // Determine if we're in preview mode
  const isPreviewMode = isPreviewParams(params);
  const parsedRecipe = isPreviewMode ? params.parsedRecipe : null;
  const recipeId = isPreviewMode ? null : params.recipeId;

  // Only fetch if we have a recipeId (not preview mode)
  const {
    data: fetchedRecipe,
    isPending,
    error,
  } = useRecipeDetail({ recipeId: recipeId ?? -1 });

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
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const saveRecipeMutation = useMutation({
    ...trpc.recipe.postRecipe.mutationOptions(),
    onSuccess: ({ id }) => {
      queryClient.invalidateQueries({
        queryKey: trpc.recipe.getUserRecipes.queryKey(),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.collection.getUserCollections.queryKey(),
      });
      // Navigate to the saved recipe (replace to prevent going back to preview)
      navigation.replace("RecipeDetail", { recipeId: id });
    },
  });

  const [activeTab, setActiveTab] = useState<TabType>("ingredients");
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [servings, setServings] = useState(1);
  const hasInitializedServings = useRef(false);
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [menuVisible, setMenuVisible] = useState(false);
  const imageListRef = useAnimatedRef<Animated.FlatList<unknown>>();
  const imageScrollOffset = useSharedValue(0);
  const gestureStartIndex = useSharedValue(0);

  const updateImageIndex = (index: number) => {
    setCurrentImageIndex(index);
  };

  // Sync scroll position with animated offset value (clamped for FlatList)
  useAnimatedReaction(
    () => imageScrollOffset.value,
    (offset) => {
      const imageCount = recipe?.images?.length ?? 1;
      const maxOffset = (imageCount - 1) * SCREEN_WIDTH;
      const clampedOffset = Math.max(0, Math.min(offset, maxOffset));
      scrollTo(imageListRef, clampedOffset, 0, false);
    },
  );

  // Animated style for overscroll effect on image container
  const imageOverscrollStyle = useAnimatedStyle(() => {
    const imageCount = recipe?.images?.length ?? 1;
    const maxOffset = (imageCount - 1) * SCREEN_WIDTH;
    const offset = imageScrollOffset.value;

    let overscrollX = 0;
    if (offset < 0) {
      overscrollX = -offset; // Move right when pulling past start
    } else if (offset > maxOffset) {
      overscrollX = -(offset - maxOffset); // Move left when pulling past end
    }

    return { transform: [{ translateX: overscrollX }] };
  });

  // Native gesture for ScrollView to coordinate with image gesture
  const scrollViewNativeGesture = Gesture.Native();

  // Gesture handler for image carousel swipes
  const FLICK_VELOCITY_THRESHOLD = 500;
  const imageGesture = Gesture.Pan()
    .activeOffsetX([-10, 10]) // Activate after 10px horizontal movement
    .failOffsetY([-10, 10]) // Fail if vertical movement exceeds 10px first
    .blocksExternalGesture(scrollViewNativeGesture) // Block ScrollView when horizontal swipe detected
    .onStart(() => {
      gestureStartIndex.value = Math.round(
        imageScrollOffset.value / SCREEN_WIDTH,
      );
    })
    .onUpdate((event) => {
      const imageCount = recipe?.images?.length ?? 1;
      const maxOffset = (imageCount - 1) * SCREEN_WIDTH;
      const startOffset = gestureStartIndex.value * SCREEN_WIDTH;
      let newOffset = startOffset - event.translationX;

      // Rubber band effect when overscrolling
      if (newOffset < 0) {
        newOffset = newOffset * 0.3;
      } else if (newOffset > maxOffset) {
        newOffset = maxOffset + (newOffset - maxOffset) * 0.3;
      }

      imageScrollOffset.value = newOffset;
    })
    .onEnd((event) => {
      const imageCount = recipe?.images?.length ?? 1;
      const velocity = -event.velocityX;
      const currentIndex = gestureStartIndex.value;

      // Snap to nearest image, or use velocity to determine direction
      let targetIndex: number;
      if (Math.abs(velocity) > FLICK_VELOCITY_THRESHOLD) {
        // Fast flick - advance in flick direction
        if (velocity > 0) {
          targetIndex = Math.min(currentIndex + 1, imageCount - 1);
        } else {
          targetIndex = Math.max(currentIndex - 1, 0);
        }
      } else {
        // Slow drag - snap to nearest based on position
        const nearestIndex = Math.round(imageScrollOffset.value / SCREEN_WIDTH);
        targetIndex = Math.max(0, Math.min(nearestIndex, imageCount - 1));
      }

      const targetOffset = targetIndex * SCREEN_WIDTH;
      imageScrollOffset.value = withSpring(targetOffset, {
        velocity,
        damping: 100,
        stiffness: 100,
        mass: 0.5,
      });
      runOnJS(updateImageIndex)(targetIndex);
    });

  // Shared value for syncing tab swipe with underline
  const scrollProgress = useSharedValue(0);

  // Shared value for vertical scroll position (parallax effects)
  const scrollY = useSharedValue(0);

  const onScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // Animated style for top buttons (fade out on scroll down)
  const topButtonsAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, 200],
      [1, 0],
      Extrapolation.CLAMP,
    );
    return { opacity };
  });

  // Animated style for image (scale up on pull down)
  const imageAnimatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      scrollY.value,
      [-1500, 0],
      [10, 1],
      Extrapolation.CLAMP,
    );
    return {
      transform: [{ scale }],
    };
  });

  // Mutations
  const addToShoppingMutation = useAddRecipeToShoppingList();
  const removeFromShoppingMutation = useRemoveRecipeFromList();
  const createReviewMutation = useCreateCookingReview();
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

  const servingMultiplier = recipe?.servings ? servings / recipe.servings : 1;

  const handleSaveRecipe = () => {
    if (!recipe) return;

    SheetManager.show("collection-selector-sheet", {
      payload: { recipeId: recipe.id },
    });
  };

  const handleToggleShoppingList = () => {
    if (!recipe) return;

    if (recipe.isInShoppingList) {
      removeFromShoppingMutation.mutate({ recipeId: recipe.id });
    } else {
      addToShoppingMutation.mutate({
        recipeId: recipe.id,
        servings: servings !== recipe.servings ? servings : undefined,
      });
    }
  };

  const handleReview = () => {
    if (!recipe) return;

    SheetManager.show("cooking-review-sheet", {
      payload: {
        recipeName: recipe.name,
        onSubmit: async (data) => {
          await createReviewMutation.mutateAsync({
            recipeId: recipe.id,
            rating: data.rating,
            reviewText: data.reviewText,
            imageUrls: data.imageUrls,
          });
        },
      },
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

  const handleDeleteRecipe = () => {
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
              await deleteMutation.mutateAsync({ recipeId });
              navigation.goBack();
            } catch (err: any) {
              Alert.alert("Error", err?.message || "Failed to delete recipe");
            }
          },
        },
      ],
    );
  };

  const handleEditRecipe = () => {
    Alert.alert("Coming Soon", "Edit functionality will be available soon.");
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
      await saveRecipeMutation.mutateAsync(recipeData);
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

  const handleTabChange = (tab: TabType, _direction: number) => {
    setActiveTab(tab);
    setActiveTabIndex(tab === "ingredients" ? 0 : 1);
  };

  const handleSwipeTabChange = (index: number) => {
    setActiveTabIndex(index);
    setActiveTab(index === 0 ? "ingredients" : "method");
  };

  const menuItems: DropdownMenuItem[] = [
    {
      key: "edit",
      label: "Edit Recipe",
      icon: "create-outline",
      onPress: handleEditRecipe,
    },
    {
      key: "shopping",
      label: recipe?.isInShoppingList
        ? "Remove from Shopping List"
        : "Add to Shopping List",
      icon: recipe?.isInShoppingList ? "cart" : "cart-outline",
      onPress: handleToggleShoppingList,
    },
    {
      key: "collections",
      label: "Manage Collections",
      icon: "bookmark-outline",
      onPress: handleSaveRecipe,
    },
    {
      key: "delete",
      label: "Delete Recipe",
      icon: "trash-outline",
      destructive: true,
      onPress: handleDeleteRecipe,
    },
  ];

  console.log({ images: recipe?.images });

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
              const adjustedQuantity = item.quantity
                ? parseFloat(item.quantity) * servingMultiplier
                : null;
              const formattedQuantity = adjustedQuantity
                ? adjustedQuantity % 1 === 0
                  ? adjustedQuantity.toString()
                  : adjustedQuantity.toFixed(2).replace(/\.?0+$/, "")
                : null;

              return (
                <View key={item.id} style={styles.ingredientItem}>
                  <View style={styles.ingredientBullet} />
                  <HSpace size={12} />
                  <View style={styles.ingredientContent}>
                    {(formattedQuantity || item.unit) && (
                      <Text style={styles.ingredientQuantity}>
                        {formattedQuantity}
                        {formattedQuantity && item.unit ? " " : ""}
                        {item.unit}
                      </Text>
                    )}
                    <Text style={styles.ingredientName}>{item.name}</Text>
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

  return (
    <SkeletonContainer
      isLoading={!isPreviewMode && (isPending || !recipe)}
      skeleton={<RecipeDetailSkeleton />}
    >
      {recipe ? (
        <View style={styles.screen}>
          {/* Fixed Image Section */}
          <Animated.View
            style={[styles.fixedImageContainer, imageAnimatedStyle]}
          >
            {recipe.images && recipe.images.length > 0 && (
              <Animated.FlatList
                ref={imageListRef}
                data={recipe.images}
                renderItem={renderImage}
                keyExtractor={(item) => item.id.toString()}
                horizontal
                showsHorizontalScrollIndicator={false}
                scrollEnabled={false}
                style={imageOverscrollStyle}
              />
            )}

            {/* Page Indicator */}
            <PageIndicator
              currentPage={currentImageIndex + 1}
              totalPages={recipe.images.length}
            />
          </Animated.View>

          {/* Top Buttons - outside ScrollView for consistent positioning */}
          {/* pointerEvents box-none lets touches pass through to image carousel between buttons */}
          <Animated.View
            style={[
              styles.topButtons,
              { top: insets.top + 8 },
              topButtonsAnimatedStyle,
            ]}
            pointerEvents="box-none"
          >
            <TouchableOpacity
              style={styles.overlayButton}
              onPress={() => navigation.goBack()}
            >
              <BlurView intensity={80} tint="dark" style={styles.blurContainer}>
                <Ionicons name="chevron-back" size={24} color="white" />
              </BlurView>
            </TouchableOpacity>

            {/* Hide menu in preview mode */}
            {!isPreviewMode && isOwnRecipe && (
              <TouchableOpacity
                style={styles.overlayButton}
                onPress={() => setMenuVisible(true)}
              >
                <BlurView
                  intensity={80}
                  tint="dark"
                  style={styles.blurContainer}
                >
                  <Ionicons
                    name="ellipsis-horizontal"
                    size={24}
                    color="white"
                  />
                </BlurView>
              </TouchableOpacity>
            )}
          </Animated.View>

          <GestureDetector gesture={scrollViewNativeGesture}>
            <Animated.ScrollView
              style={styles.scrollView}
              showsVerticalScrollIndicator={false}
              onScroll={onScrollHandler}
              scrollEventThrottle={16}
            >
              {/* Spacer to push white card below image initially - also handles image swipe gestures */}
              <GestureDetector gesture={imageGesture}>
                <View style={styles.imageSpacer} />
              </GestureDetector>

              {/* White Card Section */}
              <View style={styles.whiteCard}>
                {/* Title */}
                <Text type="title1">{recipe.name}</Text>

                <VSpace size={16} />

                {/* Cook Times */}
                <View style={styles.timesRow}>
                  {recipe.prepTime && (
                    <View style={styles.timeItem}>
                      <Ionicons
                        name="timer-outline"
                        size={18}
                        style={styles.timeIcon}
                      />
                      <Text type="subheadline" style={styles.timeIcon}>
                        Prep: {formatMinutesShort(recipe.prepTime)}
                      </Text>
                    </View>
                  )}
                  {recipe.cookTime && (
                    <View style={styles.timeItem}>
                      <Ionicons
                        name="flame-outline"
                        size={18}
                        style={styles.timeIcon}
                      />
                      <Text type="subheadline" style={styles.timeIcon}>
                        Cook: {formatMinutesShort(recipe.cookTime)}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Attribution for imported recipes */}
                {isOwnRecipe &&
                  recipe.sourceType === "user" &&
                  recipe.originalOwner && (
                    <>
                      <VSpace size={8} />
                      <Text type="footnote" style={styles.attributionText}>
                        Originally from @{recipe.originalOwner.name}
                      </Text>
                    </>
                  )}

                <VSpace size={24} />

                {/* Servings Row with Review Button or Author Info */}
                <View style={styles.servingsRow}>
                  <View style={styles.servingsStepper}>
                    <TouchableOpacity
                      style={styles.stepperButton}
                      onPress={() => setServings(Math.max(1, servings - 1))}
                    >
                      <Ionicons
                        name="remove"
                        size={20}
                        style={styles.stepperIcon}
                      />
                    </TouchableOpacity>
                    <View style={styles.servingsDisplay}>
                      <Text type="caption" style={styles.servingsLabel}>
                        Servings
                      </Text>
                      <Text style={styles.servingsNumber}>{servings}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.stepperButton}
                      onPress={() => setServings(servings + 1)}
                    >
                      <Ionicons
                        name="add"
                        size={20}
                        style={styles.stepperIcon}
                      />
                    </TouchableOpacity>
                  </View>

                  {isPreviewMode ? (
                    // Preview mode: show placeholder
                    <View style={styles.previewAuthorPlaceholder}>
                      <Ionicons
                        name="bookmark-outline"
                        size={20}
                        style={styles.previewPlaceholderIcon}
                      />
                      <Text
                        type="caption"
                        style={styles.previewPlaceholderText}
                      >
                        Will be saved to your recipes
                      </Text>
                    </View>
                  ) : isOwnRecipe ? (
                    <TouchableOpacity
                      style={styles.reviewButton}
                      onPress={handleReview}
                    >
                      {recipe.userReviewRating ? (
                        <View style={styles.starRatingContainer}>
                          {Array.from({ length: recipe.userReviewRating }).map(
                            (_, i) => (
                              <Ionicons
                                key={i}
                                name="star"
                                size={18}
                                style={styles.reviewIcon}
                              />
                            ),
                          )}
                        </View>
                      ) : (
                        <>
                          <Ionicons
                            name="star-outline"
                            size={18}
                            style={styles.reviewIcon}
                          />
                          <Text style={styles.reviewText}>Review</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : (
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
                  )}
                </View>

                <VSpace size={24} />

                {/* Full Width Tabs */}
                <SegmentedControl
                  options={TAB_OPTIONS}
                  value={activeTab}
                  onValueChange={handleTabChange}
                  scrollProgress={scrollProgress}
                  fullWidth
                />

                <VSpace size={24} />

                {/* Swipeable Tab Content - breaks out of card padding for edge-to-edge swipe */}
                <View style={styles.tabViewWrapper}>
                  <SwipeableTabView
                    activeIndex={activeTabIndex}
                    onIndexChange={handleSwipeTabChange}
                    containerWidth={SCREEN_WIDTH}
                    scrollProgress={scrollProgress}
                  >
                    {renderIngredients()}
                    {renderMethod()}
                  </SwipeableTabView>
                </View>

                <VSpace size={isPreviewMode || !isOwnRecipe ? 100 : 40} />
              </View>
            </Animated.ScrollView>
          </GestureDetector>

          {/* Sticky Footer */}
          {isPreviewMode ? (
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
          ) : !isOwnRecipe ? (
            // Non-owned recipe: Import button
            <View
              style={[
                styles.stickyFooter,
                { paddingBottom: insets.bottom + 12 },
              ]}
            >
              <TouchableOpacity
                style={styles.importButton}
                onPress={handleImportRecipe}
                disabled={importMutation.isPending}
              >
                {importMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons
                      name="download-outline"
                      size={20}
                      style={styles.importIcon}
                    />
                    <Text style={styles.importText}>Import Recipe</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Dropdown Menu */}
          <DropdownMenu
            visible={menuVisible}
            onClose={() => setMenuVisible(false)}
            items={menuItems}
            anchorPosition={{ top: insets.top + 48, right: 20 }}
          />

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
      ) : null}
    </SkeletonContainer>
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

  // Fixed Image Section - behind ScrollView so card scrolls over it
  fixedImageContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: IMAGE_HEIGHT,
  },
  imageSpacer: {
    height: IMAGE_HEIGHT - 24, // Account for white card overlap
  },
  imageContainer: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: IMAGE_HEIGHT,
  },
  recipeImage: {
    width: "100%",
    height: "100%",
    backgroundColor: theme.colors.border,
  },
  topButtons: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    zIndex: 20,
  },
  overlayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
  },
  blurContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.1)",
  },

  // White Card
  whiteCard: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 28,
    paddingHorizontal: 20,
    minHeight: 400,
  },
  recipeTitle: {},
  timesRow: {
    flexDirection: "row",
    gap: 16,
  },
  timeItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  timeIcon: {
    color: theme.colors.textSecondary,
  },

  // Author Card (in servings row)
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
    fontFamily: theme.fonts.albertSemiBold,
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
    fontFamily: theme.fonts.albertSemiBold,
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
    fontFamily: theme.fonts.albertSemiBold,
  },

  // Tab Content
  tabViewWrapper: {
    marginHorizontal: -20,
  },
  tabContent: {
    minHeight: 200,
    paddingHorizontal: 20,
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
    fontFamily: theme.fonts.albertSemiBold,
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
    fontSize: 15,
    fontFamily: theme.fonts.albertSemiBold,
    marginBottom: 2,
  },
  ingredientName: {
    fontSize: 17,
    color: theme.colors.textSecondary,
  },

  // Instructions
  instructionItem: {
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  stepNumber: {
    fontSize: 34,
    fontFamily: theme.fonts.albertBold,
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
    fontFamily: theme.fonts.albertSemiBold,
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
    fontFamily: theme.fonts.albertSemiBold,
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
    fontFamily: theme.fonts.albertSemiBold,
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
    fontFamily: theme.fonts.albertSemiBold,
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
