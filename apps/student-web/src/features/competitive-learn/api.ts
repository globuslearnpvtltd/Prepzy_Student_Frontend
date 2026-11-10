import { LEARN_API, learnApiBase, type ExamRef } from '@/shared/config/exams';
import { isApiError } from '@/shared/lib/errors';
import { apiClient } from '@/shared/lib/api-client';
import { assertOk } from '@/shared/lib/unwrap';
import { subjectLabel } from '@/shared/layout/shell-api';

/**
 * Competitive (NEET …) learn & notes endpoints (v4 `learn` module, exam id from the catalog). The backend sends
 * counters as numbers or numeric strings — everything is normalised here.
 */

type Envelope<T> = { success?: boolean; message?: string; data?: T };

const num = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null);

/* --------------------------------- Progress --------------------------------- */

export type ChapterStatus = 'completed' | 'in_progress' | 'not_started';

export interface ProgressCounts {
  completed_videos?: unknown;
  total_videos?: unknown;
  completed_notes?: unknown;
  total_notes?: unknown;
  completed_tests?: unknown;
  total_tests?: unknown;
  completed_pyqs?: unknown;
  total_pyqs?: unknown;
}

/** Chapter completion = (videos + notes + tests + PYQs done) / (same, available), as the previous app showed it. */
export function chapterProgress(row: ProgressCounts): { status: ChapterStatus; percent: number } {
  const done = num(row.completed_videos) + num(row.completed_notes) + num(row.completed_tests) + num(row.completed_pyqs);
  const total = num(row.total_videos) + num(row.total_notes) + num(row.total_tests) + num(row.total_pyqs);
  if (total === 0 || done === 0) return { status: 'not_started', percent: 0 };
  if (done >= total) return { status: 'completed', percent: 100 };
  return { status: 'in_progress', percent: Math.round((done / total) * 100) };
}

/* ---------------------------------- Notes ---------------------------------- */

export interface NotesSubject {
  id: string;
  name: string;
  total: number;
  completed: number;
}

export interface NotesChapter {
  moduleId: string;
  courseId: string;
  order: number;
  title: string;
  locked: boolean;
  status: ChapterStatus;
}

export interface NotesChapters {
  chapters: NotesChapter[];
  total: number;
  completed: number;
}

export function toNotesSubjects(rows: unknown): NotesSubject[] {
  if (!Array.isArray(rows)) return [];
  return (rows as Record<string, unknown>[]).map((row) => ({
    id: String(row.subject_id),
    name: subjectLabel(String(row.subject_name ?? '')),
    total: num(row.total_chapters),
    completed: num(row.completed_chapters),
  }));
}

export function toNotesChapters(body: { data?: unknown; summary?: Record<string, unknown> | null }): NotesChapters {
  const rows = Array.isArray(body.data) ? (body.data as Record<string, unknown>[]) : [];
  const chapters = rows.map((row) => ({
    moduleId: String(row.module_id),
    courseId: String(row.course_id),
    order: num(row.module_order),
    title: String(row.module_title ?? ''),
    locked: !!num(row.lock_content),
    status: (row.notes_status === 'completed'
      ? 'completed'
      : row.notes_status === 'in_progress'
        ? 'in_progress'
        : 'not_started') as ChapterStatus,
  }));
  return {
    chapters,
    total: body.summary ? num(body.summary.total_chapters) : chapters.length,
    completed: body.summary ? num(body.summary.completed_chapters) : chapters.filter((c) => c.status === 'completed').length,
  };
}

/* --------------------------------- Course --------------------------------- */

export interface CourseChapter {
  moduleId: string;
  title: string;
  tag: string | null;
  status: ChapterStatus;
  percent: number;
}

export interface CourseOverview {
  chapters: CourseChapter[];
  /** Completed counts across the course (each chapter has at most one of each). */
  done: { videos: number; notes: number; tests: number; pyqs: number };
}

export function toCourseOverview(body: { data?: unknown; summary?: Record<string, { completed?: unknown } | undefined> | null }): CourseOverview {
  const rows = Array.isArray(body.data) ? (body.data as (Record<string, unknown> & ProgressCounts)[]) : [];
  const chapters = [...rows]
    .sort((a, b) => num(a.orders) - num(b.orders))
    .map((row) => ({
      moduleId: String(row.module_id),
      title: String(row.title ?? ''),
      tag: text(row.tag),
      ...chapterProgress(row),
    }));
  const s = body.summary ?? {};
  return {
    chapters,
    done: {
      videos: num(s.videos?.completed),
      notes: num(s.notes?.completed),
      tests: num(s.tests?.completed),
      pyqs: num(s.pyqs?.completed),
    },
  };
}

