'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useCurrentUser } from '@/features/auth';
import type { ExamConfig } from '@/shared/config/exams';
import { useChangeLanguage, useExamLanguages } from '../hooks';
import { mediumLabel } from '../names';

/**
 * Keeps the saved medium one the exam offers. When the student opens (or switches to) an exam whose books aren't in
 * their medium, it saves the exam's first medium (account.language is one value, so it then stays for other exams
 * that have it), refetches the content like a manual switch and says so quietly.
 *
 * Fires once per exam + medium, only after both the account and the exam's mediums have loaded, and never for an exam
 * without books yet. Exam pages only (ExamFrame), so never on the portals.
 */
export function useExamLanguageSync(exam: ExamConfig) {
  const student = useCurrentUser();
  const offered = useExamLanguages(exam);
  const { mutate, isPending } = useChangeLanguage();
  const tried = useRef<string | null>(null);

  const saved = student.data?.language ?? null;
  const list = offered.isSuccess ? offered.data : [];
  const target = saved && list.length > 0 && !list.some((language) => language.id === saved.id) ? list[0]! : null;
  const targetId = target?.id ?? null;

  useEffect(() => {
    if (targetId === null || isPending) return;
    const key = `${exam.examId}:${targetId}`;
    if (tried.current === key) return; // one try per exam + medium: no loop when saving fails
    tried.current = key;
    mutate(targetId, {
      onSuccess: (language) => {
        toast.info(`Showing ${exam.label} in ${mediumLabel(language.name).native}`);
      },
    });
  }, [targetId, isPending, exam.examId, exam.label, mutate]);
}

/** Renders nothing; mounted by the exam frame once the student is in the exam. */
export function ExamLanguageSync({ exam }: { exam: ExamConfig }) {
  useExamLanguageSync(exam);
  return null;
}
