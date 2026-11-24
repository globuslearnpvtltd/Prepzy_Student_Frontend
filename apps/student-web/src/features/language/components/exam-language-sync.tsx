'use client';

import { useEffect, useRef } from 'react';
import { notify } from '@/shared/ui/toast';
import { useCurrentUser } from '@/features/auth';
import { classLabel } from '@/features/plans';
import type { ExamConfig } from '@/shared/config/exams';
import { useChangeLanguage, useOfferedLanguages } from '../hooks';
import { mediumLabel } from '../names';

/**
 * Keeps the saved medium one the student can read on screen. When the class picked in the goal switcher (or, for a
 * class without books, the exam) has no books in the student's medium, it saves the first medium it has
 * (account.language is one value, so it then stays wherever that medium exists), refetches the content like a manual
 * switch and says so quietly.
 *
 * Fires once per exam + class + medium, only after the account, the plans and the mediums have loaded, and never for
 * an exam without books yet. Exam pages only (ExamFrame, inside the exam's provider), so never on the portals.
 */
export function useExamLanguageSync(exam: ExamConfig) {
  const student = useCurrentUser();
  const offered = useOfferedLanguages();
  const { mutate, isPending } = useChangeLanguage();
  const tried = useRef<string | null>(null);

  const saved = student.data?.language ?? null;
  const list = offered.settled ? (offered.languages ?? []) : [];
  const target = saved && list.length > 0 && !list.some((language) => language.id === saved.id) ? list[0]! : null;
  const targetId = target?.id ?? null;
  const classId = offered.classId;
  const where =
    offered.plan && offered.classLanguages
      ? `${exam.label} ${classLabel(offered.plan.className, offered.plan.streamName)}`
      : exam.label;

  useEffect(() => {
    if (targetId === null || isPending) return;
    const key = `${exam.examId}:${classId ?? ''}:${targetId}`;
    if (tried.current === key) return; // one try per exam + class + medium: no loop when saving fails
    tried.current = key;
    mutate(targetId, {
      onSuccess: (language) => {
        notify.info(`Showing ${where} in ${mediumLabel(language.name).native}`);
      },
    });
  }, [targetId, isPending, exam.examId, classId, where, mutate]);
}

/** Renders nothing; mounted by the exam frame once the student is in the exam. */
export function ExamLanguageSync({ exam }: { exam: ExamConfig }) {
  useExamLanguageSync(exam);
  return null;
}
