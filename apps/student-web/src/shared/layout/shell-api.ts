'use client';

import type { ExamRef } from '@/shared/config/exams';
import { useQuery } from '@tanstack/react-query';
import type { ExamConfig } from '@/shared/config/exams';
import { routes } from '@/shared/config/routes';
import { apiClient } from '@/shared/lib/api-client';
import { assertOk } from '@/shared/lib/unwrap';

/** Backend calls the app shell needs (sidebar locks, search, daily practice, plan summary). */

type Envelope<T> = { success?: boolean; message?: string; data?: T };

const num = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export interface SearchSuggestion {
  key: string;
  title: string;
  /** e.g. "in Electrostatics" */
  context: string | null;
  subject: string;
  /** Where the suggestion opens (competitive: the course, the topic in its notes, or the chapter). */
  href: string | null;
}

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

export interface PlanSummary {
  planName: string;
  planType: 'basic' | 'topper';
  status: string;
  expiryDate: string | null;
  daysLeft: number | null;
  isFreeForever: boolean;
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
    const body = assertOk(await apiClient.get<Envelope<{ has_plan?: boolean }>>(`/api/v1/study-plan/status/${classId}`));
    return !!body.data?.has_plan;
  },

  async searchSuggestions(exam: ExamConfig, query: string, classId: number | null): Promise<SearchSuggestion[]> {
    type Board = { topic_name: string; subject_name: string };
    type Competitive = {
      result_name: string;
      result_type?: string;
      module_name?: string | null;
      subject_name: string;
      course_id?: number | string | null;
      module_id?: number | string | null;
      anchor_id?: string | null;
    };
    const body = assertOk(
      exam.category === 'competitive'
        ? await apiClient.get<Envelope<{ suggestions?: Competitive[] }>>('/api/v1/student/neet-search-suggestions', {
            params: { q: query },
          })
        : await apiClient.get<Envelope<{ suggestions?: Board[] }>>('/api/v1/student/search-suggestions', {
            params: { q: query, classId: classId ?? undefined },
          }),
    );
    const rows = (body.data?.suggestions ?? []) as (Board | Competitive)[];
    return rows.map((row, index) => {
      const title = 'result_name' in row ? row.result_name : row.topic_name;
      return {
        key: `${index}-${title}`,
        title,
        context: 'module_name' in row && row.module_name ? `in ${row.module_name.toLowerCase()}` : null,
        subject: subjectLabel(row.subject_name ?? ''),
        href: 'result_name' in row ? competitiveSuggestionHref(exam.slug, row) : null,
      };
    });
  },

  /** Today's daily practice paper, or null when there is none. */
  async liveDpp(exam: ExamConfig): Promise<LiveDpp | null> {
    type Raw = {
      dpp?: { dpp_id: number | string; dpp_name?: string } | null;
      questionCount?: unknown;
      attempted_questions?: unknown;
      subjects?: { subject_name: string }[] | null;
      attempt?: { status?: string; attempt_id?: number | string } | null;
    };
    const body = assertOk(
      await apiClient.get<Envelope<Raw>>('/api/neet/get-live-dpp-neet', {
        params: { exam: exam.examSlice.toUpperCase() },
      }),
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
      questionCount: num(data.questionCount),
      attempted: num(data.attempted_questions),
      subjects: (data.subjects ?? []).map((s) => subjectLabel(s.subject_name)),
      attempt,
    };
  },

  /** Latest month's first paper, used when there's no live paper today. */
  async latestDppId(exam: ExamConfig): Promise<string | null> {
    const body = assertOk(
      await apiClient.get<Envelope<{ months?: { first_dpp_id?: number | string }[] }>>('/api/neet/get-dpp-months', {
        params: { exam: exam.examSlice.toUpperCase() },
      }),
    );
    const id = body.data?.months?.[0]?.first_dpp_id;
    return id ? String(id) : null;
  },

  async planSummary(exam: Pick<ExamRef, 'examId'>): Promise<PlanSummary | null> {
    const body = assertOk(await apiClient.get<Envelope<PlanSummary>>(`/api/v4/student/plans/${exam.examId}/summary`));
    return body.data && typeof body.data === 'object' && 'planName' in body.data ? body.data : null;
  },
};

export const shellKeys = {
  studyPlan: (classId: number | null) => ['shell', 'study-plan', classId] as const,
  search: (exam: string, query: string, classId: number | null) => ['shell', 'search', exam, query, classId] as const,
  liveDpp: (exam: string) => ['shell', 'live-dpp', exam] as const,
  planSummary: (exam: string) => ['shell', 'plan-summary', exam] as const,
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

/** Plan summary shown in the account menu (competitive exams only), for the current exam. */
export function usePlanSummary(exam: ExamConfig | null) {
  return useQuery({
    queryKey: shellKeys.planSummary(exam?.slug ?? ''),
    queryFn: () => shellApi.planSummary(exam!),
    enabled: exam?.category === 'competitive',
    staleTime: 5 * 60_000,
  });
}
