import type { ExamResult, Outcome } from '@/features/exam-engine';
import type { ExamRef } from '@/shared/config/exams';
import { apiClient } from '@/shared/lib/api-client';
import { ApiError } from '@/shared/lib/errors';
import { assertOk } from '@/shared/lib/unwrap';

type Envelope<T> = { success?: boolean; message?: string; error?: string; data?: T };

export interface DiagnosticStatus {
  state: 'not_attempted' | 'in_progress' | 'cooldown' | 'available';
  assessmentId: number | null;
}

export interface Blueprint {
  isValid: boolean;
  errors: string[];
  subjectCount: number;
  chapterCount: number;
  totalQuestions: number;
  durationSeconds: number;
}

export type QuestionStatus = 'not_visited' | 'skipped' | 'answered' | 'marked_for_review';

export interface DiagnosticOption {
  option_index: number;
  option_text: string;
  option_image: string | null;
}
export interface SubQuestion {
  sub_index: number;
  sub_question_text: string;
  sub_question_image: string | null;
  marks: number;
  options: DiagnosticOption[];
}
export type SubAnswer = { sub_index: number; option_index: number };
export type DiagnosticAnswer = { option_index: number } | SubAnswer[] | null;

/** Kept in the backend's shape: the whole list is saved and submitted back as-is. */
export interface DiagnosticQuestion {
  question_id: number;
  question_order: number;
  question_type: 'conceptual' | 'numerical' | 'case_based';
  subject_id: number;
  subject_name: string;
  module_id: number;
  question_text: string;
  question_image: string | null;
  marks: number;
  options: DiagnosticOption[];
  sub_questions: SubQuestion[];
  selected_answer: DiagnosticAnswer;
  status: QuestionStatus;
}

export interface SubjectStrength {
  id: number;
  name: string;
  pct: number;
  correct: number;
  questions: number;
  /** Marks of the subject (negative marking can push `obtained` below 0). */
  total: number;
  obtained: number;
  /** strong / moderate / weak */
  band: string | null;
}

export interface ChapterStrength {
  id: number;
  name: string;
  subjectId: number | null;
  correct: number;
  questions: number;
  pct: number;
}

/** The score the backend returns straight after submitting (the competitive score card). */
export interface DiagnosticSubmitSummary {
  totalQuestions: number;
  totalMarks: number;
  obtained: number;
  correct: number;
  incorrect: number;
  unattempted: number;
}

export interface DiagnosticResult {
  assessmentId: number;
  status: string;
  totalQuestions: number;
  totalMarks: number;
  obtained: number;
  correct: number;
  incorrect: number;
  subjects: SubjectStrength[];
  chapters: ChapterStrength[];
  overallPercent: number;
  academicBand: string;
  pace: { band: string; takenSeconds: number; totalSeconds: number };
  thinking: { label: string; leaning: string | null; reason: string | null; accuracies: Record<string, number> };
  aiSummary: {
    summary: string[];
    strongest: { name: string; summary: string } | null;
    needsTime: { name: string; summary: string } | null;
    howYouLearn: { tagline: string; suggestion: string } | null;
  } | null;
}

const num = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
const obj = (value: unknown) => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {});
const list = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object') : [];

export function toDiagnosticStatus(raw: unknown): DiagnosticStatus {
  const row = obj(raw);
  const states = ['not_attempted', 'in_progress', 'cooldown', 'available'] as const;
  return {
    state: states.find((s) => s === row.state) ?? 'available',
    assessmentId: row.assessment_id ? num(row.assessment_id) : null,
  };
}

export function toBlueprint(raw: unknown): Blueprint {
  const row = obj(raw);
  return {
    isValid: row.is_valid !== false,
    errors: Array.isArray(row.errors) ? row.errors.map(String) : [],
    subjectCount: num(row.subject_count),
    chapterCount: num(row.chapter_count),
    totalQuestions: num(row.total_questions),
    durationSeconds: num(row.duration_seconds) || num(row.duration_minutes) * 60,
  };
}

const toOptions = (raw: unknown): DiagnosticOption[] =>
  list(raw).map((o) => ({ option_index: num(o.option_index), option_text: String(o.option_text ?? ''), option_image: text(o.option_image) }));

