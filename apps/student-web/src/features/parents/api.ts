import { apiClient } from '@/shared/lib/api-client';
import { ApiError } from '@/shared/lib/errors';
import { assertOk } from '@/shared/lib/unwrap';

/** Parents portal endpoints (`/api/mentor/v1/...`). The backend keeps the session in the `mentorAccessToken` cookie. */

type Envelope<T> = { success?: boolean; message?: string; error?: unknown; data?: T };
type Raw = Record<string, unknown>;

const num = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const str = (value: unknown) => (typeof value === 'string' ? value : value == null ? '' : String(value));
const list = (value: unknown): Raw[] => (Array.isArray(value) ? (value as Raw[]) : []);

export interface Parent {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export interface ChildClass {
  id: number;
  name: string;
}

export interface Child {
  id: number;
  firstName: string;
  lastName: string;
  createdAt: string | null;
  classes: ChildClass[];
}

export interface StudyEngagement {
  weekMinutes: number;
  totalMinutes: number;
  avgMinutesPerActiveDay: number;
}

export interface LearningHours {
  /** Hours per day, keyed like the backend: "Mon" … "Sat" and "Today". */
  graph: Record<string, number>;
  engagement: StudyEngagement | null;
}

export interface CountItem {
  id: string;
  name: string;
  count: number;
  /** Backend colour (doubts) or null to use the portal palette by position. */
  color: string | null;
}

export interface LectureCompletion {
  total: number;
  subjects: CountItem[];
  chapters: string[];
}

export interface DoubtsSummary {
  total: number;
  subjects: CountItem[];
  categories: CountItem[];
}

export interface AssessmentCategory {
  label: string;
  count: number;
  percentage: number;
}

export interface AssessmentsSummary {
  total: number;
  categories: AssessmentCategory[];
}

export type OtpChannel = { method: 'email'; email: string } | { method: 'whatsapp'; phone: string };

export function toParent(raw: unknown): Parent | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Raw;
  return {
    id: str(p.account_id),
    firstName: str(p.first_name),
    lastName: str(p.last_name),
    email: str(p.email),
    phone: str(p.phone),
  };
}

export function toChildren(raw: unknown): Child[] {
  return list(raw).map((s) => ({
    id: num(s.account_id),
    firstName: str(s.first_name),
    lastName: str(s.last_name),
    createdAt: typeof s.created_at === 'string' ? s.created_at : null,
    classes: list(s.classes).map((c) => ({
      id: num(c.class_id),
      name: [str(c.class_name), str(c.stream_name)].filter(Boolean).join(' '),
    })),
  }));
}

export function toLearningHours(raw: unknown): LearningHours {
  const data = (raw ?? {}) as Raw;
  const graph: Record<string, number> = {};
  for (const [key, value] of Object.entries((data.graph_data ?? {}) as Raw)) graph[key] = num(value);
  const e = data.study_engagement as Raw | null | undefined;
  const week = (e?.this_week ?? {}) as Raw;
  return {
    graph,
    // The previous app printed `this_week.hours` and `total_since_joining_hours` as minutes; both are hours.
    engagement: e
      ? {
          weekMinutes: Math.round(num(week.total_hours) * 60),
          totalMinutes: Math.round(num(e.total_since_joining_hours) * 60),
          avgMinutesPerActiveDay: Math.round(num(e.avg_minutes_per_active_day)),
        }
      : null,
  };
}

export function toLectureCompletion(raw: unknown): LectureCompletion {
  const data = (raw ?? {}) as Raw;
  return {
    total: num(data.total),
    subjects: list(data.subjects).map((s, i) => ({
      id: str(s.subject_id ?? i),
      name: str(s.subject_name),
      count: num(s.count),
      color: null,
    })),
    chapters: Array.isArray(data.chapters) ? data.chapters.map(str) : [],
  };
}

export function toDoubts(raw: unknown): DoubtsSummary {
  const data = (raw ?? {}) as Raw;
  const item = (s: Raw, name: unknown): CountItem => ({
    id: str(name),
    name: str(name),
    count: num(s.count),
    color: typeof s.color === 'string' ? s.color : null,
  });
  return {
    total: num(data.total),
    subjects: list(data.subjects).map((s) => item(s, s.name)),
    categories: list(data.categories).map((s) => item(s, s.label)),
  };
}

export function toAssessments(raw: unknown): AssessmentsSummary {
  const data = (raw ?? {}) as Raw;
  return {
    total: num(data.total),
    categories: list(data.categories).map((c) => ({
      label: str(c.label),
      count: num(c.count),
      percentage: num(c.percentage),
    })),
  };
}

type StudentQuery = { studentId: number; classId: number };
const params = ({ studentId, classId }: StudentQuery) => ({ student_id: studentId, class_id: classId });
const data = async <T>(path: string, query: StudentQuery) =>
  assertOk(await apiClient.get<Envelope<T>>(path, { params: params(query) })).data;

export const parentsApi = {
  /** Sends a login code by WhatsApp or email. Unregistered contacts answer HTTP 200 with `{ success: false, error }`. */
  async requestOtp(channel: OtpChannel): Promise<void> {
    const body = channel.method === 'whatsapp' ? { phone: channel.phone, email: '' } : { phone: '', email: channel.email };
    assertOk(await apiClient.post<Envelope<unknown>>('/api/mentor/v1/auth/generate-login-otp', body));
  },

  /** The backend looks the contact up by phone OR email, both sent as `phone`. Sets the session cookie. */
  async verifyOtp(contact: string, otp: string): Promise<void> {
    const body = await apiClient.post<Envelope<unknown>>('/api/mentor/v1/auth/verify-login-otp', { phone: contact, otp });
    if (assertOk(body)?.success !== true) {
      throw new ApiError({ status: 422, code: 'REJECTED', message: 'OTP verification failed. Please try again.' });
    }
  },

  async logout(): Promise<void> {
    await apiClient.post('/api/mentor/v1/auth/parent-logout');
  },

  async me(): Promise<Parent | null> {
    const body = assertOk(await apiClient.get<Envelope<{ parent_data?: unknown }>>('/api/mentor/v1/auth/get-parent-info'));
    return toParent(body.data?.parent_data);
  },

  async children(): Promise<Child[]> {
    const body = assertOk(await apiClient.get<Envelope<{ student_data?: unknown }>>('/api/mentor/v1/parents/get-student-list'));
    return toChildren(body.data?.student_data);
  },

  async learningHours(query: StudentQuery): Promise<LearningHours> {
    return toLearningHours(await data('/api/mentor/v1/parents/get-student-learning-hours-info', query));
  },

  async lectures(query: StudentQuery): Promise<LectureCompletion> {
    const body = await data<{ video_completion?: unknown }>('/api/mentor/v1/parents/get-student-video-completion-info', query);
    return toLectureCompletion(body?.video_completion);
  },

  async doubts(query: StudentQuery): Promise<DoubtsSummary> {
    const body = await data<{ doubts?: unknown }>('/api/mentor/v1/parents/get-student-doubts-section-info', query);
    return toDoubts(body?.doubts);
  },

  async assessments(query: StudentQuery): Promise<AssessmentsSummary> {
    const body = await data<{ assessments?: unknown }>('/api/mentor/v1/parents/get-student-assessment-section-info', query);
    return toAssessments(body?.assessments);
  },
};
