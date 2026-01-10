import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { getAisleOrder } from "@repo/shared";
import { Image } from "expo-image";
import { useMemo, useCallback, useState } from "react";
import {
  View,
  SectionList,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from "react-native";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import {
  KeyboardStickyView,
  useReanimatedKeyboardAnimation,
} from "react-native-keyboard-controller";
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  useAnimatedReaction,
  interpolate,
  interpolateColor,
  Extrapolation,
  LinearTransition,
  type SharedValue,
} from "react-native-reanimated";
import {
  useUnistyles,
  StyleSheet,
  UnistylesRuntime,
} from "react-native-unistyles";

import {
  useGetShoppingList,
  useToggleItemChecked,
  useRemoveItem,
  useClearCheckedItems,
  useRemoveRecipeFromList,
  useAddManualItem,
} from "@/api/shopping";
import { FLOATING_TAB_BAR_HEIGHT } from "@/components/FloatingTabBar";
import { ShoppingListSkeleton, SkeletonContainer } from "@/components/Skeleton";
import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";
import { useTabBar, useTabBarScroll } from "@/lib/tabBarContext";

interface ShoppingListItem {
  id: number;
  ingredientName: string;
  quantity: number;
  unit: string | null;
  displayText: string;
  isChecked: boolean;
  aisle: string;
  sourceItems: {
    id: number;
    quantity: number | null;
    sourceRecipeId: number | null;
    sourceRecipeName: string | null;
  }[];
}

interface Section {
  title: string;
  data: ShoppingListItem[];
}

interface Recipe {
  id: number;
  name: string;
  imageUrl: string | null;
}

const INPUT_SECTION_HEIGHT = 68;

interface SwipeableItemProps {
  item: ShoppingListItem;
  onToggle: (id: number) => void;
  onRemove: (id: number) => void;
}

const DeleteAction = ({
  swipeProgress,
  onRemove,
}: {
  swipeProgress: SharedValue<number>;
  onRemove: () => void;
}) => {
  const deleteButtonStyle = useAnimatedStyle(() => {
    const scale = interpolate(swipeProgress.value, [0.5, 0.7, 1], [0, 0.8, 1], {
      extrapolateLeft: Extrapolation.CLAMP,
      extrapolateRight: Extrapolation.CLAMP,
    });
    return {
      transform: [{ scale }],
      opacity: interpolate(swipeProgress.value, [0.5, 0.6], [0, 1], {
        extrapolateLeft: Extrapolation.CLAMP,
        extrapolateRight: Extrapolation.CLAMP,
      }),
    };
  });

  return (
    <View style={styles.deleteActionContainer}>
      <Animated.View style={deleteButtonStyle}>
        <TouchableOpacity style={styles.deleteActionPill} onPress={onRemove}>
          <Ionicons name="trash" size={20} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const ItemContent = ({
  item,
  swipeProgress,
  onToggle,
}: {
  item: ShoppingListItem;
  swipeProgress: SharedValue<number>;
  onToggle: () => void;
}) => {
  const { theme } = useUnistyles();

  const backgroundStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      swipeProgress.value,
      [0, 1],
      ["transparent", theme.colors.inputBackground],
    ),
  }));

  return (
    <TouchableOpacity
      style={[styles.itemRowOuter, item.isChecked && styles.itemRowChecked]}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <Animated.View style={[styles.itemRowInner, backgroundStyle]}>
        <View
          style={[styles.checkbox, item.isChecked && styles.checkboxChecked]}
        >
          {item.isChecked && (
            <Ionicons name="checkmark" size={18} style={styles.checkIcon} />
          )}
        </View>
        <View style={styles.itemContent}>
          <Text
            style={[styles.itemText, item.isChecked && styles.itemTextChecked]}
          >
            {item.displayText}
          </Text>
          {item.sourceItems.length > 0 &&
            item.sourceItems.some((si) => si.sourceRecipeName) && (
              <Text style={styles.recipeTag}>
                from{" "}
                {item.sourceItems
                  .filter((si) => si.sourceRecipeName)
                  .map((si) => si.sourceRecipeName)
                  .join(", ")}
              </Text>
            )}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

const ProgressSyncer = ({
  source,
  target,
}: {
  source: SharedValue<number>;
  target: SharedValue<number>;
}) => {
  useAnimatedReaction(
    () => source.value,
    (value) => {
      target.value = value;
    },
  );
  return null;
};

const SwipeableItem = ({ item, onToggle, onRemove }: SwipeableItemProps) => {
  const swipeProgress = useSharedValue(0);

  const renderRightActions = useCallback(
    (progress: SharedValue<number>) => (
      <>
        <ProgressSyncer source={progress} target={swipeProgress} />
        <DeleteAction
          swipeProgress={progress}
          onRemove={() => onRemove(item.id)}
        />
      </>
    ),
    [item.id, onRemove, swipeProgress],
  );

  return (
    <Animated.View layout={LinearTransition}>
      <Swipeable
        renderRightActions={renderRightActions}
        overshootRight
        overshootLeft
        friction={2}
      >
        <ItemContent
          item={item}
          swipeProgress={swipeProgress}
          onToggle={() => onToggle(item.id)}
        />
      </Swipeable>
    </Animated.View>
  );
};

const SectionCheck = ({ isComplete }: { isComplete: boolean }) => {
  const scale = useSharedValue(isComplete ? 1 : 0);

  useAnimatedReaction(
    () => isComplete,
    (current, previous) => {
      if (current !== previous) {
        scale.value = withSpring(current ? 1 : 0, {
          damping: 12,
          stiffness: 300,
          mass: 1,
        });
      }
    },
    [isComplete],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: scale.value,
  }));

  return (
    <Animated.View style={[styles.sectionCheck, animatedStyle]}>
      <Ionicons name="checkmark" size={14} style={styles.sectionCheckIcon} />
    </Animated.View>
  );
};

