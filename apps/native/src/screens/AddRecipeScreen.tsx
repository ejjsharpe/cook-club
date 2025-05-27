import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { useScrapeRecipe } from '@/api/recipe';
import { Input } from '@/components/Input';
import { VSpace } from '@/components/Space';
import { Text } from '@/components/Text';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';

export const AddRecipeScreen = () => {
  const [url, setUrl] = useState<string>('');
  const { data, refetch } = useScrapeRecipe({ url });

  useEffect(() => {
    console.log('Scraped recipe data:', data);
  }, [data]);

  const onPressScrapeRecipe = async () => {
    try {
      const something = await refetch();
      console.log({ something });
    } catch (error) {
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
