import { useMutation, useQueryClient } from "@tanstack/react-query";

import { authClient } from "@/lib/authClient";
import { clearSelectedMealPlan } from "@/lib/mealPlanPreferences";
import { storage } from "@/lib/mmkv";
import { clearPendingShareIntent } from "@/lib/pendingShareIntent";
import {
  setThemePreference,
  applyThemePreference,
} from "@/lib/themePreferences";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export const useSignInWithEmail = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      email,
      password,
    }: {
      email: string;
      password: string;
    }) => {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) {
        throw new AuthError(
          result.error.message ?? "Sign in failed",
          result.error.status ?? 500,
        );
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
};

export const useSignUpWithEmail = () => {
  return useMutation({
    mutationFn: async ({
      email,
      password,
    }: {
      email: string;
      password: string;
    }) => {
      const result = await authClient.signUp.email({
        email,
        password,
        name: "Cook",
        callbackURL: "cookclub://",
      });
      if (result.error) {
        throw new AuthError(
          result.error.message ?? "Sign up failed",
          result.error.status ?? 500,
        );
      }
      return result.data;
    },
  });
};

export const useSignInWithSocial = () => {
  const queryClient = useQueryClient();
  return useMutation({
    onError: (e) => console.log(e),
    mutationFn: ({ provider }: { provider: "google" | "facebook" | "apple" }) =>
      authClient.signIn.social({ provider, callbackURL: "/" }),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
};

export const useSignOut = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authClient.signOut(),
    onSuccess: () => {
      queryClient.setQueryData(["session"], null);
      queryClient.clear();
      storage.delete("cook-club-query-cache");
      clearSelectedMealPlan();
      clearPendingShareIntent();
      setThemePreference("system");
      applyThemePreference("system");
    },
  });
};
