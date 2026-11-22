'use client';

import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { create } from 'zustand';
import type { ExamRef } from '@/shared/config/exams';
import { useOptionalExam } from '@/shared/hooks/use-exam';
import { featureAccessApi } from './api';
import { featureList, type FeatureKeys, type RestrictableFeature } from './keys';

export const featureAccessKeys = {
  all: ['feature-access'] as const,
  exam: (examId: number | null | undefined) => ['feature-access', examId ?? null] as const,
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
 * What the student's institute switched off for the current exam (GET /api/v4/feature-access/:category/:examId).
 * Cached 5 minutes; logout clears it with every other query; a 403 FEATURE_RESTRICTED refetches it.
 */
export function useFeatureAccess(examOverride?: ExamRef | null): FeatureAccess {
  const current = useOptionalExam();
  const exam = examOverride === undefined ? current : examOverride;
  const enabled = !!exam?.examId;
  const query = useQuery({
    queryKey: featureAccessKeys.exam(exam?.examId),
    queryFn: () => featureAccessApi.restricted(exam!),
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
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
