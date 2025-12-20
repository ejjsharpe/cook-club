import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { View, TouchableOpacity } from "react-native";
import { SheetManager } from "react-native-actions-sheet";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";

import "@/components/ImportRecipeSheet";

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
    <View style={styles.cardContent}>
      <Ionicons name={icon} size={32} style={styles.icon} />
      <VSpace size={12} />
      <Text type="heading">{title}</Text>
      <VSpace size={4} />
      <Text type="bodyFaded" style={styles.cardDescription}>
        {description}
      </Text>
    </View>
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
        <VSpace size={28} />
        <Text type="title2">Add a recipe</Text>
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
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.medium,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 20,
  },
  cardContent: {
    alignItems: "center",
  },
  cardDescription: {
    textAlign: "center",
  },
  icon: {
    color: theme.colors.text,
  },
}));
