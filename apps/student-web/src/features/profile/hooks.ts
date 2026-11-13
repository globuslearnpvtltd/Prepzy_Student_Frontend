'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { authKeys } from '@/features/auth';
import type { ExamConfig } from '@/shared/config/exams';
import { profileApi, type Parent, type Profile, type ProfileUpdate } from './api';

export const profileKeys = {
  profile: ['profile', 'account'] as const,
  parent: ['profile', 'parent'] as const,
  helpRequests: ['profile', 'help-requests'] as const,
  deleteInfo: ['profile', 'delete-info'] as const,
  planSummary: (examId: number) => ['profile', 'plan-summary', examId] as const,
};

export function useProfile() {
  return useQuery({ queryKey: profileKeys.profile, queryFn: profileApi.get });
}

/** Writes the saved account into the cache and refreshes the session user (header name, photo). */
function useStoreProfile() {
  const queryClient = useQueryClient();
  return (patch: Partial<Profile>) => {
    queryClient.setQueryData<Profile>(profileKeys.profile, (current) => (current ? { ...current, ...patch } : current));
    return queryClient.invalidateQueries({ queryKey: authKeys.me });
  };
}

export function useUpdateProfile() {
  const store = useStoreProfile();
  return useMutation({
    mutationFn: (values: ProfileUpdate) => profileApi.update(values),
    onSuccess: (saved) => store(saved),
  });
}

/** Photo upload (cancellable) and removal; both update the picture and completion in place. */
export function useProfilePhoto() {
  const store = useStoreProfile();
  const upload = useMutation({
    mutationFn: ({ file, signal }: { file: File; signal?: AbortSignal }) => profileApi.uploadPhoto(file, signal),
    onSuccess: store,
  });
  const remove = useMutation({ mutationFn: () => profileApi.removePhoto(), onSuccess: store });
  return { upload, remove };
}

export function useChangePassword() {
  return useMutation({
    mutationFn: ({ oldPassword, newPassword }: { oldPassword: string; newPassword: string }) =>
      profileApi.changePassword(oldPassword, newPassword),
  });
}

export function useParent() {
  return useQuery({ queryKey: profileKeys.parent, queryFn: profileApi.parent });
}

/** Keeps the parent query in step with what the page shows after linking, renaming or removing. */
export function useSetParent() {
  const queryClient = useQueryClient();
  return (parent: Parent | null) => queryClient.setQueryData(profileKeys.parent, parent);
}

export function useHelpRequests(enabled = true) {
  return useQuery({ queryKey: profileKeys.helpRequests, queryFn: profileApi.helpRequests, enabled });
}

/** Competitive exams describe the plan by its summary (Basic / Topper, end date); board exams by the class's plan. */
export function usePlanSummary(exam: Pick<ExamConfig, 'examId' | 'category'>) {
  return useQuery({
    queryKey: profileKeys.planSummary(exam.examId),
    queryFn: () => profileApi.planSummary(exam.examId),
    enabled: exam.category === 'competitive',
    staleTime: 5 * 60_000,
  });
}

export function useDeleteInfo() {
  return useQuery({ queryKey: profileKeys.deleteInfo, queryFn: profileApi.deleteInfo, staleTime: 60_000 });
}

/** navigator.onLine, kept in sync with the browser's online / offline events. */
export function useOffline() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);
  return offline;
}

/** Tracks a media query (false until mounted, so the server render matches the first client render). */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const list = window.matchMedia(query);
    const sync = () => setMatches(list.matches);
    sync();
    list.addEventListener('change', sync);
    return () => list.removeEventListener('change', sync);
  }, [query]);
  return matches;
}

export const DESKTOP_QUERY = '(min-width: 1024px)';
export const isDesktop = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(DESKTOP_QUERY).matches;
