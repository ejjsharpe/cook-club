import { Image } from "expo-image";
import { View, TouchableOpacity } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { Text } from "@/components/Text";

interface AvatarProps {
  imageUrl?: string | null;
  name: string;
  size?: number;
  onPress?: () => void;
}

export const Avatar = ({ imageUrl, name, size = 44, onPress }: AvatarProps) => {
  const initial = name.charAt(0).toUpperCase();
  const fontSize = size * 0.36;

  const content = imageUrl ? (
    <Image
      source={{ uri: imageUrl }}
      style={[styles.image, { width: size, height: size }]}
      cachePolicy="memory-disk"
      transition={100}
    />
  ) : (
    <View style={[styles.placeholder, { width: size, height: size }]}>
      <Text type="heading" style={[styles.initial, { fontSize }]}>
        {initial}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        style={{ width: size, height: size }}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const styles = StyleSheet.create((theme) => ({
  image: {
    borderRadius: theme.borderRadius.full,
  },
  placeholder: {
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary + "20",
    justifyContent: "center",
    alignItems: "center",
  },
  initial: {
    color: theme.colors.primary,
  },
}));
