import { adapty } from "react-native-adapty";

export const ADAPTY_PAYWALL_PLACEMENT_ID =
  process.env.EXPO_PUBLIC_ADAPTY_PAYWALL_PLACEMENT_ID ?? "pro_paywall";

const ADAPTY_SDK_KEY = process.env.EXPO_PUBLIC_ADAPTY_PUBLIC_SDK_KEY;

let activationPromise: Promise<void> | null = null;
let identifiedUserId: string | null = null;

export function isAdaptyConfigured() {
  return Boolean(ADAPTY_SDK_KEY);
}

export function activateAdaptyAtStartup() {
  if (!ADAPTY_SDK_KEY || activationPromise) return activationPromise;

  activationPromise = adapty
    .activate(ADAPTY_SDK_KEY, {
      activateUi: true,
      __ignoreActivationOnFastRefresh: true,
    })
    .catch((error) => {
      activationPromise = null;
      throw error;
    });

  return activationPromise;
}

export async function identifyAdaptyUser(userId: string) {
  if (!ADAPTY_SDK_KEY) return;

  await (activationPromise ?? activateAdaptyAtStartup());

  if (identifiedUserId === userId) return;

  await adapty.identify(userId);
  identifiedUserId = userId;
}

export { adapty };
