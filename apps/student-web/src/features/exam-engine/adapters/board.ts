import { apiClient } from '@/shared/lib/api-client';
import { assertOk } from '@/shared/lib/unwrap';
import { emptySnapshot, htmlToText, isAnswered, writtenToHtml } from '../attempt';
import type {
  Answer,
  AttemptSnapshot,
  ExamQuestion,
  ExamResult,
  Outcome,
  QuestionKind,
  ResultQuestion,
  SetStatus,
  TestSetSummary,
  WrittenAnswer,
} from '../model';
import { emptyCounts, num, str, strOrNull, toSubmitSummary, type TestAdapter } from './types';

/** Board papers (CBSE mock, PYQ, chapter PYQ, custom, mid, final, quiz): MCQ + written answers graded on submit. */
export interface BoardEndpoints {
  label: string;
  fetch: string;
  save: string;
  submit: string;
  result: string;
  /** Paper list per subject; absent for tests opened from Learn (chapter PYQ, mid, final, quiz, custom). */
  sets?: string;
  /** Key in GET /api/active-exams that lists subjects for this paper type. */
  subjectKey?: 'mock_result' | 'pyq_result';
}

type RawImage = { url: string; public_id?: string };
type RawSelected = { text?: string | number | null; images?: RawImage[] } | null | undefined;
type RawOption = {
  option_id: string | number;
  option_text?: string;
  option_image?: string | null;
  is_correct?: unknown;
};
type RawSubQuestion = {
  id: string | number;
  sub_question_text?: string;
  sub_question_image?: string | null;
  mark?: number;
  selected_answer?: RawSelected;
};
export type RawBoardQuestion = {
  question_id: string | number;
  question_text?: string;
  question_image?: string | null;
  question_type?: string;
  marks?: number | string;
  options?: RawOption[] | null;
  sub_questions?: RawSubQuestion[] | null;
  selected_answer?: RawSelected;
  status?: string;
};

const TYPE_LABELS: Record<string, string> = {
  mcq: 'Multiple choice',
  grammar_mcq: 'Grammar · multiple choice',
  very_short_answer: 'Very short answer',
  short_answer: 'Short answer',
  long_answer: 'Long answer',
  'long_answer_type-i': 'Long answer (type I)',
  'long_answer_type-ii': 'Long answer (type II)',
  grammar_short: 'Grammar',
  letter: 'Letter writing',
  paragraph: 'Paragraph writing',
  case_based: 'Case based',
  unseen_passage: 'Unseen passage',
};

