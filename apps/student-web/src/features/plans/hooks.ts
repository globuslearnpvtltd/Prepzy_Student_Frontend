'use client';

import { useQuery } from '@tanstack/react-query';
import { plansApi } from './api';

export const planKeys = {
  catalog: ['plans', 'catalog'] as const,
  limits: ['plans', 'limits'] as const,
  coupons: ['plans', 'coupons'] as const,
  boardPlans: ['plans', 'board'] as const,
  boardPayments: (planId: number, page: number) => ['plans', 'board-payments', planId, page] as const,
  learningPlans: ['plans', 'learning'] as const,
  billing: ['plans', 'billing'] as const,
};

export const useCatalog = () => useQuery({ queryKey: planKeys.catalog, queryFn: plansApi.catalog, staleTime: 5 * 60_000 });

/** Limits only fill the comparison table, so a failure just leaves the price rows. */
export const useFeatureLimits = () =>
  useQuery({ queryKey: planKeys.limits, queryFn: plansApi.featureLimits, staleTime: 5 * 60_000 });

export const useCoupons = () => useQuery({ queryKey: planKeys.coupons, queryFn: plansApi.coupons });

export const useBoardPlans = (enabled: boolean) =>
  useQuery({ queryKey: planKeys.boardPlans, queryFn: plansApi.boardPlans, enabled });

export const useBoardPayments = (planId: number | null, page: number) =>
  useQuery({
    queryKey: planKeys.boardPayments(planId ?? 0, page),
    queryFn: () => plansApi.boardPayments(planId!, page),
    enabled: planId !== null,
  });

export const useLearningPlans = (enabled: boolean) =>
  useQuery({ queryKey: planKeys.learningPlans, queryFn: plansApi.learningPlans, enabled });

export const useBillingHistory = () => useQuery({ queryKey: planKeys.billing, queryFn: plansApi.billingHistory });
