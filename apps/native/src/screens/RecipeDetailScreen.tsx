import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
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
} from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { useCreateCookingReview } from "@/api/activity";
import { useRecipeDetail, useImportRecipe } from "@/api/recipe";
import {
  useAddRecipeToShoppingList,
  useRemoveRecipeFromList,
} from "@/api/shopping";
import { useUser } from "@/api/user";
import { CollectionSheetManager } from "@/components/CollectionSelectorSheet";
import { CookingReviewSheetManager } from "@/components/CookingReviewSheet";
import { VSpace, HSpace } from "@/components/Space";
import { Text } from "@/components/Text";
import { BackButton } from "@/components/buttons/BackButton";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { formatMinutes } from "@/utils/timeUtils";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const IMAGE_HEIGHT = 360;

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

export const RecipeDetailScreen = () => {
  const route = useRoute<RecipeDetailScreenRouteProp>();
  const navigation = useNavigation<any>();
  const { recipeId } = route.params;

  const { data: recipe, isPending, error } = useRecipeDetail({ recipeId });
  const { data: userData } = useUser();

  const [activeTab, setActiveTab] = useState<TabType>("ingredients");
  const [servings, setServings] = useState(1);
  const hasInitializedServings = useRef(false);
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);

  // Mutations
  const addToShoppingMutation = useAddRecipeToShoppingList();
  const removeFromShoppingMutation = useRemoveRecipeFromList();
  const createReviewMutation = useCreateCookingReview();
  const importMutation = useImportRecipe();

  // Check if the current user owns this recipe
  const isOwnRecipe = recipe?.uploadedBy.id === userData?.user?.id;

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
      // Remove from shopping list
      removeFromShoppingMutation.mutate({ recipeId: recipe.id });
    } else {
      // Add to shopping list with current servings value for scaling
      addToShoppingMutation.mutate({
        recipeId: recipe.id,
        servings: servings !== recipe.servings ? servings : undefined,
      });
    }
  };

  const handleIMadeThis = () => {
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
      // Navigate to the newly imported recipe
      navigation.replace("RecipeDetail", { recipeId: newRecipe.id });
    } catch (error: any) {
      const message =
        error?.message || "Something went wrong while importing the recipe.";
      Alert.alert("Import Failed", message);
    }
  };

  if (isPending) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !recipe) {
    // Check if it's a FORBIDDEN error (URL-scraped recipe from another user)
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

  const formatIngredient = (
    quantity: string | null,
    unit: string | null,
    name: string,
  ): string => {
    if (!quantity) {
      return name;
    }

    const adjustedQuantity = parseFloat(quantity) * servingMultiplier;
    const formattedQuantity =
      adjustedQuantity % 1 === 0
        ? adjustedQuantity.toString()
        : adjustedQuantity.toFixed(2).replace(/\.?0+$/, "");

    if (unit) {
      return `${formattedQuantity} ${unit} ${name}`;
    }

    return `${formattedQuantity} ${name}`;
  };

  const renderImage = ({
    item,
    index,
  }: {
    item: RecipeImage;
    index: number;
  }) => (
    <View style={styles.imageContainer}>
      <Image source={{ uri: item.url }} style={styles.recipeImage} />
    </View>
  );

  const renderUserInfo = () => {
    // Don't show user section for own recipes
    if (isOwnRecipe) {
      // For imported recipes (own recipe with sourceType === "user"), show attribution
      if (recipe.sourceType === "user" && recipe.originalUploader) {
        return (
          <View style={styles.attributionSection}>
            <Text type="bodyFaded" style={styles.attributionText}>
              Originally from @{recipe.originalUploader.name}
            </Text>
          </View>
        );
      }
      return null;
    }

    return (
      <View style={styles.userSection}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            {recipe.uploadedBy.image ? (
              <Image
                source={{ uri: recipe.uploadedBy.image }}
                style={styles.avatarImage}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text type="heading" style={styles.avatarText}>
                  {recipe.uploadedBy.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <HSpace size={12} />
          <View>
            <Text type="heading">{recipe.uploadedBy.name}</Text>
            <Text type="bodyFaded" style={styles.recipeCount}>
              {recipe.userRecipesCount} recipes
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const isSaved = !!recipe.collectionIds.length;

  const renderControls = () => (
    <View style={styles.controlsSection}>
      {/* Left side - Servings toggler */}
      <View style={styles.leftControls}>
        <Text type="bodyFaded" style={styles.servingsLabel}>
          Servings
        </Text>
        <VSpace size={4} />
        <View style={styles.servingsButtons}>
          <TouchableOpacity
            style={styles.servingsButton}
            onPress={() => {
              setServings(Math.max(1, servings - 1));
            }}
          >
            <Text type="heading" style={styles.servingsButtonText}>
              -
            </Text>
          </TouchableOpacity>
          <View style={styles.servingsDisplay}>
            <Text type="heading" style={styles.servingsNumber}>
              {servings}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.servingsButton}
            onPress={() => setServings(servings + 1)}
          >
            <Text type="heading" style={styles.servingsButtonText}>
              +
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Right side - Context-dependent buttons */}
      <View style={styles.rightControls}>
        {isOwnRecipe ? (
          // Own recipe controls
          <>
            {/* Collection/Manage button */}
            <TouchableOpacity
              style={[styles.iconButton, isSaved && styles.iconButtonActive]}
              onPress={handleSaveRecipe}
            >
              <Ionicons
                name={isSaved ? "bookmark" : "bookmark-outline"}
                size={24}
                color={isSaved ? "#fff" : undefined}
                style={styles.iconButtonIcon}
              />
            </TouchableOpacity>

            {/* Shopping list button */}
            <TouchableOpacity
              style={[
                styles.iconButton,
                recipe.isInShoppingList && styles.iconButtonActive,
              ]}
              onPress={handleToggleShoppingList}
            >
              <Ionicons
                name={recipe.isInShoppingList ? "cart" : "cart-outline"}
                size={24}
                color={recipe.isInShoppingList ? "#fff" : undefined}
                style={styles.iconButtonIcon}
              />
            </TouchableOpacity>

            {/* I made this button */}
            <TouchableOpacity
              style={styles.iMadeThisButton}
              onPress={handleIMadeThis}
            >
              <Ionicons
                name="checkmark-circle"
                size={20}
                style={styles.iMadeThisIcon}
              />
              <Text style={styles.iMadeThisText}>I made this!</Text>
            </TouchableOpacity>
          </>
        ) : (
          // Someone else's recipe - show import button
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
        )}
      </View>
    </View>
  );

  const renderTabs = () => (
    <View style={styles.tabsContainer}>
      <TouchableOpacity
        style={[styles.tab, activeTab === "ingredients" && styles.activeTab]}
        onPress={() => setActiveTab("ingredients")}
      >
        <Text type={activeTab === "ingredients" ? "highlight" : "bodyFaded"}>
          Ingredients
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, activeTab === "method" && styles.activeTab]}
        onPress={() => setActiveTab("method")}
      >
        <Text type={activeTab === "method" ? "highlight" : "bodyFaded"}>
          Method
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderTabContent = () => {
    if (activeTab === "ingredients") {
      return (
        <View style={styles.tabContent}>
          {recipe.ingredients.map(
            (
              item: {
                index: number;
                quantity: string | null;
                unit: string | null;
                name: string;
              },
              index: number,
            ) => {
              const adjustedQuantity = item.quantity
                ? parseFloat(item.quantity) * servingMultiplier
                : null;
              const formattedQuantity = adjustedQuantity
                ? adjustedQuantity % 1 === 0
                  ? adjustedQuantity.toString()
                  : adjustedQuantity.toFixed(2).replace(/\.?0+$/, "")
                : null;

              return (
                <View key={index} style={styles.ingredientItem}>
                  <Text type="body">
                    {formattedQuantity && (
                      <Text type="heading" style={styles.ingredientQuantity}>
                        {formattedQuantity}
                      </Text>
                    )}
                    {item.unit && (
                      <Text type="heading" style={styles.ingredientQuantity}>
                        {formattedQuantity ? " " : ""}
                        {item.unit}
                      </Text>
                    )}
                    {(formattedQuantity || item.unit) && " "}
                    {item.name}
                  </Text>
                </View>
              );
            },
          )}
        </View>
      );
    } else {
      return (
        <View style={styles.tabContent}>
          {recipe.instructions.map(
            (
              item: {
                index: number;
                instruction: string;
                imageUrl?: string | null;
              },
              index: number,
            ) => (
              <View key={index} style={styles.instructionItem}>
                <View style={styles.stepNumber}>
                  <Text type="highlight" style={styles.stepNumberText}>
                    {item.index + 1}
                  </Text>
                </View>
                <HSpace size={12} />
                <View style={styles.instructionTextContainer}>
                  <Text type="body">{item.instruction}</Text>
                  {item.imageUrl && (
                    <>
                      <VSpace size={12} />
                      <TouchableOpacity
                        onPress={() => setExpandedImageUrl(item.imageUrl!)}
                        style={styles.stepImageThumbnail}
                      >
                        <Image
                          source={{ uri: item.imageUrl }}
                          style={styles.stepImage}
                          contentFit="cover"
                        />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            ),
          )}
        </View>
      );
    }
  };

  return (
    <View style={styles.screen}>
      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Image Carousel or Header */}
        <View style={[styles.imageCarousel, styles.imageHeader]}>
          {recipe.images && recipe.images.length > 0 && (
            <FlatList
              data={recipe.images}
              renderItem={renderImage}
              keyExtractor={(item) => item.id.toString()}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={styles.imageCarousel}
              bounces={false}
            />
          )}
          <LinearGradient
            colors={["rgba(0,0,0,0.0)", "rgba(0,0,0,1)"]}
            style={styles.gradient}
            pointerEvents="none"
          />
          <View style={styles.imageOverlay}>
            <Text type="title1" style={styles.recipeName}>
              {recipe.name}
            </Text>
            <VSpace size={8} />
            <View style={styles.timeInfo}>
              {recipe.prepTime && (
                <Text type="body" style={styles.timeText}>
                  Prep: {formatMinutes(recipe.prepTime)}
                </Text>
              )}
              {recipe.cookTime && (
                <>
                  <HSpace size={16} />
                  <Text type="body" style={styles.timeText}>
                    Cook: {formatMinutes(recipe.cookTime)}
                  </Text>
                </>
              )}
            </View>
          </View>
        </View>
        {/* Back Button */}
        <View style={styles.backButtonContainer}>
          <BackButton />
        </View>
        <VSpace size={20} />

        <View style={styles.padded}>
          {renderUserInfo()}
          <VSpace size={24} />

          {renderControls()}
          <VSpace size={24} />

          {renderTabs()}
          {renderTabContent()}

          <VSpace size={40} />
        </View>
      </ScrollView>

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
                source={{ uri: expandedImageUrl }}
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
  imageHeader: {
    justifyContent: "flex-end",
  },
  imageCarousel: {
    height: IMAGE_HEIGHT,
  },
  gradient: {
    position: "absolute",
    top: IMAGE_HEIGHT / 2,
    left: 0,
    right: 0,
    bottom: 0,
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: IMAGE_HEIGHT,
    position: "relative",
  },
  recipeImage: {
    width: "100%",
    height: "100%",
    backgroundColor: theme.colors.border,
  },

  imageOverlay: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
  },
  padded: { paddingHorizontal: 20 },
  recipeName: {
    color: "white",
  },
  timeInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  timeText: {
    color: "white",
    opacity: 0.9,
  },
  backButtonContainer: {
    position: "absolute",
    top: 50,
    left: 20,
    zIndex: 10,
  },
  content: {
    flex: 1,
  },
  userSection: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 50,
    height: 50,
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.primary + "20",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 20,
    color: theme.colors.primary,
  },
  recipeCount: {
    fontSize: 14,
    marginTop: 2,
  },
  controlsSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  leftControls: {
    flex: 1,
  },
  rightControls: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  iconButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  iconButtonIcon: {
    color: theme.colors.text,
  },
  iMadeThisButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 22,
  },
  iMadeThisIcon: {
    color: theme.colors.buttonText,
  },
  iMadeThisText: {
    color: theme.colors.buttonText,
    fontSize: 14,
    fontWeight: "600",
  },
  importButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 22,
    minWidth: 140,
    justifyContent: "center",
  },
  importIcon: {
    color: theme.colors.buttonText,
  },
  importText: {
    color: theme.colors.buttonText,
    fontSize: 14,
    fontWeight: "600",
  },
  attributionSection: {
    paddingVertical: 12,
  },
  attributionText: {
    fontSize: 14,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  servingsLabel: {
    fontSize: 14,
  },
  servingsButtons: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: theme.borderRadius.small,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
  },
  servingsButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.background,
  },
  servingsButtonText: {
    fontSize: 18,
  },
  servingsDisplay: {
    width: 60,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  servingsNumber: {
    fontSize: 16,
  },
  tabsContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: "center",
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.primary,
  },
  tabContent: {
    paddingTop: 20,
  },
  ingredientItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border + "30",
  },
  ingredientQuantity: {
    fontFamily: theme.fonts.albertBold,
  },
  instructionItem: {
    flexDirection: "row",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border + "30",
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  stepNumberText: {
    color: "white",
    fontSize: 14,
    fontFamily: theme.fonts.albertBold,
  },
  instructionTextContainer: {
    flex: 1,
    paddingTop: 2,
  },
  stepImageThumbnail: {
    width: 120,
    height: 90,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  stepImage: {
    width: "100%",
    height: "100%",
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
    padding: 8,
  },
  expandedImage: {
    width: "90%",
    height: "80%",
  },
}));
