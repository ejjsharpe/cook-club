import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import { useState, useEffect, useRef } from "react";
import {
  View,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Modal,
  Alert,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import { useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";

import { useCreateCookingReview } from "@/api/activity";
import {
  useRecipeDetail,
  useImportRecipe,
  useDeleteRecipe,
} from "@/api/recipe";
import {
  useAddRecipeToShoppingList,
  useRemoveRecipeFromList,
} from "@/api/shopping";
import { useUser } from "@/api/user";
import { CollectionSheetManager } from "@/components/CollectionSelectorSheet";
import { CookingReviewSheetManager } from "@/components/CookingReviewSheet";
import { DropdownMenu, DropdownMenuItem } from "@/components/DropdownMenu";
import { PageIndicator } from "@/components/PageIndicator";
import { VSpace, HSpace } from "@/components/Space";
import { SwipeableTabView } from "@/components/SwipeableTabView";
import { Text } from "@/components/Text";
import { UnderlineTabBar, TabOption } from "@/components/UnderlineTabBar";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { getImageUrl } from "@/utils/imageUrl";
import { formatMinutesShort } from "@/utils/timeUtils";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const IMAGE_HEIGHT = 400;

type RecipeDetailScreenParams = {
  RecipeDetail: {
    recipeId: number;
  };
};

type RecipeDetailScreenRouteProp = RouteProp<
  RecipeDetailScreenParams,
  "RecipeDetail"
>;

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
  const { recipeId } = route.params;

  const { data: recipe, isPending, error } = useRecipeDetail({ recipeId });
  const { data: userData } = useUser();

  const [activeTab, setActiveTab] = useState<TabType>("ingredients");
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [servings, setServings] = useState(1);
  const hasInitializedServings = useRef(false);
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [menuVisible, setMenuVisible] = useState(false);

  // Shared value for syncing tab swipe with underline
  const scrollProgress = useSharedValue(0);

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

    CollectionSheetManager.show("collection-selector-sheet", {
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

    CookingReviewSheetManager.show("cooking-review-sheet", {
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

  const handleImageScroll = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const page = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setCurrentImageIndex(page);
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

  if (isPending) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !recipe) {
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

  const renderImage = ({ item }: { item: RecipeImage }) => (
    <View style={styles.imageContainer}>
      <Image
        source={{ uri: getImageUrl(item.url, "recipe-hero") }}
        style={styles.recipeImage}
      />
    </View>
  );

  const renderIngredients = () => (
    <View style={styles.tabContent}>
      {recipe.ingredientSections.map((section) => (
        <View key={section.id}>
          {section.name && (
            <View style={styles.sectionHeader}>
              <Text type="heading" style={styles.sectionTitle}>
                {section.name}
              </Text>
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
                    <Text type="heading" style={styles.ingredientQuantity}>
                      {formattedQuantity}
                      {formattedQuantity && item.unit ? " " : ""}
                      {item.unit}
                    </Text>
                  )}
                  <Text type="body" style={styles.ingredientName}>
                    {item.name}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );

  const renderMethod = () => {
    let globalStepIndex = 0;

    return (
      <View style={styles.tabContent}>
        {recipe.instructionSections.map((section) => (
          <View key={section.id}>
            {section.name && (
              <View style={styles.sectionHeader}>
                <Text type="heading" style={styles.sectionTitle}>
                  {section.name}
                </Text>
              </View>
            )}

            {section.instructions.map((item) => {
              globalStepIndex++;
              return (
                <View key={item.id} style={styles.instructionItem}>
                  <Text style={styles.stepNumber}>{globalStepIndex}</Text>
                  <VSpace size={8} />
                  <Text type="body" style={styles.instructionText}>
                    {item.instruction}
                  </Text>
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
    <View style={styles.screen}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Cover Photo Section */}
        <View style={styles.coverSection}>
          {recipe.images && recipe.images.length > 0 && (
            <FlatList
              data={recipe.images}
              renderItem={renderImage}
              keyExtractor={(item) => item.id.toString()}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={handleImageScroll}
              scrollEventThrottle={16}
              bounces={false}
            />
          )}

          {/* Page Indicator */}
          <PageIndicator
            currentPage={currentImageIndex + 1}
            totalPages={recipe.images.length}
          />

          {/* Top Buttons */}
          <View style={[styles.topButtons, { top: insets.top + 8 }]}>
            <TouchableOpacity
              style={styles.overlayButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="chevron-back" size={24} color="white" />
            </TouchableOpacity>

            {isOwnRecipe && (
              <TouchableOpacity
                style={styles.overlayButton}
                onPress={() => setMenuVisible(true)}
              >
                <Ionicons name="ellipsis-horizontal" size={24} color="white" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* White Card Section */}
        <View style={styles.whiteCard}>
          {/* Title */}
          <Text type="title1" style={styles.recipeTitle}>
            {recipe.name}
          </Text>

          <VSpace size={12} />

          {/* Cook Times */}
          <View style={styles.timesRow}>
            {recipe.prepTime && (
              <View style={styles.timeItem}>
                <Ionicons
                  name="timer-outline"
                  size={18}
                  style={styles.timeIcon}
                />
                <Text>Prep: {formatMinutesShort(recipe.prepTime)}</Text>
              </View>
            )}
            {recipe.cookTime && (
              <View style={styles.timeItem}>
                <Ionicons
                  name="flame-outline"
                  size={18}
                  style={styles.timeIcon}
                />
                <Text>Cook: {formatMinutesShort(recipe.cookTime)}</Text>
              </View>
            )}
          </View>

          {/* Attribution for imported recipes */}
          {isOwnRecipe &&
            recipe.sourceType === "user" &&
            recipe.originalOwner && (
              <>
                <VSpace size={8} />
                <Text type="caption" style={styles.attributionText}>
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
                <Ionicons name="remove" size={20} style={styles.stepperIcon} />
              </TouchableOpacity>
              <View style={styles.servingsDisplay}>
                <Text type="bodyFaded" style={styles.servingsLabel}>
                  Servings
                </Text>
                <Text type="heading" style={styles.servingsNumber}>
                  {servings}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={() => setServings(servings + 1)}
              >
                <Ionicons name="add" size={20} style={styles.stepperIcon} />
              </TouchableOpacity>
            </View>

            {isOwnRecipe ? (
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
                    <Text type="heading" style={styles.authorAvatarText}>
                      {recipe.owner.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.authorInfo}>
                  <Text
                    type="heading"
                    style={styles.authorName}
                    numberOfLines={1}
                  >
                    {recipe.owner.name}
                  </Text>
                  <Text type="caption">{recipe.userRecipesCount} recipes</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          <VSpace size={24} />

          {/* Full Width Tabs */}
          <UnderlineTabBar
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

          <VSpace size={isOwnRecipe ? 40 : 100} />
        </View>
      </ScrollView>

      {/* Sticky Footer - Only for non-owned recipes */}
      {!isOwnRecipe && (
        <View
          style={[styles.stickyFooter, { paddingBottom: insets.bottom + 12 }]}
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
      )}

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

  // Cover Section
  coverSection: {
    height: IMAGE_HEIGHT,
    position: "relative",
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
  topButtons: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    zIndex: 10,
  },
  overlayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },

  // White Card
  whiteCard: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -24,
    paddingTop: 24,
    paddingHorizontal: 20,
    minHeight: 400,
  },
  recipeTitle: {
    fontSize: 28,
    lineHeight: 34,
  },
  timesRow: {
    flexDirection: "row",
    gap: 20,
  },
  timeItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  timeIcon: {
    color: theme.colors.text,
  },

  // Author Card (in servings row)
  authorCard: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    borderRadius: theme.borderRadius.medium,
    borderWidth: 1,
    borderColor: theme.colors.border,
    height: 52,
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
    backgroundColor: theme.colors.primary + "20",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  authorAvatarText: {
    fontSize: 14,
    color: theme.colors.primary,
  },
  authorInfo: {
    flex: 1,
    minWidth: 0,
  },
  authorName: {
    fontSize: 14,
  },
  attributionText: {
    opacity: 0.6,
  },

  // Servings Row
  servingsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  servingsLabel: {
    fontSize: 12,
  },
  servingsStepper: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    borderRadius: theme.borderRadius.medium,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
  },
  stepperButton: {
    width: 44,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
  },
  stepperIcon: {
    color: theme.colors.text,
  },
  servingsDisplay: {
    flex: 1,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: theme.colors.border,
  },
  servingsNumber: {
    fontSize: 18,
  },
  reviewButton: {
    width: "48%",
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.medium,
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
    fontSize: 16,
    fontWeight: "600",
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
    paddingBottom: 12,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    textTransform: "uppercase",
    opacity: 0.5,
    letterSpacing: 1,
  },

  // Modern Ingredients
  ingredientItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
  },
  ingredientBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.primary,
    marginTop: 8,
  },
  ingredientContent: {
    flex: 1,
  },
  ingredientQuantity: {
    fontSize: 15,
    marginBottom: 2,
  },
  ingredientName: {
    fontSize: 16,
    opacity: 0.8,
  },

  // Modern Instructions
  instructionItem: {
    paddingVertical: 20,
  },
  stepNumber: {
    fontSize: 32,
    fontFamily: theme.fonts.albertBold,
    color: theme.colors.text,
    opacity: 0.15,
  },
  instructionText: {
    fontSize: 16,
    lineHeight: 24,
  },
  stepImageThumbnail: {
    width: "100%",
    height: 180,
    borderRadius: 12,
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
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    borderRadius: theme.borderRadius.full,
  },
  importIcon: {
    color: theme.colors.buttonText,
  },
  importText: {
    color: theme.colors.buttonText,
    fontSize: 16,
    fontWeight: "600",
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
    padding: 8,
  },
  expandedImage: {
    width: "90%",
    height: "80%",
  },
}));
