'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useCatalogs } from '@/features/plans';
import type { ExamRef } from '@/shared/config/exams';
import { buildPlanOptions, referralApi } from './api';

export const referralKeys = {
  hub: ['referral', 'hub'] as const,
};

export function useReferralHub() {
  return useQuery({ queryKey: referralKeys.hub, queryFn: referralApi.hub });
}

/**
 * Plans for the calculator, from the v4 billing catalog of every purchasable exam (shared with the plans page).
 * The page works without them (the calculator says "Loading plans…").
 */
export function usePlanOptions(exam: ExamRef) {
  const catalogs = useCatalogs(exam);
  const data = useMemo(() => (catalogs.data ? buildPlanOptions(catalogs.data) : undefined), [catalogs.data]);
  return { data, isPending: catalogs.isPending, isError: catalogs.isError };
}
