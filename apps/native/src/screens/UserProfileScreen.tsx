import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { View, Image, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { useUserProfile, useFollowUser, useUnfollowUser } from '@/api/follows';
import { useUser } from '@/api/user';
import { VSpace } from '@/components/Space';
import { Text } from '@/components/Text';
import { BackButton } from '@/components/buttons/BackButton';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';

type UserProfileScreenParams = {
  UserProfile: {
    userId: string;
  };
};

type UserProfileScreenRouteProp = RouteProp<UserProfileScreenParams, 'UserProfile'>;

export const UserProfileScreen = () => {
  const route = useRoute<UserProfileScreenRouteProp>();
  const navigation = useNavigation();
  const { userId } = route.params;

  const { data: currentUser } = useUser();
  const { data: profile, isLoading, error } = useUserProfile({ userId });
  const followMutation = useFollowUser();
  const unfollowMutation = useUnfollowUser();

  const isOwnProfile = currentUser?.user?.id === userId;

  const handleFollow = () => {
    followMutation.mutate({ userId });
  };

  const handleUnfollow = () => {
    Alert.alert('Unfollow User', `Are you sure you want to unfollow ${profile?.user.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unfollow',
        style: 'destructive',
        onPress: () => unfollowMutation.mutate({ userId }),
      },
    ]);
  };

  const renderActionButton = () => {
    if (!profile) return null;

    if (isOwnProfile) {
      return (
        <View style={styles.buttonContainer}>
          <Text type="bodyFaded" style={styles.ownProfileText}>
            This is your profile
          </Text>
        </View>
      );
    }

    const isLoading = followMutation.isPending || unfollowMutation.isPending;

    if (profile.isFollowing) {
      return (
        <View style={styles.buttonContainer}>
          <Text type="highlight" style={styles.statusText}>
            ✓ Following
          </Text>
          {profile.followsMe && (
            <>
              <VSpace size={4} />
              <Text type="bodyFaded" style={styles.followsYouText}>
                Follows you
              </Text>
            </>
          )}
          <VSpace size={12} />
          <PrimaryButton
            onPress={handleUnfollow}
            disabled={isLoading}
            style={styles.secondaryButton}>
            {unfollowMutation.isPending ? 'Unfollowing...' : 'Unfollow'}
          </PrimaryButton>
        </View>
      );
    }

    return (
      <View style={styles.buttonContainer}>
        {profile.followsMe && (
          <>
            <Text type="bodyFaded" style={styles.statusText}>
              Follows you
            </Text>
            <VSpace size={12} />
          </>
        )}
        <PrimaryButton onPress={handleFollow} disabled={isLoading}>
          {followMutation.isPending ? 'Following...' : 'Follow'}
        </PrimaryButton>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.screen}>
        <SafeAreaView style={styles.container}>
          <BackButton />
          <View style={styles.centered}>
            <ActivityIndicator size="large" />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.screen}>
        <SafeAreaView style={styles.container}>
          <BackButton />
          <View style={styles.centered}>
            <Text type="bodyFaded">User not found</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const formatJoinDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
    });
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.container}>
        <VSpace size={8} />
        <BackButton />

        <View style={styles.content}>
          <VSpace size={32} />

          {/* Profile Header */}
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              {profile.user.image ? (
                <Image source={{ uri: profile.user.image }} style={styles.avatarImage} />
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

            <VSpace size={12} />

            {/* Follower Stats */}
            <View style={styles.statsContainer}>
              <TouchableOpacity
                style={styles.statItem}
                onPress={() =>
                  navigation.navigate('FollowsList', {
                    userId,
                    activeTab: 'followers',
                    userName: profile.user.name,
                  })
                }
                activeOpacity={0.7}>
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
                  navigation.navigate('FollowsList', {
                    userId,
                    activeTab: 'following',
                    userName: profile.user.name,
                  })
                }
                activeOpacity={0.7}>
                <Text type="heading" style={styles.statNumber}>
                  {profile.followingCount}
                </Text>
                <Text type="bodyFaded" style={styles.statLabel}>
                  Following
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <VSpace size={40} />

          {/* Action Button */}
          <View style={styles.actionSection}>{renderActionButton()}</View>

          {/* TODO: Add user's recipes, cooking stats, etc. */}
          <VSpace size={40} />

          <View style={styles.comingSoonSection}>
            <Text type="heading">Coming Soon</Text>
            <VSpace size={8} />
            <Text type="bodyFaded" style={styles.comingSoon}>
              • View {profile.user.name}'s recipes
            </Text>
            <Text type="bodyFaded" style={styles.comingSoon}>
              • Cooking activity and stats
            </Text>
            <Text type="bodyFaded" style={styles.comingSoon}>
              • Recipe collections
            </Text>
          </View>
        </View>
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
    paddingHorizontal: 20,
  },
  content: {
    flex: 1,
    alignItems: 'center',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileHeader: {
    alignItems: 'center',
  },
  avatar: {
    width: 100,
    height: 100,
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
    backgroundColor: theme.colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: theme.colors.primary,
  },
  name: {
    textAlign: 'center',
  },
  email: {
    textAlign: 'center',
    marginTop: 4,
  },
  joinDate: {
    textAlign: 'center',
    fontSize: 14,
  },
  actionSection: {
    width: '100%',
    maxWidth: 300,
  },
  buttonContainer: {
    alignItems: 'center',
  },
  statusText: {
    textAlign: 'center',
    fontSize: 16,
  },
  followsYouText: {
    textAlign: 'center',
    fontSize: 14,
  },
  ownProfileText: {
    textAlign: 'center',
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
  },
  statLabel: {
    fontSize: 14,
    marginTop: 2,
  },
  comingSoonSection: {
    alignItems: 'center',
    opacity: 0.6,
  },
  comingSoon: {
    fontSize: 14,
    marginVertical: 2,
  },
}));
