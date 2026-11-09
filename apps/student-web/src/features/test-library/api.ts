import { dashboardApiBase, type ExamRef } from '@/shared/config/exams';
import type { ExamConfig } from '@/shared/config/exams';
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

const BOARD_SETS: Record<BoardPaperKind, string> = {
  mock: '/api/mock-exams/fetch-mock-sets',
  pyq: '/api/pyq-exams/fetch-pyq-sets',
};

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

const LIB: Record<LibraryKind, { base: string; key: string; nameKey: 'name' | 'title' }> = {
  mock: { base: '/api/neet/mock-exam', key: 'mockExams', nameKey: 'name' },
  pyq: { base: '/api/neet/pyq-exam', key: 'pyqExams', nameKey: 'title' },
};
const ENDPOINT: Record<LibraryKind, Record<MockVariant, { sets: string; best: string; recent: string }>> = {
  mock: {
    full: { sets: 'fetch-mock-exams', best: 'fetch-mock-best-score', recent: 'fetch-recent-mock-attempts' },
    subject: { sets: 'fetch-subject-mock-exams', best: 'fetch-mock-subject-best-score', recent: 'fetch-recent-subject-mock-attempts' },
  },
  pyq: {
    full: { sets: 'fetch-pyq-exams', best: 'fetch-pyq-best-score', recent: 'fetch-recent-pyq-attempts' },
    subject: { sets: 'fetch-pyq-exams', best: 'fetch-pyq-best-score', recent: 'fetch-recent-pyq-attempts' },
  },
};

