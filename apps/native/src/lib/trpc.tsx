import {
  TRPCProvider as _TRPCProvider,
  createTRPCClient,
} from "@repo/trpc/client";
import { useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";

import { authClient } from "./authClient";

const getApiUrl = () => {
  if (process.env.NODE_ENV === "production") {
    return "https://your-production-url.com/api/trpc"; // TODO: update for production
  }
  const debuggerHost = Constants.expoConfig?.hostUri;
  const localhost = debuggerHost?.split(":")[0];
  return `http://${localhost}:8787/api/trpc`;
};

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
