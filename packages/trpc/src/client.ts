import {
  createTRPCClient as _createTRPCClient,
  httpBatchLink,
} from "@trpc/client";
import { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { createTRPCContext } from "@trpc/tanstack-react-query";

import type { AppRouter, UserCollectionWithMetadata, FeedItem } from "./server";

// Re-export service types for frontend use
export type { UserCollectionWithMetadata, FeedItem };

export const createTRPCClient = ({
  apiUrl,
  cookie,
}: {
  apiUrl: string;
  cookie: string | undefined;
}) => {
  return _createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: apiUrl,
        headers() {
          return {
            cookie,
          };
        },
      }),
    ],
  });
};

export type Inputs = inferRouterInputs<AppRouter>;
export type Outputs = inferRouterOutputs<AppRouter>;

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();
