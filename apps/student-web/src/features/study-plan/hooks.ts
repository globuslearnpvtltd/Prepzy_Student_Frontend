'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTestContext } from '@/features/exam-engine';
import { studyPlanApi, type PlanTask, type TaskStatus } from './api';

export const studyPlanKeys = {
  all: ['study-plan'] as const,
  plan: (classId: number | null) => ['study-plan', 'plan', classId] as const,
  day: (planId: number | null, date: string) => ['study-plan', 'day', planId, date] as const,
  status: (classId: number | null) => ['study-plan', 'status', classId] as const,
  journey: (classId: number | null) => ['study-plan', 'journey', classId] as const,
  syllabus: (classId: number | null, examId: number) => ['study-plan', 'syllabus', classId, examId] as const,
};

/** Exam + class (from the class switcher) every study plan / diagnostic API needs. */
export function useClassContext() {
  const { context, isPending } = useTestContext();
  return { exam: context?.exam ?? null, classId: context?.classId ?? null, isPending };
}

export function usePlan(classId: number | null) {
  return useQuery({ queryKey: studyPlanKeys.plan(classId), queryFn: () => studyPlanApi.plan(classId!), enabled: !!classId });
}

export function useDayTasks(planId: number | null, date: string) {
  return useQuery({ queryKey: studyPlanKeys.day(planId, date), queryFn: () => studyPlanApi.day(planId!, date), enabled: !!planId });
}

export function usePlanStatus(classId: number | null) {
  return useQuery({ queryKey: studyPlanKeys.status(classId), queryFn: () => studyPlanApi.status(classId!), enabled: !!classId });
}

export function useJourney(classId: number | null) {
  return useQuery({ queryKey: studyPlanKeys.journey(classId), queryFn: () => studyPlanApi.journey(classId!), enabled: !!classId });
}

export function useSyllabus(classId: number | null, examId: number) {
  return useQuery({
    queryKey: studyPlanKeys.syllabus(classId, examId),
    queryFn: () => studyPlanApi.syllabus(classId!, examId),
    enabled: !!classId,
  });
}

/** Ticks a task (optimistically), then refreshes the calendar counts. */
export function useSetTask(classId: number | null, planId: number | null, date: string) {
  const queryClient = useQueryClient();
  const key = studyPlanKeys.day(planId, date);
  return useMutation({
    mutationFn: ({ taskId, status }: { taskId: number; status: TaskStatus }) => studyPlanApi.setTask(taskId, status),
    onMutate: ({ taskId, status }) => {
      queryClient.setQueryData<PlanTask[]>(key, (tasks) =>
        tasks?.map((t) =>
          t.id === taskId ? { ...t, status, isCompleted: status === 'completed', isStarted: t.isStarted || status !== 'todo' } : t,
        ),
      );
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: key }),
        queryClient.invalidateQueries({ queryKey: studyPlanKeys.plan(classId) }),
      ]),
  });
}

export function useCompleteDay(classId: number | null, planId: number | null, date: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dayId: number) => studyPlanApi.completeDay(dayId),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: studyPlanKeys.day(planId, date) }),
        queryClient.invalidateQueries({ queryKey: studyPlanKeys.plan(classId) }),
      ]),
  });
}
