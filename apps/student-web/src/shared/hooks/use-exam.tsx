'use client';

import { createContext, useContext } from 'react';
import type { ExamConfig } from '@/shared/config/exams';

const ExamContext = createContext<ExamConfig | null>(null);

export const ExamProvider = ExamContext.Provider;

/** The exam of the current /[exam]/… page, from the registry. */
export function useExam(): ExamConfig {
  const exam = useContext(ExamContext);
  if (!exam) throw new Error('useExam must be used inside an /[exam] route');
  return exam;
}

/** The current exam, or null on pages outside the /[exam] routes (reference books). */
export function useOptionalExam(): ExamConfig | null {
  return useContext(ExamContext);
}
