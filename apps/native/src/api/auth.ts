import { useMutation } from "@tanstack/react-query";

import { authClient } from "@/lib/authClient";

export const useSignInWithEmail = () => {
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authClient.signIn.email({ email, password }),
  });
};

export const useSignUpWithEmail = () => {
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
  });
};

export const useSignInWithSocial = () => {
  return useMutation({
    onError: (e) => console.log(e),
    mutationFn: ({ provider }: { provider: "google" | "facebook" | "apple" }) =>
      authClient.signIn.social({ provider, callbackURL: "/" }),
  });
};

export const useSignOut = () => {
  return useMutation({
    mutationFn: () => authClient.signOut(),
  });
};
