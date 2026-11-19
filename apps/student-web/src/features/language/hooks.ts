'use client';

import { useMutation, useQuery, useQueryClient, type Query } from '@tanstack/react-query';
import { create } from 'zustand';
import { authApi, authKeys, pickActivePlan, useCurrentUser, usePlanSelection, type ActivePlan, type Student } from '@/features/auth';
import { classLabel } from '@/features/plans';
import type { ExamRef } from '@/shared/config/exams';
import { useOptionalExam } from '@/shared/hooks/use-exam';
import { languageApi, type Language } from './api';

export const languageKeys = {
  all: ['languages'] as const,
  /** Under `languages`, so switching medium doesn't refetch it (see isContentQuery). */
  exam: (examId: number) => ['languages', 'exam', examId] as const,
  /** The mediums of one class's books in an exam. */
  class: (examId: number, classId: number) => ['languages', 'exam', examId, 'class', classId] as const,
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
 * The class on screen: the student's current plan for the exam (the class picked in the goal switcher, else the first
 * active one; same query and cache as useActivePlan). `settled` is false while the plans load.
 */
export function useScreenClass(exam: Partial<ExamRef> | null): { plan: ActivePlan | null; settled: boolean } {
  const ready = hasExamId(exam);
  const selectedId = usePlanSelection((state) => state.planId);
  const plans = useQuery({
    queryKey: authKeys.plans(ready ? exam.examId : 0),
    queryFn: () => authApi.activePlans((exam as ExamRef).examId),
    staleTime: 5 * 60_000,
    enabled: ready,
  });
  return { plan: pickActivePlan(plans.data ?? [], selectedId), settled: !ready || !plans.isPending };
}

/** The mediums of one class's books in the exam (its class_subject_mapping rows); empty when it has none. */
export function useClassLanguages(exam: Partial<ExamRef> | null, classId: number | null) {
  const ready = hasExamId(exam) && classId !== null;
  return useQuery({
    queryKey: languageKeys.class(hasExamId(exam) ? exam.examId : 0, classId ?? 0),
    queryFn: () => languageApi.forExam(exam as ExamRef, classId!),
    staleTime: 10 * 60_000,
    enabled: ready,
  });
}

/**
 * The mediums the student can use on the current page: the class's (goal switcher) when it has books, else the
 * exam's. `settled` is false until the plans and both lists have loaded (an error counts as loaded: the exam's list,
 * or none, is used). Outside an exam, nothing is offered (`languages` undefined).
 */
export function useOfferedLanguages() {
  const exam = useOptionalExam();
  const screen = useScreenClass(exam);
  const classId = screen.plan?.classId ?? null;
  const forExam = useExamLanguages(exam);
  const forClass = useClassLanguages(exam, classId);
  const classList = forClass.isSuccess && forClass.data.length > 0 ? forClass.data : null;
  const examList = forExam.isSuccess ? forExam.data : undefined;
  const settled =
    hasExamId(exam) && screen.settled && !forExam.isPending && (classId === null || !forClass.isPending);
  return {
    exam,
    plan: screen.plan,
    classId,
    /** The class's mediums when it has books, else the exam's (undefined while loading). */
    languages: classList ?? examList,
    /** Only the class's mediums can be picked (null: every listed medium can). */
    classLanguages: classList,
    settled,
  };
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

/** The medium the current class's (else exam's) content is shown in (null until the account is loaded). */
export function useCurrentLanguage(): Language | null {
  return effectiveLanguage(useSavedLanguage(), useOfferedLanguages().languages);
}

const byId = (a: Language, b: Language) => a.id - b.id;

/**
 * What the change-medium dialog offers: the current exam's mediums, or every medium outside an exam and for an exam
 * without books yet. `exam` is set when the list is the exam's. When the class on screen has books, only its mediums
 * can be picked (`isAvailable`); the exam's others are listed but disabled. `classLabel` names that class.
 */
export function useMediumOptions() {
  const offered = useOfferedLanguages();
  const { exam } = offered;
  const forExam = useExamLanguages(exam);
  const examEmpty = forExam.isSuccess && forExam.data.length === 0;
  const useAll = !hasExamId(exam) || examEmpty;
  const all = useLanguages(useAll);
  const query = useAll ? all : forExam;
  const classLanguages = offered.classLanguages;
  // The class's mediums are always listed (a class row may carry a medium the exam-wide list doesn't show).
  const languages = query.data
    ? [...query.data, ...(classLanguages ?? []).filter((c) => !query.data.some((l) => l.id === c.id))].sort(byId)
    : undefined;
  return {
    languages,
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
    exam: useAll ? null : exam,
    isAvailable: (languageId: number) => !classLanguages || classLanguages.some((language) => language.id === languageId),
    /** The mediums of the class on screen, when it limits the choice (null otherwise). */
    classLanguages,
    classLabel: offered.plan && classLanguages ? classLabel(offered.plan.className, offered.plan.streamName) : null,
  };
}

/** Queries that don't depend on the medium: the session, the account and the languages themselves. */
const LANGUAGE_INDEPENDENT = new Set<string>([authKeys.me[0], 'profile', languageKeys.all[0]]);

/** Content (subjects, courses, notes, papers …) is fetched in the student's medium. */
export const isContentQuery = (query: Pick<Query, 'queryKey'>) => !LANGUAGE_INDEPENDENT.has(String(query.queryKey[0]));

/**
 * Saves the medium, puts it on the cached student and refetches every content query so each page shows the new
 * medium (the account, session and language list are kept). On an exam page the exam and the class on screen are
 * sent, so the backend checks the medium is one they offer.
 */
export function useChangeLanguage() {
  const queryClient = useQueryClient();
  const exam = useOptionalExam();
  const examId = hasExamId(exam) ? exam.examId : undefined;
  const classId = useScreenClass(exam).plan?.classId;
  return useMutation({
    mutationFn: (languageId: number) => languageApi.change(languageId, examId, examId === undefined ? undefined : classId),
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
