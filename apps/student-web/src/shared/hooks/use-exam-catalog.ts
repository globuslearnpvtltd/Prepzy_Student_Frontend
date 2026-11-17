'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { catalogExams, examFromCatalog, type CatalogEntry, type ExamCategory, type ExamConfig } from '@/shared/config/exams';
import { apiClient } from '@/shared/lib/api-client';
import { unwrapData } from '@/shared/lib/unwrap';

/** An active exam as the backend knows it (exam_table + exam_types). */
export type CatalogExam = CatalogEntry;

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

/** Every active exam that has pages (board / competitive), with its design: registry polish or category defaults. */
export function useCatalogExams() {
  const catalog = useExamCatalog();
  const exams = useMemo(() => catalogExams(catalog.data), [catalog.data]);
  return { exams, query: catalog };
}

/** The active exam a slug, slice, name or id names (see examFromCatalog); null until the catalog loads or if none. */
export function useCatalogExam(value: string | number | null | undefined): { exam: ExamConfig | null; query: ReturnType<typeof useExamCatalog> } {
  const catalog = useExamCatalog();
  const exam = useMemo(() => examFromCatalog(catalog.data, value), [catalog.data, value]);
  return { exam, query: catalog };
}
