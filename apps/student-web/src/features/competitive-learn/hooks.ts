'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
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

export function useNotesSubjects(classId: number | null) {
  return useQuery({
    queryKey: learnKeys.notesSubjects(classId),
    queryFn: () => learnApi.notesSubjects(classId!),
    enabled: classId !== null,
  });
}

export function useNotesChapters(classId: number | null, subjectId: string | null) {
  return useQuery({
    queryKey: learnKeys.notesChapters(classId, subjectId),
    queryFn: () => learnApi.notesChapters(classId!, subjectId!),
    enabled: classId !== null && !!subjectId,
  });
}

export const useCourse = (courseId: string) =>
  useQuery({ queryKey: learnKeys.course(courseId), queryFn: () => learnApi.course(courseId) });

export const useChapter = (moduleId: string | null | undefined) =>
  useQuery({ queryKey: learnKeys.chapter(moduleId ?? ''), queryFn: () => learnApi.chapter(moduleId!), enabled: !!moduleId });

export const useSummaryVideo = (moduleId: string) =>
  useQuery({ queryKey: learnKeys.video(moduleId), queryFn: () => learnApi.summaryVideo(moduleId) });

export const useStudyNotes = (moduleId: string) =>
  useQuery({ queryKey: learnKeys.notes(moduleId), queryFn: () => learnApi.studyNotes(moduleId) });

export const usePracticeAssessment = (moduleId: string) =>
  useQuery({ queryKey: learnKeys.practice(moduleId), queryFn: () => learnApi.practiceAssessment(moduleId) });

export const usePracticeAttempts = (assessmentId: string | null | undefined) =>
  useQuery({
    queryKey: learnKeys.practiceAttempts(assessmentId ?? null),
    queryFn: () => learnApi.practiceAttempts(assessmentId!),
    enabled: !!assessmentId,
  });

export const useChapterPyqAttempts = (moduleId: string) =>
  useQuery({ queryKey: learnKeys.pyqAttempts(moduleId), queryFn: () => learnApi.chapterPyqAttempts(moduleId) });

/** Marks the chapter's video or notes as done, then refreshes the chapter's progress everywhere. */
export function useMarkComplete(kind: 'video' | 'notes', courseId: string, moduleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => learnApi.markComplete(kind, courseId, moduleId),
    onSuccess: (message) => {
      toast.success(message ?? 'Marked as completed');
      void queryClient.invalidateQueries({ queryKey: learnKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error) =>
      toast.error(userMessage(error, kind === 'video' ? 'Failed to mark video as completed' : 'Failed to mark notes as completed')),
  });
}
