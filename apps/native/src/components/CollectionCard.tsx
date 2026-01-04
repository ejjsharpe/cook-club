import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { View, TouchableOpacity } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { Text } from "./Text";

interface CollectionOwner {
  id: string;
  name: string;
  image: string | null;
}

interface Collection {
  id: number;
  name: string;
  recipeCount?: number;
  owner?: CollectionOwner;
  previewImages?: string[];
}

interface Props {
  collection: Collection;
  onPress?: () => void;
}

const ImageGrid = ({ images }: { images: string[] }) => {
  const count = Math.min(images.length, 4);

  // No images - show placeholder
  if (count === 0) {
    return (
      <View style={gridStyles.container}>
        <View style={gridStyles.placeholder}>
          <Ionicons
            name="albums-outline"
            size={32}
            style={gridStyles.placeholderIcon}
          />
        </View>
      </View>
    );
  }

  // 1 image - full size
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

  // 2 images - side by side
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

  // 3 images - one large on left, two stacked on right
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

  // 4 images - 2x2 grid
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
    width: 100,
    height: 100,
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
    borderRadius: theme.borderRadius.medium,
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

export const CollectionCard = ({ collection, onPress }: Props) => {
  const previewImages = collection.previewImages || [];
  const recipeCount = collection.recipeCount ?? 0;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <ImageGrid images={previewImages} />

      <View style={styles.content}>
        <Text type="headline" numberOfLines={2}>
          {collection.name}
        </Text>
        <Text type="subheadline" style={styles.recipeCount}>
          {recipeCount} {recipeCount === 1 ? "recipe" : "recipes"}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={20} style={styles.chevron} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create((theme) => ({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.background,
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 14,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  recipeCount: {
    color: theme.colors.textSecondary,
  },
  chevron: {
    color: theme.colors.textTertiary,
  },
}));
