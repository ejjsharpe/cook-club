import { Ionicons } from "@expo/vector-icons";
import { TrueSheet } from "@lodev09/react-native-true-sheet";
import {
  forwardRef,
  useCallback,
  useEffect,
  useState,
  useImperativeHandle,
  useRef,
} from "react";
import { View, TouchableOpacity, Alert, ScrollView } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";

import { useUnshareMealPlan, type ShareStatus } from "../../api/mealPlan";
import { Avatar } from "../Avatar";
import { VSpace } from "../Space";
import { Text } from "../Text";

interface AnimatedAvatarProps {
  user: ShareStatus;
  index: number;
  isOwner: boolean;
  onRemove: () => void;
}

const AnimatedAvatar = ({
  user,
  index,
  isOwner,
  onRemove,
}: AnimatedAvatarProps) => {
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(
      index * 50,
      withSpring(1, { damping: 12, stiffness: 180 }),
    );
    opacity.value = withDelay(index * 50, withTiming(1, { duration: 200 }));
  }, [index, scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handleLongPress = () => {
    if (!isOwner) return;
    Alert.alert(
      "Remove Access",
      `Remove ${user.userName}'s access to this meal plan?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: onRemove,
        },
      ],
    );
  };

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        style={styles.userItem}
        onLongPress={handleLongPress}
        delayLongPress={500}
        activeOpacity={isOwner ? 0.7 : 1}
      >
        <Avatar imageUrl={user.userImage} name={user.userName} size={56} />
        <VSpace size={8} />
        <Text type="caption" style={styles.userName} numberOfLines={1}>
          {user.userName.split(" ")[0]}
        </Text>
        <View style={styles.badge}>
          <Text type="caption" style={styles.badgeText}>
            {user.canEdit ? "Can edit" : "View only"}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

export interface SharedUsersSheetProps {
  mealPlanId?: number;
  planName?: string;
  sharedUsers?: ShareStatus[];
  isOwner?: boolean;
  onManageSharing?: () => void;
}

export interface SharedUsersSheetRef {
  present: () => void;
  dismiss: () => void;
}

export const SharedUsersSheet = forwardRef<
  SharedUsersSheetRef,
  SharedUsersSheetProps
>(({ mealPlanId, planName, sharedUsers, isOwner, onManageSharing }, ref) => {
  const sheetRef = useRef<TrueSheet>(null);

  const unshareMutation = useUnshareMealPlan();

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const handleClose = () => {
    sheetRef.current?.dismiss();
  };

  const handleRemoveUser = useCallback(
    async (userId: string) => {
      if (!mealPlanId) return;
      try {
        await unshareMutation.mutateAsync({ mealPlanId, userId });
      } catch {
        // Error handled by mutation
      }
    },
    [mealPlanId, unshareMutation],
  );

  const handleManageSharing = useCallback(async () => {
    await sheetRef.current?.dismiss();
    onManageSharing?.();
  }, [onManageSharing]);

  const users = sharedUsers || [];

  return (
    <TrueSheet ref={sheetRef} detents={[1]} grabber cornerRadius={20}>
      <View>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text type="title2">Shared With</Text>
            {planName && (
              <Text type="caption" style={styles.planNameText}>
                {planName}
              </Text>
            )}
          </View>
          <TouchableOpacity onPress={handleClose}>
            <Ionicons name="close" size={28} style={styles.closeIcon} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {users.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons
                name="people-outline"
                size={48}
                style={styles.emptyIcon}
              />
              <Text type="bodyFaded" style={styles.emptyText}>
                This meal plan isn't shared with anyone yet.
              </Text>
              {isOwner && (
                <TouchableOpacity
                  style={styles.inviteButton}
                  onPress={handleManageSharing}
                >
                  <Text type="body" style={styles.inviteButtonText}>
                    Invite Friends
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              {/* Avatar Grid */}
              <View style={styles.avatarGrid}>
                {users.map((user, index) => (
                  <AnimatedAvatar
                    key={user.userId}
                    user={user}
                    index={index}
                    isOwner={isOwner ?? false}
                    onRemove={() => handleRemoveUser(user.userId)}
                  />
                ))}
              </View>

              {isOwner && (
                <>
                  <VSpace size={24} />
                  <TouchableOpacity
                    style={styles.manageButton}
                    onPress={handleManageSharing}
                  >
                    <Ionicons
                      name="settings-outline"
                      size={20}
                      style={styles.manageButtonIcon}
                    />
                    <Text type="body" style={styles.manageButtonText}>
                      Manage Sharing
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              {isOwner && (
                <Text type="caption" style={styles.hintText}>
                  Long press on a user to remove access
                </Text>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </TrueSheet>
  );
});

const styles = StyleSheet.create((theme) => ({
  indicator: {
    backgroundColor: theme.colors.border,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  planNameText: {
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  closeIcon: {
    color: theme.colors.text,
  },
  scrollView: {
    maxHeight: 400,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  emptyIcon: {
    color: theme.colors.textTertiary,
    marginBottom: 12,
  },
  emptyText: {
    textAlign: "center",
    paddingHorizontal: 20,
  },
  inviteButton: {
    marginTop: 20,
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: theme.borderRadius.medium,
  },
  inviteButtonText: {
    color: theme.colors.buttonText,
    fontWeight: "600",
  },
  avatarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 16,
  },
  userItem: {
    alignItems: "center",
    width: 80,
  },
  userName: {
    textAlign: "center",
  },
  badge: {
    marginTop: 4,
    backgroundColor: theme.colors.inputBackground,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: theme.borderRadius.small,
  },
  badgeText: {
    color: theme.colors.textSecondary,
    fontSize: 10,
  },
  manageButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: theme.colors.inputBackground,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: theme.borderRadius.medium,
  },
  manageButtonIcon: {
    color: theme.colors.text,
  },
  manageButtonText: {
    color: theme.colors.text,
    fontWeight: "500",
  },
  hintText: {
    color: theme.colors.textSecondary,
    textAlign: "center",
    marginTop: 16,
  },
}));