export function toQuestions(raw: unknown): DiagnosticQuestion[] {
  return list(raw).map((q) => {
    const type = q.question_type === 'numerical' || q.question_type === 'case_based' ? q.question_type : 'conceptual';
    const statuses: QuestionStatus[] = ['not_visited', 'skipped', 'answered', 'marked_for_review'];
    return {
      question_id: num(q.question_id),
      question_order: num(q.question_order),
      question_type: type,
      subject_id: num(q.subject_id),
      subject_name: String(q.subject_name ?? ''),
      module_id: num(q.module_id),
      question_text: String(q.question_text ?? ''),
      question_image: text(q.question_image),
      marks: num(q.marks),
      options: toOptions(q.options),
      sub_questions: list(q.sub_questions).map((s) => ({
        sub_index: num(s.sub_index),
        sub_question_text: String(s.sub_question_text ?? ''),
        sub_question_image: text(s.sub_question_image),
        marks: num(s.marks),
        options: toOptions(s.options),
      })),
      selected_answer: (q.selected_answer as DiagnosticAnswer) ?? null,
      status: statuses.find((s) => s === q.status) ?? 'not_visited',
    };
  });
}

export function toResult(raw: unknown): DiagnosticResult {
  const row = obj(raw);
  const profiling = obj(row.profiling_parameters);
  const pace = obj(profiling.learning_pace);
  const thinking = obj(profiling.thinking_style);
  const ai = row.ai_summary ? obj(row.ai_summary) : null;
  const pair = (value: unknown, key: string) => {
    const p = obj(value);
    return text(p.subject_name) ? { name: String(p.subject_name), summary: String(p[key] ?? '') } : null;
  };
  const how = ai ? obj(ai.how_you_learn) : {};
  return {
    assessmentId: num(row.assessment_id),
    status: text(row.status) ?? '',
    totalQuestions: num(row.total_questions),
    totalMarks: num(row.total_marks),
    obtained: num(row.total_marks_obtained),
    correct: num(row.correct_answers),
    incorrect: num(row.incorrect_answers),
    subjects: list(row.subject_strengths).map((s) => ({
      id: num(s.subject_id),
      name: text(s.name) ?? '—',
      pct: num(s.pct),
      correct: num(s.correct),
      questions: num(s.questions),
      total: num(s.total),
      obtained: num(s.obtained),
      band: text(s.band),
    })),
    chapters: list(row.chapter_strengths).map((c) => ({
      id: num(c.module_id),
      name: text(c.name) ?? 'Chapter',
      subjectId: c.subject_id === null || c.subject_id === undefined ? null : num(c.subject_id),
      correct: num(c.correct),
      questions: num(c.questions),
      pct: num(c.pct),
    })),
    overallPercent: num(profiling.overall_percentage),
    academicBand: text(profiling.academic_band) ?? 'basic',
    pace: { band: text(pace.band) ?? 'normal', takenSeconds: num(pace.time_taken_seconds), totalSeconds: num(pace.total_time_seconds) },
    thinking: {
      label: text(thinking.label) ?? '',
      leaning: text(thinking.leaning),
      reason: text(thinking.reason),
      accuracies: Object.fromEntries(Object.entries(obj(thinking.accuracies)).map(([k, v]) => [k, num(v)])),
    },
    aiSummary: ai
      ? {
          summary: Array.isArray(ai.summary) ? ai.summary.map(String) : [],
          strongest: pair(ai.strongest_subject, 'summary'),
          needsTime: pair(ai.needs_time, 'summary'),
          howYouLearn: text(how.tagline) ? { tagline: String(how.tagline), suggestion: String(how.suggestion ?? '') } : null,
        }
      : null,
  };
}

export function toSubmitSummary(raw: unknown): DiagnosticSubmitSummary {
  const row = obj(obj(raw).summary);
  const totalQuestions = num(row.total_questions);
  const correct = num(row.correct_answers);
  const incorrect = num(row.incorrect_answers);
  return {
    totalQuestions,
    totalMarks: num(row.total_marks),
    obtained: num(row.total_marks_obtained),
    correct,
    incorrect,
    unattempted:
      row.unattempted === undefined || row.unattempted === null
        ? Math.max(0, totalQuestions - correct - incorrect)
        : num(row.unattempted),
  };
}

