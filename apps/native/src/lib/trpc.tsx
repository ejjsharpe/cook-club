import {
  TRPCProvider as _TRPCProvider,
  createTRPCClient,
} from "@repo/trpc/client";
import { useQueryClient } from "@tanstack/react-query";

import { authClient } from "./authClient";
import { getApiUrl } from "./runtimeConfig";

export const TRPCProvider = ({ children }: { children: React.ReactNode }) => {
  const queryClient = useQueryClient();

  const trpcClient = createTRPCClient({
    apiUrl: getApiUrl(),
    getCookie: () => authClient.getCookie(),
  });

  return (
    <_TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
      {children}
    </_TRPCProvider>
  );
};
