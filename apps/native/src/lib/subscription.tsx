import { useQueryClient } from "@tanstack/react-query";
import { createPaywallView } from "react-native-adapty";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { Alert } from "react-native";
import { useTRPC } from "@repo/trpc/client";

import {
  useRefreshSubscriptionEntitlement,
  useSubscriptionStatus,
  type SubscriptionStatus,
} from "@/api/subscription";
import {
  ADAPTY_PAYWALL_PLACEMENT_ID,
  adapty,
  identifyAdaptyUser,
  isAdaptyConfigured,
} from "@/lib/adapty";
import { useSessionContext } from "@/lib/sessionContext";

interface SubscriptionContextValue {
  status: SubscriptionStatus | undefined;
  isPro: boolean;
  isLoading: boolean;
  smartImportsUsed: number;
  smartImportsLimit: number | null;
  smartImportsRemaining: number | null;
  canUseSmartImport: boolean;
  presentPaywall: () => Promise<boolean>;
  restorePurchases: () => Promise<void>;
  refresh: () => Promise<SubscriptionStatus | undefined>;
  requireProFeature: (featureName?: string) => Promise<boolean>;
  requireSmartImport: () => Promise<boolean>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: PropsWithChildren) {
  const session = useSessionContext();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const enabled = Boolean(session?.user.id);
  const statusQuery = useSubscriptionStatus(enabled);
  const refreshMutation = useRefreshSubscriptionEntitlement();
  const [isPresentingPaywall, setIsPresentingPaywall] = useState(false);
  const activatedUserIdRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session?.user.id) return undefined;
    const nextStatus = await refreshMutation.mutateAsync();
    await queryClient.invalidateQueries(
      trpc.subscription.getStatus.pathFilter(),
    );
    return nextStatus;
  }, [queryClient, refreshMutation, session?.user.id, trpc]);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId || !isAdaptyConfigured()) return;
    if (activatedUserIdRef.current === userId) return;

    let isMounted = true;
    activatedUserIdRef.current = userId;

    identifyAdaptyUser(userId)
      .then(() => {
        if (isMounted) {
          refresh().catch((error) => {
            console.log("Subscription refresh failed:", error);
          });
        }
      })
      .catch((error) => {
        console.log("Adapty activation failed:", error);
      });

    const listener = adapty.addEventListener("onLatestProfileLoad", () => {
      refresh().catch((error) => {
        console.log("Subscription refresh failed:", error);
      });
    });

    return () => {
      isMounted = false;
      listener.remove();
    };
  }, [refresh, session?.user.id]);

  const presentPaywall = useCallback(async () => {
    if (!isAdaptyConfigured()) {
      Alert.alert(
        "Subscriptions unavailable",
        "Adapty is not configured for this build.",
      );
      return false;
    }

    if (!session?.user.id || isPresentingPaywall) return false;

    setIsPresentingPaywall(true);
    let purchaseCompleted = false;

    try {
      await identifyAdaptyUser(session.user.id);

      const paywall = await adapty.getPaywall(ADAPTY_PAYWALL_PLACEMENT_ID);
      const view = await createPaywallView(paywall);
      view.setEventHandlers({
        onPurchaseCompleted: (purchaseResult) => {
          purchaseCompleted = purchaseResult.type === "success";
          refresh().catch((error) => {
            console.log("Subscription refresh failed:", error);
          });
          return purchaseResult.type !== "user_cancelled";
        },
        onRestoreCompleted: () => {
          refresh().catch((error) => {
            console.log("Subscription refresh failed:", error);
          });
          return true;
        },
      });
      await view.present();
      const refreshedStatus = await refresh();
      return Boolean(refreshedStatus?.isPro || purchaseCompleted);
    } catch (error: any) {
      Alert.alert(
        "Subscription unavailable",
        error?.message || "Could not open the subscription screen.",
      );
      return false;
    } finally {
      setIsPresentingPaywall(false);
    }
  }, [isPresentingPaywall, refresh, session?.user.id]);

  const restorePurchases = useCallback(async () => {
    if (!isAdaptyConfigured()) {
      Alert.alert(
        "Subscriptions unavailable",
        "Adapty is not configured for this build.",
      );
      return;
    }

    try {
      if (session?.user.id) {
        await identifyAdaptyUser(session.user.id);
      }
      await adapty.restorePurchases();
      await refresh();
      Alert.alert("Purchases restored", "Your subscription status is updated.");
    } catch (error: any) {
      Alert.alert(
        "Restore failed",
        error?.message || "Could not restore purchases.",
      );
    }
  }, [refresh, session?.user.id]);

  const status = statusQuery.data;
  const isPro = Boolean(status?.isPro);
  const smartImportsUsed = status?.smartImports.used ?? 0;
  const smartImportsLimit = status ? status.smartImports.limit : 5;
  const smartImportsRemaining = status ? status.smartImports.remaining : 5;
  const canUseSmartImport = isPro || (smartImportsRemaining ?? 0) > 0;

  const requireProFeature = useCallback(
    async (_featureName?: string) => {
      if (isPro) return true;
      return await presentPaywall();
    },
    [isPro, presentPaywall],
  );

  const requireSmartImport = useCallback(async () => {
    if (canUseSmartImport) return true;
    return await presentPaywall();
  }, [canUseSmartImport, presentPaywall]);

  const value = useMemo(
    () => ({
      status,
      isPro,
      isLoading: statusQuery.isPending || refreshMutation.isPending,
      smartImportsUsed,
      smartImportsLimit,
      smartImportsRemaining,
      canUseSmartImport,
      presentPaywall,
      restorePurchases,
      refresh,
      requireProFeature,
      requireSmartImport,
    }),
    [
      canUseSmartImport,
      isPro,
      presentPaywall,
      refresh,
      refreshMutation.isPending,
      requireProFeature,
      requireSmartImport,
      restorePurchases,
      smartImportsLimit,
      smartImportsRemaining,
      smartImportsUsed,
      status,
      statusQuery.isPending,
    ],
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error("useSubscription must be used within SubscriptionProvider");
  }
  return context;
}
