import { useTRPC } from '@repo/trpc/client';
import { useQuery } from '@tanstack/react-query';

export const useUser = () => {
  const trpc = useTRPC();

  return useQuery(trpc.getUser.queryOptions());
};
