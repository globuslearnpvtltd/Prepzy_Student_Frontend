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

export function toCompetitivePayload(
  raws: RawCompetitiveQuestion[],
  snapshot: AttemptSnapshot,
): RawCompetitiveQuestion[] {
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
    return { ...raw, selected_option: chosen?.option_id ?? null, status: TO_BACKEND_STATUS[state] };
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

/** Session-based papers (NEET mock, PYQ, chapter PYQ, custom): POST start returns an absolute expiry time. */
export interface SessionEndpoints {
  label: string;
  start: string;
  save: string;
  submit: string;
  result: string;
  /** Body key the id is sent as: papers use `set_id`, chapter PYQs the chapter's `module_id`. */
  idKey?: 'set_id' | 'module_id';
  list?: string;
  listKey?: 'mockExams' | 'pyqExams';
}

type StartData = {
  session_expiry_time?: string;
  remaining_seconds?: number | string;
  questions?: RawCompetitiveQuestion[];
  name?: string;
  /** Custom tests: the session expired, so the backend submitted it and sends the attempt instead. */
  expired_submitted?: boolean;
  attempt_id?: string | number;
};

function deadlineOf(data: StartData): number | null {
  const seconds = num(data.remaining_seconds);
  if (seconds !== null) return Date.now() + seconds * 1000;
  const expiry = data.session_expiry_time ? Date.parse(data.session_expiry_time) : Number.NaN;
  return Number.isFinite(expiry) ? expiry : null;
}

export function createSessionAdapter(endpoints: SessionEndpoints): TestAdapter {
  type Context = { setId: string; raws: RawCompetitiveQuestion[] };
  const idKey = endpoints.idKey ?? 'set_id';

  const adapter: TestAdapter = {
    async start({ classId }, setId) {
      const body = assertOk(
        await apiClient.post<{ data: StartData }>(endpoints.start, { [idKey]: setId, class_id: classId }),
      );
      const data = body.data ?? {};
      if (data.expired_submitted) throw new AlreadySubmittedError(str(data.attempt_id));
      const raws = data.questions ?? [];
      return {
        key: `${endpoints.label}:${setId}`,
        title: data.name ?? endpoints.label,
        questions: raws.map(toCompetitiveQuestion),
        deadline: deadlineOf(data),
        initial: competitiveSnapshot(raws),
        context: { setId, raws } satisfies Context,
      };
    },

    async save(session, snapshot, _context, options) {
      const { setId, raws } = session.context as Context;
      const body = { [idKey]: setId, questions: toCompetitivePayload(raws, snapshot) };
      if (options?.keepalive) apiClient.keepalive('PUT', endpoints.save, body);
      else await apiClient.put(endpoints.save, body);
    },

    async submit(session, snapshot, { classId }) {
      const { setId, raws } = session.context as Context;
      const body = assertOk(
        await apiClient.post<{ data?: { attempt_id: string | number } & Record<string, unknown> }>(endpoints.submit, {
          [idKey]: setId,
          class_id: classId,
          questions: toCompetitivePayload(raws, snapshot),
        }),
      );
      return { attemptId: str(body.data?.attempt_id), summary: toSubmitSummary(body.data) };
    },

    async result(attemptId) {
      const body = assertOk(
        await apiClient.get<{ data?: { summary?: Record<string, never>; questions?: RawResultQuestion[] } }>(
          endpoints.result,
          { params: { attempt_id: attemptId } },
        ),
      );
      return toResult(`${endpoints.label} result`, body.data?.summary, body.data?.questions);
    },
  };

  const { list, listKey } = endpoints;
  if (list && listKey) {
    adapter.listSets = async ({ exam, classId }) => {
      type Item = {
        set_id: string | number;
        name?: string;
        title?: string;
        year?: string | number;
        setName?: string;
        duration?: number | string;
        question_count?: number | string;
        attempt_count?: number | string;
        status?: string;
        ongoing_session?: unknown;
      };
      const body = assertOk(
        await apiClient.get<{ data?: Record<string, Item[]> }>(list, {
          params: { exam_id: exam.examId, class_id: classId },
        }),
      );
      return (body.data?.[listKey] ?? []).map((item): TestSetSummary => ({
        id: str(item.set_id),
        title: item.name ?? item.title ?? `Paper ${str(item.set_id)}`,
        subtitle: [item.year, item.setName].filter(Boolean).join(' · ') || null,
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

/** Chapter practice questions (keyed by assessment id): GET start, timer in seconds. */
export function createPracticeAdapter(): TestAdapter {
  type Context = { assessmentId: string; raws: RawCompetitiveQuestion[] };
  const label = 'Practice questions';
  const base = '/api/neet/quiz-exam';

  return {
    async start({ classId }, assessmentId) {
      const body = assertOk(
        await apiClient.get<{ questions?: RawCompetitiveQuestion[]; time_left?: number | string }>(
          `${base}/fetch-quiz-questions`,
          { params: { assessment_id: assessmentId, class_id: classId } },
        ),
      );
      const raws = body.questions ?? [];
      const seconds = num(body.time_left);
      return {
        key: `practice:${assessmentId}`,
        title: label,
        questions: raws.map(toCompetitiveQuestion),
        deadline: seconds === null ? null : Date.now() + seconds * 1000,
        initial: competitiveSnapshot(raws),
        context: { assessmentId, raws } satisfies Context,
      };
    },

    async save(session, snapshot, _context, options) {
      const { assessmentId, raws } = session.context as Context;
      const body = { assessment_id: assessmentId, questions: toCompetitivePayload(raws, snapshot) };
      if (options?.keepalive) apiClient.keepalive('PUT', `${base}/update-quiz-session-questions`, body);
      else await apiClient.put(`${base}/update-quiz-session-questions`, body);
    },

    async submit(session, snapshot) {
      const { assessmentId, raws } = session.context as Context;
      const body = assertOk(
        await apiClient.post<{ attempt_id?: string | number; data?: Record<string, unknown> }>(`${base}/submit-exam`, {
          assessment_id: assessmentId,
          questions: toCompetitivePayload(raws, snapshot),
        }),
      );
      return { attemptId: str(body.attempt_id ?? body.data?.attempt_id), summary: toSubmitSummary(body.data) };
    },

    async result(attemptId) {
      const body = assertOk(
        await apiClient.get<{ data?: { summary?: Record<string, never>; questions?: RawResultQuestion[] } }>(
          `${base}/fetch-quiz-responses`,
          { params: { attempt_id: attemptId } },
        ),
      );
      return toResult(`${label} result`, body.data?.summary, body.data?.questions);
    },
  };
}

/** Daily practice paper: attempt-based, timer in seconds, one paper per day. */
export function createDppAdapter(): TestAdapter {
  type Context = { dppId: string; attemptId: string; raws: RawCompetitiveQuestion[] };
  const label = 'Daily practice';

  return {
    async start({ classId }, dppId) {
      const body = assertOk(
        await apiClient.get<{
          already_attempted?: boolean;
          attempt_id: string | number;
          time_left?: number;
          questions?: RawCompetitiveQuestion[];
        }>('/api/neet/start-dpp-attempt', { params: { dpp_id: dppId, class_id: classId } }),
      );
      if (body.already_attempted) throw new AlreadySubmittedError(str(body.attempt_id));
      const raws = body.questions ?? [];
      const seconds = num(body.time_left);
      return {
        key: `dpp:${dppId}`,
        title: label,
        questions: raws.map(toCompetitiveQuestion),
        deadline: seconds === null ? null : Date.now() + seconds * 1000,
        initial: competitiveSnapshot(raws),
        context: { dppId, attemptId: str(body.attempt_id), raws } satisfies Context,
      };
    },

    async save(session, snapshot, _context, options) {
      const { dppId, attemptId, raws } = session.context as Context;
      const body = { dpp_id: dppId, attempt_id: attemptId, questions: toCompetitivePayload(raws, snapshot) };
      if (options?.keepalive) apiClient.keepalive('PUT', '/api/neet/update-dpp-session-questions', body);
      else await apiClient.put('/api/neet/update-dpp-session-questions', body);
    },

    async submit(session, snapshot, { classId }) {
      const { dppId, attemptId, raws } = session.context as Context;
      assertOk(
        await apiClient.post('/api/neet/submit-dpp-attempt', {
          dpp_id: dppId,
          attempt_id: attemptId,
          class_id: classId,
          questions: toCompetitivePayload(raws, snapshot),
        }),
      );
      return { attemptId };
    },

    async result(attemptId) {
      const body = assertOk(
        await apiClient.get<{ data?: { summary?: Record<string, never>; questions?: RawResultQuestion[] } }>(
          '/api/neet/get-dpp-result',
          { params: { attempt_id: attemptId } },
        ),
      );
      return toResult(`${label} result`, body.data?.summary, body.data?.questions);
    },

    async listSets({ exam }) {
      type Live = {
        dpp?: { dpp_id: string | number; dpp_name?: string; dpp_date?: string } | null;
        questionCount?: number;
        attempt?: { status?: string; attempt_id?: string | number } | null;
      };
      const body = assertOk(
        await apiClient.get<{ data?: Live }>('/api/neet/get-live-dpp-neet', {
          params: { exam: exam.examSlice.toUpperCase() },
        }),
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
          questionCount: num(live.questionCount),
          durationMinutes: num(live.questionCount) === null ? null : (num(live.questionCount) ?? 0) * 2,
          status: submitted ? 'completed' : live.attempt ? 'in-progress' : 'new',
          lastScore: null,
          lastAttemptId: submitted ? strOrNull(live.attempt?.attempt_id) : null,
        },
      ];
    },
  };
}
