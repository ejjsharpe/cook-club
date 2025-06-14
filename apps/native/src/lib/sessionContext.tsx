import { Session } from 'better-auth';
import { createContext, useContext } from 'react';
import { authClient } from './authClient';

interface User {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  image?: string | null | undefined | undefined;
}

const SessionContext = createContext<{ user: User; session: Session } | null>(null);

export const useSessionContext = () => useContext(SessionContext);

export const SessionProvider = ({ children }: { children: React.ReactNode }) => {
  const { data, isPending } = authClient.useSession();

  if (isPending) return null;

  return <SessionContext.Provider value={data}>{children}</SessionContext.Provider>;
};
