import { useQuery } from "@tanstack/react-query";
import { Session } from "better-auth";
import { createContext, useContext } from "react";

import { authClient } from "./authClient";

interface User {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  image?: string | null | undefined | undefined;
}

const SessionContext = createContext<{ user: User; session: Session } | null>(
  null,
);

export const useSessionContext = () => useContext(SessionContext);

export const SessionProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { data, isPending, isError } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const result = await authClient.getSession();
      console.log({ result });
      return result.data;
    },
  });

  // Only block on initial load, don't block forever on error
  if (isPending && !isError) return null;

  return (
    <SessionContext.Provider value={data ?? null}>
      {children}
    </SessionContext.Provider>
  );
};
