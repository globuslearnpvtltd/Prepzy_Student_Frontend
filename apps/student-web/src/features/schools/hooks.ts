'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { schoolsApi, type Teacher } from './api';
import { schoolsRoutes } from './model';

type ClassQuery = { classId: number; institutionId: number };
type StudentQuery = { studentId: string; classId?: string | null };

export const schoolsKeys = {
  all: ['schools'] as const,
  me: ['schools', 'me'] as const,
  school: ['schools', 'school'] as const,
  classStats: (q: ClassQuery) => ['schools', 'class-stats', q] as const,
  featureUsage: (q: ClassQuery) => ['schools', 'feature-usage', q] as const,
  students: (q: ClassQuery) => ['schools', 'students', q] as const,
  student: (id: string) => ['schools', 'student', id] as const,
  learningHours: (q: StudentQuery) => ['schools', 'learning-hours', q] as const,
  lectures: (q: StudentQuery) => ['schools', 'lectures', q] as const,
  doubts: (q: StudentQuery) => ['schools', 'doubts', q] as const,
  assessments: (q: StudentQuery) => ['schools', 'assessments', q] as const,
};

export const useTeacher = () => useQuery({ queryKey: schoolsKeys.me, queryFn: schoolsApi.me, staleTime: 5 * 60_000 });
export const useSchool = () => useQuery({ queryKey: schoolsKeys.school, queryFn: schoolsApi.school });

export const useClassStats = (q: ClassQuery | null) =>
  useQuery({ queryKey: schoolsKeys.classStats(q!), queryFn: () => schoolsApi.classStats(q!), enabled: !!q });
export const useFeatureUsage = (q: ClassQuery | null) =>
  useQuery({ queryKey: schoolsKeys.featureUsage(q!), queryFn: () => schoolsApi.featureUsage(q!), enabled: !!q });
export const useClassStudents = (q: ClassQuery | null) =>
  useQuery({ queryKey: schoolsKeys.students(q!), queryFn: () => schoolsApi.students(q!), enabled: !!q });

export const useStudentProfile = (studentId: string) =>
  useQuery({ queryKey: schoolsKeys.student(studentId), queryFn: () => schoolsApi.student(studentId) });
export const useLearningHours = (q: StudentQuery) =>
  useQuery({ queryKey: schoolsKeys.learningHours(q), queryFn: () => schoolsApi.learningHours(q) });
export const useLectureCompletion = (q: StudentQuery) =>
  useQuery({ queryKey: schoolsKeys.lectures(q), queryFn: () => schoolsApi.lectures(q) });
export const useDoubtsSummary = (q: StudentQuery) =>
  useQuery({ queryKey: schoolsKeys.doubts(q), queryFn: () => schoolsApi.doubts(q) });
export const useAssessmentsSummary = (q: StudentQuery) =>
  useQuery({ queryKey: schoolsKeys.assessments(q), queryFn: () => schoolsApi.assessments(q) });

export function useRequestTeacherOtp() {
  return useMutation({ mutationFn: (email: string) => schoolsApi.requestOtp(email) });
}

export function useVerifyTeacherOtp() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: ({ email, otp }: { email: string; otp: string }) => schoolsApi.verifyOtp(email, otp),
    onSuccess: (teacher: Teacher | null) => {
      if (teacher) queryClient.setQueryData(schoolsKeys.me, teacher);
      router.replace(schoolsRoutes.dashboard());
    },
  });
}

/** Ends the teacher session (even if the request fails), clears cached data and returns to the portal login. */
export function useTeacherLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: schoolsApi.logout,
    onSettled: () => {
      queryClient.clear();
      router.replace(schoolsRoutes.login());
    },
  });
}
