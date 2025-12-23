import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { View, TouchableOpacity } from "react-native";
import { SheetManager } from "react-native-actions-sheet";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";

import "@/components/ImportRecipeSheet";

import { ScreenHeader } from "@/components/ScreenHeader";
import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";

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
      <Text type="heading">{title}</Text>
      <Text type="bodyFaded" style={styles.cardDescription}>
        {description}
      </Text>
    </View>
    <Ionicons name="chevron-forward" size={20} style={styles.chevron} />
  </TouchableOpacity>
);

export const AddRecipeScreen = () => {
  const { navigate } = useNavigation();

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

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Add a recipe">
          <VSpace size={28} />
        </ScreenHeader>

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
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 20,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor:
      theme.colors.background === "#FFFFFF"
        ? "rgba(0,0,0,0.04)"
        : "rgba(255,255,255,0.06)",
    borderRadius: theme.borderRadius.medium,
    padding: 16,
    gap: 14,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.colors.primary + "15",
    justifyContent: "center",
    alignItems: "center",
  },
  icon: {
    color: theme.colors.primary,
  },
  cardContent: {
    flex: 1,
    gap: 2,
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 18,
  },
  chevron: {
    color: theme.colors.border,
  },
}));
