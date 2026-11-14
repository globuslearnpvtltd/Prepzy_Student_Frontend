'use client';

import { useQuery } from '@tanstack/react-query';
import { useActivePlan } from '@/features/auth';
import { useExam } from '@/shared/hooks/use-exam';
import { syllabusApi, type SyllabusKind } from './api';

export const syllabusKeys = {
  subjects: (exam: string, classId: number | null, kind: SyllabusKind) => ['syllabus', exam, 'subjects', classId, kind] as const,
  pdf: (exam: string, classId: number | null, kind: SyllabusKind, subjectId: string) =>
    ['syllabus', exam, 'pdf', classId, kind, subjectId] as const,
};

/**
 * Exam + the student's class for it (from the active plan). The backend only serves a class of this exam that the
 * student has an active plan for, so the class id is never taken from the URL.
 */
export function useSyllabusContext() {
  const exam = useExam();
  const plan = useActivePlan(exam);
  return {
    exam,
    classId: plan.data?.classId ?? null,
    className: plan.data?.className ?? null,
    isPending: plan.isPending,
    error: plan.error,
  };
}

export function useSyllabusSubjects(kind: SyllabusKind, enabled = true) {
  const { exam, classId } = useSyllabusContext();
  return useQuery({
    queryKey: syllabusKeys.subjects(exam.slug, classId, kind),
    queryFn: () => syllabusApi.subjects(exam, classId!, kind),
    enabled: enabled && classId !== null,
  });
}

export function useSyllabusPdf(kind: SyllabusKind, subjectId: string | null) {
  const { exam, classId } = useSyllabusContext();
  return useQuery({
    queryKey: syllabusKeys.pdf(exam.slug, classId, kind, subjectId ?? ''),
    queryFn: () => syllabusApi.pdf(exam, classId!, kind, subjectId!),
    enabled: classId !== null && !!subjectId,
  });
}
