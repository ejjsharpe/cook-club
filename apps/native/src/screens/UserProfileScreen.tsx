import { Ionicons } from "@expo/vector-icons";
import { LegendList } from "@legendapp/list";
import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import { useTRPC } from "@repo/trpc/client";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useMemo, useCallback, useState } from "react";
import {
  View,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Share,
} from "react-native";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

import type {
  FeedItem,
  CookingReviewFeedItem,
  RecipeImportFeedItem,
} from "@/api/activity";
import { useUserActivities } from "@/api/activity";
import { useUserProfile, useFollowUser, useUnfollowUser } from "@/api/follows";
import { useUser } from "@/api/user";
import { ImportActivityCard } from "@/components/ImportActivityCard";
import { ReviewActivityCard } from "@/components/ReviewActivityCard";
import { SafeAreaView } from "@/components/SafeAreaView";
import { SkeletonContainer, UserProfileSkeleton } from "@/components/Skeleton";
import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";
import { BackButton } from "@/components/buttons/BackButton";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";

type UserProfileScreenParams = {
  UserProfile: {
    userId: string;
  };
};

type UserProfileScreenRouteProp = RouteProp<
  UserProfileScreenParams,
  "UserProfile"
>;

export const UserProfileScreen = () => {
  const route = useRoute<UserProfileScreenRouteProp>();
  const navigation = useNavigation();
  const { userId } = route.params;
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [isImporting, setIsImporting] = useState(false);
  const [imageError, setImageError] = useState(false);

  const { data: currentUser } = useUser();
  const { data: profile, isLoading, error } = useUserProfile({ userId });
  const followMutation = useFollowUser();
  const unfollowMutation = useUnfollowUser();

  // Fetch user activities
  const {
    data: activitiesData,
    fetchNextPage: fetchNextActivities,
    hasNextPage: hasMoreActivities,
    isFetchingNextPage: isFetchingNextActivities,
    isLoading: isLoadingActivities,
  } = useUserActivities({ userId });

  const isOwnProfile = currentUser?.user?.id === userId;

  const activities = useMemo(() => {
    return activitiesData?.pages.flatMap((page) => page?.items ?? []) ?? [];
  }, [activitiesData]);

  const handleFollow = () => {
    followMutation.mutate({ userId });
  };

  const handleUnfollow = () => {
    Alert.alert(
      "Unfollow User",
      `Are you sure you want to unfollow ${profile?.user.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unfollow",
          style: "destructive",
          onPress: () => unfollowMutation.mutate({ userId }),
        },
      ],
    );
  };

  const handleShareProfile = async () => {
    if (!profile) return;

    try {
      await Share.share({
        message: `Check out ${profile.user.name}'s profile on Cook Club!`,
        url: `cookclub://profile/${userId}`,
      });
    } catch {
      // User cancelled or share failed - silent failure
    }
  };

  const handleEditProfile = () => {
    navigation.navigate("EditProfile");
  };

  const handleLoadMoreActivities = useCallback(() => {
    if (hasMoreActivities && !isFetchingNextActivities) {
      fetchNextActivities();
    }
  }, [hasMoreActivities, isFetchingNextActivities, fetchNextActivities]);

  const handleImportRecipe = useCallback(
    async (sourceUrl: string) => {
      if (isImporting) return;

      setIsImporting(true);
      try {
        const result = await queryClient.fetchQuery(
          trpc.recipe.parseRecipeFromUrl.queryOptions({ url: sourceUrl }),
        );

        if (result.success) {
          navigation.navigate("EditRecipe", { parsedRecipe: result });
        } else {
          Alert.alert("Error", "Failed to parse recipe from URL");
        }
      } catch (error) {
        console.error("Import error:", error);
        Alert.alert("Error", "Something went wrong. Please try again.");
      } finally {
        setIsImporting(false);
      }
    },
    [isImporting, queryClient, trpc, navigation],
  );

  const renderActivityItem = useCallback(
    ({ item }: { item: FeedItem }) => {
      if (item.type === "cooking_review") {
        return (
          <ReviewActivityCard
            activity={item satisfies CookingReviewFeedItem}
            onPress={() =>
              navigation.navigate("RecipeDetail", {
                recipeId: item.recipe.id,
              })
            }
            onUserPress={() =>
              navigation.navigate("UserProfile", { userId: item.actor.id })
            }
            onImportPress={handleImportRecipe}
          />
        );
      }
      return (
        <ImportActivityCard
          activity={item satisfies RecipeImportFeedItem}
          onPress={() =>
            navigation.navigate("RecipeDetail", {
              recipeId: item.recipe.id,
            })
          }
          onUserPress={() =>
            navigation.navigate("UserProfile", { userId: item.actor.id })
          }
          onImportPress={handleImportRecipe}
        />
      );
    },
    [navigation, handleImportRecipe],
  );

  const renderEmpty = () => {
    if (isLoadingActivities) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" />
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Text type="bodyFaded">
          {isOwnProfile
            ? "No activity yet. Import recipes or write reviews to share!"
            : `${profile?.user.name} hasn't shared any activity yet`}
        </Text>
      </View>
    );
  };

  const renderFooter = () => {
    if (isFetchingNextActivities) {
      return (
        <View style={styles.footer}>
          <ActivityIndicator />
        </View>
      );
    }
    return null;
  };

  const formatJoinDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-GB", {
      year: "numeric",
      month: "long",
    });
  };

  const insets = UnistylesRuntime.insets;

  if (error) {
    return (
      <SafeAreaView edges={["top"]} style={styles.container}>
        <VSpace size={8} />
        <View style={styles.headerRow}>
          <BackButton />
        </View>
        <View style={styles.centered}>
          <Text type="bodyFaded">User not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isMutationLoading =
    followMutation.isPending || unfollowMutation.isPending;

  const renderHeader = () => {
    if (!profile) return null;
    return (
      <View style={styles.headerContent}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            {profile.user.image && !imageError ? (
              <Image
                source={{ uri: profile.user.image }}
                style={styles.avatarImage}
                onError={() => setImageError(true)}
                cachePolicy="memory-disk"
                transition={100}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text type="largeTitle" style={styles.avatarText}>
                  {profile.user.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          <VSpace size={16} />

          <Text type="title1" style={styles.name}>
            {profile.user.name}
          </Text>

          <Text type="bodyFaded" style={styles.email}>
            {profile.user.email}
          </Text>

          <VSpace size={8} />

          <Text type="bodyFaded" style={styles.joinDate}>
            Joined {formatJoinDate(profile.user.createdAt)}
          </Text>

          <VSpace size={20} />

          {/* Stats */}
          <View style={styles.statsContainer}>
            <TouchableOpacity
              style={styles.statItem}
              onPress={() =>
                navigation.navigate("FollowsList", {
                  userId,
                  activeTab: "followers",
                  userName: profile.user.name,
                })
              }
              activeOpacity={0.7}
            >
              <Text type="heading" style={styles.statNumber}>
                {profile.followersCount}
              </Text>
              <Text type="bodyFaded" style={styles.statLabel}>
                Followers
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.statItem}
              onPress={() =>
                navigation.navigate("FollowsList", {
                  userId,
                  activeTab: "following",
                  userName: profile.user.name,
                })
              }
              activeOpacity={0.7}
            >
              <Text type="heading" style={styles.statNumber}>
                {profile.followingCount}
              </Text>
              <Text type="bodyFaded" style={styles.statLabel}>
                Following
              </Text>
            </TouchableOpacity>
            <View style={styles.statItem}>
              <Text type="heading" style={styles.statNumber}>
                {profile.recipeCount}
              </Text>
              <Text type="bodyFaded" style={styles.statLabel}>
                Recipes
              </Text>
            </View>
          </View>
        </View>

        <VSpace size={24} />

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {isOwnProfile ? (
            <>
              <TouchableOpacity
                style={styles.pillButton}
                onPress={handleEditProfile}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="pencil-outline"
                  size={18}
                  style={styles.pillButtonIcon}
                />
                <Text style={styles.pillButtonText}>Edit Profile</Text>
              </TouchableOpacity>
              <View style={styles.buttonSpacer} />
              <TouchableOpacity
                style={styles.pillButton}
                onPress={handleShareProfile}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="share-outline"
                  size={18}
                  style={styles.pillButtonIcon}
                />
                <Text style={styles.pillButtonText}>Share</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {profile.isFollowing ? (
                <TouchableOpacity
                  style={[styles.pillButton, styles.followingButton]}
                  onPress={handleUnfollow}
                  disabled={isMutationLoading}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="checkmark"
                    size={18}
                    style={styles.followingIcon}
                  />
                  <Text style={styles.followingButtonText}>Following</Text>
                </TouchableOpacity>
              ) : (
                <PrimaryButton
                  onPress={handleFollow}
                  disabled={isMutationLoading}
                  style={styles.followButton}
                >
                  Follow
                </PrimaryButton>
              )}
              <View style={styles.buttonSpacer} />
              <TouchableOpacity
                style={styles.pillButton}
                onPress={handleShareProfile}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="share-outline"
                  size={18}
                  style={styles.pillButtonIcon}
                />
                <Text style={styles.pillButtonText}>Share</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {profile.followsMe && !isOwnProfile && (
          <>
            <VSpace size={12} />
            <View style={styles.followsYouBadge}>
              <Text type="caption" style={styles.followsYouText}>
                Follows you
              </Text>
            </View>
          </>
        )}

        <VSpace size={24} />

        {/* Activity Section Header */}
        <View style={styles.sectionHeader}>
          <Text type="heading">Activity</Text>
        </View>
        <VSpace size={12} />
      </View>
    );
  };

  const handleSettings = () => {
    navigation.navigate("Settings");
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      <VSpace size={8} />
      <View style={styles.headerRow}>
        <BackButton />
        {isOwnProfile && profile && (
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={handleSettings}
            activeOpacity={0.7}
          >
            <Ionicons
              name="settings-outline"
              size={22}
              style={styles.settingsIcon}
            />
          </TouchableOpacity>
        )}
      </View>

      <SkeletonContainer
        isLoading={isLoading || !profile}
        skeleton={<UserProfileSkeleton />}
      >
        <LegendList
          data={activities}
          renderItem={renderActivityItem}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          onEndReached={handleLoadMoreActivities}
          onEndReachedThreshold={0.5}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 20 },
          ]}
          ItemSeparatorComponent={() => <VSpace size={16} />}
        />
      </SkeletonContainer>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.inputBackground,
    justifyContent: "center",
    alignItems: "center",
  },
  settingsIcon: {
    color: theme.colors.text,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerContent: {
    alignItems: "center",
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  profileHeader: {
    alignItems: "center",
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: "hidden",
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.colors.primary + "20",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: theme.colors.primary,
  },
  name: {
    textAlign: "center",
  },
  email: {
    textAlign: "center",
    marginTop: 4,
  },
  joinDate: {
    textAlign: "center",
    fontSize: 14,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 40,
  },
  statItem: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: 20,
  },
  statLabel: {
    fontSize: 14,
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: "row",
    width: "100%",
  },
  pillButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 50,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.inputBackground,
    gap: 8,
  },
  pillButtonText: {
    fontSize: 16,
    fontWeight: "500",
    color: theme.colors.text,
  },
  pillButtonIcon: {
    color: theme.colors.text,
  },
  buttonSpacer: {
    width: 12,
  },
  followButton: {
    flex: 1,
  },
  followingButton: {
    backgroundColor: theme.colors.primary + "15",
  },
  followingButtonText: {
    fontSize: 16,
    fontWeight: "500",
    color: theme.colors.primary,
  },
  followingIcon: {
    color: theme.colors.primary,
  },
  followsYouBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.inputBackground,
  },
  followsYouText: {
    color: theme.colors.textSecondary,
  },
  sectionHeader: {
    width: "100%",
    paddingLeft: 4,
  },
  listContent: {},
  emptyContainer: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  footer: {
    paddingVertical: 20,
    alignItems: "center",
  },
}));
