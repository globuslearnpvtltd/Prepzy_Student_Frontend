'use client';

import { useMemo } from 'react';
import { rememberedExam, usePurchasedExams } from '@/features/auth';
import { examFromCatalog, type ExamConfig } from '@/shared/config/exams';
import { useExamCatalog } from '@/shared/hooks/use-exam-catalog';

/**
 * The student's current exam on pages outside any exam (/manage-plans, /purchase): the remembered exam if the student
 * owns it, else their first owned exam, else none. With the backend's exam_id (GET /api/v4/exams).
 */
export function useAccountExam() {
  const catalog = useExamCatalog();
  const purchased = usePurchasedExams();
  const remembered = useMemo(() => rememberedExam(), []);

  const owned = (purchased.data ?? []).flatMap((p) => {
    const exam = examFromCatalog(catalog.data, p.examSlice);
    return exam ? [exam] : [];
  });
  const exam: ExamConfig | null = owned.find((e) => e.slug === remembered) ?? owned[0] ?? null;

  return {
    exam,
    isPending: catalog.isPending || purchased.isPending,
    isError: catalog.isError || purchased.isError,
    error: catalog.error ?? purchased.error,
  };
}
