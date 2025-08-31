import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { useScrapeRecipe } from '@/api/recipe';
import { Input } from '@/components/Input';
import { VSpace } from '@/components/Space';
import { Text } from '@/components/Text';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { useNavigation } from '@react-navigation/native';

export const AddRecipeScreen = () => {
  const [url, setUrl] = useState<string>('');
  const { refetch: fetchRecipe } = useScrapeRecipe({ url });
  const { navigate } = useNavigation();

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
        <Text type="heading">Import from the web</Text>
        <VSpace size={8} />
        <Text type="bodyFaded">
          Enter the URL for a recipe on any website and add it to to your collection.
        </Text>
        <VSpace size={16} />
        <Input keyboardType="url" autoCapitalize="none" onChangeText={setUrl} />
        <VSpace size={8} />
        <PrimaryButton onPress={onPressScrapeRecipe}>Add Recipe</PrimaryButton>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
});