const OUTCOMES: Record<string, Outcome> = { correct: 'correct', incorrect: 'incorrect', not_answered: 'unattempted' };

/** Review Solutions (competitive): the answers in the exam engine's result shape, so its review screen renders them. */
export function toReviewResult(raw: unknown): ExamResult {
  const row = obj(raw);
  const counts = obj(row.counts);
  return {
    title: 'Diagnostic Test',
    totalMarks: num(row.total_marks),
    obtained: num(row.total_marks_obtained),
    counts: { correct: num(counts.correct), incorrect: num(counts.incorrect), partial: 0, unattempted: num(counts.not_answered) },
    attemptedAt: text(row.submitted_at),
    questions: list(row.questions).map((q) => ({
      id: String(q.question_id ?? q.question_number ?? ''),
      kind: 'mcq' as const,
      typeLabel: 'MCQ',
      html: String(q.question_text ?? ''),
      image: text(q.question_image),
      marks: num(q.marks),
      obtained: num(q.marks_obtained),
      outcome: OUTCOMES[String(q.status)] ?? 'unattempted',
      options: list(q.options).map((o, i) => ({
        id: String(o.option_index ?? i),
        html: String(o.option_text ?? ''),
        image: text(o.option_image),
        isCorrect: !!o.is_correct_answer,
        isSelected: !!o.is_selected,
      })),
      answerHtml: null,
      feedbackHtml: null,
      sampleAnswerHtml: text(q.explanation),
      explanationImage: text(q.explanation_image),
      parts: [],
    })),
  };
}

// ---- Attempt state (pure; the test screen keeps it in a reducer) ----

export const isCase = (q: DiagnosticQuestion) => q.question_type === 'case_based';

export function hasAnswer(q: DiagnosticQuestion): boolean {
  if (isCase(q)) {
    const picks = Array.isArray(q.selected_answer) ? q.selected_answer.length : 0;
    return picks > 0 && picks >= q.sub_questions.length;
  }
  return q.selected_answer !== null && !Array.isArray(q.selected_answer);
}

export type AttemptAction =
  | { type: 'select'; questionId: number; optionIndex: number }
  | { type: 'select-sub'; questionId: number; subIndex: number; optionIndex: number }
  | { type: 'toggle-review'; questionId: number }
  | { type: 'leave'; questionId: number };

/** One question changes per action; "leave" marks an unanswered, unmarked question as skipped. */
export function attemptReducer(questions: DiagnosticQuestion[], action: AttemptAction): DiagnosticQuestion[] {
  return questions.map((q) => {
    if (q.question_id !== action.questionId) return q;
    switch (action.type) {
      case 'select':
        return isCase(q) ? q : { ...q, selected_answer: { option_index: action.optionIndex }, status: 'answered' };
      case 'select-sub': {
        if (!isCase(q)) return q;
        const picks = Array.isArray(q.selected_answer) ? [...q.selected_answer] : [];
        const at = picks.findIndex((p) => p.sub_index === action.subIndex);
        if (at >= 0 && picks[at]!.option_index === action.optionIndex) picks.splice(at, 1);
        else if (at >= 0) picks[at] = { sub_index: action.subIndex, option_index: action.optionIndex };
        else picks.push({ sub_index: action.subIndex, option_index: action.optionIndex });
        picks.sort((a, b) => a.sub_index - b.sub_index);
        const next = { ...q, selected_answer: picks };
        return q.status === 'marked_for_review' ? next : { ...next, status: hasAnswer(next) ? 'answered' : 'not_visited' };
      }
      case 'toggle-review':
        return q.status === 'marked_for_review' ? { ...q, status: hasAnswer(q) ? 'answered' : 'not_visited' } : { ...q, status: 'marked_for_review' };
      case 'leave':
        return !hasAnswer(q) && q.status !== 'marked_for_review' ? { ...q, status: 'skipped' } : q;
      default:
        return q;
    }
  });
}

