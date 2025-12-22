import { Ionicons } from "@expo/vector-icons";
import { View, TouchableOpacity, Image } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { HSpace } from "./Space";
import { Text } from "./Text";

interface CollectionOwner {
  id: string;
  name: string;
  image: string | null;
}

interface Collection {
  id: number;
  name: string;
  recipeCount: number;
  owner: CollectionOwner;
}

interface Props {
  collection: Collection;
  onPress?: () => void;
  onOwnerPress?: () => void;
}

export const CollectionCard = ({
  collection,
  onPress,
  onOwnerPress,
}: Props) => {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.iconContainer}>
        <Ionicons name="albums-outline" size={24} style={styles.icon} />
      </View>

      <HSpace size={12} />

      <View style={styles.content}>
        <Text type="heading" numberOfLines={1}>
          {collection.name}
        </Text>
        <View style={styles.meta}>
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onOwnerPress?.();
            }}
            activeOpacity={0.7}
          >
            <View style={styles.ownerInfo}>
              {collection.owner.image ? (
                <Image
                  source={{ uri: collection.owner.image }}
                  style={styles.ownerAvatar}
                />
              ) : (
                <View style={styles.ownerAvatarPlaceholder}>
                  <Text style={styles.ownerAvatarText}>
                    {collection.owner.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <HSpace size={6} />
              <Text type="bodyFaded" numberOfLines={1} style={styles.ownerName}>
                {collection.owner.name}
              </Text>
            </View>
          </TouchableOpacity>
          <View style={styles.recipeCount}>
            <Ionicons
              name="restaurant-outline"
              size={12}
              style={styles.recipeIcon}
            />
            <HSpace size={4} />
            <Text type="bodyFaded" style={styles.recipeCountText}>
              {collection.recipeCount}
            </Text>
          </View>
        </View>
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
    borderRadius: theme.borderRadius.medium,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
    marginVertical: 4,
    marginHorizontal: 20,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: theme.colors.primary + "15",
    justifyContent: "center",
    alignItems: "center",
  },
  icon: {
    color: theme.colors.primary,
  },
  content: {
    flex: 1,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 12,
  },
  ownerInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  ownerAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  ownerAvatarPlaceholder: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  ownerAvatarText: {
    fontSize: 10,
    fontWeight: "600",
    color: theme.colors.text,
  },
  ownerName: {
    fontSize: 13,
  },
  recipeCount: {
    flexDirection: "row",
    alignItems: "center",
  },
  recipeIcon: {
    color: "#888",
  },
  recipeCountText: {
    fontSize: 13,
  },
  chevron: {
    color: theme.colors.border,
    marginLeft: 8,
  },
}));
