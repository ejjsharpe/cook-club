import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { View, TouchableOpacity, ScrollView } from "react-native";
import { SheetManager } from "react-native-actions-sheet";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

import { SafeAreaView } from "@/components/SafeAreaView";
import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";

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

  const handleRecipeParsed = (
    result: ReactNavigation.RootParamList["EditRecipe"]["parsedRecipe"],
  ) => {
    navigate("EditRecipe", { parsedRecipe: result });
  };

  const onPressSmartImport = () => {
    SheetManager.show("smart-import-sheet", {
      payload: { onRecipeParsed: handleRecipeParsed },
    });
  };

  const onPressCreate = () => {
    navigate("EditRecipe", {});
  };

  const onPressAIChef = () => {
    navigate("GenerateRecipe", {});
  };

  const onPressBasicImport = () => {
    SheetManager.show("basic-import-sheet", {
      payload: { onRecipeParsed: handleRecipeParsed },
    });
  };

  const onPressFridgeSnap = () => {
    navigate("FridgeSnap", {});
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <VSpace size={8} />
        <View style={styles.headerPadded}>
          <Text type="title1">Add recipe</Text>
        </View>

        <VSpace size={24} />

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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create((theme) => ({
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
  headerPadded: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontFamily: theme.fonts.albertSemiBold,
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
