import { apiClient } from '@/shared/lib/api-client';
import { assertOk } from '@/shared/lib/unwrap';

/**
 * Schools (teacher) portal endpoints: /api/v4/schools/auth/* (teacher OTP login, session) and /api/v4/schools/*.
 * The session is the `teacherAccessToken` cookie the backend sets on verify. The backend takes the school from the
 * teacher's account, so only the class is sent. Responses are normalised here so screens never see the backend's
 * snake_case or missing fields.
 */

const BASE = '/api/v4/schools';

type Envelope<T> = { success?: boolean; message?: string; error?: unknown; data?: T };
type Raw = Record<string, unknown>;

const num = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const str = (value: unknown): string => (typeof value === 'string' ? value : value == null ? '' : String(value));
const list = (value: unknown): Raw[] =>
  Array.isArray(value) ? (value.filter((v) => v && typeof v === 'object') as Raw[]) : [];

export interface Teacher {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface SchoolClass {
  id: number;
  name: string;
  stream: string;
}

export interface School {
  id: number;
  name: string;
  address: string;
  studentCount: number;
  classCount: number;
  classes: SchoolClass[];
}

export interface ClassStats {
  studentCount: number;
  activeStudents: number;
  totalHours: number;
}

export interface FeatureUsage {
  exams: number;
  doubts: number;
  lectures: number;
  doubtSolverChats: number;
  customExams: number;
  postAssessmentChats: number;
}

export interface StudentSummary {
  id: number;
  firstName: string;
  lastName: string;
}

export interface StudentProfile {
  id: number;
  firstName: string;
  lastName: string;
  school: string;
  className: string;
  joinedAt: string | null;
}

export interface LearningHours {
  /** Hours per day label ("Mon" … "Sat", and "Today" for the current day). */
  graph: Record<string, number>;
  /** The previous app shows this whole-hours value with a "Min" label; kept as is. */
  thisWeek: number;
  totalSinceJoining: number;
  avgMinutesPerActiveDay: number;
}

export interface CountItem {
  name: string;
  count: number;
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
  name: string;
  count: number;
  percentage: number;
}

export interface AssessmentsSummary {
  total: number;
  categories: AssessmentCategory[];
}

export function toTeacher(raw: unknown): Teacher | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Raw;
  return { id: str(t.account_id), firstName: str(t.first_name), lastName: str(t.last_name), email: str(t.email) };
}

export function toSchool(raw: unknown): School | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Raw;
  const classes = list(s.class_list).map((c) => ({
    id: num(c.class_id),
    name: str(c.class_name),
    stream: str(c.stream_name),
  }));
  return {
    id: num(s.institute_id),
    name: str(s.institute_name),
    address: str(s.address),
    studentCount: num(s.student_count),
    classCount: s.class_count == null ? classes.length : num(s.class_count),
    classes,
  };
}

const toCounts = (raw: unknown, nameKey: string): CountItem[] =>
  list(raw).map((item) => ({ name: str(item[nameKey]) || 'Others', count: num(item.count) }));

type ClassQuery = { classId: number; institutionId: number };
const classParams = ({ classId }: ClassQuery) => ({ class_id: classId });
type StudentQuery = { studentId: string; classId?: string | null };
const studentPath = (studentId: string, report = '') => `${BASE}/students/${encodeURIComponent(studentId)}${report}`;
const studentParams = ({ classId }: StudentQuery) => ({ class_id: classId ?? undefined });

const get = async <T>(path: string, params?: Record<string, string | number | undefined>): Promise<T | undefined> =>
  assertOk(await apiClient.get<Envelope<T>>(path, { params })).data;

