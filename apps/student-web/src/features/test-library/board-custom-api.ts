import { assessmentsApiBase, type ExamRef } from '@/shared/config/exams';
import { apiClient } from '@/shared/lib/api-client';
import { assertOk } from '@/shared/lib/unwrap';

/** Board (CBSE) custom tests: course → one chapter → up to 5 topics → difficulty (previous app's CustomExamModal). */

const num = (v: unknown): number => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
};
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));

export const MAX_CUSTOM_TOPICS = 5;

export interface BoardCustomCourse {
  id: number;
  name: string;
  subject: string;
}
export interface BoardCustomTopic {
  id: number;
  name: string;
}
export interface BoardCustomChapter {
  id: number;
  name: string;
  topics: BoardCustomTopic[];
}
export type BoardDifficulty = 'easy' | 'medium' | 'hard';

export interface BoardCustomSet {
  setId: string;
  title: string;
  questionCount: number;
  difficulty: string;
  totalMarks: number;
  createdAt: string | null;
}
export interface BoardCustomSubmission {
  attemptId: string;
  attemptNumber: number;
  obtained: number;
  total: number;
  questionCount: number;
  date: string | null;
}

type Raw = Record<string, unknown>;

export const boardCustomApi = {
  async courses(exam: ExamRef, classId: number, search = ''): Promise<BoardCustomCourse[]> {
    const body = assertOk(
      await apiClient.get<{ data?: Raw[] }>(`${assessmentsApiBase(exam)}/custom/courses`, {
        params: search ? { class_id: classId, search } : { class_id: classId },
      }),
    );
    return (body.data ?? []).map((c) => ({ id: num(c.course_id), name: str(c.course_name), subject: str(c.subject_name) }));
  },

  async chapters(exam: ExamRef, courseId: number): Promise<BoardCustomChapter[]> {
    const body = assertOk(await apiClient.get<{ data?: Raw[] }>(`${assessmentsApiBase(exam)}/custom/courses/${courseId}/modules`));
    return (body.data ?? []).map((m) => ({
      id: num(m.module_id),
      name: str(m.module_name),
      topics: (Array.isArray(m.topics) ? (m.topics as Raw[]) : []).map((t) => ({ id: num(t.topic_id), name: str(t.topic_name) })),
    }));
  },

  /** Returns the new set id, or null when the chosen topics have no questions. */
  async generate(exam: ExamRef, input: { chapter: BoardCustomChapter; topicIds: number[]; difficulty: BoardDifficulty }) {
    const body = assertOk(
      await apiClient.post<{ data?: { set_id?: string | number | null; total?: number } }>(`${assessmentsApiBase(exam)}/custom/sets`, {
        module_id: input.chapter.id,
        topic_ids: input.topicIds,
        difficulty_level: input.difficulty,
      }),
    );
    const setId = body.data?.set_id;
    return setId === null || setId === undefined || body.data?.total === 0 ? null : str(setId);
  },

  async savedSets(exam: ExamRef, classId: number): Promise<BoardCustomSet[]> {
    const body = assertOk(
      await apiClient.get<{ data?: { sets?: Raw[] } }>(`${assessmentsApiBase(exam)}/custom/sets`, { params: { class_id: classId } }),
    );
    return (body.data?.sets ?? []).map((s) => ({
      setId: str(s.set_id),
      title: [str(s.course_name), str(s.subject_name)].filter(Boolean).join(' - ') || `Custom test ${str(s.set_number)}`,
      questionCount: num(s.total_questions),
      difficulty: str(s.difficulty_level),
      totalMarks: num(s.total_marks),
      createdAt: s.created_at ? str(s.created_at) : null,
    }));
  },

  async submissions(exam: ExamRef, setId: string): Promise<BoardCustomSubmission[]> {
    const body = assertOk(
      await apiClient.get<{ data?: { attempts?: Raw[] } }>(`${assessmentsApiBase(exam)}/custom/sets/${encodeURIComponent(setId)}/attempts`),
    );
    return (body.data?.attempts ?? []).map((s) => ({
      attemptId: str(s.attempt_id),
      attemptNumber: num(s.attempt_number),
      obtained: num(s.total_marks_obtained),
      total: num(s.total_marks),
      questionCount: num(s.total_questions),
      date: s.attempt_date ? str(s.attempt_date) : null,
    }));
  },
};