type RawSet = Record<string, unknown> & { set_id: string | number; ongoing_session?: { remaining_seconds?: unknown } | null };
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
  async boardSubjects(classId: number, kind: BoardPaperKind): Promise<BoardSubject[]> {
    type S = { subject_id: string | number; subject_title: string; exam_count?: unknown };
    const body = assertOk(
      await apiClient.get<{ data?: Partial<Record<'mock_result' | 'pyq_result', S[]>> }>(
        '/api/v4/assessments/board/subjects',
        { params: { class_id: classId } },
      ),
    );
    const list = body.data?.[kind === 'mock' ? 'mock_result' : 'pyq_result'] ?? [];
    return list.map((s) => ({ id: str(s.subject_id), title: s.subject_title, count: num(s.exam_count) }));
  },

  async boardPapers(kind: BoardPaperKind, subjectId: string, classId: number, status?: string): Promise<BoardPaperList> {
    type Raw = Record<string, unknown> & { set_id: string | number };
    const body = assertOk(
      await apiClient.get<{
        data?: {
          papers?: Raw[];
          stats?: Record<string, unknown>;
          filterOptions?: { subjectOptions?: { subjectId: string | number; subject: string }[] };
        };
      }>(BOARD_SETS[kind], { params: { subject: subjectId, class_id: classId, status } }),
    );
    const data = body.data ?? {};
    const papers = (data.papers ?? []).map(
      (p): BoardPaper => ({
        setId: str(p.set_id),
        setNumber: str(p.set_number ?? p.set_id),
        year: optStr(p.year),
        subject: str(p.subject),
        status: toStatus({ status: str(p.status) }),
        durationLabel: optStr(p.duration),
        questionCount: num(p.totalQuestion),
        maxScore: num(p.total_marks),
        lastScore: p.latest_mark === null || p.latest_mark === undefined ? null : num(p.latest_mark),
        lastAttemptedAt: optStr(p.last_attempted_date),
        attempts: num(p.attempts),
        progress: p.current_progress === undefined || p.current_progress === null ? null : num(p.current_progress),
        attemptId: optStr(p.attempt_id),
      }),
    );
    const stats = data.stats ?? {};
    return {
      papers,
      stats: {
        total: num(stats.totalPaper ?? papers.length),
        completed: num(stats.completed ?? papers.filter((p) => p.status === 'completed').length),
        inProgress: num(stats.inProgress ?? papers.filter((p) => p.status === 'in-progress').length),
        pending: num(stats.pending ?? papers.filter((p) => p.status === 'pending').length),
      },
      subjects: (data.filterOptions?.subjectOptions ?? []).map((s) => ({ id: str(s.subjectId), title: s.subject, count: 0 })),
    };
  },

  async librarySets(exam: ExamConfig, classId: number, kind: LibraryKind, variant: MockVariant): Promise<LibrarySet[]> {
    const lib = LIB[kind];
    const body = assertOk(
      await apiClient.get<{ data?: Record<string, RawSet[]> }>(`${lib.base}/${ENDPOINT[kind][variant].sets}`, {
        params: { exam_id: exam.examId, class_id: classId },
      }),
    );
    return (body.data?.[lib.key] ?? []).map((s) => ({
      setId: str(s.set_id),
      name: str(s[lib.nameKey] ?? s.name ?? s.title) || `Paper ${str(s.set_id)}`,
      subjectName: optStr(s.subjectName) && subjectName(str(s.subjectName)),
      year: optStr(s.year),
      durationMinutes: num(s.duration),
      questionCount: num(s.question_count),
      attemptCount: num(s.attempt_count),
      status: toStatus({ status: str(s.status), ongoing_session: s.ongoing_session }),
      remainingSeconds: s.ongoing_session ? num(s.ongoing_session.remaining_seconds) : null,
    }));
  },

  async bestScore(exam: ExamConfig, classId: number, kind: LibraryKind, variant: MockVariant) {
    const body = assertOk(
      await apiClient.get<{ data?: { bestScore?: { obtained?: unknown; total?: unknown } | null } }>(
        `${LIB[kind].base}/${ENDPOINT[kind][variant].best}`,
        { params: { exam_id: exam.examId, class_id: classId } },
      ),
    );
    const best = body.data?.bestScore;
    return best ? { obtained: num(best.obtained), total: num(best.total) } : null;
  },

  async recentAttempts(exam: ExamConfig, classId: number, kind: LibraryKind, variant: MockVariant): Promise<LibraryAttempt[]> {
    const body = assertOk(
      await apiClient.get<{ data?: { attempts?: RawAttempt[] } }>(`${LIB[kind].base}/${ENDPOINT[kind][variant].recent}`, {
        params: { exam_id: exam.examId, class_id: classId },
      }),
    );
    return (body.data?.attempts ?? []).map((a) => ({
      attemptId: str(a.attempt_id),
      setId: str(a.set_id),
      name: str(a.name ?? a.title),
      obtained: num(a.total_marks_obtained),
      total: num(a.total_marks),
      date: optStr(a.attempt_date),
    }));
  },

  /** Every attempt of one paper (the "View Attempts" dialog). */
  async setAttempts(kind: LibraryKind, setId: string): Promise<LibraryAttempt[]> {
    const path = kind === 'mock' ? 'fetch-mock-attempts' : 'fetch-pyq-attempts';
    const body = assertOk(
      await apiClient.get<{ data?: { name?: string; title?: string; attempts?: RawAttempt[] } }>(`${LIB[kind].base}/${path}`, {
        params: { set_id: setId },
      }),
    );
    const name = str(body.data?.name ?? body.data?.title);
    return (body.data?.attempts ?? []).map((a) => ({
      attemptId: str(a.attempt_id),
      setId,
      name: `${name} · Attempt ${str(a.attempt_number)}`,
      obtained: num(a.total_marks_obtained),
      total: num(a.total_marks),
      date: optStr(a.attempt_date),
    }));
  },

  async savedCustomTests(): Promise<SavedCustomTest[]> {
    type Raw = Record<string, unknown> & { set_id: string | number; topics?: { title?: string }[] };
    const body = assertOk(await apiClient.get<{ sets?: Raw[] }>('/api/neet/custom-exam/saved-tests'));
    return (body.sets ?? []).map((s) => ({
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

  async pastCustomAttempts(): Promise<PastCustomAttempt[]> {
    const body = assertOk(await apiClient.get<{ attempts?: RawAttempt[] }>('/api/neet/custom-exam/past-attempts'));
    return (body.attempts ?? []).map((a) => ({
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
    type Raw = { subject_name: string; total_chapters?: unknown; course_ids?: unknown };
    const body = assertOk(await apiClient.get<{ data?: Raw[] }>(`${dashboardApiBase(exam)}/subject-progress`));
    return (body.data ?? []).map((s) => {
      let ids = s.course_ids;
      if (typeof ids === 'string') ids = ids.split(',');
      return {
        name: subjectName(s.subject_name),
        courseIds: (Array.isArray(ids) ? ids : []).map(str).filter(Boolean),
        chapterCount: num(s.total_chapters),
      };
    });
  },

  async customChapters(courseIds: string[]) {
    type Raw = { module_id: string | number; module_name: string; topic_count?: unknown };
    const lists = await Promise.all(
      courseIds.map(async (id) => assertOk(await apiClient.get<{ chapters?: Raw[] }>(`/api/neet/custom-exam/chapters/${id}`)).chapters ?? []),
    );
    return lists.flat().map((c) => ({ id: str(c.module_id), name: c.module_name, topicCount: num(c.topic_count) }));
  },

  async customTopics(moduleId: string) {
    type Raw = { lecture_id: string | number; title: string };
    const body = assertOk(await apiClient.get<{ topics?: Raw[] }>(`/api/neet/custom-exam/topics/${moduleId}`));
    return (body.topics ?? []).map((t) => ({ id: str(t.lecture_id), title: t.title }));
  },

  /** Returns the new set id, or null when no questions match (the backend explains why in `message`). */
  async generateCustomTest(input: { moduleId: string; lectureIds: string[]; difficulty: Difficulty }) {
    const body = assertOk(
      await apiClient.post<{ set_id?: string | number | null; message?: string }>('/api/neet/custom-exam/generate', {
        module_id: Number(input.moduleId),
        lecture_ids: input.lectureIds.map(Number),
        difficulty_level: input.difficulty,
      }),
    );
    return { setId: optStr(body.set_id), message: body.message ?? null };
  },

  async dppMonths(exam: ExamConfig): Promise<DppMonth[]> {
    type Raw = { year: unknown; month: unknown; first_dpp_id: unknown };
    const body = assertOk(
      await apiClient.get<{ data?: { months?: Raw[] } }>('/api/neet/get-dpp-months', { params: { exam: exam.examSlice.toUpperCase() } }),
    );
    return (body.data?.months ?? []).map((m) => ({ year: num(m.year), month: num(m.month), firstDppId: str(m.first_dpp_id) }));
  },

  async dppList(exam: ExamConfig, month: number, year: number): Promise<DppItem[]> {
    type Raw = { dpp_id: unknown; dpp_name?: string; dpp_date?: string; attempted?: unknown; attempt_id?: unknown };
    const body = assertOk(
      await apiClient.get<{ data?: { list?: Raw[] } }>('/api/neet/get-dpp-list', {
        params: { exam: exam.examSlice.toUpperCase(), month, year },
      }),
    );
    return (body.data?.list ?? []).map((d) => ({
      dppId: str(d.dpp_id),
      name: d.dpp_name ?? 'Daily practice',
      date: d.dpp_date ?? null,
      attemptId: num(d.attempted) ? optStr(d.attempt_id) : null,
    }));
  },
};
