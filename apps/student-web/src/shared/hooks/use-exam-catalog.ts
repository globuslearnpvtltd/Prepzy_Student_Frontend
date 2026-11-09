'use client';

import { useQuery } from '@tanstack/react-query';
import type { ExamCategory } from '@/shared/config/exams';
import { apiClient } from '@/shared/lib/api-client';
import { unwrapData } from '@/shared/lib/unwrap';

/** An active exam as the backend knows it (exam_table + exam_types). */
export interface CatalogExam {
  examId: number;
  name: string;
  examSlice: string;
  category: ExamCategory;
}

type Raw = { exam_id: number; exam_name: string; exam_slice: string; category: ExamCategory };

export async function fetchExamCatalog(): Promise<CatalogExam[]> {
  const body = await apiClient.get<{ success?: boolean; data?: Raw[] }>('/api/v4/exams');
  return unwrapData(body).map((e) => ({
    examId: e.exam_id,
    name: e.exam_name,
    examSlice: e.exam_slice,
    category: e.category,
  }));
}

/** Active exams from the backend: the source of exam ids (none are hard-coded for API calls). */
export function useExamCatalog() {
  return useQuery({ queryKey: ['exam-catalog'], queryFn: fetchExamCatalog, staleTime: 10 * 60_000 });
}
