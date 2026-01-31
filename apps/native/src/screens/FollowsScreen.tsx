import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import { useState } from "react";
import { View, FlatList, ActivityIndicator } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import {
  useSearchUsers,
  useUserFollowers,
  useUserFollowing,
} from "@/api/follows";
import { Input } from "@/components/Input";
import { NavigationHeader } from "@/components/NavigationHeader";
import { SafeAreaView } from "@/components/SafeAreaView";
import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";
import { UserCard } from "@/components/UserCard";
import { UserSearchCard } from "@/components/UserSearchCard";

type TabType = "following" | "followers" | "search";

interface FollowUser {
  followId: number;
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
  followedAt: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

type FollowsScreenParams = {
  FollowsList: {
    userId: string;
    activeTab: "following" | "followers";
    userName: string;
  };
};

type FollowsScreenRouteProp = RouteProp<FollowsScreenParams, "FollowsList">;

export const FollowsScreen = () => {
  const route = useRoute<FollowsScreenRouteProp>();
  const navigation = useNavigation();
  const { userId, activeTab: initialTab, userName } = route.params;

  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [searchQuery, setSearchQuery] = useState("");

  // Use specific user's data instead of current user's data
  const { data: userFollowing, isPending: isPendingUserFollowing } =
    useUserFollowing({ userId });
  const { data: userFollowers, isPending: isPendingUserFollowers } =
    useUserFollowers({ userId });

  // Keep search functionality for current user
  const { data: searchResults, isPending: isSearching } = useSearchUsers({
    query: searchQuery,
    limit: 20,
  });

  const renderFollowUser = ({ item }: { item: FollowUser }) => (
    <UserCard
      user={item.user}
      onPress={() => {
        navigation.navigate("UserProfile", { userId: item.user.id });
      }}
    />
  );

  const renderSearchResult = ({ item }: { item: User }) => (
    <UserSearchCard
      user={item}
      onUserPress={() => {
        navigation.navigate("UserProfile", { userId: item.id });
      }}
    />
  );

  const renderTab = (tab: TabType, title: string, count?: number) => {
    const isActive = activeTab === tab;
    return (
      <Text
        type={isActive ? "highlight" : "bodyFaded"}
        style={[styles.tabText, isActive && styles.activeTab]}
        onPress={() => setActiveTab(tab)}
      >
        {title}
        {count !== undefined && ` (${count})`}
      </Text>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case "following":
        if (isPendingUserFollowing) {
          return (
            <View style={styles.centered}>
              <ActivityIndicator size="large" />
            </View>
          );
        }

        if (!userFollowing || userFollowing.length === 0) {
          return (
            <View style={styles.emptyState}>
              <Text type="bodyFaded">
                {userName} isn't following anyone yet
              </Text>
            </View>
          );
        }

        return (
          <FlatList
            data={userFollowing}
            renderItem={renderFollowUser}
            keyExtractor={(item) => item.followId.toString()}
            showsVerticalScrollIndicator={false}
          />
        );

      case "followers":
        if (isPendingUserFollowers) {
          return (
            <View style={styles.centered}>
              <ActivityIndicator size="large" />
            </View>
          );
        }

        if (!userFollowers || userFollowers.length === 0) {
          return (
            <View style={styles.emptyState}>
              <Text type="bodyFaded">{userName} has no followers yet</Text>
            </View>
          );
        }

        return (
          <FlatList
            data={userFollowers}
            renderItem={renderFollowUser}
            keyExtractor={(item) => item.followId.toString()}
            showsVerticalScrollIndicator={false}
          />
        );

      case "search":
        return (
          <View>
            <Input
              placeholder="Search for people to follow..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <VSpace size={16} />

            {searchQuery.length < 2 ? (
              <View style={styles.emptyState}>
                <Text type="bodyFaded">Start typing to search for people</Text>
              </View>
            ) : isSearching ? (
              <View style={styles.centered}>
                <ActivityIndicator />
              </View>
            ) : !searchResults || searchResults.length === 0 ? (
              <View style={styles.emptyState}>
                <Text type="bodyFaded">No users found for "{searchQuery}"</Text>
              </View>
            ) : (
              <FlatList
                data={searchResults}
                renderItem={renderSearchResult}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        );
    }
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.container}>
        <NavigationHeader title={userName} />

        {/* Tabs */}
        <View style={styles.tabs}>
          {renderTab("following", "Following", userFollowing?.length)}
          {renderTab("followers", "Followers", userFollowers?.length)}
          {renderTab("search", "Discover")}
        </View>

        <VSpace size={20} />

        <View style={styles.content}>{renderContent()}</View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
  },
  tabs: {
    marginHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-around",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tabText: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptySubtext: {
    marginTop: 8,
    textAlign: "center",
  },
}));
