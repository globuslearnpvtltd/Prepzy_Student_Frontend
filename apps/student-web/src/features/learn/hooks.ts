'use client';

import { useQuery } from '@tanstack/react-query';
import { useActivePlan } from '@/features/auth';
import { useExam } from '@/shared/hooks/use-exam';
import { learnApi } from './api';

export const learnKeys = {
  all: ['learn'] as const,
  subjects: (classId: number | null) => ['learn', 'subjects', classId] as const,
  freeCourses: (exam: string) => ['learn', 'free-courses', exam] as const,
  continue: (classId: number | null) => ['learn', 'continue', classId] as const,
  subjectCourses: (classId: number | null, subjectId: string) => ['learn', 'subject-courses', classId, subjectId] as const,
  outline: (courseId: string) => ['learn', 'outline', courseId] as const,
  module: (courseId: string, moduleId: string) => ['learn', 'module', courseId, moduleId] as const,
  pyqs: (moduleId: string) => ['learn', 'pyqs', moduleId] as const,
  pyqAttempts: (moduleId: string) => ['learn', 'pyq-attempts', moduleId] as const,
  ncert: (moduleId: string) => ['learn', 'ncert', moduleId] as const,
  ncertCount: (moduleId: string) => ['learn', 'ncert-count', moduleId] as const,
  lecture: (lectureId: string) => ['learn', 'lecture', lectureId] as const,
  transcript: (lectureId: string) => ['learn', 'transcript', lectureId] as const,
};

/** Exam + the class picked in the class switcher (null until the plan loads, or without a plan). */
export function useLearnContext() {
  const exam = useExam();
  const plan = useActivePlan(exam);
  const data = plan.data ?? null;
  return {
    exam,
    classId: data?.classId ?? null,
    className: data ? [data.className, data.streamName].filter(Boolean).join(' ') : null,
    isPending: plan.isPending,
  };
}

export function useSubjects(classId: number | null) {
  return useQuery({
    queryKey: learnKeys.subjects(classId),
    queryFn: () => learnApi.subjects(classId!),
    enabled: classId !== null,
  });
}

export function useSubjectCourses(classId: number | null, subjectId: string | null) {
  return useQuery({
    queryKey: learnKeys.subjectCourses(classId, subjectId ?? ''),
    queryFn: () => learnApi.subjectCourses(classId!, subjectId!),
    enabled: classId !== null && !!subjectId,
  });
}

export function useCourseOutline(courseId: string) {
  return useQuery({ queryKey: learnKeys.outline(courseId), queryFn: () => learnApi.outline(courseId), staleTime: 5 * 60_000 });
}
