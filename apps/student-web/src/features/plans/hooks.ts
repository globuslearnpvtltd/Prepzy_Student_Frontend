'use client';

import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';
import { planName, type ActivePlan } from '@/features/auth';
import { findExam, type ExamConfig, type ExamRef } from '@/shared/config/exams';
import { useExamCatalog } from '@/shared/hooks/use-exam-catalog';
import { isPlanCategory, plansApi, type PlanCategory } from './api';
import type { CatalogExam } from './catalog';

const STALE = 5 * 60_000;

export const planKeys = {
  all: ['plans'] as const,
  catalog: (exam: ExamRef, classId?: number | null) => ['plans', 'catalog', exam.category, exam.examId, classId ?? null] as const,
  limits: (exam: ExamRef) => ['plans', 'limits', exam.category, exam.examId] as const,
  coupons: (exam: ExamRef) => ['plans', 'coupons', exam.category, exam.examId] as const,
  quote: (exam: ExamRef, priceId: number, coupon: string | null) =>
    ['plans', 'quote', exam.category, exam.examId, priceId, coupon] as const,
  purchases: (exam: ExamRef) => ['plans', 'purchases', exam.category, exam.examId] as const,
  planPayments: (exam: ExamRef, planId: number, page: number) =>
    ['plans', 'plan-payments', exam.category, exam.examId, planId, page] as const,
  billing: (exam: ExamRef, page?: number) =>
    (page === undefined ? ['plans', 'billing', exam.category, exam.examId] : ['plans', 'billing', exam.category, exam.examId, page]) as readonly unknown[],
};

/** An exam that can be bought: its category, slice, name and exam_id from GET /api/v4/exams. */
export interface PlanExam extends ExamRef {
  category: PlanCategory;
  examSlice: string;
  name: string;
  /** The app's route for the exam, when it has pages for it. */
  slug: string | null;
}

const combineCatalogs = (results: UseQueryResult<CatalogExam>[]) => ({
  pending: results.some((result) => result.isPending),
  data: results.map((result) => result.data ?? null),
  errors: results.map((result) => result.error ?? null),
});

/**
 * Catalogs of every purchasable exam (the checkout lets the student switch exam). Exams, ids and names come from
 * GET /api/v4/exams, filtered to the plan categories, so a new exam in the DB shows up without a code change. It
 * errors when the exam list or the `primary` exam's catalog fails; another exam's failure just leaves that exam out
 * (its card is disabled).
 */
export function useCatalogs(primary: ExamRef) {
  const examList = useExamCatalog();
  const exams = useMemo<PlanExam[]>(
    () =>
      (examList.data ?? []).flatMap((entry) => {
        const design = findExam(entry.examSlice);
        if (!isPlanCategory(entry.category) || (design && design.category !== entry.category)) return [];
        return [{ examId: entry.examId, category: entry.category, examSlice: entry.examSlice, name: entry.name, slug: design?.slug ?? null }];
      }),
    [examList.data],
  );
  const catalogs = useQueries({
    queries: exams.map((exam) => ({ queryKey: planKeys.catalog(exam), queryFn: () => plansApi.catalog(exam), staleTime: STALE })),
    combine: combineCatalogs,
  });
  const primaryIndex = exams.findIndex((exam) => exam.examId === primary.examId && exam.category === primary.category);
  const error = examList.error ?? (primaryIndex >= 0 ? catalogs.errors[primaryIndex] : null) ?? null;
  const settled = examList.isSuccess && !catalogs.pending;
  const data = useMemo<CatalogExam[] | undefined>(
    () =>
      settled
        ? catalogs.data.flatMap((catalog, index) =>
            catalog
              ? [
                  {
                    ...catalog,
                    examKey: exams[index]!.examSlice,
                    title: catalog.title || exams[index]!.name,
                    category: exams[index]!.category,
                    slug: catalog.slug ?? exams[index]!.slug,
                  },
                ]
              : [],
          )
        : undefined,
    [settled, catalogs.data, exams],
  );
  return { data, exams, isPending: !error && !settled, isError: !!error, error };
}

/** Limits only fill the comparison table, so a failure just leaves the price rows. */
export const useFeatureLimits = (exam: ExamRef | null) =>
  useQuery({
    queryKey: exam ? planKeys.limits(exam) : ['plans', 'limits', 'none'],
    queryFn: () => plansApi.featureLimits(exam!),
    enabled: !!exam,
    staleTime: STALE,
  });

export const useCoupons = (exam: ExamRef | null) =>
  useQuery({
    queryKey: exam ? planKeys.coupons(exam) : ['plans', 'coupons', 'none'],
    queryFn: () => plansApi.coupons(exam!),
    enabled: !!exam,
  });

/** Shared by useQuote and the coupon "Apply" (which fetches the same key). */
export const quoteQuery = (exam: ExamRef, priceId: number, coupon: string | null) => ({
  queryKey: planKeys.quote(exam, priceId, coupon),
  queryFn: () => plansApi.quote(exam, priceId, coupon),
  staleTime: 60_000,
  retry: false,
});

/** The server's bill for a paid price; idle while there's nothing to price. */
export function useQuote(exam: ExamRef | null, priceId: number | null, coupon: string | null) {
  return useQuery({
    ...quoteQuery(exam ?? { category: 'board', examId: 0 }, priceId ?? 0, coupon),
    enabled: !!exam && priceId !== null,
  });
}

/** GET /purchases: per plan of the exam, the active purchase, else the latest one. */
export const usePurchases = (exam: ExamRef) => useQuery({ queryKey: planKeys.purchases(exam), queryFn: () => plansApi.purchases(exam) });

/**
 * The name of the student's active plan: the API's `display_name` of its purchase (GET /purchases, shared with the
 * Manage Plans page), else the name composed by the same rule from the active plan and the backend exam list.
 */
export function useActivePlanName(exam: ExamConfig, plan: ActivePlan | null | undefined): string | null {
  const catalog = useExamCatalog();
  const purchases = useQuery({
    queryKey: planKeys.purchases(exam),
    queryFn: () => plansApi.purchases(exam),
    enabled: !!plan && isPlanCategory(exam.category),
    staleTime: STALE,
  });
  if (!plan) return null;
  // The purchase of this plan and length: the active one, else the pending one, else the latest.
  const own = (purchases.data ?? []).filter(
    (purchase) => purchase.planId === plan.planId && purchase.durationMonths === plan.durationMonths && purchase.displayName,
  );
  const purchase = own.find((p) => p.status === 'active') ?? own.find((p) => p.status === 'pending') ?? own[0];
  return purchase?.displayName ?? planName(plan, exam, catalog.data);
}

/** One page of a plan's payments; idle until a plan is opened. */
export const usePlanPayments = (exam: ExamRef, planId: number | null, page: number) =>
  useQuery({
    queryKey: planKeys.planPayments(exam, planId ?? 0, page),
    queryFn: () => plansApi.planPayments(exam, planId!, page),
    enabled: planId !== null,
  });

/** One page of the exam's billing history (GET /payments?page=). */
export const useBillingHistory = (exam: ExamRef, page: number) =>
  useQuery({ queryKey: planKeys.billing(exam, page), queryFn: () => plansApi.payments(exam, page), placeholderData: (previous) => previous });
