import {
  createTRPCClient as _createTRPCClient,
  httpBatchLink,
} from "@trpc/client";
import { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { createTRPCContext } from "@trpc/tanstack-react-query";

import type { AppRouter } from "./server";

export const createTRPCClient = ({
  apiUrl,
  getCookie,
}: {
  apiUrl: string;
  getCookie: () => string | undefined;
}) => {
  return _createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: apiUrl,
        headers() {
          return {
            cookie: getCookie(),
          };
        },
      }),
    ],
  });
};

export type Inputs = inferRouterInputs<AppRouter>;
export type Outputs = inferRouterOutputs<AppRouter>;

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();
