'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { create } from 'zustand';
import { useScreenClass } from '@/features/auth';
import type { ExamRef } from '@/shared/config/exams';
import { useOptionalExam } from '@/shared/hooks/use-exam';
import { featureAccessApi } from './api';
import { featureList, type FeatureKeys, type RestrictableFeature } from './keys';

export const featureAccessKeys = {
  all: ['feature-access'] as const,
  /** One list per exam and class on screen (null: the class isn't known, the backend applies its own rule). */
  exam: (examId: number | null | undefined, classId: number | null = null) =>
    ['feature-access', examId ?? null, classId] as const,
};

export interface FeatureAccess {
  /**
   * True when the institute switched off the feature (all of them, for a list). False while loading and when the
   * access list couldn't be loaded: the backend still enforces, so nothing is locked on a guess.
   */
  isRestricted: (keys: FeatureKeys) => boolean;
  isLoading: boolean;
  restricted: readonly RestrictableFeature[];
}

/**
 * What the student's institute switched off for the current exam and the class on screen
 * (GET /api/v4/feature-access/:category/:examId?class_id=). The class is the goal switcher's plan (useScreenClass,
 * shared with the medium), so switching class updates the locks. While the plans load, the list is asked for without
 * a class (never blocked on them); when the class changes, the previous list stays shown until the new one arrives,
 * so locks don't blink open. Cached 5 minutes; logout clears it with every other query; a 403 FEATURE_RESTRICTED
 * refetches it.
 */
export function useFeatureAccess(examOverride?: ExamRef | null): FeatureAccess {
  const current = useOptionalExam();
  const exam = examOverride === undefined ? current : examOverride;
  const enabled = !!exam?.examId;
  const screen = useScreenClass(enabled ? exam : null);
  const classId = screen.plan?.classId ?? null;
  const query = useQuery({
    queryKey: featureAccessKeys.exam(exam?.examId, classId),
    queryFn: () => featureAccessApi.restricted(exam!, classId),
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
    // Same exam, another class: keep the last list on screen while the class's own loads.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === (exam?.examId ?? null) ? keepPreviousData(previous) : undefined,
  });
  const restricted = query.data;
  const set = useMemo(() => new Set(restricted ?? []), [restricted]);
  const isRestricted = useCallback(
    (keys: FeatureKeys) => {
      const list = featureList(keys);
      return list.length > 0 && list.every((key) => set.has(key));
    },
    [set],
  );
  // Loading only until a first list is shown: a class switch keeps the page (and its gate) on the previous list.
  return { isRestricted, isLoading: enabled && query.isPending, restricted: restricted ?? [] };
}

interface RestrictedDialogState {
  open: boolean;
  feature: RestrictableFeature | null;
  show: (feature?: RestrictableFeature | null) => void;
  hide: () => void;
}

/** The "not enabled by your institute" dialog (one host in app/providers.tsx). Locks and API errors open it. */
export const useFeatureRestrictedDialog = create<RestrictedDialogState>((set) => ({
  open: false,
  feature: null,
  show: (feature = null) => set({ open: true, feature }),
  hide: () => set({ open: false }),
}));

export const showFeatureRestricted = (feature?: RestrictableFeature | null) =>
  useFeatureRestrictedDialog.getState().show(feature);

/** For custom buttons: `onClick={guard('atlas_chat', open)}` runs `open` unless the feature is restricted (then the dialog). */
export function useFeatureGuard(examOverride?: ExamRef | null) {
  const access = useFeatureAccess(examOverride);
  const { isRestricted } = access;
  const guard = useCallback(
    (feature: FeatureKeys, action: () => void) => () => {
      if (isRestricted(feature)) showFeatureRestricted(featureList(feature)[0] ?? null);
      else action();
    },
    [isRestricted],
  );
  return { ...access, guard };
}
