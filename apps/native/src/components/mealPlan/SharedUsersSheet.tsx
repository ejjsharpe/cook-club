import { TrueSheet } from "@lodev09/react-native-true-sheet";
import {
  forwardRef,
  useCallback,
  useEffect,
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
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

import { useRemoveMealPlanMember, type ShareStatus } from "../../api/mealPlan";
import { AppSheet } from "../AppSheet";
import { Avatar } from "../Avatar";
import { VSpace } from "../Space";
import { Text } from "../Text";

import { Ionicons } from "@/components/Ionicons";

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
  const theme = UnistylesRuntime.getTheme();
  const sheetRef = useRef<TrueSheet>(null);

  const unshareMutation = useRemoveMealPlanMember();

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
    dismiss: () => sheetRef.current?.dismiss(),
  }));

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
    <AppSheet
      ref={sheetRef}
      title="Shared With"
      subtitle={planName}
      detents={["auto"]}
      backgroundColor={theme.colors.background}
    >
      <View>
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
    </AppSheet>
  );
});

const styles = StyleSheet.create((theme) => ({
  indicator: {
    backgroundColor: theme.colors.border,
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
