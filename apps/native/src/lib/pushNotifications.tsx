import { useTRPC } from "@repo/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import type { ReactNode } from "react";

import { useSessionContext } from "./sessionContext";

import { navigationRef } from "@/navigation/RootStack";

type PushNotificationData = {
  notificationId?: unknown;
  type?: unknown;
  actorId?: unknown;
  activityEventId?: unknown;
  mealPlanId?: unknown;
  shoppingListId?: unknown;
  commentId?: unknown;
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function getProjectId(): string | null {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    null
  );
}

function getPlatform(): "ios" | "android" | "web" {
  if (process.env.EXPO_OS === "ios") {
    return "ios";
  }

  if (process.env.EXPO_OS === "android") {
    return "android";
  }

  return "web";
}

function invalidateNotificationQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  trpc: ReturnType<typeof useTRPC>,
) {
  queryClient.invalidateQueries(trpc.notification.pathFilter());
}

function navigateWhenReady(data: PushNotificationData, attempts = 0) {
  if (!navigationRef.isReady()) {
    if (attempts < 20) {
      setTimeout(() => navigateWhenReady(data, attempts + 1), 250);
    }
    return;
  }

  const type = typeof data.type === "string" ? data.type : null;
  const actorId = typeof data.actorId === "string" ? data.actorId : null;

  switch (type) {
    case "follow":
    case "activity_like":
    case "activity_comment":
    case "comment_reply":
      if (actorId) {
        navigationRef.navigate("UserProfile", { userId: actorId });
        return;
      }
      break;
    case "meal_plan_share":
      navigationRef.navigate("Tabs", { screen: "Meal Plan" } as never);
      return;
    case "meal_plan_invite":
    case "shopping_list_invite":
      navigationRef.navigate("Notifications");
      return;
  }

  navigationRef.navigate("Notifications");
}

export async function getCurrentExpoPushToken(): Promise<string | null> {
  const existingPermissions = await Notifications.getPermissionsAsync();

  if (existingPermissions.status !== "granted") {
    return null;
  }

  const projectId = getProjectId();
  if (!projectId) {
    console.warn("Missing EAS project ID for push notifications");
    return null;
  }

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return token.data;
}

async function requestAndRegisterPushToken(params: {
  registerToken: (input: {
    token: string;
    platform: "ios" | "android" | "web";
  }) => void;
}) {
  await Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: Notifications.AndroidImportance.DEFAULT,
  });

  const existingPermissions = await Notifications.getPermissionsAsync();
  let finalStatus = existingPermissions.status;

  if (finalStatus !== "granted") {
    const requestedPermissions = await Notifications.requestPermissionsAsync();
    finalStatus = requestedPermissions.status;
  }

  if (finalStatus !== "granted") {
    return;
  }

  const token = await getCurrentExpoPushToken();
  if (!token) {
    return;
  }

  params.registerToken({
    token,
    platform: getPlatform(),
  });
}

export const PushNotificationsProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const sessionContext = useSessionContext();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutate: registerPushToken } = useMutation(
    trpc.notification.registerPushToken.mutationOptions(),
  );

  useEffect(() => {
    if (!sessionContext?.user.id) {
      return;
    }

    let cancelled = false;
    requestAndRegisterPushToken({
      registerToken: (input) => {
        if (!cancelled) {
          registerPushToken(input);
        }
      },
    }).catch((error) => {
      console.warn("Failed to register push notifications", error);
    });

    return () => {
      cancelled = true;
    };
  }, [registerPushToken, sessionContext?.user.id]);

  useEffect(() => {
    const receivedSubscription = Notifications.addNotificationReceivedListener(
      () => {
        invalidateNotificationQueries(queryClient, trpc);
      },
    );

    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        invalidateNotificationQueries(queryClient, trpc);
        navigateWhenReady(
          response.notification.request.content.data as PushNotificationData,
        );
      });

    let cancelled = false;
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!cancelled && response) {
          invalidateNotificationQueries(queryClient, trpc);
          navigateWhenReady(
            response.notification.request.content.data as PushNotificationData,
          );
        }
      })
      .catch((error) => {
        console.warn("Failed to read last push notification response", error);
      });

    return () => {
      cancelled = true;
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, [queryClient, trpc]);

  return children;
};
