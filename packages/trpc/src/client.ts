import {
  createTRPCClient as _createTRPCClient,
  httpBatchLink,
} from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";

import type { AppRouter } from "./server";

export const createTRPCClient = ({ apiUrl }: { apiUrl: string }) => {
  return _createTRPCClient<AppRouter>({
    links: [httpBatchLink({ url: apiUrl })],
  });
};

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();
