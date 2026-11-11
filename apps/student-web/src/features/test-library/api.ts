import { assessmentsApiBase, dashboardApiBase, type ExamRef } from '@/shared/config/exams';
import { apiClient } from '@/shared/lib/api-client';
import { assertOk } from '@/shared/lib/unwrap';

/** Data for the test hubs (lists, stats, attempts). Taking a test goes through the exam engine. */

const num = (v: unknown): number => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
};
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const optStr = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v));

export type LibraryStatus = 'pending' | 'in-progress' | 'completed';
const toStatus = (raw: { status?: string; ongoing_session?: unknown }): LibraryStatus =>
  raw.ongoing_session || raw.status === 'in_progress' ? 'in-progress' : raw.status === 'completed' ? 'completed' : 'pending';

/* ------------------------------ board papers ------------------------------ */

export type BoardPaperKind = 'mock' | 'pyq';

export interface BoardSubject {
  id: string;
  title: string;
  count: number;
}

export interface BoardPaper {
  setId: string;
  setNumber: string;
  year: string | null;
  subject: string;
  status: LibraryStatus;
  durationLabel: string | null;
  questionCount: number;
  maxScore: number;
  lastScore: number | null;
  lastAttemptedAt: string | null;
  attempts: number;
  progress: number | null;
  attemptId: string | null;
}

export interface BoardPaperList {
  papers: BoardPaper[];
  stats: { total: number; completed: number; inProgress: number; pending: number };
  subjects: BoardSubject[];
}


/* ------------------------------ competitive ------------------------------- */

export type LibraryKind = 'mock' | 'pyq';
export type MockVariant = 'full' | 'subject';

export interface LibrarySet {
  setId: string;
  name: string;
  subjectName: string | null;
  year: string | null;
  durationMinutes: number;
  questionCount: number;
  attemptCount: number;
  status: LibraryStatus;
  remainingSeconds: number | null;
}

export interface LibraryAttempt {
  attemptId: string;
  setId: string;
  name: string;
  obtained: number;
  total: number;
  date: string | null;
}

/** Query of a competitive paper list: mocks are per class and come as full or per-subject papers. */
const paperScope = (classId: number, kind: LibraryKind, variant: MockVariant) =>
  kind === 'mock' ? { class_id: classId, variant } : {};

type RawSet = Record<string, unknown> & { set_id: string | number; ongoing_session?: { remaining_seconds?: unknown } | null };
type Envelope<T> = { data?: T };
type RawAttempt = Record<string, unknown> & { attempt_id: string | number };

/* ------------------------------- custom tests ------------------------------ */

export interface SavedCustomTest {
  setId: string;
  title: string;
  subject: string;
  topics: string[];
  difficulty: string;
  questionCount: number;
  totalMarks: number;
  createdAt: string | null;
  attemptCount: number;
  latestAttemptId: string | null;
  inProgress: boolean;
}

export interface PastCustomAttempt {
  attemptId: string;
  setId: string;
  title: string;
  subject: string;
  attemptNumber: number;
  difficulty: string;
  obtained: number;
  total: number;
  date: string | null;
}

export interface CustomSubject {
  /** subjects.subject_id (custom chapters are listed per subject). */
  id: string;
  name: string;
  courseIds: string[];
  chapterCount: number;
}

export type Difficulty = 'easy' | 'medium' | 'hard';

/* ---------------------------------- DPP ----------------------------------- */

export interface DppMonth {
  year: number;
  month: number;
  firstDppId: string;
}

export interface DppItem {
  dppId: string;
  name: string;
  date: string | null;
  attemptId: string | null;
}

export const subjectName = (raw: string) => {
  const cleaned = raw.replace(/^neet-/i, '').trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
};

