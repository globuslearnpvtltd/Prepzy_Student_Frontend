'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { DEFAULT_EXAM, examSlugOf, type ExamConfig } from '@/shared/config/exams';
import { isPortalPublicPath, portalForHost, portalForPath } from '@/shared/config/portals';
import { isPublicPath, routes } from '@/shared/config/routes';
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

/** Dashboard of the student's exam (any exam's slug, see Student.targetExam), falling back to the default exam. */
export function homeFor(student: Pick<Student, 'targetExam'> | null | undefined): string {
  return routes.dashboard(examSlugOf(student?.targetExam) ?? DEFAULT_EXAM);
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

/** The login page for the current page: the portal's (by subdomain or base path) or the student app's. */
function sessionLogin(): { login: string; isPublic: boolean } {
  const { host, pathname } = window.location;
  const portal = portalForHost(host) ?? portalForPath(pathname);
  if (portal) {
    const path = pathname.startsWith(portal.basePath) ? pathname : `${portal.basePath}${pathname === '/' ? '' : pathname}`;
    return { login: portal.login, isPublic: isPortalPublicPath(portal, path) };
  }
  return { login: routes.login(), isPublic: isPublicPath(pathname) };
}

/**
 * Any request reporting an expired session (401) opens the "Session expired" dialog once; its button clears the
 * cached data and opens the login page (the portal's own on parents / schools / partners). Nothing happens on the
 * login / sign-up pages themselves.
 */
export function useSessionExpiry(): { expired: boolean; logIn: () => void } {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [expired, setExpired] = useState(false);
  const target = useRef(routes.login());

  useEffect(
    () =>
      onApiEvent('unauthorized', () => {
        const { login, isPublic } = sessionLogin();
        if (isPublic) return;
        target.current = login;
        setExpired(true);
      }),
    [],
  );

  const logIn = useCallback(() => {
    queryClient.clear();
    setExpired(false);
    router.replace(target.current);
  }, [queryClient, router]);

  return { expired, logIn };
}
