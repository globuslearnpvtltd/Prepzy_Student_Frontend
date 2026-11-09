'use client';

import { useQuery } from '@tanstack/react-query';
import { referralApi } from './api';

export const referralKeys = {
  hub: ['referral', 'hub'] as const,
  plans: ['referral', 'plan-options'] as const,
};

export function useReferralHub() {
  return useQuery({ queryKey: referralKeys.hub, queryFn: referralApi.hub });
}

/** Plans for the calculator; the page works without them (calculator says "Loading plans…"). */
export function usePlanOptions() {
  return useQuery({ queryKey: referralKeys.plans, queryFn: referralApi.planOptions, staleTime: 30 * 60_000 });
}
