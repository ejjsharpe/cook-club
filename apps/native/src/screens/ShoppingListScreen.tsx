import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { getAisleOrder } from "@repo/shared";
import { Image } from "expo-image";
import { useState, useMemo } from "react";
import {
  View,
  SectionList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Alert,
} from "react-native";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

import {
  useGetShoppingList,
  useToggleItemChecked,
  useRemoveItem,
  useClearCheckedItems,
  useRemoveRecipeFromList,
  useAddManualItem,
} from "@/api/shopping";
import { FLOATING_TAB_BAR_HEIGHT } from "@/components/FloatingTabBar";
import { SafeAreaView } from "@/components/SafeAreaView";
import { ScreenHeader } from "@/components/ScreenHeader";
import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";

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

export const ShoppingListScreen = () => {
  const navigation = useNavigation();
  const insets = UnistylesRuntime.insets;
  const [manualItemText, setManualItemText] = useState("");

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

  const renderRecipeChip = ({ item }: { item: Recipe }) => (
    <TouchableOpacity
      style={styles.recipeChip}
      onPress={() => handleRecipePress(item.id)}
      activeOpacity={0.7}
    >
      {item.imageUrl ? (
        <Image
          source={{ uri: item.imageUrl }}
          style={styles.recipeChipImage}
          contentFit="cover"
        />
      ) : (
        <View
          style={[styles.recipeChipImage, styles.recipeChipImagePlaceholder]}
        >
          <Ionicons
            name="image-outline"
            size={20}
            style={styles.placeholderIcon}
          />
        </View>
      )}
      <Text style={styles.recipeChipText} numberOfLines={1}>
        {item.name}
      </Text>
      <TouchableOpacity
        style={styles.recipeChipRemove}
        onPress={(e) => {
          e.stopPropagation();
          handleRemoveRecipe(item.id, item.name);
        }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="close-circle" size={20} style={styles.removeIcon} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderRightActions = (itemId: number) => {
    return (
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => handleRemoveItem(itemId)}
      >
        <Ionicons name="trash" size={24} color="#fff" />
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }: { item: ShoppingListItem }) => (
    <Swipeable renderRightActions={() => renderRightActions(item.id)}>
      <TouchableOpacity
        style={[styles.itemRow, item.isChecked && styles.itemRowChecked]}
        onPress={() => handleToggleCheck(item.id)}
        activeOpacity={0.7}
      >
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
      </TouchableOpacity>
    </Swipeable>
  );

  const renderSectionHeader = ({ section }: { section: Section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
    </View>
  );

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      );
    }

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

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScreenHeader title="Shopping List" style={styles.header}>
          {checkedCount > 0 && (
            <>
              <VSpace size={16} />
              <TouchableOpacity
                onPress={handleClearChecked}
                style={styles.clearButton}
                disabled={clearMutation.isPending}
              >
                <Text style={styles.clearButtonText}>
                  Clear ({checkedCount})
                </Text>
              </TouchableOpacity>
            </>
          )}
          <VSpace size={16} />
        </ScreenHeader>

        {/* Recipe Chips */}
        {recipes.length > 0 && (
          <View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recipeChipsContainer}
            >
              {recipes.map((recipe: Recipe) => (
                <View key={recipe.id}>
                  {renderRecipeChip({ item: recipe })}
                </View>
              ))}
            </ScrollView>
            <VSpace size={12} />
          </View>
        )}

        {/* Shopping List Items */}
        <SectionList
          sections={sections}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={(item) => item.id.toString()}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: INPUT_SECTION_HEIGHT + insets.bottom },
            sections.length === 0 && styles.emptyListContent,
          ]}
        />
      </SafeAreaView>
      {/* Bottom Input - sticks to keyboard */}
      <KeyboardStickyView
        style={[
          styles.inputSection,
          { paddingBottom: FLOATING_TAB_BAR_HEIGHT + insets.bottom },
        ]}
        offset={{
          closed: 0,
          opened: FLOATING_TAB_BAR_HEIGHT + insets.bottom - 12,
        }}
      >
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
            size={32}
            style={[
              styles.addIcon,
              !manualItemText.trim() && styles.addIconDisabled,
            ]}
          />
        </TouchableOpacity>
      </KeyboardStickyView>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
  },
  header: {
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

  // Recipe Chips
  recipeChipsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 4,
    gap: 10,
  },
  recipeChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 12,
    borderRadius: 14,
    backgroundColor: theme.colors.inputBackground,
    gap: 10,
  },
  recipeChipImage: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  recipeChipImagePlaceholder: {
    backgroundColor: theme.colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderIcon: {
    color: theme.colors.textTertiary,
  },
  recipeChipText: {
    fontSize: 15,
    fontFamily: theme.fonts.albertSemiBold,
  },
  recipeChipRemove: {
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  removeIcon: {
    color: theme.colors.textTertiary,
  },

  // Manual Item Input (positioned at bottom)
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
    height: 50,
    paddingHorizontal: 20,
    borderRadius: 25,
    backgroundColor: theme.colors.inputBackground,
    fontSize: 17,
    fontFamily: theme.fonts.albertRegular,
    color: theme.colors.text,
  },
  inputPlaceholder: {
    color: theme.colors.textTertiary,
  },
  addButton: {
    width: 44,
    height: 44,
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
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
    backgroundColor: theme.colors.background,
  },
  sectionTitle: {
    color: theme.colors.textSecondary,
    textTransform: "uppercase",
    fontSize: 13,
    fontFamily: theme.fonts.albertSemiBold,
    letterSpacing: 0.5,
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
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: theme.colors.background,
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
    color: "#fff",
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
  deleteAction: {
    backgroundColor: "#FF3B30",
    justifyContent: "center",
    alignItems: "center",
    width: 80,
  },
}));
