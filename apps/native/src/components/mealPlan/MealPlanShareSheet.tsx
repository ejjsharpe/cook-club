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
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

import {
  useGetShareableUsers,
  useGetShareStatus,
  useGetMealPlanInvitationStatus,
  useInviteToMealPlan,
  useCancelMealPlanInvitation,
  useRemoveMealPlanMember,
  type ShareableUser,
} from "../../api/mealPlan";
import { VSpace } from "../Space";
import { Text } from "../Text";

type FriendState = "none" | "invited" | "shared";

interface FriendItemProps {
  friend: ShareableUser;
  state: FriendState;
  onInvite: () => void;
  onCancelInvitation: () => void;
  onRemoveMember: () => void;
  isPending: boolean;
}

const FriendItem = ({
  friend,
  state,
  onInvite,
  onCancelInvitation,
  onRemoveMember,
  isPending,
}: FriendItemProps) => {
  const handlePress = () => {
    if (state === "shared") {
      Alert.alert(
        "Remove Access",
        `Remove ${friend.name}'s access to this meal plan?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove Access",
            style: "destructive",
            onPress: onRemoveMember,
          },
        ],
      );
    } else if (state === "invited") {
      Alert.alert(
        "Cancel Invitation",
        `Cancel the invitation to ${friend.name}?`,
        [
          { text: "Keep", style: "cancel" },
          {
            text: "Cancel Invitation",
            style: "destructive",
            onPress: onCancelInvitation,
          },
        ],
      );
    } else {
      onInvite();
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
        {state === "shared" && (
          <Text type="caption" style={styles.accessText}>
            Shared
          </Text>
        )}
        {state === "invited" && (
          <Text type="caption" style={styles.invitedText}>
            Invited
          </Text>
        )}
      </View>
      {isPending ? (
        <ActivityIndicator size="small" />
      ) : state === "shared" ? (
        <Ionicons name="checkmark-circle" size={24} style={styles.sharedIcon} />
      ) : state === "invited" ? (
        <Ionicons name="time-outline" size={24} style={styles.invitedIcon} />
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
  const theme = UnistylesRuntime.getTheme();
  const sheetRef = useRef<TrueSheet>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const { data: shareableUsers, isLoading: isLoadingUsers } =
    useGetShareableUsers();
  const { data: shareStatus, isLoading: isLoadingStatus } = useGetShareStatus({
    mealPlanId: mealPlanId ?? 0,
    enabled: !!mealPlanId,
  });
  const { data: invitationStatus, isLoading: isLoadingInvitations } =
    useGetMealPlanInvitationStatus({
      mealPlanId: mealPlanId ?? 0,
      enabled: !!mealPlanId,
    });

  const inviteMutation = useInviteToMealPlan();
  const cancelInvitationMutation = useCancelMealPlanInvitation();
  const removeMemberMutation = useRemoveMealPlanMember();

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const handleClose = () => {
    sheetRef.current?.dismiss();
  };

  // Build lookup maps
  const sharedUserIds = new Set(shareStatus?.map((s) => s.userId) ?? []);
  const invitedUserIds = new Set(invitationStatus?.map((i) => i.userId) ?? []);

  const getFriendState = (userId: string): FriendState => {
    if (sharedUserIds.has(userId)) return "shared";
    if (invitedUserIds.has(userId)) return "invited";
    return "none";
  };

  const handleInvite = useCallback(
    async (userId: string) => {
      if (!mealPlanId) return;
      setPendingUserId(userId);
      try {
        await inviteMutation.mutateAsync({ mealPlanId, userId });
      } catch {
        // Error handled by mutation
      } finally {
        setPendingUserId(null);
      }
    },
    [mealPlanId, inviteMutation],
  );

  const handleCancelInvitation = useCallback(
    async (userId: string) => {
      if (!mealPlanId) return;
      setPendingUserId(userId);
      try {
        await cancelInvitationMutation.mutateAsync({ mealPlanId, userId });
      } catch {
        // Error handled by mutation
      } finally {
        setPendingUserId(null);
      }
    },
    [mealPlanId, cancelInvitationMutation],
  );

  const handleRemoveMember = useCallback(
    async (userId: string) => {
      if (!mealPlanId) return;
      setPendingUserId(userId);
      try {
        await removeMemberMutation.mutateAsync({ mealPlanId, userId });
      } catch {
        // Error handled by mutation
      } finally {
        setPendingUserId(null);
      }
    },
    [mealPlanId, removeMemberMutation],
  );

  const isLoading = isLoadingUsers || isLoadingStatus || isLoadingInvitations;
  const hasShareableUsers = shareableUsers && shareableUsers.length > 0;
  const sharedCount = shareStatus?.length ?? 0;
  const invitedCount = invitationStatus?.length ?? 0;

  return (
    <TrueSheet
      ref={sheetRef}
      detents={[0.8]}
      grabber={false}
      backgroundColor={theme.colors.background}
      scrollable
    >
      <View>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <View style={styles.headerCenter}>
            <Text type="headline">Share Meal Plan</Text>
            {planName && (
              <Text type="caption" style={styles.planNameText}>
                {planName}
              </Text>
            )}
          </View>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <View style={styles.closeButtonCircle}>
              <Ionicons name="close" size={16} style={styles.closeIcon} />
            </View>
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
                {(sharedCount > 0 || invitedCount > 0) && (
                  <View style={styles.sharedSummary}>
                    <Ionicons
                      name="people"
                      size={18}
                      style={styles.summaryIcon}
                    />
                    <Text type="body">
                      {sharedCount > 0 &&
                        `Shared with ${sharedCount} ${sharedCount === 1 ? "person" : "people"}`}
                      {sharedCount > 0 && invitedCount > 0 && " · "}
                      {invitedCount > 0 && `${invitedCount} pending`}
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
                    state={getFriendState(friend.id)}
                    onInvite={() => handleInvite(friend.id)}
                    onCancelInvitation={() => handleCancelInvitation(friend.id)}
                    onRemoveMember={() => handleRemoveMember(friend.id)}
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
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerSpacer: {
    width: 30,
  },
  headerCenter: {
    alignItems: "center",
  },
  closeButton: {
    padding: 4,
  },
  closeButtonCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.inputBackground,
    justifyContent: "center",
    alignItems: "center",
  },
  planNameText: {
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  closeIcon: {
    color: theme.colors.textSecondary,
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
  invitedText: {
    color: "#F59E0B",
    marginTop: 2,
  },
  sharedIcon: {
    color: theme.colors.primary,
  },
  invitedIcon: {
    color: "#F59E0B",
  },
  addIcon: {
    color: theme.colors.textTertiary,
  },
}));
