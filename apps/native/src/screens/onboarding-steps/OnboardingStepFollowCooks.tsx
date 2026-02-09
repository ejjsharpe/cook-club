import { useState } from "react";
import { View, Image, TouchableOpacity, ActivityIndicator } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import {
  useSearchUsers,
  useSuggestedUsers,
  useFollowUser,
  useUnfollowUser,
  useFollowing,
} from "@/api/follows";
import { Input } from "@/components/Input";
import { HSpace, VSpace } from "@/components/Space";
import { Text } from "@/components/Text";
import { useDebounce } from "@/hooks/useDebounce";

interface UserRowProps {
  user: {
    id: string;
    name: string;
    username?: string | null;
    image?: string | null;
  };
  isFollowing: boolean;
}

function UserRow({ user, isFollowing: isFollowingServer }: UserRowProps) {
  const [optimisticFollowing, setOptimisticFollowing] = useState<
    boolean | null
  >(null);
  const followMutation = useFollowUser();
  const unfollowMutation = useUnfollowUser();

  // Use optimistic state if set, otherwise fall back to server state
  const isFollowing = optimisticFollowing ?? isFollowingServer;

  // Sync optimistic state back to server state once it catches up
  if (
    optimisticFollowing !== null &&
    optimisticFollowing === isFollowingServer
  ) {
    setOptimisticFollowing(null);
  }

  const handlePress = () => {
    const newState = !isFollowing;
    setOptimisticFollowing(newState);

    if (isFollowing) {
      unfollowMutation.mutate(
        { userId: user.id },
        { onError: () => setOptimisticFollowing(null) },
      );
    } else {
      followMutation.mutate(
        { userId: user.id },
        { onError: () => setOptimisticFollowing(null) },
      );
    }
  };

  return (
    <View style={styles.userRow}>
      <View style={styles.userInfo}>
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
        <View style={styles.nameContainer}>
          <Text type="heading" numberOfLines={1}>
            {user.name}
          </Text>
          {user.username && (
            <Text type="bodyFaded" numberOfLines={1} style={styles.username}>
              @{user.username}
            </Text>
          )}
        </View>
      </View>
      <TouchableOpacity
        style={[styles.followButton, isFollowing && styles.followingButton]}
        onPress={handlePress}
      >
        <Text
          style={[
            styles.followButtonText,
            isFollowing && styles.followingButtonText,
          ]}
        >
          {isFollowing ? "Following" : "Follow"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export const OnboardingStepFollowCooks = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebounce(searchQuery, 300);

  const { data: following } = useFollowing();
  const followingIds = new Set(following?.map((f) => f.user.id) ?? []);

  const { data: suggestedUsers, isLoading: isSuggestedLoading } =
    useSuggestedUsers(20);
  const { data: searchResults, isLoading: isSearchLoading } = useSearchUsers({
    query: debouncedQuery,
    limit: 20,
  });

  const isSearching = debouncedQuery.length >= 2;
  const users = isSearching ? searchResults : suggestedUsers;
  const isLoading = isSearching ? isSearchLoading : isSuggestedLoading;

  return (
    <View style={styles.container}>
      <Text type="largeTitle" style={styles.title}>
        Follow some cooks
      </Text>
      <VSpace size={12} />
      <Text type="bodyFaded" style={styles.subtitle}>
        See what they're cooking in your feed
      </Text>
      <VSpace size={24} />

      <Input
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search for cooks..."
        autoCapitalize="none"
        autoCorrect={false}
      />

      <VSpace size={16} />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
        </View>
      ) : users && users.length > 0 ? (
        users.map((u) => (
          <UserRow key={u.id} user={u} isFollowing={followingIds.has(u.id)} />
        ))
      ) : (
        <View style={styles.emptyContainer}>
          <Text type="bodyFaded" style={styles.emptyText}>
            {isSearching ? "No cooks found" : "No suggestions available"}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
  },
  title: {
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  userInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 48,
    height: 48,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primary + "20",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 20,
    color: theme.colors.primary,
  },
  nameContainer: {
    flex: 1,
  },
  username: {
    fontSize: 13,
    marginTop: 1,
  },
  followButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: theme.colors.primary,
  },
  followingButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  followButtonText: {
    color: theme.colors.buttonText,
    fontFamily: theme.fonts.semiBold,
    fontSize: 14,
  },
  followingButtonText: {
    color: theme.colors.text,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyText: {
    textAlign: "center",
  },
}));
