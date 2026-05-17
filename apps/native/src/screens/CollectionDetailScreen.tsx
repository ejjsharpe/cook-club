import { useRoute, useNavigation } from "@react-navigation/native";
import { useState } from "react";
import {
  View,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

import { useGetCollectionDetail, useDeleteCollection } from "@/api/collection";
import { Ionicons } from "@/components/Ionicons";
import { NavigationHeader } from "@/components/NavigationHeader";
import { RecipeCard } from "@/components/RecipeCard";
import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";

const NAVIGATION_HEADER_HEIGHT = 60;

const ReanimatedScrollView = Animated.createAnimatedComponent(ScrollView);

type CollectionDetailScreenParams = {
  CollectionDetail: {
    collectionId: number;
  };
};

export const CollectionDetailScreen = () => {
  const route = useRoute<CollectionDetailScreenParams>("CollectionDetail");
  const navigation = useNavigation();
  const insets = UnistylesRuntime.insets;
  const { collectionId } = route.params;
  const headerOpacity = useSharedValue(1);
  const headerHidden = useSharedValue(false);

  const {
    data: collection,
    isPending,
    error,
    refetch,
  } = useGetCollectionDetail({ collectionId });

  const deleteCollectionMutation = useDeleteCollection();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const handleDeleteCollection = () => {
    if (!collection) return;

    if (collection.defaultType !== null) {
      Alert.alert("Cannot Delete", "Default collections cannot be deleted.");
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
            deleteCollectionMutation.mutate(
              { collectionId: collection.id },
              {
                onSuccess: () => {
                  // Navigate back to Recipes screen
                  navigation.goBack();
                },
              },
            );
          },
        },
      ],
    );
  };

  const handleScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      const nextHeaderHidden = event.contentOffset.y > 5;
      if (headerHidden.value !== nextHeaderHidden) {
        headerHidden.value = nextHeaderHidden;
        headerOpacity.value = withTiming(nextHeaderHidden ? 0 : 1, {
          duration: 150,
        });
      }
    },
  });

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
  }));

  if (isPending) {
    return (
      <View style={styles.screen}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
        <Animated.View style={styles.fixedHeader}>
          <NavigationHeader title="" />
        </Animated.View>
      </View>
    );
  }

  if (error || !collection) {
    return (
      <View style={styles.screen}>
        <View style={styles.centered}>
          <Text type="bodyFaded">Failed to load collection</Text>
        </View>
        <Animated.View style={styles.fixedHeader}>
          <NavigationHeader title="" />
        </Animated.View>
      </View>
    );
  }

  const deleteButton =
    collection.defaultType === null ? (
      <TouchableOpacity
        onPress={handleDeleteCollection}
        style={styles.deleteButton}
      >
        <Ionicons name="trash-outline" size={22} color="#ff3b30" />
      </TouchableOpacity>
    ) : undefined;

  return (
    <View style={styles.screen}>
      <ReanimatedScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + NAVIGATION_HEADER_HEIGHT,
            paddingBottom: insets.bottom + 40,
          },
        ]}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.recipeCount}>
          <Text type="bodyFaded">
            {collection.recipeCount}{" "}
            {collection.recipeCount === 1 ? "recipe" : "recipes"}
          </Text>
        </View>

        <VSpace size={16} />

        {collection.recipes.length === 0 ? (
          <View style={styles.emptyState}>
            <Text type="bodyFaded">No recipes in this collection yet</Text>
          </View>
        ) : (
          <>
            {collection.recipes.map((recipe, index) => (
              <View key={recipe.id}>
                <RecipeCard
                  recipe={
                    {
                      ...recipe,
                      totalTime: recipe.cookTime,
                      isLiked: false,
                      likeCount: 0,
                      isInShoppingList: false,
                      updatedAt: new Date().toISOString(),
                      description: null,
                      prepTime: null,
                      nutrition: null,
                      owner: {
                        id: "current-user",
                        name: "You",
                        email: "",
                        image: null,
                      },
                    } as any
                  }
                  onPress={() =>
                    navigation.navigate("RecipeDetail", { recipeId: recipe.id })
                  }
                />
                {index < collection.recipes.length - 1 && <VSpace size={16} />}
              </View>
            ))}
          </>
        )}
        <VSpace size={40} />
      </ReanimatedScrollView>
      <Animated.View style={[styles.fixedHeader, headerAnimatedStyle]}>
        <NavigationHeader title={collection.name} rightElement={deleteButton} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create((theme, rt) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  fixedHeader: {
    position: "absolute",
    top: rt.insets.top,
    left: rt.insets.left,
    right: rt.insets.right,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  recipeCount: {
    paddingHorizontal: 20,
  },
  deleteButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.inputBackground,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyState: {
    paddingVertical: 60,
    paddingHorizontal: 20,
    alignItems: "center",
  },
}));
