import { createContext, useContext } from 'react';

import { useSessionContext } from './sessionContext';

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
  const session = useSessionContext();

  const isSignedIn = !!session;
  return <SignInContext.Provider value={isSignedIn}>{children}</SignInContext.Provider>;
};
