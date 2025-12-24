import { createContext, useContext } from "react";

import { useSessionContext } from "./sessionContext";

import { useUser } from "@/api/user";

interface SignedInState {
  isSignedIn: boolean;
  onboardingCompleted: boolean;
}

const SignInContext = createContext<SignedInState>({
  isSignedIn: false,
  onboardingCompleted: false,
});

export function useIsSignedIn() {
  const { isSignedIn, onboardingCompleted } = useContext(SignInContext);

  return isSignedIn && onboardingCompleted;
}

export function useIsSignedOut() {
  const { isSignedIn } = useContext(SignInContext);
  return !isSignedIn;
}

export function useNeedsOnboarding() {
  const { isSignedIn, onboardingCompleted } = useContext(SignInContext);

  return isSignedIn && !onboardingCompleted;
}

export const SignedInProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const session = useSessionContext();
  const { data: userData, isPending } = useUser();

  const isSignedIn = !!session;

  if (isSignedIn && isPending) {
    return null;
  }

  const value: SignedInState = {
    isSignedIn,
    onboardingCompleted: userData?.user?.onboardingCompleted ?? false,
  };

  return (
    <SignInContext.Provider value={value}>{children}</SignInContext.Provider>
  );
};
