import { assessmentsApiBase, type ExamRef } from '@/shared/config/exams';
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

/** Board test types the v4 exam player runs (`${assessmentsApiBase}/<testType>/…`). */
export type BoardTestType = 'mock' | 'pyq' | 'chapter-pyq' | 'custom' | 'mid' | 'final' | 'quiz';

/** Board papers (CBSE mock, PYQ, chapter PYQ, custom, mid, final, quiz): MCQ + written answers graded on submit. */
export interface BoardEndpoints {
  label: string;
  /** v4 player routes: POST sets/:setId/attempts, PUT attempts/:id, POST attempts/:id/submit, GET attempts/:id/result. */
  testType: BoardTestType;
  /**
   * Test type of the v4 paper lists (`${assessmentsApiBase}/<listType>/subjects` and `/sets`);
   * absent for tests opened from Learn (chapter PYQ, mid, final, quiz, custom).
   */
  listType?: 'mock' | 'pyq';
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

export type BoardAnswer = {
  question_id: string | number;
  status: 'saved' | 'skipped' | 'unanswered';
  selected_answer?: { text: string | number | null; images: RawImage[] };
  sub_answers?: { id: string | number; selected_answer: { text: string | null; images: RawImage[] } }[];
};

/** The student's answers, by question id: all a save sends (small enough for keepalive). The server keeps the questions. */
export function toBoardAnswers(raws: RawBoardQuestion[], snapshot: AttemptSnapshot): BoardAnswer[] {
  return raws.map((raw) => {
    const id = str(raw.question_id);
    const answer = snapshot.answers[id];
    const status = isAnswered(answer) ? 'saved' : snapshot.visited.includes(id) ? 'skipped' : 'unanswered';
    const base = { question_id: raw.question_id, status } as const;

    if (answer?.kind === 'option') return { ...base, selected_answer: { text: answer.optionId, images: [] } };
    if (answer?.kind === 'parts') {
      return {
        ...base,
        sub_answers: (raw.sub_questions ?? []).map((p) => ({ id: p.id, selected_answer: writtenPayload(answer.parts[str(p.id)]) })),
      };
    }
    return { ...base, selected_answer: answer?.kind === 'written' ? writtenPayload(answer) : { text: null, images: [] } };
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
  type Context = { setId: string; attemptId: string; raws: RawBoardQuestion[] };
  const typeBase = (exam: ExamRef) => `${assessmentsApiBase(exam)}/${endpoints.testType}`;
  const attemptUrl = (exam: ExamRef, attemptId: string) => `${typeBase(exam)}/attempts/${encodeURIComponent(attemptId)}`;

  return {
    async start({ exam, classId }, setId) {
      const body = assertOk(
        await apiClient.post<{ data?: { attempt_id?: string | number; questions?: RawBoardQuestion[]; time_left?: number } }>(
          `${typeBase(exam)}/sets/${encodeURIComponent(setId)}/attempts`,
          { class_id: classId },
        ),
      );
      // A question listed twice (older quiz sessions could pick one twice) is shown and answered once.
      const seen = new Set<string>();
      const raws = (body.data?.questions ?? []).filter((raw) => {
        const id = str(raw.question_id);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      const seconds = num(body.data?.time_left);
      return {
        key: `${endpoints.label}:${setId}`,
        title: endpoints.label,
        questions: raws.map(toBoardQuestion),
        deadline: seconds === null ? null : Date.now() + seconds * 1000,
        initial: boardSnapshot(raws),
        context: { setId, attemptId: str(body.data?.attempt_id), raws } satisfies Context,
      };
    },

    async save(session, snapshot, { exam }, options) {
      const { attemptId, raws } = session.context as Context;
      const body = { answers: toBoardAnswers(raws, snapshot) };
      if (options?.keepalive) apiClient.keepalive('PUT', attemptUrl(exam, attemptId), body);
      else await apiClient.put(attemptUrl(exam, attemptId), body);
    },

    async submit(session, snapshot, { exam, classId }) {
      const { attemptId, raws } = session.context as Context;
      const body = assertOk(
        await apiClient.post<{ data?: { attempt_id: string | number; summary?: Record<string, unknown> } }>(
          `${attemptUrl(exam, attemptId)}/submit`,
          { class_id: classId, answers: toBoardAnswers(raws, snapshot) },
        ),
      );
      return { attemptId: str(body.data?.attempt_id), summary: toSubmitSummary(body.data?.summary) };
    },

    async result(attemptId, exam) {
      const body = assertOk(
        await apiClient.get<{
          data?: {
            total_marks?: number | string;
            total_marks_obtained?: number | string;
            set_id?: number | string;
            responses?: RawResponse[];
          };
        }>(`${attemptUrl(exam, attemptId)}/result`),
      );
      const data = body.data ?? {};
      const questions = (data.responses ?? []).map(toBoardResultQuestion);
      const counts = emptyCounts();
      for (const q of questions) counts[q.outcome] += 1;
      return {
        title: `${endpoints.label} result`,
        totalMarks: num(data.total_marks) ?? 0,
        obtained: num(data.total_marks_obtained) ?? 0,
        counts,
        questions,
        attemptedAt: null,
        assessmentId: strOrNull(data.set_id),
      } satisfies ExamResult;
    },

    ...(endpoints.listType ? listing(endpoints.listType) : {}),
  };
}

function listing(listType: 'mock' | 'pyq'): Pick<TestAdapter, 'listSets' | 'listSubjects'> {
  return {
    async listSubjects({ exam, classId }) {
      type Subject = { subject_id: string | number; subject_title: string; exam_count?: number };
      const body = assertOk(
        await apiClient.get<{ data?: Subject[] }>(`${assessmentsApiBase(exam)}/${listType}/subjects`, {
          params: { class_id: classId },
        }),
      );
      const subjects = body.data ?? [];
      return subjects.map((s) => ({ id: str(s.subject_id), title: s.subject_title, count: num(s.exam_count) ?? 0 }));
    },

    async listSets({ exam, classId }, subjectId) {
      type Paper = {
        set_id: string | number;
        set_number?: string | number | null;
        subject_name?: string | null;
        year?: string | number | null;
        total_questions?: number;
        status?: string;
        total_marks?: number | string;
        latest_marks?: number | string | null;
        latest_attempt_id?: string | number | null;
      };
      const body = assertOk(
        await apiClient.get<{ data?: { papers?: Paper[] } }>(`${assessmentsApiBase(exam)}/${listType}/sets`, {
          params: { subject_id: subjectId, class_id: classId },
        }),
      );
      return (body.data?.papers ?? []).map((paper): TestSetSummary => {
        const obtained = num(paper.latest_marks);
        const total = num(paper.total_marks);
        return {
          id: str(paper.set_id),
          title: paper.year ? `${paper.year} · ${str(paper.set_number)}` : `Paper ${str(paper.set_number)}`,
          subtitle: strOrNull(paper.subject_name),
          questionCount: num(paper.total_questions),
          durationMinutes: 180,
          status: SET_STATUS[paper.status ?? ''] ?? 'new',
          lastScore: obtained !== null && total !== null ? { obtained, total } : null,
          lastAttemptId: strOrNull(paper.latest_attempt_id),
        };
      });
    },
  };
}
