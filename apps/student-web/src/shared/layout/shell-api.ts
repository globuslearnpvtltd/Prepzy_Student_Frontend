'use client';

import { assessmentsApiBase } from '@/shared/config/exams';
import { useQuery } from '@tanstack/react-query';
import type { ExamConfig } from '@/shared/config/exams';
import { routes } from '@/shared/config/routes';
import { apiClient } from '@/shared/lib/api-client';
import { assertOk } from '@/shared/lib/unwrap';

/** Backend calls the app shell needs (sidebar locks, search, daily practice). */

type Envelope<T> = { success?: boolean; message?: string; data?: T };

/** The backend rejects longer search queries. */
export const SEARCH_MAX_QUERY_LENGTH = 100;
/** The semantic search agent can be slow; the backend gives it 30s. */
const LECTURE_SEARCH_TIMEOUT_MS = 35_000;

const num = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/** What a suggestion is: a topic, a chapter (the backend's "module") or a course. */
export type SuggestionKind = 'topic' | 'chapter' | 'course';

export interface SearchSuggestion {
  key: string;
  kind: SuggestionKind;
  title: string;
  /** e.g. "in Electrostatics" */
  context: string | null;
  subject: string;
  /** The backend's subject name, sent with a lecture search started from this suggestion. */
  subjectName: string | null;
  /**
   * Where the suggestion opens (competitive: the course, the topic in its notes, or the chapter). null: picking it
   * runs the lecture search for its title (board, as before).
   */
  href: string | null;
}

/** The lecture POST /api/v4/search/:category/:examId/lectures found (ids checked against the exam by the backend). */
export interface LectureSearchResult {
  lectureId: number;
  lectureName: string | null;
  courseId: number;
  moduleId: number;
  moduleName: string;
  subjectName: string | null;
  /** 0–100, or null when the agent sent no score */
  scorePercent: number | null;
  assessments: { assessmentId: number; title: string; type: string }[];
}

const kindOf = (type: string | undefined): SuggestionKind =>
  type === 'course' ? 'course' : type === 'module' ? 'chapter' : 'topic';

export interface LiveDpp {
  dppId: string;
  name: string;
  /** "Day 14" from names like "DPP #14" */
  day: number | null;
  questionCount: number;
  attempted: number;
  subjects: string[];
  attempt: { status: 'submitted' | 'in_progress'; attemptId: string } | null;
}

/** Backend subject names look like "NEET-PHYSICS"; the UI shows "Physics". */
export const subjectLabel = (name: string) =>
  name
    .replace(/^NEET[-\s]*/i, '')
    .toLowerCase()
    .replace(/(^|\s)\w/g, (c) => c.toUpperCase());

/** The previous app's search targets: a course, a topic inside a chapter's notes, or a chapter's lecture. */
export function competitiveSuggestionHref(
  exam: string,
  row: { result_type?: string; course_id?: number | string | null; module_id?: number | string | null; anchor_id?: string | null },
): string | null {
  if (!row.course_id) return null;
  if (row.result_type === 'course' || !row.module_id) return routes.learnCourse(exam, row.course_id);
  if (row.result_type === 'topic') {
    const anchor = row.anchor_id ? `#${encodeURIComponent(row.anchor_id)}` : '';
    return `${routes.learnModule(exam, row.course_id, row.module_id, 'study-notes')}${anchor}`;
  }
  return routes.learnModule(exam, row.course_id, row.module_id, 'video-lectures');
}

