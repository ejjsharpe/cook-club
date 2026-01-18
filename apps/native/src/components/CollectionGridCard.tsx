import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { View, TouchableOpacity } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { Text } from "./Text";

const GRID_GAP = 20;

interface Collection {
  id: number;
  name: string;
  recipeCount?: number;
  previewImages?: string[];
}

interface Props {
  collection: Collection;
  onPress?: () => void;
  width?: number;
}

const ImageGrid = ({ images }: { images: string[] }) => {
  const count = Math.min(images.length, 4);

  if (count === 0) {
    return (
      <View style={gridStyles.container}>
        <View style={gridStyles.placeholder}>
          <Ionicons
            name="albums-outline"
            size={40}
            style={gridStyles.placeholderIcon}
          />
        </View>
      </View>
    );
  }

  if (count === 1) {
    return (
      <View style={gridStyles.container}>
        <Image
          source={{ uri: images[0] }}
          style={gridStyles.fullImage}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      </View>
    );
  }

  if (count === 2) {
    return (
      <View style={gridStyles.container}>
        <View style={gridStyles.row}>
          <View style={gridStyles.imageWrapper}>
            <Image
              source={{ uri: images[0] }}
              style={gridStyles.image}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          </View>
          <View style={gridStyles.imageWrapper}>
            <Image
              source={{ uri: images[1] }}
              style={gridStyles.image}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          </View>
        </View>
      </View>
    );
  }

  if (count === 3) {
    return (
      <View style={gridStyles.container}>
        <View style={gridStyles.threeImageLayout}>
          <View style={gridStyles.largeImageWrapper}>
            <Image
              source={{ uri: images[0] }}
              style={gridStyles.image}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          </View>
          <View style={gridStyles.smallImagesColumn}>
            <View style={gridStyles.imageWrapper}>
              <Image
                source={{ uri: images[1] }}
                style={gridStyles.image}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            </View>
            <View style={gridStyles.imageWrapper}>
              <Image
                source={{ uri: images[2] }}
                style={gridStyles.image}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={gridStyles.container}>
      <View style={gridStyles.row}>
        <View style={gridStyles.imageWrapper}>
          <Image
            source={{ uri: images[0] }}
            style={gridStyles.image}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        </View>
        <View style={gridStyles.imageWrapper}>
          <Image
            source={{ uri: images[1] }}
            style={gridStyles.image}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        </View>
      </View>
      <View style={gridStyles.row}>
        <View style={gridStyles.imageWrapper}>
          <Image
            source={{ uri: images[2] }}
            style={gridStyles.image}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        </View>
        <View style={gridStyles.imageWrapper}>
          <Image
            source={{ uri: images[3] }}
            style={gridStyles.image}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        </View>
      </View>
    </View>
  );
};

const gridStyles = StyleSheet.create((theme) => ({
  container: {
    aspectRatio: 1,
    borderRadius: theme.borderRadius.medium,
    overflow: "hidden",
  },
  row: {
    flex: 1,
    flexDirection: "row",
    gap: 2,
  },
  imageWrapper: {
    flex: 1,
  },
  largeImageWrapper: {
    flex: 1,
  },
  smallImagesColumn: {
    flex: 1,
    gap: 2,
  },
  threeImageLayout: {
    flex: 1,
    flexDirection: "row",
    gap: 2,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  fullImage: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    width: "100%",
    height: "100%",
    backgroundColor: theme.colors.inputBackground,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderIcon: {
    color: theme.colors.textTertiary,
  },
}));

export const CollectionGridCard = ({ collection, onPress, width }: Props) => {
  const previewImages = collection.previewImages || [];
  const recipeCount = collection.recipeCount ?? 0;

  return (
    <TouchableOpacity
      style={[styles.card, width != null && { flex: undefined, width }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <ImageGrid images={previewImages} />
      <View style={styles.content}>
        <Text type="headline" numberOfLines={1}>
          {collection.name}
        </Text>
        <Text type="caption" style={styles.recipeCount}>
          {recipeCount} {recipeCount === 1 ? "recipe" : "recipes"}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

export { GRID_GAP };

const styles = StyleSheet.create((theme) => ({
  card: {
    flex: 1,
  },
  content: {
    paddingTop: 8,
    gap: 2,
  },
  recipeCount: {
    color: theme.colors.textSecondary,
  },
}));
