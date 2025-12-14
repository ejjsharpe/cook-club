import { TRPCProvider as _TRPCProvider, createTRPCClient } from '@repo/trpc/client';
import { useQueryClient } from '@tanstack/react-query';

import { authClient } from './authClient';

export const TRPCProvider = ({ children }: { children: React.ReactNode }) => {
  const queryClient = useQueryClient();

  const trpcClient = createTRPCClient({
    apiUrl: 'http://localhost:8787/api/trpc',
    cookie: authClient.getCookie(),
  });

  return (
    <_TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
      {children}
    </_TRPCProvider>
  );
};
