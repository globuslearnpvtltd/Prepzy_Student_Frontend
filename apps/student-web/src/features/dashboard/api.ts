import { dashboardApiBase, type ExamRef } from '@/shared/config/exams';
import type { TestTypeKey } from '@/shared/config/exams';
import { apiClient } from '@/shared/lib/api-client';
import { assertOk } from '@/shared/lib/unwrap';

type Envelope<T> = { success?: boolean; message?: string; data?: T };

export interface DayActivity {
  day: string;
  hours: number;
}

export interface SubjectScore {
  subject: string;
  thisAttempt: number;
  lastAttempt: number;
}

export interface SubjectOverview {
  id: string;
  name: string;
  /** "Books" on the subject card. */
  courseCount: number;
  chapterCount: number;
}

export interface SubjectProgress {
  name: string;
  completed: number;
  total: number;
  percent: number;
  courseId: string | null;
}

export interface ContinueCourse {
  courseId: string;
  name: string;
  className: string;
  subjectName: string;
  image: string | null;
  percent: number;
}

/** Backend exam types of unfinished board papers. */
export type BoardExamKind = 'mock' | 'pyq' | 'mid_term' | 'final';

export interface ContinueTest {
  kind: BoardExamKind | 'other';
  /** Test type in the exam engine for this kind (the widget checks the exam supports it). */
  testType: TestTypeKey | null;
  setId: string;
  setNumber: string;
  className: string;
  percent: number;
}

export interface ProfileProgress {
  initials: string | null;
  image: string | null;
  percent: number;
}

export interface ReferralSummary {
  balance: number;
  friendCount: number;
  tier: 'free' | 'paid';
}

const toNumber = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const text = (value: unknown) =>
  typeof value === 'string' && value.trim() && !/^(null|undefined)$/.test(value.trim()) ? value : null;

/** Accepts `{ Mon: 1.5, … }` or `[{ day, hours }]`. */
export function toActivity(raw: unknown): DayActivity[] {
  if (Array.isArray(raw)) {
    return raw.map((item: { day?: string; hours?: unknown }) => ({
      day: String(item.day ?? ''),
      hours: toNumber(item.hours),
    }));
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>).map(([day, hours]) => ({ day, hours: toNumber(hours) }));
  }
  return [];
}

/** 1.5 → "1h 30m" */
export function formatHours(hours: number): string {
  let h = Math.floor(hours);
  let m = Math.round((hours - h) * 60);
  if (m === 60) {
    h += 1;
    m = 0;
  }
  return `${h}h ${m}m`;
}

/** Average hours per day of the week, as the previous dashboard showed it. */
export function weeklyAverage(days: DayActivity[]): number {
  return days.length ? days.reduce((sum, d) => sum + d.hours, 0) / days.length : 0;
}

/** Class 9–12 see the syllabus card, classes 10 and 12 also PYQ trends (previous app's rule). */
export function syllabusCards(className: string | null | undefined): { syllabus: boolean; trends: boolean } {
  const grade = Number(/\d+/.exec(className ?? '')?.[0]);
  return { syllabus: [9, 10, 11, 12].includes(grade), trends: [10, 12].includes(grade) };
}

const ENGINE_TYPES: Record<BoardExamKind, TestTypeKey> = { mock: 'mock', pyq: 'pyq', mid_term: 'mid', final: 'final' };
const KINDS = Object.keys(ENGINE_TYPES) as BoardExamKind[];

/** A board PYQ paper teased to students without a plan ("Get Ready For Your Exams"). */
export interface PyqTeaser {
  title: string;
  className: string;
  year: number;
  subjectId: string;
  image: string | null;
}

