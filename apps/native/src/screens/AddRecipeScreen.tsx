import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { View, TouchableOpacity, ScrollView } from "react-native";
import { SheetManager } from "react-native-actions-sheet";
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

import { SafeAreaView } from "@/components/SafeAreaView";
import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

const SCROLL_THRESHOLD = 50;

const OptionCard = ({
  icon,
  title,
  description,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
}) => (
  <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
    <View style={styles.iconContainer}>
      <Ionicons name={icon} size={24} style={styles.icon} />
    </View>
    <View style={styles.cardContent}>
      <Text type="headline">{title}</Text>
      <Text type="subheadline" style={styles.cardDescription}>
        {description}
      </Text>
    </View>
    <Ionicons name="chevron-forward" size={20} style={styles.chevron} />
  </TouchableOpacity>
);

export const AddRecipeScreen = () => {
  const { navigate } = useNavigation();
  const insets = UnistylesRuntime.insets;
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const largeTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [0, SCROLL_THRESHOLD],
      [1, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [0, SCROLL_THRESHOLD],
          [0, -10],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const headerTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [SCROLL_THRESHOLD - 20, SCROLL_THRESHOLD],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const handleRecipeParsed = (
    result: ReactNavigation.RootParamList["EditRecipe"]["parsedRecipe"],
  ) => {
    navigate("EditRecipe", { parsedRecipe: result });
  };

  const onPressImport = () => {
    SheetManager.show("import-recipe-sheet", {
      payload: { onRecipeParsed: handleRecipeParsed },
    });
  };

  const onPressCreate = () => {
    navigate("EditRecipe", {});
  };

  const onPressGenerate = () => {
    navigate("GenerateRecipe", {});
  };

  return (
    <View style={styles.screen}>
      {/* Fixed Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerContent}>
          <Animated.Text style={[styles.headerTitle, headerTitleStyle]}>
            Add a recipe
          </Animated.Text>
        </View>
      </View>

      <AnimatedScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 44 },
        ]}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Animated.View style={largeTitleStyle}>
          <Text type="title1">Add a recipe</Text>
        </Animated.View>

        <VSpace size={28} />

        <OptionCard
          icon="download-outline"
          title="Import recipe"
          description="Import from a URL, paste recipe text, or scan an image using AI"
          onPress={onPressImport}
        />

        <VSpace size={12} />

        <OptionCard
          icon="create-outline"
          title="Create from scratch"
          description="Start with a blank canvas and build your own unique recipe"
          onPress={onPressCreate}
        />

        <VSpace size={12} />

        <OptionCard
          icon="sparkles-outline"
          title="Generate with AI"
          description="Tell me what you have, and I'll create a recipe just for you"
          onPress={onPressGenerate}
        />

        <VSpace size={40} />
      </AnimatedScrollView>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: theme.colors.background,
  },
  headerContent: {
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: theme.fonts.albertSemiBold,
    color: theme.colors.text,
  },
  scrollView: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 20,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.borderRadius.large,
    padding: 16,
    gap: 14,
    minHeight: 88,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary + "20",
    justifyContent: "center",
    alignItems: "center",
  },
  icon: {
    color: theme.colors.primary,
  },
  cardContent: {
    flex: 1,
    gap: 4,
  },
  cardDescription: {
    color: theme.colors.textSecondary,
  },
  chevron: {
    color: theme.colors.textTertiary,
  },
}));
