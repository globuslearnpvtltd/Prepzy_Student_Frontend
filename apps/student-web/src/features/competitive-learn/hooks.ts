'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notify } from '@/shared/ui/toast';
import { useExam } from '@/shared/hooks/use-exam';
import { userMessage } from '@/shared/lib/errors';
import { learnApi } from './api';

export const learnKeys = {
  all: ['competitive-learn'] as const,
  notesSubjects: (classId: number | null) => ['competitive-learn', 'notes-subjects', classId] as const,
  notesChapters: (classId: number | null, subjectId: string | null) => ['competitive-learn', 'notes-chapters', classId, subjectId] as const,
  course: (courseId: string) => ['competitive-learn', 'course', courseId] as const,
  chapter: (moduleId: string) => ['competitive-learn', 'chapter', moduleId] as const,
  video: (moduleId: string) => ['competitive-learn', 'video', moduleId] as const,
  notes: (moduleId: string) => ['competitive-learn', 'notes', moduleId] as const,
  practice: (moduleId: string) => ['competitive-learn', 'practice', moduleId] as const,
  practiceAttempts: (assessmentId: string | null) => ['competitive-learn', 'practice-attempts', assessmentId] as const,
  pyqAttempts: (moduleId: string) => ['competitive-learn', 'pyq-attempts', moduleId] as const,
};

/**
 * Progress shown on the chapter pages (overall %, step ticks, attempts) changes on other pages (a test, the video,
 * the notes): re-read it every time a page opens, so coming back never shows the old numbers (user, 2026-11-27).
 * The cached data is shown meanwhile, so nothing blinks. Content (video, notes) keeps the normal cache.
 */
const FRESH_ON_RETURN = { staleTime: 0, refetchOnMount: 'always' as const };

export function useNotesSubjects(classId: number | null) {
  const exam = useExam();
  return useQuery({
    queryKey: learnKeys.notesSubjects(classId),
    queryFn: () => learnApi.notesSubjects(exam, classId!),
    enabled: classId !== null,
  });
}

export function useNotesChapters(classId: number | null, subjectId: string | null) {
  const exam = useExam();
  return useQuery({
    queryKey: learnKeys.notesChapters(classId, subjectId),
    queryFn: () => learnApi.notesChapters(exam, classId!, subjectId!),
    enabled: classId !== null && !!subjectId,
  });
}

export function useCourse(courseId: string) {
  const exam = useExam();
  return useQuery({ queryKey: learnKeys.course(courseId), queryFn: () => learnApi.course(exam, courseId), ...FRESH_ON_RETURN });
}

export function useChapter(moduleId: string | null | undefined) {
  const exam = useExam();
  return useQuery({
    queryKey: learnKeys.chapter(moduleId ?? ''),
    queryFn: () => learnApi.chapter(exam, moduleId!),
    enabled: !!moduleId,
    ...FRESH_ON_RETURN,
  });
}

export function useSummaryVideo(moduleId: string) {
  const exam = useExam();
  return useQuery({ queryKey: learnKeys.video(moduleId), queryFn: () => learnApi.summaryVideo(exam, moduleId) });
}

export function useStudyNotes(moduleId: string) {
  const exam = useExam();
  return useQuery({ queryKey: learnKeys.notes(moduleId), queryFn: () => learnApi.studyNotes(exam, moduleId) });
}

export function usePracticeAssessment(moduleId: string) {
  const exam = useExam();
  return useQuery({ queryKey: learnKeys.practice(moduleId), queryFn: () => learnApi.practiceAssessment(exam, moduleId), ...FRESH_ON_RETURN });
}

export function usePracticeAttempts(assessmentId: string | null | undefined) {
  const exam = useExam();
  return useQuery({
    queryKey: learnKeys.practiceAttempts(assessmentId ?? null),
    queryFn: () => learnApi.practiceAttempts(exam, assessmentId!),
    enabled: !!assessmentId,
    ...FRESH_ON_RETURN,
  });
}

export const useChapterPyqAttempts = (moduleId: string) =>
  useQuery({ queryKey: learnKeys.pyqAttempts(moduleId), queryFn: () => learnApi.chapterPyqAttempts(moduleId), ...FRESH_ON_RETURN });

/** Marks the chapter's video or notes as done, then refreshes the chapter's progress everywhere. */
export function useMarkComplete(kind: 'video' | 'notes', moduleId: string) {
  const exam = useExam();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => learnApi.markComplete(exam, kind, moduleId),
    onSuccess: (message) => {
      notify.success(message ?? 'Marked as completed');
      void queryClient.invalidateQueries({ queryKey: learnKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error) =>
      notify.error(userMessage(error, kind === 'video' ? 'Failed to mark video as completed' : 'Failed to mark notes as completed')),
  });
}