export const boardTypeLabel = (type: string | undefined) =>
  TYPE_LABELS[type ?? ''] ?? (type ? type.replace(/[_-]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : 'Question');

function kindOf(raw: RawBoardQuestion): QuestionKind {
  if (raw.question_type === 'mcq' || raw.question_type === 'grammar_mcq') return 'mcq';
  // The backend sends `sub_questions: []` for every question; only a non-empty list makes it multipart.
  if ((raw.sub_questions?.length ?? 0) > 0) return 'multipart';
  return 'written';
}

/** Restores a saved written answer; the stored HTML goes back into the rich-text editor unchanged. */
export function toWritten(selected: RawSelected): WrittenAnswer {
  const html = typeof selected?.text === 'string' ? selected.text : '';
  return {
    text: htmlToText(html),
    images: (selected?.images ?? []).map((img) => ({ url: img.url, publicId: img.public_id ?? '' })),
    ...(html.trim() ? { html } : {}),
  };
}

export function toBoardQuestion(raw: RawBoardQuestion): ExamQuestion {
  return {
    id: str(raw.question_id),
    kind: kindOf(raw),
    typeLabel: boardTypeLabel(raw.question_type),
    html: raw.question_text ?? '',
    image: raw.question_image ?? null,
    marks: num(raw.marks),
    options: (raw.options ?? []).map((o) => ({
      id: str(o.option_id),
      html: o.option_text ?? '',
      image: o.option_image ?? null,
    })),
    parts: (raw.sub_questions ?? []).map((p) => ({
      id: str(p.id),
      html: p.sub_question_text ?? '',
      image: p.sub_question_image ?? null,
      marks: num(p.mark),
    })),
  };
}

/** Rebuilds the student's progress from questions the server returns on resume. */
export function boardSnapshot(raws: RawBoardQuestion[]): AttemptSnapshot {
  const snapshot = emptySnapshot();
  for (const raw of raws) {
    const question = toBoardQuestion(raw);
    let answer: Answer | null = null;
    if (question.kind === 'mcq') {
      const chosen = raw.selected_answer?.text;
      if (chosen !== null && chosen !== undefined && chosen !== '') answer = { kind: 'option', optionId: str(chosen) };
    } else if (question.kind === 'multipart') {
      answer = {
        kind: 'parts',
        parts: Object.fromEntries((raw.sub_questions ?? []).map((p) => [str(p.id), toWritten(p.selected_answer)])),
      };
    } else {
      answer = { kind: 'written', ...toWritten(raw.selected_answer) };
    }
    if (answer && isAnswered(answer)) snapshot.answers[question.id] = answer;
    if (raw.status === 'saved' || raw.status === 'skipped' || isAnswered(answer ?? undefined))
      snapshot.visited.push(question.id);
  }
  return snapshot;
}

export const writtenPayload = (answer: WrittenAnswer | undefined) =>
  answer
    ? { text: writtenToHtml(answer), images: answer.images.map((img) => ({ url: img.url, public_id: img.publicId })) }
    : { text: null, images: [] };

/** Writes the student's answers back into the backend's own question objects. */
export function toBoardPayload(raws: RawBoardQuestion[], snapshot: AttemptSnapshot): RawBoardQuestion[] {
  return raws.map((raw) => {
    const id = str(raw.question_id);
    const answer = snapshot.answers[id];
    const status = isAnswered(answer) ? 'saved' : snapshot.visited.includes(id) ? 'skipped' : 'unanswered';

    if (answer?.kind === 'option') {
      const option = raw.options?.find((o) => str(o.option_id) === answer.optionId);
      return {
        ...raw,
        status,
        selected_answer: {
          text: option?.option_id ?? answer.optionId,
          images: option?.option_image ? [{ url: option.option_image, public_id: '' }] : [],
        },
      };
    }
    if (answer?.kind === 'parts') {
      return {
        ...raw,
        status,
        sub_questions: (raw.sub_questions ?? []).map((p) => ({
          ...p,
          selected_answer: writtenPayload(answer.parts[str(p.id)]),
        })),
      };
    }
    return {
      ...raw,
      status,
      selected_answer: answer?.kind === 'written' ? writtenPayload(answer) : { text: null, images: [] },
    };
  });
}

type RawResponseOption = RawOption & {
  text?: string;
  image?: string | null;
  isSelected?: boolean;
  isCorrectAnswer?: boolean;
};
type RawResponse = {
  id?: string | number;
  question_text?: string;
  question_image?: string | null;
  question_type?: string;
  feedback?: string | null;
  total_marks?: number | string;
  marks?: number | string;
  marks_obtained?: number | string;
  options?: RawResponseOption[] | null;
  sub_questions?: RawResponse[] | null;
  sample_answer?: string | null;
  selected_answer?: RawSelected;
  answer_image?: string | null;
};

function outcomeOf(obtained: number | null, total: number | null, attempted: boolean): Outcome {
  if (!attempted) return 'unattempted';
  if (obtained !== null && total !== null && total > 0 && obtained >= total) return 'correct';
  if (!obtained) return 'incorrect';
  return 'partial';
}

export function toBoardResultQuestion(row: RawResponse, index: number): ResultQuestion {
  const options = (row.options ?? []).map((o) => ({
    id: str(o.option_id),
    html: o.option_text ?? o.text ?? '',
    image: o.option_image ?? o.image ?? null,
    isCorrect: !!(o.isCorrectAnswer ?? o.is_correct),
    isSelected: !!o.isSelected,
  }));
  const parts = (row.sub_questions ?? []).map(toBoardResultQuestion);
  const answerHtml =
    typeof row.selected_answer?.text === 'string' && row.selected_answer.text ? row.selected_answer.text : null;
  const isMcq = row.question_type === 'mcq' || row.question_type === 'grammar_mcq' || options.length > 0;
  const attempted = isMcq
    ? options.some((o) => o.isSelected)
    : !!answerHtml || (row.selected_answer?.images?.length ?? 0) > 0 || parts.some((p) => p.outcome !== 'unattempted');
  const marks = num(row.total_marks ?? row.marks);
  const obtained = num(row.marks_obtained);
  return {
    id: str(row.id ?? index),
    kind: isMcq ? 'mcq' : parts.length ? 'multipart' : 'written',
    typeLabel: boardTypeLabel(row.question_type),
    html: row.question_text ?? '',
    image: row.question_image ?? null,
    marks,
    obtained,
    outcome: outcomeOf(obtained, marks, attempted),
    options,
    answerHtml: isMcq ? null : answerHtml,
    feedbackHtml: row.feedback ?? null,
    sampleAnswerHtml: row.sample_answer ?? null,
    explanationImage: row.answer_image ?? null,
    parts,
  };
}

const SET_STATUS: Record<string, SetStatus> = { completed: 'completed', in_progress: 'in-progress' };

export function createBoardAdapter(endpoints: BoardEndpoints): TestAdapter {
  type Context = { setId: string; raws: RawBoardQuestion[] };

  return {
    async start({ classId }, setId) {
      const body = assertOk(
        await apiClient.get<{ success?: boolean; questions: RawBoardQuestion[]; time_left?: number }>(endpoints.fetch, {
          params: { set_id: setId, class_id: classId },
        }),
      );
      const raws = body.questions ?? [];
      const seconds = num(body.time_left);
      return {
        key: `${endpoints.label}:${setId}`,
        title: endpoints.label,
        questions: raws.map(toBoardQuestion),
        deadline: seconds === null ? null : Date.now() + seconds * 1000,
        initial: boardSnapshot(raws),
        context: { setId, raws } satisfies Context,
      };
    },

    async save(session, snapshot, _context, options) {
      const { setId, raws } = session.context as Context;
      const body = { set_id: setId, questions: toBoardPayload(raws, snapshot) };
      if (options?.keepalive) apiClient.keepalive('PUT', endpoints.save, body);
      else await apiClient.put(endpoints.save, body);
    },

    async submit(session, snapshot, { classId }) {
      const { setId, raws } = session.context as Context;
      const body = assertOk(
        await apiClient.post<{ success?: boolean; data?: { attempt_id: string | number } & Record<string, unknown> }>(
          endpoints.submit,
          { set_id: setId, class_id: classId, questions: toBoardPayload(raws, snapshot) },
        ),
      );
      return { attemptId: str(body.data?.attempt_id), summary: toSubmitSummary(body.data) };
    },

    async result(attemptId) {
      const body = assertOk(
        await apiClient.get<{
          success?: boolean;
          marks?: { total_marks?: number | string; total_marks_obtained?: number | string; set_id?: number | string };
          responses?: (RawResponse & { set_id?: number | string })[];
        }>(endpoints.result, { params: { attempt_id: attemptId } }),
      );
      const questions = (body.responses ?? []).map(toBoardResultQuestion);
      const counts = emptyCounts();
      for (const q of questions) counts[q.outcome] += 1;
      return {
        title: `${endpoints.label} result`,
        totalMarks: num(body.marks?.total_marks) ?? 0,
        obtained: num(body.marks?.total_marks_obtained) ?? 0,
        counts,
        questions,
        attemptedAt: null,
        assessmentId: strOrNull(body.marks?.set_id) ?? strOrNull(body.responses?.[0]?.set_id),
      } satisfies ExamResult;
    },

    ...(endpoints.sets && endpoints.subjectKey ? listing(endpoints.sets, endpoints.subjectKey) : {}),
  };
}

function listing(setsUrl: string, subjectKey: 'mock_result' | 'pyq_result'): Pick<TestAdapter, 'listSets' | 'listSubjects'> {
  return {
    async listSubjects({ classId }) {
      type Subject = { subject_id: string | number; subject_title: string; exam_count?: number };
      const body = assertOk(
        await apiClient.get<Record<string, Subject[] | boolean | undefined>>('/api/active-exams', {
          params: { class_id: classId },
        }),
      );
      const subjects = (body[subjectKey] as Subject[] | undefined) ?? [];
      return subjects.map((s) => ({ id: str(s.subject_id), title: s.subject_title, count: num(s.exam_count) ?? 0 }));
    },

    async listSets({ classId }, subjectId) {
      type Paper = {
        set_id: string | number;
        set_number?: string | number;
        subject?: string;
        year?: string | number;
        totalQuestion?: number;
        status?: string;
        total_marks?: number | string;
        latest_mark?: number | string | null;
        attempt_id?: string | number | null;
      };
      const body = assertOk(
        await apiClient.get<{ data?: { papers?: Paper[] } }>(setsUrl, {
          params: { subject: subjectId, class_id: classId },
        }),
      );
      return (body.data?.papers ?? []).map((paper): TestSetSummary => {
        const obtained = num(paper.latest_mark);
        const total = num(paper.total_marks);
        return {
          id: str(paper.set_id),
          title: paper.year ? `${paper.year} · ${str(paper.set_number)}` : `Paper ${str(paper.set_number)}`,
          subtitle: strOrNull(paper.subject),
          questionCount: num(paper.totalQuestion),
          durationMinutes: 180,
          status: SET_STATUS[paper.status ?? ''] ?? 'new',
          lastScore: obtained !== null && total !== null ? { obtained, total } : null,
          lastAttemptId: strOrNull(paper.attempt_id),
        };
      });
    },
  };
}
