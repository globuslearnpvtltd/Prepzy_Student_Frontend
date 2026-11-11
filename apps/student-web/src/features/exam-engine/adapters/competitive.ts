import { assessmentsApiBase, type ExamRef } from '@/shared/config/exams';
import { apiClient } from '@/shared/lib/api-client';
import { assertOk } from '@/shared/lib/unwrap';
import { emptySnapshot } from '../attempt';
import {
  AlreadySubmittedError,
  type AttemptSnapshot,
  type ExamQuestion,
  type ExamResult,
  type ResultQuestion,
  type SetStatus,
  type TestSetSummary,
} from '../model';
import { emptyCounts, num, str, strOrNull, toSubmitSummary, type TestAdapter } from './types';

/** NEET-style papers: MCQ only, review marks, +4/−1 scored by the backend. */
type RawOption = { option_id: string | number; text?: string; image?: string | null; is_correct?: unknown };
export type RawCompetitiveQuestion = {
  question_id: string | number;
  question_text?: string;
  question_image?: string | null;
  marks?: number | string;
  options?: RawOption[];
  selected_option?: string | number | null;
  status?: string;
};

const TO_BACKEND_STATUS = {
  answered: 'answered',
  marked: 'marked_for_review',
  skipped: 'skipped',
  'not-visited': 'not_visited',
};

export function toCompetitiveQuestion(raw: RawCompetitiveQuestion): ExamQuestion {
  return {
    id: str(raw.question_id),
    kind: 'mcq',
    typeLabel: 'Multiple choice',
    html: raw.question_text ?? '',
    image: raw.question_image ?? null,
    marks: num(raw.marks),
    options: (raw.options ?? []).map((o) => ({ id: str(o.option_id), html: o.text ?? '', image: o.image ?? null })),
    parts: [],
  };
}

export function competitiveSnapshot(raws: RawCompetitiveQuestion[]): AttemptSnapshot {
  const snapshot = emptySnapshot();
  for (const raw of raws) {
    const id = str(raw.question_id);
    if (raw.selected_option !== null && raw.selected_option !== undefined && raw.selected_option !== '') {
      snapshot.answers[id] = { kind: 'option', optionId: str(raw.selected_option) };
    }
    if (raw.status === 'marked_for_review') snapshot.marked.push(id);
    if (raw.status && raw.status !== 'not_visited') snapshot.visited.push(id);
  }
  return snapshot;
}

export type CompetitiveAnswer = { question_id: string | number; status: string; selected_option: string | number | null };

/** The student's choices by question id: all a save sends (the server keeps the questions). */
export function toCompetitiveAnswers(raws: RawCompetitiveQuestion[], snapshot: AttemptSnapshot): CompetitiveAnswer[] {
  return raws.map((raw) => {
    const id = str(raw.question_id);
    const answer = snapshot.answers[id];
    const chosen =
      answer?.kind === 'option' ? raw.options?.find((o) => str(o.option_id) === answer.optionId) : undefined;
    const state = snapshot.marked.includes(id)
      ? 'marked'
      : chosen
        ? 'answered'
        : snapshot.visited.includes(id)
          ? 'skipped'
          : 'not-visited';
    return { question_id: raw.question_id, status: TO_BACKEND_STATUS[state], selected_option: chosen?.option_id ?? null };
  });
}

type RawResultQuestion = {
  question_id: string | number;
  question_text?: string;
  question_image?: string | null;
  options?: RawOption[];
  selected_option_id?: string | number | null;
  correct_option_id?: string | number | null;
  is_correct?: boolean | number;
  explanation?: string | null;
  explanation_image?: string | null;
  sample_answer?: string | null;
  marks_obtained?: number | string | null;
};

