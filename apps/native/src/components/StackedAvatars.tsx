import { View, TouchableOpacity } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { Avatar } from "@/components/Avatar";
import { Text } from "@/components/Text";

interface User {
  id: string;
  name: string;
  image?: string | null;
}

interface StackedAvatarsProps {
  users: User[];
  maxVisible?: number;
  size?: number;
  overlapAmount?: number;
  onPress?: () => void;
}

export const StackedAvatars = ({
  users,
  maxVisible = 3,
  size = 44,
  overlapAmount = 16,
  onPress,
}: StackedAvatarsProps) => {
  if (users.length === 0) return null;

  const visibleUsers = users.slice(0, maxVisible);
  const overflowCount = Math.max(0, users.length - maxVisible);

  const content = (
    <View style={[styles.container, { height: size }]}>
      {visibleUsers.map((user, index) => (
        <View
          key={user.id}
          style={[
            styles.avatarWrapper,
            {
              marginLeft: index === 0 ? 0 : -overlapAmount,
              zIndex: visibleUsers.length - index,
              width: size,
              height: size,
              borderRadius: size / 2,
            },
          ]}
        >
          <Avatar imageUrl={user.image} name={user.name} size={size - 4} />
        </View>
      ))}
      {overflowCount > 0 && (
        <View
          style={[
            styles.avatarWrapper,
            styles.overflowBadge,
            {
              marginLeft: -overlapAmount,
              zIndex: 0,
              width: size,
              height: size,
              borderRadius: size / 2,
            },
          ]}
        >
          <Text type="caption" style={styles.overflowText}>
            +{overflowCount}
          </Text>
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const styles = StyleSheet.create((theme) => ({
  container: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarWrapper: {
    borderWidth: 2,
    borderColor: theme.colors.background,
    backgroundColor: theme.colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  overflowBadge: {
    backgroundColor: theme.colors.inputBackground,
  },
  overflowText: {
    color: theme.colors.textSecondary,
    fontWeight: "600",
    fontSize: 11,
  },
}));
