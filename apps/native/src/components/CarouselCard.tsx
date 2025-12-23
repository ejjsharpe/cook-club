import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { memo } from "react";
import { View, TouchableOpacity, Dimensions } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeIn,
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
  index?: number;
}

const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = Math.round(SCREEN_WIDTH * 0.4);
const IMAGE_SIZE = CARD_WIDTH;

export const CarouselCard = memo(({ recipe, onPress, index = 0 }: Props) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const displayTags = recipe.tags.slice(0, 2);

  return (
    <Animated.View entering={FadeIn.delay(index * 50).duration(300)}>
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
              priority="normal"
              transition={200}
            />
          ) : (
            <View style={[styles.image, styles.placeholderImage]}>
              <Ionicons
                name="restaurant"
                size={40}
                style={styles.placeholderIcon}
              />
            </View>
          )}
        </View>
        <VSpace size={8} />
        <Text type="heading" numberOfLines={2}>
          {recipe.name}
        </Text>
        {recipe.totalTime && (
          <>
            <VSpace size={4} />
            <View style={styles.timeContainer}>
              <Ionicons name="time-outline" size={15} style={styles.timeIcon} />
              <HSpace size={4} />
              <Text type="caption">{recipe.totalTime}</Text>
            </View>
          </>
        )}
        {/* {displayTags.length > 0 && (
          <>
            <VSpace size={4} />
            <Text type="bodyFaded" style={styles.tags} numberOfLines={1}>
              {displayTags.map((tag) => tag.name).join(" · ")}
            </Text>
          </>
        )} */}
      </AnimatedTouchableOpacity>
    </Animated.View>
  );
});

export { CARD_WIDTH };

const styles = StyleSheet.create((theme) => ({
  card: {
    width: CARD_WIDTH,
  },
  imageContainer: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: theme.borderRadius.medium,
    overflow: "hidden",
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
  timeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  timeIcon: {
    color: theme.colors.primary,
  },
}));
