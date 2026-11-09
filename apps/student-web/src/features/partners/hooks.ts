'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ApiError } from '@/shared/lib/errors';
import { partnerApi, partnerRoutes, type BankDetailsInput } from './api';

export const partnerKeys = {
  all: ['partners'] as const,
  profile: ['partners', 'profile'] as const,
  summary: ['partners', 'summary'] as const,
  friends: ['partners', 'friends'] as const,
  statement: ['partners', 'statement'] as const,
  payouts: ['partners', 'payouts'] as const,
  bank: ['partners', 'bank-details'] as const,
  types: ['partners', 'types'] as const,
};

export const usePartnerProfile = () => useQuery({ queryKey: partnerKeys.profile, queryFn: partnerApi.profile });
export const usePartnerSummary = () => useQuery({ queryKey: partnerKeys.summary, queryFn: partnerApi.summary });
export const usePartnerFriends = () => useQuery({ queryKey: partnerKeys.friends, queryFn: partnerApi.friends });
export const usePartnerStatement = () => useQuery({ queryKey: partnerKeys.statement, queryFn: partnerApi.statement });
export const usePayouts = () => useQuery({ queryKey: partnerKeys.payouts, queryFn: partnerApi.payouts });
export const useBankDetails = () => useQuery({ queryKey: partnerKeys.bank, queryFn: partnerApi.bankDetails });
export const usePartnerTypes = () =>
  useQuery({ queryKey: partnerKeys.types, queryFn: partnerApi.partnerTypes, staleTime: 60 * 60_000 });

/** Ends the partner session, forgets every cached response and returns to the partner login. */
export function usePartnerLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: partnerApi.logout,
    onSettled: () => {
      queryClient.clear();
      router.replace(partnerRoutes.login);
    },
  });
}

/**
 * No profile (404) means a sign-up that stopped before "How to reach you": drop that session and send them back
 * to finish it, instead of loading forever.
 */
export function useUnfinishedSignupRedirect(error: unknown) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const unfinished = error instanceof ApiError && error.status === 404;
  useEffect(() => {
    if (!unfinished) return;
    void partnerApi
      .logout()
      .catch(() => undefined)
      .finally(() => {
        queryClient.removeQueries({ queryKey: partnerKeys.all });
        router.replace(partnerRoutes.signup);
      });
  }, [unfinished, queryClient, router]);
  return unfinished;
}

export function useRequestPayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: partnerApi.requestPayout,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: partnerKeys.payouts }),
        queryClient.invalidateQueries({ queryKey: partnerKeys.summary }),
      ]),
  });
}

export function useSaveBankDetails() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BankDetailsInput) => partnerApi.saveBankDetails(input),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: partnerKeys.bank }),
        queryClient.invalidateQueries({ queryKey: partnerKeys.profile }),
      ]),
  });
}
