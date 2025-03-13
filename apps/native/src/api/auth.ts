import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { authClient } from '@/lib/authClient';

export const useSession = () =>
  useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data, error } = await authClient.getSession();

      if (error) throw new Error(error.message);

      return data;
    },
  });

export const useSignInWithEmail = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authClient.signIn.email({ email, password }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['session'] });
    },
  });
};

export const useSignUpWithEmail = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ email, password, name }: { email: string; password: string; name: string }) =>
      authClient.signUp.email({ email, password, name }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['session'] });
    },
  });
};

export const useSignInWithSocial = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ provider }: { provider: 'google' | 'facebook' | 'apple' }) =>
      authClient.signIn.social({ provider, callbackURL: '/' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['session'] });
    },
  });
};
