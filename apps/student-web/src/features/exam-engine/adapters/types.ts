import type { ExamRef } from '@/shared/config/exams';
import type { AttemptSnapshot, SubmitOutcome, SubmitSummary, ExamResult, ExamSession, SubjectGroup, TestContext, TestSetSummary } from '../model';

/** What the engine needs from a backend. One implementation per backend family. */
export interface TestAdapter {
  /** Starts or resumes an attempt. Throws AlreadySubmittedError when there is nothing to resume. */
  start(context: TestContext, setId: string): Promise<ExamSession>;
  /** Saves progress. `keepalive` is used while the page is closing. */
  save(
    session: ExamSession,
    snapshot: AttemptSnapshot,
    context: TestContext,
    options?: { keepalive?: boolean },
  ): Promise<void>;
  /** Submits and returns the attempt id for the result page (and the score when the backend sends it). */
  submit(session: ExamSession, snapshot: AttemptSnapshot, context: TestContext): Promise<SubmitOutcome>;
  /** The exam is the result page's (board results are read through its v4 routes). */
  result(attemptId: string, exam: ExamRef): Promise<ExamResult>;
  /** Absent when sets are only reachable from another page (Learn opens chapter tests by id). */
  listSets?(context: TestContext, subjectId?: string): Promise<TestSetSummary[]>;
  /** Present when sets are grouped by subject (board papers). */
  listSubjects?(context: TestContext): Promise<SubjectGroup[]>;
}

export const num = (value: unknown): number | null => {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

export const str = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

export const strOrNull = (value: unknown): string | null =>
  value === null || value === undefined || value === '' ? null : String(value);

export function emptyCounts() {
  return { correct: 0, incorrect: 0, partial: 0, unattempted: 0 };
}

/** Maps the stats every submit endpoint returns (`total_marks_obtained`, `correct_answers` …). */
export function toSubmitSummary(raw: Record<string, unknown> | null | undefined): SubmitSummary | null {
  if (!raw) return null;
  return {
    totalQuestions: num(raw.total_questions),
    totalMarks: num(raw.total_marks),
    obtained: num(raw.total_marks_obtained),
    correct: num(raw.correct_answers),
    incorrect: num(raw.incorrect_answers),
    partial: num(raw.partially_correct),
  };
}
