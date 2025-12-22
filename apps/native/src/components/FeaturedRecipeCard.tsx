import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { memo } from "react";
import { View, TouchableOpacity } from "react-native";
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
          <Text type="heading" style={styles.title} numberOfLines={2}>
            {recipe.name}
          </Text>
          {displayTags.length > 0 && (
            <>
              <VSpace size={4} />
              <Text style={styles.tags} numberOfLines={1}>
                {displayTags.map((tag) => tag.name).join(" · ")}
              </Text>
            </>
          )}
          {recipe.totalTime && (
            <>
              <VSpace size={4} />
              <View style={styles.timeContainer}>
                <Ionicons
                  name="time-outline"
                  size={14}
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
  title: {
    color: theme.colors.buttonText,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  tags: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    fontFamily: theme.fonts.albertRegular,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  timeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  timeIcon: {
    color: "rgba(255,255,255,0.8)",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  timeText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    fontFamily: theme.fonts.albertRegular,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
}));