export function statusCounts(questions: DiagnosticQuestion[]) {
  const counts = { answered: 0, notAnswered: 0, marked: 0, notVisited: 0 };
  for (const q of questions) {
    if (q.status === 'answered') counts.answered += 1;
    else if (q.status === 'skipped') counts.notAnswered += 1;
    else if (q.status === 'marked_for_review') counts.marked += 1;
    else counts.notVisited += 1;
  }
  return counts;
}

/** "25 Mins", "12:30 Mins" */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (s) return `${m}:${String(s).padStart(2, '0')} Mins`;
  return `${m} ${m === 1 ? 'Min' : 'Mins'}`;
}
export const formatClock = (seconds: number) => {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
};

/** v4 diagnostic routes of an exam (`attemptId` is the backend's diagnostic attempt id, called assessment_id in payloads). */
export const diagnosticApiBase = (exam: ExamRef): string => `/api/v4/diagnostic/${exam.category}/${exam.examId}`;

export const diagnosticApi = {
  async status(exam: ExamRef, classId: number): Promise<DiagnosticStatus> {
    return toDiagnosticStatus(assertOk(await apiClient.get<Envelope<unknown>>(`${diagnosticApiBase(exam)}/classes/${classId}/status`)).data);
  },
  async blueprint(exam: ExamRef, classId: number, moduleIds: number[]): Promise<Blueprint> {
    const body = await apiClient.post<Envelope<unknown>>(`${diagnosticApiBase(exam)}/classes/${classId}/blueprint`, { module_ids: moduleIds });
    return toBlueprint(assertOk(body).data);
  },
  /** Starts the test (or resumes the running one); 429 means a cooldown is running (the page then shows the last result). */
  async start(exam: ExamRef, classId: number, moduleIds: number[]): Promise<number> {
    const body = await apiClient.post<Envelope<{ assessment_id?: number }>>(`${diagnosticApiBase(exam)}/classes/${classId}/attempts`, { module_ids: moduleIds });
    const id = num(assertOk(body).data?.assessment_id);
    if (!id) throw new ApiError({ status: 500, code: 'EMPTY_RESPONSE', message: "We couldn't start your test. Please try again." });
    return id;
  },
  async questions(exam: ExamRef, assessmentId: string): Promise<{ questions: DiagnosticQuestion[]; timeLeft: number | null }> {
    const body = assertOk(await apiClient.get<Envelope<{ questions?: unknown; time_left?: unknown }>>(`${diagnosticApiBase(exam)}/attempts/${assessmentId}`));
    const timeLeft = body.data?.time_left;
    return { questions: toQuestions(body.data?.questions), timeLeft: timeLeft === undefined || timeLeft === null ? null : num(timeLeft) };
  },
  async save(exam: ExamRef, assessmentId: string, questions: DiagnosticQuestion[], keepalive = false): Promise<void> {
    const path = `${diagnosticApiBase(exam)}/attempts/${assessmentId}`;
    if (keepalive) apiClient.keepalive('PUT', path, { questions });
    else await apiClient.put(path, { questions });
  },
  /** Marks the test; returns the score (the competitive score card shows it). */
  async submit(exam: ExamRef, assessmentId: string, questions: DiagnosticQuestion[]): Promise<DiagnosticSubmitSummary> {
    const body = assertOk(await apiClient.post<Envelope<unknown>>(`${diagnosticApiBase(exam)}/attempts/${assessmentId}/submit`, { questions }));
    return toSubmitSummary(body.data);
  },
  /** Review Solutions of a finished attempt (competitive exams only; board answers 404). */
  async review(exam: ExamRef, assessmentId: string): Promise<ExamResult> {
    const body = assertOk(await apiClient.get<Envelope<unknown>>(`${diagnosticApiBase(exam)}/attempts/${assessmentId}/review`));
    if (!body.data) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'No solutions found for this test.' });
    return toReviewResult(body.data);
  },
  /** The given attempt's report, or the class's latest (404 when there is none). */
  async result(exam: ExamRef, classId: number, assessmentId: string | null): Promise<DiagnosticResult> {
    const body = await apiClient.get<Envelope<unknown>>(`${diagnosticApiBase(exam)}/classes/${classId}/result`, {
      params: assessmentId ? { attempt_id: assessmentId } : {},
    });
    const data = assertOk(body).data;
    if (!data) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Take the diagnostic test to see your personalised report.' });
    return toResult(data);
  },
};
