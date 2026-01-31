import { Ionicons } from "@expo/vector-icons";
import { TrueSheet } from "@lodev09/react-native-true-sheet";
import {
  forwardRef,
  useState,
  useCallback,
  useImperativeHandle,
  useRef,
} from "react";
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  ScrollView,
} from "react-native";
import { StyleSheet } from "react-native-unistyles";

import {
  useGetShareableUsers,
  useGetShareStatus,
  useShareMealPlan,
  useUnshareMealPlan,
  type ShareableUser,
  type ShareStatus,
} from "../../api/mealPlan";
import { VSpace } from "../Space";
import { Text } from "../Text";

interface FriendItemProps {
  friend: ShareableUser;
  shareStatus: ShareStatus | undefined;
  onToggleShare: (canEdit: boolean) => void;
  onRemoveShare: () => void;
  isPending: boolean;
}

const FriendItem = ({
  friend,
  shareStatus,
  onToggleShare,
  onRemoveShare,
  isPending,
}: FriendItemProps) => {
  const isShared = !!shareStatus;

  const handlePress = () => {
    if (isShared) {
      Alert.alert(
        "Sharing Options",
        `${friend.name} currently has ${shareStatus.canEdit ? "edit" : "view-only"} access.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: shareStatus.canEdit ? "Change to View-Only" : "Allow Editing",
            onPress: () => onToggleShare(!shareStatus.canEdit),
          },
          {
            text: "Remove Access",
            style: "destructive",
            onPress: onRemoveShare,
          },
        ],
      );
    } else {
      Alert.alert("Share Meal Plan", `Share with ${friend.name}?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "View Only",
          onPress: () => onToggleShare(false),
        },
        {
          text: "Can Edit",
          onPress: () => onToggleShare(true),
        },
      ]);
    }
  };

  return (
    <TouchableOpacity
      style={styles.friendRow}
      onPress={handlePress}
      disabled={isPending}
    >
      {friend.image ? (
        <Image source={{ uri: friend.image }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Ionicons name="person" size={20} style={styles.avatarIcon} />
        </View>
      )}
      <View style={styles.friendInfo}>
        <Text type="body">{friend.name}</Text>
        {isShared && (
          <Text type="caption" style={styles.accessText}>
            {shareStatus.canEdit ? "Can edit" : "View only"}
          </Text>
        )}
      </View>
      {isPending ? (
        <ActivityIndicator size="small" />
      ) : isShared ? (
        <Ionicons name="checkmark-circle" size={24} style={styles.sharedIcon} />
      ) : (
        <Ionicons name="add-circle-outline" size={24} style={styles.addIcon} />
      )}
    </TouchableOpacity>
  );
};

export interface MealPlanShareSheetProps {
  mealPlanId?: number;
  planName?: string;
}

export interface MealPlanShareSheetRef {
  present: () => void;
  dismiss: () => void;
}

export const MealPlanShareSheet = forwardRef<
  MealPlanShareSheetRef,
  MealPlanShareSheetProps
>(({ mealPlanId, planName }, ref) => {
  const sheetRef = useRef<TrueSheet>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const { data: shareableUsers, isLoading: isLoadingUsers } =
    useGetShareableUsers();
  const { data: shareStatus, isLoading: isLoadingStatus } = useGetShareStatus({
    mealPlanId: mealPlanId ?? 0,
    enabled: !!mealPlanId,
  });

  const shareMutation = useShareMealPlan();
  const unshareMutation = useUnshareMealPlan();

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const handleClose = () => {
    sheetRef.current?.dismiss();
  };

  // Convert share status to a map for easy lookup
  const shareStatusMap = new Map<string, ShareStatus>();
  shareStatus?.forEach((status) => {
    shareStatusMap.set(status.userId, status);
  });

  const handleToggleShare = useCallback(
    async (userId: string, canEdit: boolean) => {
      if (!mealPlanId) return;
      setPendingUserId(userId);
      try {
        await shareMutation.mutateAsync({ mealPlanId, userId, canEdit });
      } catch {
        // Error handled by mutation
      } finally {
        setPendingUserId(null);
      }
    },
    [mealPlanId, shareMutation],
  );

  const handleRemoveShare = useCallback(
    async (userId: string) => {
      if (!mealPlanId) return;
      setPendingUserId(userId);
      try {
        await unshareMutation.mutateAsync({ mealPlanId, userId });
      } catch {
        // Error handled by mutation
      } finally {
        setPendingUserId(null);
      }
    },
    [mealPlanId, unshareMutation],
  );

  const isLoading = isLoadingUsers || isLoadingStatus;
  const hasShareableUsers = shareableUsers && shareableUsers.length > 0;
  const sharedCount = shareStatus?.length ?? 0;

  return (
    <TrueSheet ref={sheetRef} detents={[1]} grabber cornerRadius={20}>
      <View>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text type="title2">Share Meal Plan</Text>
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

        <ScrollView style={styles.scrollView}>
          <View style={styles.scrollContent}>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" />
              </View>
            ) : !hasShareableUsers ? (
              <View style={styles.emptyContainer}>
                <Ionicons
                  name="people-outline"
                  size={48}
                  style={styles.emptyIcon}
                />
                <Text type="bodyFaded" style={styles.emptyText}>
                  You don't have any friends to share with yet. Follow other
                  users and have them follow you back to share meal plans!
                </Text>
              </View>
            ) : (
              <>
                {sharedCount > 0 && (
                  <View style={styles.sharedSummary}>
                    <Ionicons
                      name="people"
                      size={18}
                      style={styles.summaryIcon}
                    />
                    <Text type="body">
                      Shared with {sharedCount}{" "}
                      {sharedCount === 1 ? "person" : "people"}
                    </Text>
                  </View>
                )}

                <Text type="heading" style={styles.sectionTitle}>
                  Friends
                </Text>
                <VSpace size={12} />

                {shareableUsers.map((friend) => (
                  <FriendItem
                    key={friend.id}
                    friend={friend}
                    shareStatus={shareStatusMap.get(friend.id)}
                    onToggleShare={(canEdit) =>
                      handleToggleShare(friend.id, canEdit)
                    }
                    onRemoveShare={() => handleRemoveShare(friend.id)}
                    isPending={pendingUserId === friend.id}
                  />
                ))}
              </>
            )}
          </View>
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
    maxHeight: 500,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyIcon: {
    color: theme.colors.textTertiary,
    marginBottom: 12,
  },
  emptyText: {
    textAlign: "center",
    paddingHorizontal: 20,
  },
  sharedSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: theme.colors.primary + "15",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: theme.borderRadius.medium,
    marginBottom: 20,
  },
  summaryIcon: {
    color: theme.colors.primary,
  },
  sectionTitle: {
    marginBottom: 4,
  },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.inputBackground,
  },
  avatarPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarIcon: {
    color: theme.colors.textTertiary,
  },
  friendInfo: {
    flex: 1,
    marginLeft: 12,
  },
  accessText: {
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  sharedIcon: {
    color: theme.colors.primary,
  },
  addIcon: {
    color: theme.colors.textTertiary,
  },
}));