/* --------------------------------- Chapter --------------------------------- */

export interface ChapterInfo {
  moduleId: string;
  title: string;
  courseId: string;
  courseTitle: string;
  subject: string;
  status: ChapterStatus;
  percent: number;
  pyqQuestionCount: number;
}

export function toChapterInfo(rows: unknown): ChapterInfo | null {
  const row = Array.isArray(rows) ? (rows[0] as (Record<string, unknown> & ProgressCounts) | undefined) : undefined;
  if (!row) return null;
  return {
    moduleId: String(row.module_id),
    title: String(row.module_title ?? ''),
    courseId: String(row.course_id ?? ''),
    courseTitle: String(row.course_title ?? ''),
    subject: subjectLabel(String(row.subject_title ?? '')),
    ...chapterProgress(row),
    pyqQuestionCount: num(row.pyq_question_count),
  };
}

/* ---------------------------------- Video ---------------------------------- */

export interface VideoSource {
  language: string;
  title: string;
  url: string;
}

export interface VideoPart {
  label: string;
  /** Languages this part is available in, in the backend's order. */
  sources: VideoSource[];
}

export interface SummaryVideo {
  title: string | null;
  completed: boolean;
  parts: VideoPart[];
}

/**
 * `new_video_link` is `{ [language]: { [part]: { title, video_link } } }` (sometimes still a JSON string, or a
 * bare URL on old rows). Parts are listed in first-seen order across languages.
 */
export function toVideoParts(raw: unknown, fallbackTitle: string | null = null): VideoPart[] {
  let links: unknown = raw;
  if (typeof links === 'string') {
    const value = links.trim();
    if (!value) return [];
    try {
      links = JSON.parse(value);
    } catch {
      return /^https?:\/\//.test(value) ? [{ label: 'Part 1', sources: [{ language: 'default', title: fallbackTitle ?? '', url: value }] }] : [];
    }
  }
  if (!links || typeof links !== 'object' || Array.isArray(links)) return [];
  const parts = new Map<string, VideoSource[]>();
  for (const [language, byPart] of Object.entries(links as Record<string, unknown>)) {
    if (!byPart || typeof byPart !== 'object') continue;
    for (const [label, video] of Object.entries(byPart as Record<string, { title?: unknown; video_link?: unknown } | null>)) {
      const url = text(video?.video_link);
      if (!url) continue;
      const sources = parts.get(label) ?? [];
      sources.push({ language, title: text(video?.title) ?? fallbackTitle ?? '', url });
      parts.set(label, sources);
    }
  }
  return [...parts].map(([label, sources]) => ({ label, sources }));
}

export function toSummaryVideo(data: unknown): SummaryVideo | null {
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined | null;
  if (!row || typeof row !== 'object') return null;
  const title = text(row.title);
  const parts = toVideoParts(row.new_video_link, title);
  // A stale "completed" status without any uploaded video is never shown as completed.
  return { title, parts, completed: parts.length > 0 && row.summary_video_status === 'completed' };
}

/** YouTube video id from watch / share / embed / shorts links, else null (a file played natively). */
export function youTubeId(url: string): string | null {
  const match = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/.exec(url);
  return match ? match[1]! : null;
}

/* ---------------------------------- Notes ---------------------------------- */

export interface StudyNotes {
  courseName: string | null;
  moduleName: string | null;
  order: number | null;
  html: string | null;
  pdf: string | null;
  completed: boolean;
}

export function toStudyNotes(data: unknown): StudyNotes | null {
  if (!data || typeof data !== 'object') return null;
  const row = data as Record<string, unknown>;
  return {
    courseName: text(row.course_name),
    moduleName: text(row.module_name),
    order: row.module_order === undefined || row.module_order === null ? null : num(row.module_order),
    html: text(row.notes_text),
    pdf: text(row.notes_pdf),
    completed: row.is_completed === true || row.summary_notes_status === 'completed',
  };
}

/* --------------------------------- Attempts --------------------------------- */

export interface PastAttempt {
  attemptId: string;
  number: number;
  date: string;
  marks: number;
  totalMarks: number;
  latest: boolean;
}

export function toAttempts(rows: unknown): PastAttempt[] {
  if (!Array.isArray(rows)) return [];
  return (rows as Record<string, unknown>[]).map((row) => ({
    attemptId: String(row.attempt_id),
    number: num(row.attempt_number),
    date: String(row.date ?? ''),
    marks: num(row.total_marks_obtained),
    totalMarks: num(row.total_marks),
    latest: row.is_latest === true,
  }));
}