export function toCompetitiveResultQuestion(raw: RawResultQuestion): ResultQuestion {
  const selected = strOrNull(raw.selected_option_id);
  const correctId = strOrNull(raw.correct_option_id);
  const options = (raw.options ?? []).map((o) => {
    const id = str(o.option_id);
    return {
      id,
      html: o.text ?? '',
      image: o.image ?? null,
      isCorrect: correctId !== null ? id === correctId : !!o.is_correct,
      isSelected: id === selected,
    };
  });
  return {
    id: str(raw.question_id),
    kind: 'mcq',
    typeLabel: 'Multiple choice',
    html: raw.question_text ?? '',
    image: raw.question_image ?? null,
    marks: null,
    obtained: num(raw.marks_obtained),
    outcome: selected === null ? 'unattempted' : raw.is_correct ? 'correct' : 'incorrect',
    options,
    answerHtml: null,
    feedbackHtml: null,
    sampleAnswerHtml: raw.sample_answer || raw.explanation || null,
    explanationImage: raw.explanation_image ?? null,
    parts: [],
  };
}

function toResult(
  title: string,
  summary: {
    total_marks?: unknown;
    total_marks_obtained?: unknown;
    attempt_date?: string;
    submitted_at?: string;
    name?: string;
    set_id?: unknown;
  } = {},
  rawQuestions: RawResultQuestion[] = [],
): ExamResult {
  const questions = rawQuestions.map(toCompetitiveResultQuestion);
  const counts = emptyCounts();
  for (const q of questions) counts[q.outcome] += 1;
  return {
    title: summary.name ? `${summary.name} result` : title,
    totalMarks: num(summary.total_marks) ?? 0,
    obtained: num(summary.total_marks_obtained) ?? 0,
    counts,
    questions,
    attemptedAt: summary.attempt_date ?? summary.submitted_at ?? null,
    assessmentId: strOrNull(summary.set_id),
  };
}

function setStatus(item: { status?: string; attempt_count?: unknown; ongoing_session?: unknown }): SetStatus {
  if (item.ongoing_session || item.status === 'in_progress') return 'in-progress';
  if ((num(item.attempt_count) ?? 0) > 0 || item.status === 'completed') return 'completed';
  return 'new';
}

/** Competitive test types the v4 exam player runs (`${assessmentsApiBase}/<testType>/…`). */
export type CompetitiveTestType = 'mock' | 'pyq' | 'chapter-pyq' | 'custom' | 'dpp' | 'practice';

/**
 * Competitive papers on the v4 player: POST sets/:setId/attempts, PUT attempts/:id, POST attempts/:id/submit,
 * GET attempts/:id/result. Chapter PYQs are keyed by chapter (module) id, practice by the chapter's assessment id.
 */
export interface CompetitiveEndpoints {
  label: string;
  testType: CompetitiveTestType;
  /** Test type of the v4 paper list (`${assessmentsApiBase}/<listType>/sets`). */
  listType?: 'mock' | 'pyq';
}

type StartData = {
  attempt_id?: string | number;
  /** `submitted`: a daily paper already taken, or a custom test whose time ran out (the saved answers were submitted). */
  status?: 'in_progress' | 'submitted';
  name?: string | null;
  time_left?: number | string;
  questions?: RawCompetitiveQuestion[];
};