export const shellApi = {
  async hasStudyPlan(classId: number): Promise<boolean> {
    const body = assertOk(await apiClient.get<Envelope<{ has_plan?: boolean }>>(`/api/v4/study-plan/classes/${classId}/status`));
    return !!body.data?.has_plan;
  },

  /**
   * Top-bar suggestions: GET /api/v4/search/:category/:examId/suggestions. The backend decides what is searched per
   * category (board: topics of the class; competitive: notes topics, chapters and courses of the exam).
   */
  async searchSuggestions(exam: ExamConfig, query: string, classId: number | null): Promise<SearchSuggestion[]> {
    type Row = {
      result_name: string;
      result_type?: string;
      module_name?: string | null;
      subject_name?: string | null;
      course_id?: number | string | null;
      module_id?: number | string | null;
      anchor_id?: string | null;
    };
    const body = assertOk(
      await apiClient.get<Envelope<{ suggestions?: Row[] }>>(
        `/api/v4/search/${exam.category}/${exam.examId}/suggestions`,
        { params: { q: query.slice(0, SEARCH_MAX_QUERY_LENGTH), class_id: classId ?? undefined } },
      ),
    );
    // Board results open nothing (as before); competitive ones link to the course, notes topic or chapter.
    const linked = exam.category === 'competitive';
    return (body.data?.suggestions ?? []).map((row, index) => ({
      key: `${index}-${row.result_name}`,
      kind: kindOf(row.result_type),
      title: row.result_name,
      context: row.module_name ? `in ${row.module_name.toLowerCase()}` : null,
      subject: subjectLabel(row.subject_name ?? ''),
      subjectName: row.subject_name ?? null,
      href: linked ? competitiveSuggestionHref(exam.slug, row) : null,
    }));
  },

  /**
   * The search button: POST /api/v4/search/:category/:examId/lectures. The backend asks the category's semantic
   * search agent (board: in the class it checks against the student's plans) and returns the best lecture or null.
   */
  async searchLectures(
    exam: ExamConfig,
    query: string,
    { subjectName, classId }: { subjectName?: string | null; classId?: number | null } = {},
  ): Promise<LectureSearchResult | null> {
    type Raw = {
      lecture_id: number;
      lecture_name?: string | null;
      course_id: number;
      module_id: number;
      module_name?: string | null;
      subject_name?: string | null;
      score?: number | null;
      assessments?: { assessment_id: number; title?: string | null; assessment_type?: string | null }[];
    };
    const body = assertOk(
      await apiClient.post<Envelope<{ result?: Raw | null }>>(`/api/v4/search/${exam.category}/${exam.examId}/lectures`, {
        query: query.trim().slice(0, SEARCH_MAX_QUERY_LENGTH),
        ...(subjectName ? { subject_name: subjectName } : {}),
        ...(classId ? { class_id: classId } : {}),
      }, { timeout: LECTURE_SEARCH_TIMEOUT_MS }),
    );
    const raw = body.data?.result;
    if (!raw) return null;
    return {
      lectureId: raw.lecture_id,
      lectureName: raw.lecture_name ?? null,
      courseId: raw.course_id,
      moduleId: raw.module_id,
      moduleName: raw.module_name ?? '',
      subjectName: raw.subject_name ?? null,
      scorePercent: typeof raw.score === 'number' ? Math.round(raw.score * 100) : null,
      assessments: (raw.assessments ?? []).map((a) => ({
        assessmentId: a.assessment_id,
        title: a.title ?? '',
        // The previous app's label: the type with underscores as spaces, "Quiz" when missing.
        type: (a.assessment_type || 'Quiz').replace(/_/g, ' '),
      })),
    };
  },

  /** Today's daily practice paper, or null when there is none. */
  async liveDpp(exam: ExamConfig): Promise<LiveDpp | null> {
    type Raw = {
      dpp?: { dpp_id: number | string; dpp_name?: string | null } | null;
      question_count?: unknown;
      attempted_questions?: unknown;
      subjects?: { subject_name: string }[] | null;
      attempt?: { status?: string; attempt_id?: number | string } | null;
    };
    const body = assertOk(
      await apiClient.get<Envelope<Raw | null>>(`${assessmentsApiBase(exam)}/dpp/live`),
    );
    const data = body.data;
    if (!data?.dpp) return null;
    const name = data.dpp.dpp_name ?? "Today's DPP";
    const day = /#(\d+)\s*$/.exec(name)?.[1];
    const attempt = data.attempt?.attempt_id
      ? {
          status: data.attempt.status === 'submitted' ? ('submitted' as const) : ('in_progress' as const),
          attemptId: String(data.attempt.attempt_id),
        }
      : null;
    return {
      dppId: String(data.dpp.dpp_id),
      name,
      day: day ? Number(day) : null,
      questionCount: num(data.question_count),
      attempted: num(data.attempted_questions),
      subjects: (data.subjects ?? []).map((s) => subjectLabel(s.subject_name)),
      attempt,
    };
  },

  /** Latest month's first paper, used when there's no live paper today. */
  async latestDppId(exam: ExamConfig): Promise<string | null> {
    const body = assertOk(
      await apiClient.get<Envelope<{ first_dpp_id?: number | string }[]>>(`${assessmentsApiBase(exam)}/dpp/months`),
    );
    const id = body.data?.[0]?.first_dpp_id;
    return id ? String(id) : null;
  },
};

export const shellKeys = {
  studyPlan: (classId: number | null) => ['shell', 'study-plan', classId] as const,
  search: (exam: string, query: string, classId: number | null) => ['shell', 'search', exam, query, classId] as const,
  liveDpp: (exam: string) => ['shell', 'live-dpp', exam] as const,
};

export function useHasStudyPlan(classId: number | null) {
  return useQuery({
    queryKey: shellKeys.studyPlan(classId),
    queryFn: () => shellApi.hasStudyPlan(classId!),
    enabled: classId !== null,
    staleTime: 5 * 60_000,
  });
}

export function useLiveDpp(exam: ExamConfig) {
  return useQuery({ queryKey: shellKeys.liveDpp(exam.slug), queryFn: () => shellApi.liveDpp(exam) });
}