/** The highest-scoring attempt (first one wins a tie). */
export function bestAttempt(attempts: PastAttempt[]): PastAttempt | null {
  return attempts.reduce<PastAttempt | null>((best, a) => (!best || a.marks > best.marks ? a : best), null);
}

/* ---------------------------------- Calls ---------------------------------- */

export const learnApi = {
  async notesSubjects(exam: ExamRef, classId: number): Promise<NotesSubject[]> {
    const body = assertOk(await apiClient.get<Envelope<{ subjects?: unknown }>>(`${learnApiBase(exam)}/classes/${classId}/notes/subjects`));
    return toNotesSubjects(body.data?.subjects);
  },

  async notesChapters(exam: ExamRef, classId: number, subjectId: string): Promise<NotesChapters> {
    const body = assertOk(
      await apiClient.get<Envelope<{ chapters?: unknown; summary?: Record<string, unknown> }>>(
        `${learnApiBase(exam)}/classes/${classId}/notes/chapters`,
        { params: { subject_id: subjectId } },
      ),
    );
    return toNotesChapters({ data: body.data?.chapters, summary: body.data?.summary ?? null });
  },

  async course(exam: ExamRef, courseId: string): Promise<CourseOverview> {
    const body = assertOk(
      await apiClient.get<Envelope<{ chapters?: unknown; summary?: Record<string, { completed?: unknown }> }>>(
        `${learnApiBase(exam)}/courses/${courseId}/chapters`,
      ),
    );
    return toCourseOverview({ data: body.data?.chapters, summary: body.data?.summary ?? null });
  },

  /** Null when the chapter doesn't exist (404). */
  async chapter(exam: ExamRef, moduleId: string): Promise<ChapterInfo | null> {
    try {
      const body = assertOk(await apiClient.get<Envelope<{ chapter?: unknown }>>(`${learnApiBase(exam)}/chapters/${moduleId}`));
      return toChapterInfo(body.data?.chapter ? [body.data.chapter] : []);
    } catch (error) {
      if (isApiError(error) && error.status === 404) return null;
      throw error;
    }
  },

  async summaryVideo(exam: ExamRef, moduleId: string): Promise<SummaryVideo | null> {
    const body = assertOk(await apiClient.get<Envelope<{ video?: unknown }>>(`${learnApiBase(exam)}/chapters/${moduleId}/summary-video`));
    return toSummaryVideo(body.data?.video);
  },

  /** Null when the chapter has no notes yet (404). */
  async studyNotes(exam: ExamRef, moduleId: string): Promise<StudyNotes | null> {
    try {
      const body = assertOk(await apiClient.get<Envelope<unknown>>(`${learnApiBase(exam)}/chapters/${moduleId}/notes`));
      return toStudyNotes(body.data);
    } catch (error) {
      if (isApiError(error) && error.status === 404) return null;
      throw error;
    }
  },

  /** Marks the chapter's video or notes done (the backend also updates course progress); returns its message. */
  async markComplete(exam: ExamRef, kind: 'video' | 'notes', moduleId: string): Promise<string | null> {
    const body = assertOk(await apiClient.post<Envelope<unknown>>(`${learnApiBase(exam)}/chapters/${moduleId}/${kind}/complete`));
    return text(body.message);
  },

  /** The chapter's practice (unit test) assessment id, or null when there isn't one (404). */
  async practiceAssessment(exam: ExamRef, moduleId: string): Promise<string | null> {
    try {
      const body = assertOk(
        await apiClient.get<Envelope<{ assessment_id?: unknown } | null>>(`${learnApiBase(exam)}/chapters/${moduleId}/practice`),
      );
      const id = body.data?.assessment_id;
      return id === undefined || id === null ? null : String(id);
    } catch (error) {
      if (isApiError(error) && error.status === 404) return null;
      throw error;
    }
  },

  async practiceAttempts(exam: ExamRef, assessmentId: string): Promise<PastAttempt[]> {
    const body = assertOk(await apiClient.get<Envelope<{ attempts?: unknown }>>(`${learnApiBase(exam)}/practice/${assessmentId}/attempts`));
    return toAttempts(body.data?.attempts);
  },

  /** Chapter-PYQ attempts are shared with board exams (one table, keyed by chapter). */
  async chapterPyqAttempts(moduleId: string): Promise<PastAttempt[]> {
    const body = assertOk(await apiClient.get<Envelope<{ attempts?: unknown }>>(`${LEARN_API}/modules/${moduleId}/pyq-attempts`));
    return toAttempts(body.data?.attempts);
  },
};