export const libraryApi = {
  async boardSubjects(exam: ExamRef, classId: number, kind: BoardPaperKind): Promise<BoardSubject[]> {
    type S = { subject_id: string | number; subject_title: string; exam_count?: unknown };
    const body = assertOk(
      await apiClient.get<Envelope<S[]>>(`${assessmentsApiBase(exam)}/${kind}/subjects`, { params: { class_id: classId } }),
    );
    return (body.data ?? []).map((s) => ({ id: str(s.subject_id), title: s.subject_title, count: num(s.exam_count) }));
  },

  async boardPapers(exam: ExamRef, kind: BoardPaperKind, subjectId: string, classId: number, status?: string): Promise<BoardPaperList> {
    type Raw = Record<string, unknown> & { set_id: string | number };
    const body = assertOk(
      await apiClient.get<
        Envelope<{
          papers?: Raw[];
          stats?: Record<string, unknown>;
          subjects?: { subject_id: string | number; subject_title: string }[];
        }>
      >(`${assessmentsApiBase(exam)}/${kind}/sets`, { params: { subject_id: subjectId, class_id: classId, status } }),
    );
    const data = body.data ?? {};
    const papers = (data.papers ?? []).map(
      (p): BoardPaper => ({
        setId: str(p.set_id),
        setNumber: str(p.set_number ?? p.set_id),
        year: optStr(p.year),
        subject: str(p.subject_name),
        status: toStatus({ status: str(p.status) }),
        durationLabel: optStr(p.duration),
        questionCount: num(p.total_questions),
        maxScore: num(p.total_marks),
        lastScore: p.latest_marks === null || p.latest_marks === undefined ? null : num(p.latest_marks),
        lastAttemptedAt: optStr(p.last_attempted_at),
        attempts: num(p.attempt_count),
        progress: p.current_progress === undefined || p.current_progress === null ? null : num(p.current_progress),
        attemptId: optStr(p.latest_attempt_id),
      }),
    );
    const stats = data.stats ?? {};
    return {
      papers,
      stats: {
        total: num(stats.total ?? papers.length),
        completed: num(stats.completed ?? papers.filter((p) => p.status === 'completed').length),
        inProgress: num(stats.in_progress ?? papers.filter((p) => p.status === 'in-progress').length),
        pending: num(stats.pending ?? papers.filter((p) => p.status === 'pending').length),
      },
      subjects: (data.subjects ?? []).map((s) => ({ id: str(s.subject_id), title: s.subject_title, count: 0 })),
    };
  },

  async librarySets(exam: ExamRef, classId: number, kind: LibraryKind, variant: MockVariant): Promise<LibrarySet[]> {
    const body = assertOk(
      await apiClient.get<Envelope<{ sets?: RawSet[] }>>(`${assessmentsApiBase(exam)}/${kind}/sets`, {
        params: paperScope(classId, kind, variant),
      }),
    );
    return (body.data?.sets ?? []).map((s) => ({
      setId: str(s.set_id),
      name: str(s.name) || `Paper ${str(s.set_id)}`,
      subjectName: optStr(s.subject_name) && subjectName(str(s.subject_name)),
      year: optStr(s.year),
      durationMinutes: num(s.duration),
      questionCount: num(s.question_count),
      attemptCount: num(s.attempt_count),
      status: toStatus({ status: str(s.status), ongoing_session: s.ongoing_session }),
      remainingSeconds: s.ongoing_session ? num(s.ongoing_session.remaining_seconds) : null,
    }));
  },

  async bestScore(exam: ExamRef, classId: number, kind: LibraryKind, variant: MockVariant) {
    const body = assertOk(
      await apiClient.get<Envelope<{ obtained?: unknown; total?: unknown } | null>>(`${assessmentsApiBase(exam)}/${kind}/best-score`, {
        params: paperScope(classId, kind, variant),
      }),
    );
    const best = body.data;
    return best ? { obtained: num(best.obtained), total: num(best.total) } : null;
  },

  async recentAttempts(exam: ExamRef, classId: number, kind: LibraryKind, variant: MockVariant): Promise<LibraryAttempt[]> {
    const body = assertOk(
      await apiClient.get<Envelope<RawAttempt[]>>(`${assessmentsApiBase(exam)}/${kind}/attempts`, {
        params: paperScope(classId, kind, variant),
      }),
    );
    return (body.data ?? []).map((a) => ({
      attemptId: str(a.attempt_id),
      setId: str(a.set_id),
      name: str(a.name),
      obtained: num(a.total_marks_obtained),
      total: num(a.total_marks),
      date: optStr(a.attempt_date),
    }));
  },

  /** Every attempt of one paper (the "View Attempts" dialog). */
  async setAttempts(exam: ExamRef, kind: LibraryKind, setId: string): Promise<LibraryAttempt[]> {
    const body = assertOk(
      await apiClient.get<Envelope<{ name?: string; attempts?: RawAttempt[] }>>(
        `${assessmentsApiBase(exam)}/${kind}/sets/${encodeURIComponent(setId)}/attempts`,
      ),
    );
    const name = str(body.data?.name);
    return (body.data?.attempts ?? []).map((a) => ({
      attemptId: str(a.attempt_id),
      setId,
      name: `${name} · Attempt ${str(a.attempt_number)}`,
      obtained: num(a.total_marks_obtained),
      total: num(a.total_marks),
      date: optStr(a.attempt_date),
    }));
  },

  async savedCustomTests(exam: ExamRef): Promise<SavedCustomTest[]> {
    type Raw = Record<string, unknown> & { set_id: string | number; topics?: { title?: string }[] };
    const body = assertOk(await apiClient.get<Envelope<{ sets?: Raw[] }>>(`${assessmentsApiBase(exam)}/custom/sets`));
    return (body.data?.sets ?? []).map((s) => ({
      setId: str(s.set_id),
      title: str(s.module_name) || `Custom test ${str(s.set_number)}`,
      subject: subjectName(str(s.subject_name)),
      topics: (s.topics ?? []).map((t) => str(t.title)).filter(Boolean),
      difficulty: str(s.difficulty_level) || 'medium',
      questionCount: num(s.total_questions),
      totalMarks: num(s.total_marks),
      createdAt: optStr(s.created_at),
      attemptCount: num(s.attempt_count),
      latestAttemptId: optStr(s.latest_attempt_id),
      inProgress: !!s.in_progress,
    }));
  },

  async pastCustomAttempts(exam: ExamRef): Promise<PastCustomAttempt[]> {
    const body = assertOk(await apiClient.get<Envelope<RawAttempt[]>>(`${assessmentsApiBase(exam)}/custom/attempts`));
    return (body.data ?? []).map((a) => ({
      attemptId: str(a.attempt_id),
      setId: str(a.set_id),
      title: str(a.module_name) || 'Custom test',
      subject: subjectName(str(a.subject_name)),
      attemptNumber: num(a.attempt_number),
      difficulty: str(a.difficulty_level) || 'medium',
      obtained: num(a.total_marks_obtained),
      total: num(a.total_marks),
      date: optStr(a.attempt_date),
    }));
  },

  async customSubjects(exam: ExamRef): Promise<CustomSubject[]> {
    type Raw = { subject_id?: unknown; subject_name: string; total_chapters?: unknown; course_ids?: unknown };
    const body = assertOk(await apiClient.get<{ data?: Raw[] }>(`${dashboardApiBase(exam)}/subject-progress`));
    return (body.data ?? []).map((s) => {
      let ids = s.course_ids;
      if (typeof ids === 'string') ids = ids.split(',');
      return {
        id: str(s.subject_id),
        name: subjectName(s.subject_name),
        courseIds: (Array.isArray(ids) ? ids : []).map(str).filter(Boolean),
        chapterCount: num(s.total_chapters),
      };
    });
  },

  /** A subject's chapters in the exam (all of its courses). */
  async customChapters(exam: ExamRef, subjectId: string) {
    type Raw = { module_id: string | number; module_name: string; topic_count?: unknown };
    const body = assertOk(
      await apiClient.get<Envelope<Raw[]>>(`${assessmentsApiBase(exam)}/custom/chapters/${encodeURIComponent(subjectId)}`),
    );
    return (body.data ?? []).map((c) => ({ id: str(c.module_id), name: c.module_name, topicCount: num(c.topic_count) }));
  },

  async customTopics(exam: ExamRef, moduleId: string) {
    type Raw = { lecture_id: string | number; title: string };
    const body = assertOk(
      await apiClient.get<Envelope<Raw[]>>(`${assessmentsApiBase(exam)}/custom/chapters/${encodeURIComponent(moduleId)}/topics`),
    );
    return (body.data ?? []).map((t) => ({ id: str(t.lecture_id), title: t.title }));
  },

  /** Returns the new set id, or null when no questions match (the backend explains why in `message`). */
  async generateCustomTest(exam: ExamRef, input: { moduleId: string; lectureIds: string[]; difficulty: Difficulty }) {
    const body = assertOk(
      await apiClient.post<{ message?: string; data?: { set_id?: string | number | null } }>(`${assessmentsApiBase(exam)}/custom/sets`, {
        module_id: Number(input.moduleId),
        topic_ids: input.lectureIds.map(Number),
        difficulty_level: input.difficulty,
      }),
    );
    const setId = optStr(body.data?.set_id);
    return { setId, message: setId ? null : (body.message ?? null) };
  },

  async dppMonths(exam: ExamRef): Promise<DppMonth[]> {
    type Raw = { year: unknown; month: unknown; first_dpp_id: unknown };
    const body = assertOk(await apiClient.get<Envelope<Raw[]>>(`${assessmentsApiBase(exam)}/dpp/months`));
    return (body.data ?? []).map((m) => ({ year: num(m.year), month: num(m.month), firstDppId: str(m.first_dpp_id) }));
  },

  async dppList(exam: ExamRef, month: number, year: number): Promise<DppItem[]> {
    type Raw = { dpp_id: unknown; dpp_name?: string | null; dpp_date?: string | null; attempted?: unknown; attempt_id?: unknown };
    const body = assertOk(
      await apiClient.get<Envelope<Raw[]>>(`${assessmentsApiBase(exam)}/dpp/sets`, { params: { month, year } }),
    );
    return (body.data ?? []).map((d) => ({
      dppId: str(d.dpp_id),
      name: d.dpp_name ?? 'Daily practice',
      date: d.dpp_date ?? null,
      attemptId: d.attempted ? optStr(d.attempt_id) : null,
    }));
  },
};
