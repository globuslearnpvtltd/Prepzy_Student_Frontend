'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { create } from 'zustand';
import { DEFAULT_EXAM, getExam, type ExamConfig } from '@/shared/config/exams';
import { portalForHost, portalForPath } from '@/shared/config/portals';
import { routes } from '@/shared/config/routes';
import { onApiEvent } from '@/shared/lib/api-client';
import { authApi } from './api';
import { forgetExam } from './device';
import type { ActivePlan, Student } from './model';

export const authKeys = {
  me: ['auth', 'me'] as const,
  purchasedExams: ['auth', 'purchased-exams'] as const,
  plans: (examId: number) => ['auth', 'plans', examId] as const,
};

export function useCurrentUser() {
  return useQuery({ queryKey: authKeys.me, queryFn: authApi.me, staleTime: 5 * 60_000 });
}

export function usePurchasedExams() {
  return useQuery({ queryKey: authKeys.purchasedExams, queryFn: authApi.purchasedExams, staleTime: 5 * 60_000 });
}

/** Same storage key as the previous app, so the class a student picked there stays picked. */
const SELECTED_PLAN_KEY = 'selectedPlanId';

function readSelectedPlan(): number | null {
  try {
    const value = Number(localStorage.getItem(SELECTED_PLAN_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

/** The plan (class) the student switched to with the class switcher. */
export const usePlanSelection = create<{ planId: number | null; select: (planId: number) => void }>((set) => ({
  planId: typeof window === 'undefined' ? null : readSelectedPlan(),
  select: (planId) => {
    try {
      localStorage.setItem(SELECTED_PLAN_KEY, String(planId));
    } catch {
      // Private mode: the choice still applies for this visit.
    }
    set({ planId });
  },
}));

/** Every plan the student has for an exam, including expired ones (shown greyed out in the class switcher). */
export function usePlans(exam: ExamConfig) {
  return useQuery({
    queryKey: authKeys.plans(exam.examId),
    queryFn: () => authApi.activePlans(exam.examId),
    staleTime: 5 * 60_000,
  });
}

/** The selected active plan, else the first active plan, else null. */
export function pickActivePlan(plans: ActivePlan[], selectedId: number | null): ActivePlan | null {
  const active = plans.filter((plan) => plan.status === 'active');
  return active.find((plan) => plan.planId === selectedId) ?? active[0] ?? null;
}

/** The student's current plan for an exam: the class they picked in the class switcher, or the first active one. */
export function useActivePlan(exam: ExamConfig) {
  const selectedId = usePlanSelection((state) => state.planId);
  return useQuery({
    queryKey: authKeys.plans(exam.examId),
    queryFn: () => authApi.activePlans(exam.examId),
    select: (plans): ActivePlan | null => pickActivePlan(plans, selectedId),
    staleTime: 5 * 60_000,
  });
}

/** Dashboard of the student's exam, falling back to the default exam. */
export function homeFor(student: Pick<Student, 'targetExam'> | null | undefined): string {
  return routes.dashboard(getExam(student?.targetExam)?.slug ?? DEFAULT_EXAM);
}

export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      forgetExam();
      queryClient.clear();
      router.replace(routes.login());
    },
  });
}

/** Sends the student to login once when any request reports an expired session. */
export function useSessionExpiryRedirect() {
  const queryClient = useQueryClient();
  const router = useRouter();
  useEffect(() => {
    let redirecting = false;
    return onApiEvent('unauthorized', () => {
      if (redirecting) return;
      redirecting = true;
      queryClient.clear();
      // Parents / schools / partners go back to their own portal's login (by subdomain or base path).
      const portal = portalForHost(window.location.host) ?? portalForPath(window.location.pathname);
      router.replace(portal?.login ?? routes.login());
    });
  }, [queryClient, router]);
}
