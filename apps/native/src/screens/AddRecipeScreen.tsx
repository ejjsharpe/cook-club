import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useCallback, useRef } from "react";
import {
  View,
  TouchableOpacity,
  ScrollView,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

import {
  BasicImportSheet,
  type BasicImportSheetRef,
} from "@/components/BasicImportSheet";
import {
  SmartImportSheet,
  type SmartImportSheetRef,
} from "@/components/SmartImportSheet";
import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";

const HEADER_HEIGHT = 52;

const ActionRow = ({
  icon,
  label,
  subtitle,
  onPress,
  disabled,
  featured,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle: string;
  onPress: () => void;
  disabled?: boolean;
  featured?: boolean;
}) => {
  const theme = UnistylesRuntime.getTheme();

  return (
    <TouchableOpacity
      style={[
        styles.row,
        disabled && styles.rowDisabled,
        featured && styles.rowFeatured,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View
        style={[styles.iconContainer, featured && styles.iconContainerFeatured]}
      >
        <Ionicons name={icon} size={24} color={theme.colors.primary} />
      </View>
      <View style={styles.textContainer}>
        <View style={styles.labelRow}>
          <Text type="body">{label}</Text>
          {featured && (
            <View style={styles.badge}>
              <Text type="caption" style={styles.badgeText}>
                Recommended
              </Text>
            </View>
          )}
        </View>
        <Text type="subheadline" style={styles.subtitle}>
          {subtitle}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} style={styles.chevron} />
    </TouchableOpacity>
  );
};

export const AddRecipeScreen = () => {
  const { navigate } = useNavigation();
  const insets = UnistylesRuntime.insets;

  // Sheet refs
  const smartImportSheetRef = useRef<SmartImportSheetRef>(null);
  const basicImportSheetRef = useRef<BasicImportSheetRef>(null);

  // Scroll tracking for header fade
  const titleOpacity = useSharedValue(1);

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
  }));

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      const titleShouldHide = y > 5;
      titleOpacity.value = withTiming(titleShouldHide ? 0 : 1, {
        duration: 150,
      });
    },
    [titleOpacity],
  );

  const handleRecipeParsed = (
    result: ReactNavigation.RootParamList["EditRecipe"]["parsedRecipe"],
  ) => {
    // Navigate to preview mode - user can save directly or edit first
    if (result) {
      navigate("RecipeDetail", { parsedRecipe: result });
    }
  };

  const onPressSmartImport = () => {
    smartImportSheetRef.current?.present();
  };

  const onPressCreate = () => {
    navigate("EditRecipe", {});
  };

  const onPressAIChef = () => {
    navigate("GenerateRecipe", {});
  };

  const onPressBasicImport = () => {
    basicImportSheetRef.current?.present();
  };

  const onPressFridgeSnap = () => {
    navigate("FridgeSnap", {});
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <VSpace size={insets.top + HEADER_HEIGHT + 8} />

        {/* Import Section */}
        <Text style={styles.sectionTitle}>Import</Text>
        <VSpace size={8} />
        <View style={styles.section}>
          <ActionRow
            icon="link"
            label="Basic import"
            subtitle="Import from URL. Works for most recipe websites."
            onPress={onPressBasicImport}
          />
          <View style={styles.separator} />
          <ActionRow
            icon="sparkles"
            label="Smart import"
            subtitle="Import from anywhere including social media using AI."
            onPress={onPressSmartImport}
            featured
          />
        </View>

        <VSpace size={24} />

        {/* AI Section */}
        <Text style={styles.sectionTitle}>AI Tools</Text>
        <VSpace size={8} />
        <View style={styles.section}>
          <ActionRow
            icon="restaurant"
            label="AI Chef"
            subtitle="Describe what you want and AI will create a recipe."
            onPress={onPressAIChef}
          />
          <View style={styles.separator} />
          <ActionRow
            icon="camera"
            label="Fridge Snap"
            subtitle="Take a photo of your fridge and get recipe ideas."
            onPress={onPressFridgeSnap}
          />
        </View>

        <VSpace size={24} />

        {/* Manual Section */}
        <Text style={styles.sectionTitle}>Manual</Text>
        <VSpace size={8} />
        <View style={styles.section}>
          <ActionRow
            icon="create"
            label="Create from scratch"
            subtitle="Build your own recipe step by step."
            onPress={onPressCreate}
          />
        </View>
      </ScrollView>

      {/* Fixed Header */}
      <View style={styles.fixedHeader}>
        <Animated.View style={titleAnimatedStyle}>
          <Text type="screenTitle">Add recipe</Text>
        </Animated.View>
      </View>

      {/* Sheets */}
      <SmartImportSheet
        ref={smartImportSheetRef}
        onRecipeParsed={handleRecipeParsed}
      />
      <BasicImportSheet
        ref={basicImportSheetRef}
        onRecipeParsed={handleRecipeParsed}
      />
    </View>
  );
};

const styles = StyleSheet.create((theme, rt) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  container: {
    paddingBottom: 40,
  },
  fixedHeader: {
    position: "absolute",
    top: rt.insets.top,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontFamily: theme.fonts.semiBold,
    marginLeft: 24,
  },
  section: {
    marginHorizontal: 20,
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.borderRadius.large,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 16,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  rowFeatured: {
    backgroundColor: theme.colors.primary + "10",
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: theme.colors.primary + "15",
    justifyContent: "center",
    alignItems: "center",
  },
  iconContainerFeatured: {
    backgroundColor: theme.colors.primary + "25",
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  badge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.full,
  },
  badgeText: {
    color: "white",
    fontWeight: "600",
  },
  subtitle: {
    color: theme.colors.textSecondary,
  },
  chevron: {
    color: theme.colors.textTertiary,
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginLeft: 72,
  },
}));
