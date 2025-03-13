import { createContext, useContext } from 'react';

import { useSession } from '@/api/auth';

const SignInContext = createContext<boolean>(false);

export function useIsSignedIn() {
  const isSignedIn = useContext(SignInContext);
  return isSignedIn;
}

export function useIsSignedOut() {
  const isSignedIn = useContext(SignInContext);
  return !isSignedIn;
}

export const SignedInProvider = ({ children }: { children: React.ReactNode }) => {
  const { data, isPending } = useSession();

  if (isPending) return null;

  const isSignedIn = !!data?.session;
  return <SignInContext.Provider value={isSignedIn}>{children}</SignInContext.Provider>;
};