export const ShoppingListScreen = () => {
  const navigation = useNavigation();
  const insets = UnistylesRuntime.insets;
  const { isVisible } = useTabBar();
  const { onScroll: onTabBarScroll } = useTabBarScroll();
  const [manualItemText, setManualItemText] = useState("");
  const { progress: keyboardswipeProgress } = useReanimatedKeyboardAnimation();

  const inputPaddingAnimatedStyle = useAnimatedStyle(() => {
    // When keyboard is open, no extra padding needed (keyboard covers tab bar)
    const isKeyboardOpen = keyboardswipeProgress.value > 0;
    if (isKeyboardOpen) {
      return { paddingBottom: 0 };
    }

    // When keyboard is closed, add padding for tab bar
    return {
      paddingBottom: withSpring(
        isVisible.value === 1
          ? FLOATING_TAB_BAR_HEIGHT + insets.bottom
          : insets.bottom + 16,
        { damping: 50, stiffness: 400, mass: 3 },
      ),
    };
  });

  const { data, isLoading, error } = useGetShoppingList();
  const toggleMutation = useToggleItemChecked();
  const removeMutation = useRemoveItem();
  const clearMutation = useClearCheckedItems();
  const removeRecipeMutation = useRemoveRecipeFromList();
  const addManualMutation = useAddManualItem();

  const items = data?.items || [];
  const recipes = data?.recipes || [];
  const checkedCount = items.filter(
    (item: ShoppingListItem) => item.isChecked,
  ).length;

  // Group items by aisle for SectionList
  const sections = useMemo((): Section[] => {
    if (!items.length) return [];

    // Group by aisle
    const groups = new Map<string, ShoppingListItem[]>();
    for (const item of items) {
      const aisle = item.aisle || "Other";
      const existing = groups.get(aisle) || [];
      existing.push(item);
      groups.set(aisle, existing);
    }

    // Convert to SectionList format, ordered by aisle order
    return Array.from(groups.entries())
      .sort((a, b) => getAisleOrder(a[0] as any) - getAisleOrder(b[0] as any))
      .map(([aisle, data]) => ({
        title: aisle,
        data,
      }));
  }, [items]);

  const handleToggleCheck = (itemId: number) => {
    toggleMutation.mutate({ itemId });
  };

  const handleRemoveItem = (itemId: number) => {
    removeMutation.mutate({ itemId });
  };

  const handleClearChecked = () => {
    if (checkedCount === 0) return;

    Alert.alert(
      "Clear Checked Items",
      `Remove ${checkedCount} checked item${checkedCount > 1 ? "s" : ""}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => clearMutation.mutate(),
        },
      ],
    );
  };

  const handleRemoveRecipe = (recipeId: number, recipeName: string) => {
    Alert.alert(
      "Remove Recipe",
      `Remove all ingredients from "${recipeName}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => removeRecipeMutation.mutate({ recipeId }),
        },
      ],
    );
  };

  const handleAddManualItem = () => {
    if (!manualItemText.trim()) return;

    addManualMutation.mutate(
      { ingredientText: manualItemText.trim() },
      {
        onSuccess: () => {
          setManualItemText("");
        },
      },
    );
  };

  const handleRecipePress = (recipeId: number) => {
    navigation.navigate("RecipeDetail", { recipeId });
  };

  const handleAddRecipePress = () => {
    navigation.navigate("AddRecipeToShoppingList");
  };

  const renderRecipeCard = ({ item }: { item: Recipe }) => (
    <TouchableOpacity
      style={styles.recipeCard}
      onPress={() => handleRecipePress(item.id)}
      activeOpacity={0.7}
    >
      <View style={styles.recipeCardImageContainer}>
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.recipeCardImage}
            contentFit="cover"
          />
        ) : (
          <View
            style={[styles.recipeCardImage, styles.recipeCardImagePlaceholder]}
          >
            <Ionicons
              name="restaurant-outline"
              size={32}
              style={styles.placeholderIcon}
            />
          </View>
        )}
        <TouchableOpacity
          style={styles.recipeCardRemove}
          onPress={(e) => {
            e.stopPropagation();
            handleRemoveRecipe(item.id, item.name);
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <View style={styles.removeButtonBackground}>
            <Ionicons name="close" size={14} style={styles.removeButtonIcon} />
          </View>
        </TouchableOpacity>
      </View>
      <Text style={styles.recipeCardText} numberOfLines={2}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  const renderAddRecipeCard = () => (
    <TouchableOpacity
      style={styles.addRecipeCard}
      onPress={handleAddRecipePress}
      activeOpacity={0.7}
    >
      <View style={styles.addRecipeImagePlaceholder}>
        <Ionicons name="add" size={36} style={styles.addRecipeIcon} />
      </View>
      <Text style={styles.addRecipeText}>Add Recipe</Text>
    </TouchableOpacity>
  );

  const renderItem = ({ item }: { item: ShoppingListItem }) => (
    <SwipeableItem
      item={item}
      onToggle={handleToggleCheck}
      onRemove={handleRemoveItem}
    />
  );

  const renderSectionHeader = ({ section }: { section: Section }) => {
    const allChecked =
      section.data.length > 0 && section.data.every((item) => item.isChecked);

    return (
      <Animated.View layout={LinearTransition} style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <SectionCheck isComplete={allChecked} />
      </Animated.View>
    );
  };

  const renderEmpty = () => {
    if (error) {
      return (
        <View style={styles.centered}>
          <Text type="bodyFaded">Failed to load shopping list</Text>
        </View>
      );
    }

    return (
      <View style={styles.centered}>
        <Ionicons name="cart-outline" size={64} style={styles.emptyIcon} />
        <VSpace size={16} />
        <Text type="title3" style={styles.emptyTitle}>
          Your shopping list is empty
        </Text>
        <VSpace size={8} />
        <Text type="subheadline" style={styles.emptySubtitle}>
          Add ingredients from any recipe to get started
        </Text>
      </View>
    );
  };

  const listHeaderComponent = (
    <View style={{ paddingTop: insets.top }}>
      <VSpace size={32} />
      {/* Title */}
      <View style={styles.largeTitleContainer}>
        <Text type="title1">Shopping List</Text>
        {checkedCount > 0 && (
          <TouchableOpacity
            onPress={handleClearChecked}
            style={styles.clearButton}
            disabled={clearMutation.isPending}
          >
            <Text style={styles.clearButtonText}>Clear ({checkedCount})</Text>
          </TouchableOpacity>
        )}
      </View>
      <VSpace size={16} />
      {/* Recipe Cards Carousel */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.recipeCardsContainer}
      >
        {recipes.map((recipe: Recipe) => (
          <View key={recipe.id}>{renderRecipeCard({ item: recipe })}</View>
        ))}
        {renderAddRecipeCard()}
      </ScrollView>
      <VSpace size={8} />
    </View>
  );

  return (
    <View style={styles.screen}>
      {/* Shopping List Items */}
      <SkeletonContainer
        isLoading={isLoading}
        skeleton={
          <SectionList
            sections={[]}
            renderItem={() => null}
            ListHeaderComponent={listHeaderComponent}
            ListEmptyComponent={ShoppingListSkeleton}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: INPUT_SECTION_HEIGHT + insets.bottom },
            ]}
          />
        }
      >
        <SectionList
          sections={sections}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={(item) => item.id.toString()}
          ListHeaderComponent={listHeaderComponent}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: INPUT_SECTION_HEIGHT + insets.bottom },
            sections.length === 0 && styles.emptyListContent,
          ]}
          onScroll={onTabBarScroll}
          scrollEventThrottle={16}
        />
      </SkeletonContainer>
      {/* Bottom Input - sticks to keyboard */}
      <KeyboardStickyView
        style={styles.inputWrapper}
        offset={{
          closed: 0,
          opened: -12,
        }}
      >
        <Animated.View style={[styles.inputSection, inputPaddingAnimatedStyle]}>
          <TextInput
            style={styles.input}
            placeholder="Add item (e.g., 2 cups milk)"
            value={manualItemText}
            onChangeText={setManualItemText}
            onSubmitEditing={handleAddManualItem}
            returnKeyType="done"
            autoCapitalize="none"
            placeholderTextColor={styles.inputPlaceholder.color}
          />
          <TouchableOpacity
            style={[
              styles.addButton,
              !manualItemText.trim() && styles.addButtonDisabled,
            ]}
            onPress={handleAddManualItem}
            disabled={!manualItemText.trim() || addManualMutation.isPending}
          >
            <Ionicons
              name="add-circle"
              size={50}
              style={[
                styles.addIcon,
                !manualItemText.trim() && styles.addIconDisabled,
              ]}
            />
          </TouchableOpacity>
        </Animated.View>
      </KeyboardStickyView>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  largeTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  clearButton: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: theme.colors.secondaryButtonBackground,
    justifyContent: "center",
    alignItems: "center",
  },
  clearButtonText: {
    color: theme.colors.primary,
    fontSize: 15,
    fontFamily: theme.fonts.albertSemiBold,
  },

  // Recipe Cards Carousel
  recipeCardsContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 12,
  },
  recipeCard: {
    width: 110,
    overflow: "visible",
  },
  recipeCardImageContainer: {
    position: "relative",
  },
  recipeCardImage: {
    width: 110,
    height: 110,
    borderRadius: theme.borderRadius.large,
  },
  recipeCardImagePlaceholder: {
    backgroundColor: theme.colors.inputBackground,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderIcon: {
    color: theme.colors.textTertiary,
  },
  recipeCardText: {
    fontSize: 13,
    fontFamily: theme.fonts.albertMedium,
    color: theme.colors.text,
    marginTop: 8,
    lineHeight: 16,
  },
  recipeCardRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    zIndex: 10,
  },
  removeButtonBackground: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.destructive,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: theme.colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  removeButtonIcon: {
    color: "#fff",
  },
  addRecipeCard: {
    width: 110,
    alignItems: "center",
  },
  addRecipeImagePlaceholder: {
    width: 110,
    height: 110,
    borderRadius: theme.borderRadius.large,
    backgroundColor: theme.colors.inputBackground,
    justifyContent: "center",
    alignItems: "center",
  },
  addRecipeIcon: {
    color: theme.colors.primary,
  },
  addRecipeText: {
    fontSize: 13,
    fontFamily: theme.fonts.albertMedium,
    color: theme.colors.primary,
    marginTop: 8,
  },

  // Manual Item Input (positioned at bottom)
  inputWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  inputBackgroundFill: {
    height: 200,
    backgroundColor: theme.colors.background,
    marginTop: -1,
  },
  inputSection: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    gap: 12,
  },
  input: {
    flex: 1,
    minHeight: 50,
    paddingHorizontal: 20,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.inputBackground,
    fontSize: 17,
    fontFamily: theme.fonts.albertRegular,
    color: theme.colors.text,
  },
  inputPlaceholder: {
    color: theme.colors.textTertiary,
  },
  addButton: {
    width: 50,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  addButtonDisabled: {
    opacity: 0.3,
  },
  addIcon: {
    color: theme.colors.primary,
  },
  addIconDisabled: {
    opacity: 0.3,
  },

  // Section Headers
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    backgroundColor: theme.colors.background,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontFamily: theme.fonts.albertSemiBold,
  },
  sectionCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionCheckIcon: {
    color: theme.colors.buttonText,
  },

  // List Items
  listContent: {
    paddingBottom: 20,
  },
  emptyListContent: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  emptyIcon: {
    color: theme.colors.textTertiary,
  },
  emptyTitle: {
    textAlign: "center",
  },
  emptySubtitle: {
    textAlign: "center",
    color: theme.colors.textSecondary,
  },
  itemRowOuter: {
    paddingHorizontal: 12,
    paddingVertical: 1,
  },
  itemRowInner: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.borderRadius.large,
  },
  itemRowChecked: {
    opacity: 0.5,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  checkboxChecked: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  checkIcon: {
    color: theme.colors.buttonText,
  },
  itemContent: {
    flex: 1,
  },
  itemText: {
    fontSize: 17,
  },
  itemTextChecked: {
    textDecorationLine: "line-through",
  },
  recipeTag: {
    fontSize: 13,
    marginTop: 4,
    color: theme.colors.textSecondary,
  },
  deleteActionContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingRight: 20,
  },
  deleteActionPill: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.destructive,
    justifyContent: "center",
    alignItems: "center",
  },
}));
