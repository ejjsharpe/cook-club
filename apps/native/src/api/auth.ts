import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SheetManager } from "react-native-actions-sheet";

import { authClient } from "@/lib/authClient";

const dismissAuthSheets = () => {
  SheetManager.hide("sign-in-sheet");
  SheetManager.hide("sign-up-sheet");
};

export const useSignInWithEmail = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authClient.signIn.email({ email, password }),
    onSuccess: () => {
      dismissAuthSheets();
      queryClient.invalidateQueries();
    },
  });
};

export const useSignUpWithEmail = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      email,
      password,
      name,
    }: {
      email: string;
      password: string;
      name: string;
    }) => authClient.signUp.email({ email, password, name }),
    onSuccess: () => {
      dismissAuthSheets();
      queryClient.invalidateQueries();
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
      dismissAuthSheets();
      queryClient.invalidateQueries();
    },
  });
};

export const useSignOut = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authClient.signOut(),
    onSuccess: () => {
      queryClient.invalidateQueries();
      queryClient.clear();
    },
  });
};
