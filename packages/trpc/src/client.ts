import {
  createTRPCClient as _createTRPCClient,
  httpBatchLink,
} from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";

import type { AppRouter } from "./server";

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

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();
