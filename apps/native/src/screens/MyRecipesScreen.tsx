import { Ionicons } from "@expo/vector-icons";
import { LegendList } from "@legendapp/list";
import { useNavigation } from "@react-navigation/native";
import { UserCollectionWithMetadata } from "@repo/trpc/client";
import { useState, useMemo, useCallback } from "react";
import { View, ActivityIndicator, Alert, TouchableOpacity } from "react-native";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";

import {
  useGetUserCollectionsWithMetadata,
  useCreateCollection,
  useDeleteCollection,
} from "@/api/collection";
import { useGetUserRecipes } from "@/api/recipe";
import { CollectionCard } from "@/components/CollectionCard";
import { RecipeCard } from "@/components/RecipeCard";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SearchBar } from "@/components/SearchBar";
import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";
import { UnderlineTabBar, type TabOption } from "@/components/UnderlineTabBar";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { useTabSlideAnimation } from "@/hooks/useTabSlideAnimation";

type Recipe = NonNullable<
  ReturnType<typeof useGetUserRecipes>["data"]
>["pages"][number]["items"][number];

type Collection = UserCollectionWithMetadata;

type MyRecipesTab = "recipes" | "collections";

const tabOptions: TabOption<MyRecipesTab>[] = [
  { value: "recipes", label: "Recipes" },
  { value: "collections", label: "Collections" },
];

