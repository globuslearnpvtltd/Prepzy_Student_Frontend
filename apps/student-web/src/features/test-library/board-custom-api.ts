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
  async courses(classId: number, search = ''): Promise<BoardCustomCourse[]> {
    const body = assertOk(
      await apiClient.get<{ courses?: Raw[] }>(`/api/custom-exams/get-custom-exam-course-list/${classId}`, {
        params: search ? { search } : undefined,
      }),
    );
    return (body.courses ?? []).map((c) => ({ id: num(c.course_id), name: str(c.course_name), subject: str(c.subject_name) }));
  },

  async chapters(courseId: number): Promise<BoardCustomChapter[]> {
    const body = assertOk(await apiClient.get<{ modules?: Raw[] }>(`/api/custom-exams/get-custom-exam-module-list/${courseId}`));
    return (body.modules ?? []).map((m) => ({
      id: num(m.module_id),
      name: str(m.module_name),
      topics: (Array.isArray(m.topics) ? (m.topics as Raw[]) : []).map((t) => ({ id: num(t.topic_id), name: str(t.topic_name) })),
    }));
  },

  /** Returns the new set id, or null when the chosen topics have no questions. */
  async generate(input: { courseId: number; chapter: BoardCustomChapter; topicIds: number[]; difficulty: BoardDifficulty }) {
    const topics = input.chapter.topics.filter((t) => input.topicIds.includes(t.id));
    const body = assertOk(
      await apiClient.post<{ set_id?: string | number | null; total?: number }>('/api/custom-exams/generate-custom-exam', {
        course_id: input.courseId,
        // The backend reads topic ids from [{ module_id, module_name, topics: [{ topic_id, topic_name }] }].
        topic_ids: [
          {
            module_id: input.chapter.id,
            module_name: input.chapter.name,
            topics: topics.map((t) => ({ topic_id: t.id, topic_name: t.name })),
          },
        ],
        difficulty_level: input.difficulty,
      }),
    );
    return body.set_id === null || body.set_id === undefined || body.total === 0 ? null : str(body.set_id);
  },

  async savedSets(classId: number): Promise<BoardCustomSet[]> {
    const body = assertOk(await apiClient.get<{ sets?: Raw[] }>(`/api/custom-exams/get-custom-exam-set-list/${classId}`));
    return (body.sets ?? []).map((s) => ({
      setId: str(s.set_id),
      title: [str(s.course_name), str(s.subject_name)].filter(Boolean).join(' - ') || `Custom test ${str(s.set_number)}`,
      questionCount: num(s.total_questions),
      difficulty: str(s.difficulty_level),
      totalMarks: num(s.total_marks),
      createdAt: s.created_at ? str(s.created_at) : null,
    }));
  },

  async submissions(setId: string): Promise<BoardCustomSubmission[]> {
    const body = assertOk(await apiClient.get<{ submissions?: Raw[] }>(`/api/custom-exams/custom-exam-submissions-list/${setId}`));
    return (body.submissions ?? []).map((s) => ({
      attemptId: str(s.id),
      attemptNumber: num(s.attempt_number),
      obtained: num(s.total_marks_obtained),
      total: num(s.total_marks),
      questionCount: num(s.total_questions),
      date: s.attempt_date ? str(s.attempt_date) : s.created_at ? str(s.created_at) : null,
    }));
  },
};
