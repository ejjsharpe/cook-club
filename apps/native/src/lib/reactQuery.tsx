import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { PropsWithChildren, useEffect } from "react";

import { setupOnlineManager } from "./onlineManager";
import { persistOptions } from "./queryPersister";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 3,
    },
  },
});

export const ReactQueryProvider = ({ children }: PropsWithChildren) => {
  useEffect(() => {
    return setupOnlineManager();
  }, []);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={persistOptions}
    >
      {children}
    </PersistQueryClientProvider>
  );
};
