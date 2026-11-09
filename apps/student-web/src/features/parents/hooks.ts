'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { PORTALS } from '@/shared/config/portals';
import { parentsApi } from './api';

type StudentQuery = { studentId: number; classId: number };

export const parentKeys = {
  all: ['parents'] as const,
  me: ['parents', 'me'] as const,
  children: ['parents', 'children'] as const,
  section: (section: string, query: StudentQuery) => ['parents', section, query.studentId, query.classId] as const,
};

const STALE = 60_000;

export const useParent = () => useQuery({ queryKey: parentKeys.me, queryFn: parentsApi.me, staleTime: 5 * STALE });

export const useChildren = () =>
  useQuery({ queryKey: parentKeys.children, queryFn: parentsApi.children, staleTime: STALE });

export const useLearningHours = (query: StudentQuery) =>
  useQuery({
    queryKey: parentKeys.section('hours', query),
    queryFn: () => parentsApi.learningHours(query),
    staleTime: STALE,
  });

export const useLectures = (query: StudentQuery) =>
  useQuery({ queryKey: parentKeys.section('lectures', query), queryFn: () => parentsApi.lectures(query), staleTime: STALE });

export const useDoubts = (query: StudentQuery) =>
  useQuery({ queryKey: parentKeys.section('doubts', query), queryFn: () => parentsApi.doubts(query), staleTime: STALE });

export const useAssessments = (query: StudentQuery) =>
  useQuery({
    queryKey: parentKeys.section('assessments', query),
    queryFn: () => parentsApi.assessments(query),
    staleTime: STALE,
  });

/** Ends the parent session (cookie cleared by the backend), drops cached data and returns to the portal login. */
export function useParentLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: parentsApi.logout,
    onSettled: () => {
      queryClient.clear();
      router.replace(PORTALS.parents.login);
    },
  });
}