export const dashboardApi = {
  async pyqTeasers(exam: ExamRef): Promise<PyqTeaser[]> {
    type Raw = { year?: unknown; subject?: unknown; title?: unknown; image?: unknown; class?: unknown };
    const body = assertOk(await apiClient.get<Envelope<{ pyq?: Raw[] }>>(`${dashboardApiBase(exam)}/pyq-subjects`));
    return (body.data?.pyq ?? []).map((p) => ({
      title: text(p.title) ?? '',
      className: text(p.class) ?? '',
      year: toNumber(p.year),
      subjectId: p.subject === null || p.subject === undefined ? '' : String(p.subject),
      image: text(p.image),
    }));
  },

  async boardOverview(exam: ExamRef, classId: number): Promise<{ activity: DayActivity[]; profile: ProfileProgress | null }> {
    type Raw = {
      week_activity?: unknown;
      profileProgress?: { name?: unknown; image?: unknown; completion_percentage?: unknown } | null;
    };
    const body = assertOk(
      await apiClient.get<Envelope<Raw>>(`${dashboardApiBase(exam)}/overview`, {
        params: { class_id: classId },
      }),
    );
    const profile = body.data?.profileProgress;
    return {
      activity: toActivity(body.data?.week_activity),
      profile: profile
        ? {
            initials: text(profile.name),
            image: text(profile.image),
            percent: Math.round(toNumber(profile.completion_percentage)),
          }
        : null,
    };
  },

  async competitiveActivity(exam: ExamRef, classId: number): Promise<DayActivity[]> {
    const body = assertOk(
      await apiClient.get<Envelope<unknown>>(`${dashboardApiBase(exam)}/weekly-activity`, { params: { class_id: classId } }),
    );
    return toActivity(body.data);
  },

  async subjectScores(exam: ExamRef, classId: number): Promise<{ overall: number; subjects: SubjectScore[] }> {
    const body = assertOk(
      await apiClient.get<Envelope<{ overall_percent?: unknown; result_data?: SubjectScore[] }>>(
        `${dashboardApiBase(exam)}/classes/${classId}/subject-scores`,
      ),
    );
    return {
      overall: Math.floor(toNumber(body.data?.overall_percent)),
      subjects: (body.data?.result_data ?? []).map((s) => ({
        subject: s.subject,
        thisAttempt: toNumber(s.thisAttempt),
        lastAttempt: toNumber(s.lastAttempt),
      })),
    };
  },

  async boardSubjects(exam: ExamRef, classId: number): Promise<SubjectOverview[]> {
    type Raw = { subject_id: number | string; subject_name: string; course_count?: unknown; module_count?: unknown };
    const body = assertOk(
      await apiClient.get<Envelope<{ subjects?: Raw[] }>>(`${dashboardApiBase(exam)}/classes/${classId}/subjects`),
    );
    return (body.data?.subjects ?? []).map((s) => ({
      id: String(s.subject_id),
      name: s.subject_name,
      courseCount: toNumber(s.course_count),
      chapterCount: toNumber(s.module_count),
    }));
  },

  async continueCourses(exam: ExamRef, classId: number): Promise<ContinueCourse[]> {
    type Raw = {
      course_id: number | string;
      course_name?: string;
      class_name?: string;
      subject_name?: string;
      image?: string | null;
      progress_percentage?: unknown;
    };
    const body = assertOk(
      await apiClient.get<Envelope<{ courses?: Raw[] }>>(`${dashboardApiBase(exam)}/classes/${classId}/continue-courses`),
    );
    return (body.data?.courses ?? []).map((c) => ({
      courseId: String(c.course_id),
      name: c.course_name ?? '',
      className: c.class_name ?? '',
      subjectName: c.subject_name ?? '',
      image: text(c.image),
      percent: Math.round(toNumber(c.progress_percentage)),
    }));
  },

  /** Board papers the student started but hasn't submitted (backend returns the latest 4). */
  async continueTests(exam: ExamRef, classId: number): Promise<ContinueTest[]> {
    type Raw = {
      set_id: number | string;
      set_number?: unknown;
      exam_type?: string;
      progress_percentage?: unknown;
      class_name?: string;
    };
    const body = assertOk(
      await apiClient.get<Envelope<{ exams?: Raw[] } | Raw[]>>(`${dashboardApiBase(exam)}/classes/${classId}/continue-exams`),
    );
    const data = body.data;
    const rows = Array.isArray(data) ? data : (data?.exams ?? []);
    return rows.map((row) => {
      const kind = KINDS.find((k) => k === row.exam_type);
      return {
        kind: kind ?? 'other',
        testType: kind ? ENGINE_TYPES[kind] : null,
        setId: String(row.set_id),
        setNumber: String(row.set_number ?? row.set_id),
        className: row.class_name ?? '',
        percent: Math.round(toNumber(row.progress_percentage)),
      };
    });
  },

  async competitiveProgress(exam: ExamRef): Promise<SubjectProgress[]> {
    type Raw = {
      subject_name: string;
      completed_chapters?: unknown;
      total_chapters?: unknown;
      progress_percentage?: unknown;
      course_ids?: unknown;
    };
    const body = assertOk(await apiClient.get<Envelope<Raw[]>>(`${dashboardApiBase(exam)}/subject-progress`));
    return (body.data ?? []).map((s) => {
      let ids = s.course_ids;
      if (typeof ids === 'string') {
        try {
          ids = JSON.parse(ids);
        } catch {
          ids = [];
        }
      }
      const first: unknown = Array.isArray(ids) ? ids[0] : undefined;
      return {
        name: s.subject_name.replace(/^NEET[-\s]*/i, ''),
        completed: toNumber(s.completed_chapters),
        total: toNumber(s.total_chapters),
        percent: Math.round(toNumber(s.progress_percentage)),
        courseId: first === undefined || first === null ? null : String(first),
      };
    });
  },

  /** Null when there's no referral summary (the teaser card is hidden, as before). */
  async referralSummary(): Promise<ReferralSummary | null> {
    const body = await apiClient.get<Envelope<{ balance?: unknown; friendCount?: unknown; tier?: string }>>(
      '/api/referral/me',
    );
    if (!body?.success || !body.data || Array.isArray(body.data)) return null;
    return {
      balance: toNumber(body.data.balance),
      friendCount: toNumber(body.data.friendCount),
      tier: body.data.tier === 'paid' ? 'paid' : 'free',
    };
  },
};
