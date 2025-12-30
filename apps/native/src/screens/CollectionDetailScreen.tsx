import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import { useState } from "react";
import {
  View,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "@/components/SafeAreaView";
import { StyleSheet } from "react-native-unistyles";

import { useGetCollectionDetail, useDeleteCollection } from "@/api/collection";
import { RecipeCard } from "@/components/RecipeCard";
import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";
import { BackButton } from "@/components/buttons/BackButton";

type CollectionDetailScreenParams = {
  CollectionDetail: {
    collectionId: number;
  };
};

type CollectionDetailScreenRouteProp = RouteProp<
  CollectionDetailScreenParams,
  "CollectionDetail"
>;

export const CollectionDetailScreen = () => {
  const route = useRoute<CollectionDetailScreenRouteProp>();
  const navigation = useNavigation();
  const { collectionId } = route.params;

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
            deleteCollectionMutation.mutate(
              { collectionId: collection.id },
              {
                onSuccess: () => {
                  // Navigate back to My Recipes screen
                  navigation.goBack();
                },
              },
            );
          },
        },
      ],
    );
  };

  if (isPending) {
    return (
      <SafeAreaView style={styles.container}>
        <BackButton />
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !collection) {
    return (
      <SafeAreaView style={styles.container}>
        <BackButton />
        <View style={styles.centered}>
          <Text type="bodyFaded">Failed to load collection</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.backButtonContainer}>
        <BackButton />
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <VSpace size={28} />
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerText}>
              <Text type="title2">{collection.name}</Text>
              <VSpace size={4} />
              <Text type="bodyFaded">
                {collection.recipeCount}{" "}
                {collection.recipeCount === 1 ? "recipe" : "recipes"}
              </Text>
            </View>
            {!collection.isDefault && (
              <TouchableOpacity
                onPress={handleDeleteCollection}
                style={styles.deleteButton}
              >
                <Ionicons name="trash-outline" size={24} color="#ff3b30" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <VSpace size={24} />

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
                      coverImage: null,
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
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
  },
  backButtonContainer: {
    position: "absolute",
    top: 60,
    left: 20,
    zIndex: 10,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    paddingHorizontal: 20,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerText: {
    flex: 1,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 12,
  },
  emptyState: {
    paddingVertical: 60,
    paddingHorizontal: 20,
    alignItems: "center",
  },
}));