export function createCompetitiveAdapter(endpoints: CompetitiveEndpoints): TestAdapter {
  type Context = { setId: string; attemptId: string; raws: RawCompetitiveQuestion[] };
  const typeBase = (exam: ExamRef) => `${assessmentsApiBase(exam)}/${endpoints.testType}`;
  const attemptUrl = (exam: ExamRef, attemptId: string) => `${typeBase(exam)}/attempts/${encodeURIComponent(attemptId)}`;

  const adapter: TestAdapter = {
    async start({ exam, classId }, setId) {
      const body = assertOk(
        await apiClient.post<{ data?: StartData }>(`${typeBase(exam)}/sets/${encodeURIComponent(setId)}/attempts`, {
          class_id: classId,
        }),
      );
      const data = body.data ?? {};
      if (data.status === 'submitted') throw new AlreadySubmittedError(str(data.attempt_id));
      const raws = data.questions ?? [];
      const seconds = num(data.time_left);
      return {
        key: `${endpoints.label}:${setId}`,
        title: data.name ?? endpoints.label,
        questions: raws.map(toCompetitiveQuestion),
        deadline: seconds === null ? null : Date.now() + seconds * 1000,
        initial: competitiveSnapshot(raws),
        context: { setId, attemptId: str(data.attempt_id), raws } satisfies Context,
      };
    },

    async save(session, snapshot, { exam }, options) {
      const { attemptId, raws } = session.context as Context;
      const body = { answers: toCompetitiveAnswers(raws, snapshot) };
      if (options?.keepalive) apiClient.keepalive('PUT', attemptUrl(exam, attemptId), body);
      else await apiClient.put(attemptUrl(exam, attemptId), body);
    },

    async submit(session, snapshot, { exam, classId }) {
      const { attemptId, raws } = session.context as Context;
      const body = assertOk(
        await apiClient.post<{ data?: { attempt_id: string | number; summary?: Record<string, unknown> } }>(
          `${attemptUrl(exam, attemptId)}/submit`,
          { class_id: classId, answers: toCompetitiveAnswers(raws, snapshot) },
        ),
      );
      return { attemptId: str(body.data?.attempt_id), summary: toSubmitSummary(body.data?.summary) };
    },

    async result(attemptId, exam) {
      const body = assertOk(
        await apiClient.get<{ data?: { summary?: Record<string, never>; questions?: RawResultQuestion[] } }>(
          `${attemptUrl(exam, attemptId)}/result`,
        ),
      );
      return toResult(`${endpoints.label} result`, body.data?.summary, body.data?.questions);
    },
  };

  const { listType } = endpoints;
  if (listType) {
    adapter.listSets = async ({ exam, classId }) => {
      type Item = {
        set_id: string | number;
        name?: string;
        title?: string;
        year?: string | number | null;
        set_number?: string | null;
        duration?: number | string;
        question_count?: number | string;
        attempt_count?: number | string;
        status?: string;
        ongoing_session?: unknown;
      };
      const body = assertOk(
        await apiClient.get<{ data?: { sets?: Item[] } }>(`${assessmentsApiBase(exam)}/${listType}/sets`, {
          params: listType === 'mock' ? { class_id: classId } : {},
        }),
      );
      return (body.data?.sets ?? []).map((item): TestSetSummary => ({
        id: str(item.set_id),
        title: item.name ?? `Paper ${str(item.set_id)}`,
        subtitle: listType === 'pyq' ? [item.year, item.set_number].filter(Boolean).join(' · ') || null : null,
        questionCount: num(item.question_count),
        durationMinutes: num(item.duration),
        status: setStatus(item),
        lastScore: null,
        lastAttemptId: null,
      }));
    };
  }
  return adapter;
}

/** Daily practice paper: taken once (a submitted paper opens its result); the list is today's live paper. */
export function createDppAdapter(): TestAdapter {
  return {
    ...createCompetitiveAdapter({ label: 'Daily practice', testType: 'dpp' }),

    async listSets({ exam }) {
      type Live = {
        dpp?: { dpp_id: string | number; dpp_name?: string | null; dpp_date?: string | null } | null;
        question_count?: number;
        attempt?: { status?: string; attempt_id?: string | number } | null;
      };
      const body = assertOk(
        await apiClient.get<{ data?: Live | null }>(`${assessmentsApiBase(exam)}/dpp/live`),
      );
      const live = body.data;
      if (!live?.dpp) return [];
      const submitted = live.attempt?.status === 'submitted' || live.attempt?.status === 'completed';
      return [
        {
          id: str(live.dpp.dpp_id),
          title: live.dpp.dpp_name ?? "Today's practice",
          subtitle: live.dpp.dpp_date
            ? new Date(live.dpp.dpp_date).toLocaleDateString('en-IN', { dateStyle: 'medium' })
            : null,
          questionCount: num(live.question_count),
          durationMinutes: num(live.question_count) === null ? null : (num(live.question_count) ?? 0) * 2,
          status: submitted ? 'completed' : live.attempt ? 'in-progress' : 'new',
          lastScore: null,
          lastAttemptId: submitted ? strOrNull(live.attempt?.attempt_id) : null,
        },
      ];
    },
  };
}
