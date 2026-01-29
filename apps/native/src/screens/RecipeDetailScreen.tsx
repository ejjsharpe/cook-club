import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import { useTRPC } from "@repo/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { SheetManager } from "react-native-actions-sheet";
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
  type ParsedRecipe,
} from "@/api/recipe";
import { useUser } from "@/api/user";
import { PageIndicator } from "@/components/PageIndicator";
import { SegmentedControl, TabOption } from "@/components/SegmentedControl";
import { Skeleton } from "@/components/Skeleton";
import { VSpace, HSpace } from "@/components/Space";
import { SwipeableTabView } from "@/components/SwipeableTabView";
import { Text } from "@/components/Text";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { getImageUrl } from "@/utils/imageUrl";
import { isCompactUnit, formatUnit } from "@/utils/measurementUtils";
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

  // Shared value for syncing tab swipe with underline
  const scrollProgress = useSharedValue(0);

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
    const headerLeftItems: any[] = [
      {
        type: "button" as const,
        label: "Back",
        icon: {
          type: "sfSymbol" as const,
          name: "chevron.backward",
        },
        onPress: () => navigation.goBack(),
      },
    ];

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
                  SheetManager.show("collection-selector-sheet", {
                    payload: { recipeId: recipe.id },
                  });
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
      unstable_headerLeftItems: () => headerLeftItems,
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
    SheetManager.show("adjust-recipe-sheet", {
      payload: {
        servings,
        onServingsChange: setServings,
      },
    });
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

    SheetManager.show("shopping-list-selector-sheet", {
      payload: {
        recipeId: recipe.id,
        recipeName: recipe.name,
        ingredients: allIngredients,
        servings,
      },
    });
  };

  // Handler for Cook Mode button
  const handleStartCookMode = () => {
    if (!recipe) return;

    navigation.navigate("CookMode", {
      recipeName: recipe.name,
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

              const displayUnit = formatUnit(item.unit, adjustedQuantity);
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
              <View style={styles.timesRow}>
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

              {/* Tab bar skeleton */}
              <View style={styles.tabBarSkeleton}>
                <Skeleton width="45%" height={20} borderRadius={4} />
                <Skeleton width="45%" height={20} borderRadius={4} />
              </View>

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
                  <VSpace size={16} />
                </>
              )}

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

              <VSpace size={16} />

              {/* Action Buttons Row - Own recipes only */}
              {isOwnRecipe && !isPreviewMode && (
                <>
                  <View style={styles.actionButtonsRow}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={handleOpenAdjustSheet}
                    >
                      <Ionicons
                        name="options-outline"
                        size={22}
                        style={styles.actionButtonIcon}
                      />
                      <Text style={styles.actionButtonText}>Adjust</Text>
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
            </>
          ) : null}
        </View>
      </Animated.ScrollView>

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
    height: 44,
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
  recipeDescription: {
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },

  // Loading skeleton styles
  tabBarSkeleton: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
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
    height: 50,
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
    fontFamily: theme.fonts.semiBold,
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
