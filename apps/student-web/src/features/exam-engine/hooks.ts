'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useActivePlan } from '@/features/auth';
import type { TestTypeKey } from '@/shared/config/exams';
import { useExam } from '@/shared/hooks/use-exam';
import { getTestAdapter, type TestAdapter } from './adapters';
import { isAnswered, withAnswer, withMarkToggled, withVisit } from './attempt';
import type { Answer, AttemptSnapshot, ExamSession, SubmitOutcome, TestContext } from './model';

export const examKeys = {
  subjects: (exam: string, type: string) => ['tests', exam, type, 'subjects'] as const,
  sets: (exam: string, type: string, subject?: string) => ['tests', exam, type, 'sets', subject ?? 'all'] as const,
  session: (exam: string, type: string, setId: string) => ['tests', exam, type, 'session', setId] as const,
  result: (exam: string, type: string, attemptId: string) => ['tests', exam, type, 'result', attemptId] as const,
};

/** Exam + class of the student, needed by every test API. */
export function useTestContext(): { context: TestContext | null; isPending: boolean; error: unknown } {
  const exam = useExam();
  const plan = useActivePlan(exam);
  const fallbackClass = exam.onboarding.kind === 'choose-target-year' ? exam.onboarding.classId : null;
  const classId = plan.data?.classId ?? fallbackClass;
  return {
    context: classId ? { exam, classId } : null,
    isPending: plan.isPending,
    error: plan.error,
  };
}

export function useAdapter(testType: TestTypeKey): TestAdapter | null {
  return getTestAdapter(useExam(), testType);
}

export function useSubjects(testType: TestTypeKey, context: TestContext | null) {
  const adapter = useAdapter(testType);
  return useQuery({
    queryKey: examKeys.subjects(context?.exam.slug ?? '', testType),
    queryFn: () => adapter!.listSubjects!(context!),
    enabled: !!context && !!adapter?.listSubjects,
  });
}

export function useTestSets(testType: TestTypeKey, context: TestContext | null, subjectId?: string) {
  const adapter = useAdapter(testType);
  const needsSubject = !!adapter?.listSubjects;
  return useQuery({
    queryKey: examKeys.sets(context?.exam.slug ?? '', testType, subjectId),
    queryFn: () => adapter!.listSets!(context!, subjectId),
    enabled: !!context && !!adapter?.listSets && (!needsSubject || !!subjectId),
  });
}

export function useExamResult(testType: TestTypeKey, attemptId: string) {
  const exam = useExam();
  const adapter = useAdapter(testType);
  return useQuery({
    queryKey: examKeys.result(exam.slug, testType, attemptId),
    queryFn: () => adapter!.result(attemptId, exam),
    enabled: !!adapter,
    staleTime: Infinity,
  });
}

/** Starts (or resumes) an attempt once; never refetches, so answers are never overwritten. */
export function useExamSession(testType: TestTypeKey, setId: string, context: TestContext | null) {
  const adapter = useAdapter(testType);
  return useQuery({
    queryKey: examKeys.session(context?.exam.slug ?? '', testType, setId),
    queryFn: () => adapter!.start(context!, setId),
    enabled: !!context && !!adapter,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });
}

const AUTOSAVE_MS = 3000;

/**
 * Attempt state and persistence for the player: answers, navigation, review marks,
 * debounced autosave, save on tab hide / reconnect, and submit.
 */
export function useExamAttempt(
  session: ExamSession,
  adapter: TestAdapter,
  context: TestContext,
  onSubmitted: (outcome: SubmitOutcome) => void,
) {
  const firstOpen = Math.max(
    0,
    session.questions.findIndex((q) => !isAnswered(session.initial.answers[q.id])),
  );
  const [index, setIndex] = useState(firstOpen);
  const [snapshot, setSnapshot] = useState<AttemptSnapshot>(() => {
    const first = session.questions[firstOpen];
    return first ? withVisit(session.initial, first.id) : session.initial;
  });
  const latest = useRef(snapshot);
  latest.current = snapshot;
  const dirty = useRef(false);

  const save = useMutation({ mutationFn: (snap: AttemptSnapshot) => adapter.save(session, snap, context) });
  const saveRef = useRef(save.mutate);
  saveRef.current = save.mutate;

  const flush = useCallback(
    (keepalive = false) => {
      if (!dirty.current) return;
      dirty.current = false;
      if (keepalive) void adapter.save(session, latest.current, context, { keepalive: true });
      else saveRef.current(latest.current, { onError: () => (dirty.current = true) });
    },
    [adapter, session, context],
  );

  useEffect(() => {
    if (!dirty.current) return;
    const timer = setTimeout(() => flush(), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [snapshot, flush]);

  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && flush(true);
    const onPageHide = () => flush(true);
    const onOnline = () => flush();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('online', onOnline);
    };
  }, [flush]);

  const update = useCallback((change: (snap: AttemptSnapshot) => AttemptSnapshot) => {
    dirty.current = true;
    setSnapshot(change);
  }, []);

  const submit = useMutation({
    mutationFn: () => adapter.submit(session, latest.current, context),
    onMutate: () => {
      dirty.current = false;
    },
    onSuccess: (outcome) => onSubmitted(outcome),
  });

  const question = session.questions[index];

  return {
    index,
    question,
    snapshot,
    total: session.questions.length,
    isSaving: save.isPending,
    saveFailed: save.isError,
    submit,
    goTo: (next: number) => {
      const target = session.questions[next];
      if (!target) return;
      update((snap) => withVisit(snap, target.id));
      setIndex(next);
    },
    answer: (questionId: string, value: Answer | null) => update((snap) => withAnswer(snap, questionId, value)),
    /** Leaves the current question unanswered and moves on (it shows as "not answered"). */
    skip: () => {
      const current = session.questions[index];
      const target = session.questions[index + 1];
      if (!current) return;
      update((snap) => {
        const cleared = withAnswer(snap, current.id, null);
        return target ? withVisit(cleared, target.id) : cleared;
      });
      if (target) setIndex(index + 1);
    },
    toggleMark: (questionId: string) => update((snap) => withMarkToggled(snap, questionId)),
    saveNow: () => {
      dirty.current = true;
      flush();
    },
  };
}

/** Seconds left until `deadline` (wall clock, so it stays right after the tab sleeps). Calls onExpire once. */
export function useCountdown(deadline: number | null, onExpire: () => void): number | null {
  const compute = () => (deadline === null ? null : Math.max(0, Math.round((deadline - Date.now()) / 1000)));
  const [secondsLeft, setSecondsLeft] = useState(compute);
  const expired = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (deadline === null) return;
    const tick = () => {
      const left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0 && !expired.current) {
        expired.current = true;
        onExpireRef.current();
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [deadline]);

  return secondsLeft;
}

/** 1:05:09 / 05:09, or always hh:mm:ss (the previous app's timers) with `alwaysHours`. */
export function formatDuration(totalSeconds: number, alwaysHours = false): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (alwaysHours) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
