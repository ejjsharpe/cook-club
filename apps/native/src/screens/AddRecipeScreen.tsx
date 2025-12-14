import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { useScrapeRecipe } from '@/api/recipe';
import { Input } from '@/components/Input';
import { VSpace } from '@/components/Space';
import { Text } from '@/components/Text';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';

const OptionCard = ({
  icon,
  title,
  description,
  onPress,
  expanded = false,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
  expanded?: boolean;
  children?: React.ReactNode;
}) => (
  <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
    <View style={styles.cardContent}>
      <Ionicons name={icon} size={32} color="#000" style={styles.icon} />
      <VSpace size={12} />
      <Text type="heading">{title}</Text>
      <VSpace size={4} />
      <Text type="bodyFaded">{description}</Text>
    </View>
    {expanded && children}
  </TouchableOpacity>
);

export const AddRecipeScreen = () => {
  const [showImportInput, setShowImportInput] = useState(false);
  const [url, setUrl] = useState<string>('');
  const { refetch: fetchRecipe } = useScrapeRecipe({ url });
  const { navigate } = useNavigation();

  const onPressImport = () => {
    setShowImportInput(true);
  };

  const onPressCreate = () => {
    navigate('EditRecipe', {});
  };

  const onPressScrapeRecipe = async () => {
    try {
      const scrapedRecipe = await fetchRecipe();
      if (!scrapedRecipe.data) throw new Error('No recipe data');

      navigate('EditRecipe', { scrapedRecipe: scrapedRecipe.data });
    } catch (error) {
      // TODO: handle badly scraped recipe
      console.error('Error scraping recipe:', error);
    }
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView style={{ paddingHorizontal: 20 }}>
        <VSpace size={28} />
        <Text type="title2">Add a recipe</Text>
        <VSpace size={28} />

        <OptionCard
          icon="globe-outline"
          title="Import from web"
          description="Enter the URL for a recipe on any website and add it to your collection"
          onPress={onPressImport}
          expanded={showImportInput}>
          <VSpace size={16} />
          <Input
            keyboardType="url"
            autoCapitalize="none"
            onChangeText={setUrl}
            placeholder="https://example.com/recipe"
          />
          <VSpace size={8} />
          <PrimaryButton onPress={onPressScrapeRecipe}>Add Recipe</PrimaryButton>
        </OptionCard>

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
  card: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.medium,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 20,
  },
  cardContent: {
    alignItems: 'center',
  },
  icon: {
    // Icon styling if needed
  },
}));
