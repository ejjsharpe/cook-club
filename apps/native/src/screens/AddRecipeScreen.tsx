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
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle: string;
  onPress: () => void;
  disabled?: boolean;
}) => {
  const theme = UnistylesRuntime.getTheme();

  return (
    <TouchableOpacity
      style={[styles.row, disabled && styles.rowDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View style={styles.iconContainer}>
        <Ionicons name={icon} size={24} color={theme.colors.primary} />
      </View>
      <View style={styles.textContainer}>
        <Text type="body">{label}</Text>
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

  const onPressBasicImport = () => {
    // TODO: Implement basic import
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
          <Text type="title1">Add a recipe</Text>
        </View>

        <VSpace size={24} />

        <View style={styles.section}>
          <ActionRow
            icon="link"
            label="Basic import"
            subtitle="Import from URL. Works for most recipe websites."
            onPress={onPressBasicImport}
            disabled
          />
          <View style={styles.separator} />
          <ActionRow
            icon="sparkles"
            label="Smart import"
            subtitle="Import from anywhere including social media using AI."
            onPress={onPressSmartImport}
          />
          <View style={styles.separator} />
          <ActionRow
            icon="create"
            label="Create from scratch"
            subtitle="Build your own recipe step by step."
            onPress={onPressCreate}
          />
          <View style={styles.separator} />
          <ActionRow
            icon="color-wand"
            label="Generate with AI"
            subtitle="Describe what you want and AI will create a recipe."
            onPress={onPressGenerate}
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
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: theme.colors.primary + "15",
    justifyContent: "center",
    alignItems: "center",
  },
  textContainer: {
    flex: 1,
    gap: 2,
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