export const MyRecipesScreen = () => {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<MyRecipesTab>("recipes");
  const [searchQuery, setSearchQuery] = useState("");
  const { animatedStyle: tabContentStyle, triggerSlide } =
    useTabSlideAnimation();

  const handleTabChange = useCallback(
    (tab: MyRecipesTab, direction: number) => {
      triggerSlide(direction);
      setActiveTab(tab);
    },
    [triggerSlide],
  );

  // Fetch recipes
  const {
    data: recipesData,
    fetchNextPage: fetchNextRecipes,
    hasNextPage: hasMoreRecipes,
    isFetchingNextPage: isFetchingNextRecipes,
    isLoading: isLoadingRecipes,
    error: recipesError,
  } = useGetUserRecipes({
    search: searchQuery,
  });

  // Fetch collections
  const {
    data: collectionsData,
    isLoading: isLoadingCollections,
    error: collectionsError,
    refetch: refetchCollections,
  } = useGetUserCollectionsWithMetadata({
    search: searchQuery,
  });

  // Mutations
  const createCollectionMutation = useCreateCollection();
  const deleteCollectionMutation = useDeleteCollection();

  const recipes = useMemo(() => {
    return recipesData?.pages.flatMap((page) => page?.items ?? []) ?? [];
  }, [recipesData]);

  const collections = useMemo(() => {
    return collectionsData ?? [];
  }, [collectionsData]);

  const renderRecipe = ({ item }: { item: Recipe }) => (
    <RecipeCard
      recipe={item}
      onPress={() => navigation.navigate("RecipeDetail", { recipeId: item.id })}
    />
  );

  const RecipeSeparator = () => (
    <View style={styles.separatorContainer}>
      <View style={styles.separator} />
    </View>
  );

  const handleDeleteCollection = (collection: Collection) => {
    if (collection.isDefault) {
      Alert.alert(
        "Cannot Delete",
        "Your default collection cannot be deleted.",
      );
      return;
    }

    Alert.alert(
      "Delete Collection",
      `Are you sure you want to delete "${collection.name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteCollectionMutation.mutate({ collectionId: collection.id });
          },
        },
      ],
    );
  };

  const renderRightActions = (collection: Collection) => {
    // Don't allow swiping on default collection
    if (collection.isDefault) return null;

    return (
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => handleDeleteCollection(collection)}
      >
        <Ionicons name="trash" size={24} color="#fff" />
      </TouchableOpacity>
    );
  };

  const renderCollection = ({ item }: { item: Collection }) => {
    const collection = item;
    const collectionCard = (
      <CollectionCard
        collection={collection}
        onPress={() =>
          navigation.navigate("CollectionDetail", {
            collectionId: collection.id,
          })
        }
        onOwnerPress={() => {}} // Current user, no action needed
      />
    );

    // Wrap with Swipeable if not default collection
    if (!collection.isDefault) {
      return (
        <Swipeable renderRightActions={() => renderRightActions(collection)}>
          {collectionCard}
        </Swipeable>
      );
    }

    return collectionCard;
  };

  const renderFooter = () => {
    if (activeTab === "recipes" && !isFetchingNextRecipes) return null;
    if (activeTab === "recipes") {
      return (
        <View style={styles.footer}>
          <ActivityIndicator />
        </View>
      );
    }
    return null;
  };

  const handleCreateCollection = () => {
    Alert.prompt(
      "New Collection",
      "Enter a name for your collection",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Create",
          onPress: (collectionName?: string) => {
            const trimmedName = collectionName?.trim();
            if (!trimmedName) {
              Alert.alert("Error", "Collection name cannot be empty");
              return;
            }
            createCollectionMutation.mutate({ name: trimmedName });
          },
        },
      ],
      "plain-text",
    );
  };

  const renderEmpty = () => {
    const isLoading =
      activeTab === "recipes" ? isLoadingRecipes : isLoadingCollections;
    const error = activeTab === "recipes" ? recipesError : collectionsError;

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
          <Text type="bodyFaded">
            {activeTab === "recipes"
              ? "Failed to load recipes"
              : "Failed to load collections"}
          </Text>
        </View>
      );
    }

    if (activeTab === "recipes") {
      return (
        <View style={styles.centered}>
          <Text type="bodyFaded">
            {searchQuery
              ? "No recipes found for your search"
              : "No recipes yet"}
          </Text>
        </View>
      );
    }

    // Collections empty state
    return (
      <View style={styles.centered}>
        <Text type="bodyFaded">
          {searchQuery
            ? "No collections found for your search"
            : "No collections yet"}
        </Text>
      </View>
    );
  };

  const handleLoadMore = () => {
    if (activeTab === "recipes" && hasMoreRecipes && !isFetchingNextRecipes) {
      fetchNextRecipes();
    }
  };

  const listData: any[] = activeTab === "recipes" ? recipes : collections;
  const renderItem: any =
    activeTab === "recipes" ? renderRecipe : renderCollection;

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="My Recipes" style={styles.header}>
        <VSpace size={20} />
        <SearchBar
          placeholder={
            activeTab === "recipes"
              ? "Search recipes..."
              : "Search collections..."
          }
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <VSpace size={16} />
        <UnderlineTabBar
          options={tabOptions}
          value={activeTab}
          onValueChange={handleTabChange}
        />
      </ScreenHeader>
      <VSpace size={16} />
      <Animated.View style={[styles.listWrapper, tabContentStyle]}>
        {activeTab === "collections" && (
          <>
            <View style={styles.createButtonContainer}>
              <PrimaryButton
                onPress={handleCreateCollection}
                disabled={createCollectionMutation.isPending}
              >
                Create Collection
              </PrimaryButton>
            </View>
            <VSpace size={12} />
          </>
        )}
        <LegendList
          data={listData}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.listContent]}
          ItemSeparatorComponent={
            activeTab === "recipes"
              ? RecipeSeparator
              : () => <VSpace size={12} />
          }
        />
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
  },
  listWrapper: {
    flex: 1,
  },
  createButtonContainer: {
    paddingHorizontal: 20,
  },
  listContent: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  footer: {
    paddingVertical: 20,
    alignItems: "center",
  },
  deleteAction: {
    backgroundColor: "#ff3b30",
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    height: "100%",
    marginVertical: 4,
    marginRight: 20,
    borderRadius: theme.borderRadius.medium,
  },
  separatorContainer: {
    paddingVertical: 8,
    paddingHorizontal: 28,
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border,
  },
}));
