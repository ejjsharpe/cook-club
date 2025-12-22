import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { memo } from "react";
import { View, TouchableOpacity, ScrollView } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";

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
  recipe: Recipe;
  onPress: () => void;
}

const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);

export const FeaturedRecipeCard = memo(({ recipe, onPress }: Props) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const displayTags = recipe.tags.slice(0, 3);

  return (
    <AnimatedTouchableOpacity
      style={[styles.card, animatedStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      <View style={styles.imageContainer}>
        {recipe.coverImage ? (
          <Image
            source={{ uri: recipe.coverImage }}
            style={styles.image}
            cachePolicy="memory-disk"
            priority="high"
            transition={200}
          />
        ) : (
          <View style={[styles.image, styles.placeholderImage]}>
            <Ionicons
              name="restaurant"
              size={64}
              style={styles.placeholderIcon}
            />
          </View>
        )}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.8)"]}
          style={styles.gradient}
        />
        <View style={styles.overlay}>
          {displayTags.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tagsContainer}
              contentContainerStyle={styles.tagsContent}
            >
              {displayTags.map((tag) => (
                <View key={tag.id} style={styles.tag}>
                  <Text style={styles.tagText}>{tag.name}</Text>
                </View>
              ))}
            </ScrollView>
          )}
          <VSpace size={8} />
          <Text type="title1" style={styles.title} numberOfLines={2}>
            {recipe.name}
          </Text>
          {recipe.totalTime && (
            <>
              <VSpace size={8} />
              <View style={styles.timeContainer}>
                <Ionicons
                  name="time-outline"
                  size={16}
                  style={styles.timeIcon}
                />
                <HSpace size={4} />
                <Text style={styles.timeText}>{recipe.totalTime}</Text>
              </View>
            </>
          )}
        </View>
      </View>
    </AnimatedTouchableOpacity>
  );
});

const styles = StyleSheet.create((theme) => ({
  card: {
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: "hidden",
  },
  imageContainer: {
    position: "relative",
    width: "100%",
    aspectRatio: 4 / 3,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholderImage: {
    backgroundColor: theme.colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderIcon: {
    color: theme.colors.border,
  },
  gradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "70%",
  },
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
  },
  tagsContainer: {
    flexGrow: 0,
  },
  tagsContent: {
    gap: 8,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 12,
  },
  tagText: {
    color: theme.colors.buttonText,
    fontSize: 12,
    fontWeight: "500",
  },
  title: {
    color: theme.colors.buttonText,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  timeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  timeIcon: {
    color: theme.colors.buttonText,
  },
  timeText: {
    color: theme.colors.buttonText,
    fontSize: 14,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
}));
