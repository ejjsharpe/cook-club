import { memo } from "react";
import { View, ScrollView, TouchableOpacity } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { CarouselCard, CARD_WIDTH } from "./CarouselCard";
import { HSpace, VSpace } from "./Space";
import { Text } from "./Text";

interface Tag {
  id: number;
  name: string;
  type: string;
}

interface Recipe {
  id: number;
  name: string;
  totalTime?: string | null;
  coverImage?: string | null;
  tags: Tag[];
}

interface Props {
  title: string;
  recipes: Recipe[];
  onRecipePress: (recipeId: number) => void;
  onSeeAllPress?: () => void;
}

export const RecipeCarousel = memo(
  ({ title, recipes, onRecipePress, onSeeAllPress }: Props) => {
    if (recipes.length === 0) {
      return null;
    }

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text type="heading">{title}</Text>
          {onSeeAllPress && (
            <TouchableOpacity onPress={onSeeAllPress} activeOpacity={0.7}>
              <Text type="highlight" style={styles.seeAll}>
                See all
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <VSpace size={12} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          decelerationRate="fast"
          snapToInterval={CARD_WIDTH + 12}
          snapToAlignment="start"
        >
          {recipes.map((recipe, index) => (
            <View key={recipe.id} style={styles.cardWrapper}>
              <CarouselCard
                recipe={recipe}
                onPress={() => onRecipePress(recipe.id)}
                index={index}
              />
              {index < recipes.length - 1 && <HSpace size={12} />}
            </View>
          ))}
        </ScrollView>
      </View>
    );
  },
);

const styles = StyleSheet.create((theme) => ({
  container: {
    // No horizontal padding - handled by contentContainerStyle
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  seeAll: {
    fontSize: 14,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  cardWrapper: {
    flexDirection: "row",
  },
}));
