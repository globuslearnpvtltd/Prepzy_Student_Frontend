'use client';

import { useMutation, useQuery, useQueryClient, type Query } from '@tanstack/react-query';
import { create } from 'zustand';
import { authKeys, useCurrentUser, type Student } from '@/features/auth';
import type { ExamRef } from '@/shared/config/exams';
import { useOptionalExam } from '@/shared/hooks/use-exam';
import { languageApi, type Language } from './api';

export const languageKeys = {
  all: ['languages'] as const,
  /** Under `languages`, so switching medium doesn't refetch it (see isContentQuery). */
  exam: (examId: number) => ['languages', 'exam', examId] as const,
};

/** Every medium (the list rarely changes). */
export function useLanguages(enabled = true) {
  return useQuery({ queryKey: languageKeys.all, queryFn: languageApi.list, staleTime: 10 * 60_000, enabled });
}

/** The exam has its backend id (an exam page before GET /exams answers doesn't). */
const hasExamId = (exam: Partial<ExamRef> | null): exam is ExamRef => typeof exam?.examId === 'number';

/** The mediums an exam offers (the languages of its books); empty when it has no books yet. */
export function useExamLanguages(exam: Partial<ExamRef> | null) {
  const ready = hasExamId(exam);
  return useQuery({
    queryKey: languageKeys.exam(ready ? exam.examId : 0),
    queryFn: () => languageApi.forExam(exam as ExamRef),
    staleTime: 10 * 60_000,
    enabled: ready,
  });
}

/**
 * The medium content is shown in: the saved one when the exam offers it, else the exam's first (the backend does
 * the same, so content never comes back empty). An exam with no list yet, or none, shows the saved medium.
 */
export function effectiveLanguage(saved: Language | null, offered: readonly Language[] | undefined): Language | null {
  if (!saved || !offered || offered.length === 0) return saved;
  return offered.find((language) => language.id === saved.id) ?? offered[0] ?? saved;
}

/** The signed-in student's saved medium (account.language; null until the account is loaded). */
export function useSavedLanguage(): Language | null {
  return useCurrentUser().data?.language ?? null;
}

/** The medium the current exam's content is shown in (null until the account is loaded). */
export function useCurrentLanguage(): Language | null {
  const exam = useOptionalExam();
  return effectiveLanguage(useSavedLanguage(), useExamLanguages(exam).data);
}

/**
 * What the change-medium dialog offers: the current exam's mediums, or every medium outside an exam and for an exam
 * without books yet. `exam` is set when the list is the exam's.
 */
export function useMediumOptions() {
  const exam = useOptionalExam();
  const forExam = useExamLanguages(exam);
  const examEmpty = forExam.isSuccess && forExam.data.length === 0;
  const useAll = !hasExamId(exam) || examEmpty;
  const all = useLanguages(useAll);
  const query = useAll ? all : forExam;
  return {
    languages: query.data,
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
    exam: useAll ? null : exam,
  };
}

/** Queries that don't depend on the medium: the session, the account and the languages themselves. */
const LANGUAGE_INDEPENDENT = new Set<string>([authKeys.me[0], 'profile', languageKeys.all[0]]);

/** Content (subjects, courses, notes, papers …) is fetched in the student's medium. */
export const isContentQuery = (query: Pick<Query, 'queryKey'>) => !LANGUAGE_INDEPENDENT.has(String(query.queryKey[0]));

/**
 * Saves the medium, puts it on the cached student and refetches every content query so each page shows the new
 * medium (the account, session and language list are kept).
 */
export function useChangeLanguage() {
  const queryClient = useQueryClient();
  const exam = useOptionalExam();
  const examId = hasExamId(exam) ? exam.examId : undefined;
  return useMutation({
    // On an exam page the backend checks the exam offers the medium.
    mutationFn: (languageId: number) => languageApi.change(languageId, examId),
    onSuccess: (language) => {
      queryClient.setQueryData<Student>(authKeys.me, (student) => (student ? { ...student, language } : student));
      void queryClient.invalidateQueries({ predicate: isContentQuery });
    },
  });
}

/** The change-medium dialog, opened from the account menu and My Account (one dialog, rendered by the header). */
export const useMediumDialog = create<{ open: boolean; show: () => void; hide: () => void }>((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}));
