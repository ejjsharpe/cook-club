import { View, TouchableOpacity, Image } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { HSpace } from "./Space";
import { Text } from "./Text";

import { useFollowUser } from "@/api/follows";

interface User {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

interface Props {
  user: User;
  onUserPress?: () => void;
}

export const UserSearchCard = ({ user, onUserPress }: Props) => {
  const followMutation = useFollowUser();

  const handleFollow = () => {
    followMutation.mutate({ userId: user.id });
  };

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.userInfo}
        onPress={onUserPress}
        activeOpacity={0.7}
      >
        <View style={styles.avatar}>
          {user.image ? (
            <Image source={{ uri: user.image }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text type="heading" style={styles.avatarText}>
                {user.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        <HSpace size={12} />

        <View style={styles.info}>
          <Text type="heading" numberOfLines={1}>
            {user.name}
          </Text>
          <Text type="bodyFaded" numberOfLines={1} style={styles.email}>
            {user.email}
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.followButton}
        onPress={handleFollow}
        disabled={followMutation.isPending}
      >
        <Text style={styles.followText}>
          {followMutation.isPending ? "Following..." : "Follow"}
        </Text>
      </TouchableOpacity>
    </View>
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
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary + "20",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 18,
    color: theme.colors.primary,
  },
  info: {
    flex: 1,
  },
  email: {
    fontSize: 14,
    marginTop: 2,
  },
  followButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.small,
    backgroundColor: theme.colors.primary,
  },
  followText: {
    color: "white",
    fontFamily: theme.fonts.bold,
    fontSize: 14,
  },
}));
