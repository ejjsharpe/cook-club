import { TRPCProvider as _TRPCProvider, createTRPCClient } from '@repo/trpc/client';
import { useQueryClient } from '@tanstack/react-query';

const trpcClient = createTRPCClient({ apiUrl: 'http://localhost:55707' });

export const TRPCProvider = ({ children }: { children: React.ReactNode }) => {
  const queryClient = useQueryClient();
  return (
    <_TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
      {children}
    </_TRPCProvider>
  );
};