export const schoolsApi = {
  /** Emails a 6-digit code. Unknown emails fail with 404 ACCOUNT_NOT_FOUND, too many requests with 429. */
  async requestOtp(email: string): Promise<void> {
    const body = assertOk(await apiClient.post<Envelope<unknown>>(`${BASE}/auth/otp`, { email }));
    if (body?.success !== true) throw new Error('Failed to send code. Please try again.');
  },

  /** Wrong / expired codes fail with 400 INVALID_OTP / OTP_EXPIRED; success sets the cookie and returns the teacher. */
  async verifyOtp(email: string, otp: string): Promise<Teacher | null> {
    const body = assertOk(await apiClient.post<Envelope<{ teacher_data?: unknown }>>(`${BASE}/auth/verify`, { email, otp }));
    if (body?.success !== true) throw new Error('Invalid OTP. Please try again.');
    return toTeacher(body.data?.teacher_data);
  },

  logout: () => apiClient.post<unknown>(`${BASE}/auth/logout`),

  async me(): Promise<Teacher | null> {
    const data = await get<{ teacher_data?: unknown }>(`${BASE}/auth/me`);
    return toTeacher(data?.teacher_data);
  },

  async school(): Promise<School | null> {
    const data = await get<{ institution_data?: unknown }>(`${BASE}/school`);
    return toSchool(data?.institution_data);
  },

  async classStats(query: ClassQuery): Promise<ClassStats> {
    const data = (await get<Raw>(`${BASE}/hours`, classParams(query))) ?? {};
    return {
      studentCount: num(data.student_count),
      activeStudents: num(data.unique_students),
      totalHours: num(data.total_hours),
    };
  },

  async featureUsage(query: ClassQuery): Promise<FeatureUsage> {
    const data = (await get<Raw>(`${BASE}/feature-usage`, classParams(query))) ?? {};
    return {
      exams: num(data.avg_exam_attempts),
      doubts: num(data.chat_doubts),
      lectures: num(data.total_lectures),
      doubtSolverChats: num(data.total_doubt_solver_chats),
      customExams: num(data.custom_exam_count),
      postAssessmentChats: num(data.post_assessment_chat),
    };
  },

  async students(query: ClassQuery): Promise<StudentSummary[]> {
    const data = await get<{ student_list?: unknown }>(`${BASE}/students`, classParams(query));
    return list(data?.student_list).map((s) => ({
      id: num(s.account_id),
      firstName: str(s.first_name),
      lastName: str(s.last_name),
    }));
  },

  async student(studentId: string): Promise<StudentProfile | null> {
    const data = await get<{ student_data?: Raw | null }>(studentPath(studentId));
    const s = data?.student_data;
    if (!s) return null;
    return {
      id: num(s.account_id),
      firstName: str(s.first_name),
      lastName: str(s.last_name),
      school: str(s.school),
      className: str(s.class_title),
      joinedAt: s.created_at ? str(s.created_at) : null,
    };
  },

  async learningHours(query: StudentQuery): Promise<LearningHours> {
    const data =
      (await get<{ graph_data?: Raw; study_engagement?: Raw | null }>(
        studentPath(query.studentId, '/learning-hours'),
        studentParams(query),
      )) ?? {};
    const graph = Object.fromEntries(Object.entries(data.graph_data ?? {}).map(([key, value]) => [key, num(value)]));
    const engagement = data.study_engagement ?? {};
    const thisWeek = (engagement.this_week ?? {}) as Raw;
    return {
      graph,
      thisWeek: num(thisWeek.hours),
      totalSinceJoining: num(engagement.total_since_joining_hours),
      avgMinutesPerActiveDay: num(engagement.avg_minutes_per_active_day),
    };
  },

  async lectures(query: StudentQuery): Promise<LectureCompletion> {
    const data = await get<{ video_completion?: Raw }>(
      studentPath(query.studentId, '/videos'),
      studentParams(query),
    );
    const v = data?.video_completion ?? {};
    return {
      total: num(v.total),
      subjects: toCounts(v.subjects, 'subject_name'),
      chapters: Array.isArray(v.chapters) ? v.chapters.map(str).filter(Boolean) : [],
    };
  },

  async doubts(query: StudentQuery): Promise<DoubtsSummary> {
    const data = await get<{ doubts?: Raw }>(
      studentPath(query.studentId, '/doubts'),
      studentParams(query),
    );
    const d = data?.doubts ?? {};
    return { total: num(d.total), subjects: toCounts(d.subjects, 'name'), categories: toCounts(d.categories, 'label') };
  },

  async assessments(query: StudentQuery): Promise<AssessmentsSummary> {
    const data = await get<{ assessments?: Raw }>(
      studentPath(query.studentId, '/assessments'),
      studentParams(query),
    );
    const a = data?.assessments ?? {};
    return {
      total: num(a.total),
      categories: list(a.categories).map((c) => ({
        name: str(c.label),
        count: num(c.count),
        percentage: num(c.percentage),
      })),
    };
  },
};
