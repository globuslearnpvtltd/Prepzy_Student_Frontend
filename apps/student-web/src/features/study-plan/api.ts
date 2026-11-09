import { routes } from '@/shared/config/routes';
import { apiClient } from '@/shared/lib/api-client';
import { assertOk } from '@/shared/lib/unwrap';

type Envelope<T> = { success?: boolean; message?: string; error?: string; data?: T };

export type PlanType = 'learning_cum_practice' | 'revision';
export type TaskStatus = 'todo' | 'in_progress' | 'completed';

export interface PlanHeader {
  planId: number;
  planType: PlanType;
  status: 'active' | 'completed' | 'abandoned' | 'superseded';
  startDate: string;
  targetDate: string;
  dailyMinutes: number;
  totalDays: number;
  chapterCount: number;
}

export interface PlanDay {
  dayId: number;
  date: string;
  isRestDay: boolean;
  totalMinutes: number;
  taskCount: number;
  completedCount: number;
  inProgressCount: number;
  isCompleted: boolean;
}

export interface PlanTask {
  id: number;
  code: string;
  label: string;
  title: string | null;
  moduleTitle: string | null;
  subjectTitle: string | null;
  status: TaskStatus;
  isCompleted: boolean;
  isStarted: boolean;
  isAvailable: boolean;
  target: Record<string, string | number | null> | null;
}

export interface PlanStatus {
  state: string;
  canCreate: boolean;
  allowedPlanTypes: PlanType[];
  hasPlan: boolean;
  examDate: string | null;
  maxTargetDate: string | null;
}

export interface SyllabusModule {
  id: number;
  name: string;
  topicCount: number;
  selectable: boolean;
}
export interface SyllabusCourse {
  id: number;
  name: string;
  modules: SyllabusModule[];
}
export interface SyllabusSubject {
  id: number;
  name: string;
  courses: SyllabusCourse[];
  moduleCount: number;
}
export interface DiagnosticRules {
  minTotal: number;
  maxPerSubject: number;
}

export type JourneyState =
  | 'take_diagnostic'
  | 'resume_diagnostic'
  | 'build_plan'
  | 'weekly_progress'
  | 'tasks_partial'
  | 'tasks_done'
  | 'rest_day'
  | 'catch_up'
  | 'halfway'
  | 'plan_complete'
  | 'plan_ended';

export interface Journey {
  state: JourneyState;
  assessmentId: number | null;
  taskCount: number;
  completedCount: number;
  missedTasks: number;
  remainingTasks: number;
  week: { date: string; label: string; total: number; done: number; isToday: boolean; isRest: boolean }[];
  canRetakeDiagnostic: boolean;
}

export type CreateResult = { feasible: true; planId: number } | { feasible: false; message: string | null; minPerDay: number | null };

const num = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
const list = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object') : [];
const isoDay = (value: unknown) => (text(value) ?? '').slice(0, 10);

export function toHeader(raw: unknown): PlanHeader | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (!row.plan_id) return null;
  const status = ['active', 'completed', 'abandoned', 'superseded'].includes(String(row.status))
    ? (row.status as PlanHeader['status'])
    : 'active';
  return {
    planId: num(row.plan_id),
    planType: row.plan_type === 'revision' ? 'revision' : 'learning_cum_practice',
    status,
    startDate: isoDay(row.start_date),
    targetDate: isoDay(row.target_date),
    dailyMinutes: num(row.daily_minutes),
    totalDays: num(row.total_days),
    chapterCount: num(row.chapter_count),
  };
}

export const toDays = (raw: unknown): PlanDay[] =>
  list(raw).map((row) => ({
    dayId: num(row.day_id),
    date: isoDay(row.plan_date),
    isRestDay: !!row.is_rest_day,
    totalMinutes: num(row.total_minutes),
    taskCount: num(row.task_count),
    completedCount: num(row.completed_count),
    inProgressCount: num(row.in_progress_count),
    isCompleted: !!row.is_completed,
  }));

export const toTasks = (raw: unknown): PlanTask[] =>
  list(raw).map((row) => {
    const status: TaskStatus = row.status === 'completed' || row.status === 'in_progress' ? row.status : 'todo';
    return {
      id: num(row.task_id),
      code: text(row.task_code) ?? '',
      label: text(row.label) ?? '',
      title: text(row.title),
      moduleTitle: text(row.module_title),
      subjectTitle: text(row.subject_title),
      status,
      isCompleted: status === 'completed' || !!row.is_completed,
      isStarted: !!row.is_started,
      isAvailable: row.is_available !== false,
      target: row.target && typeof row.target === 'object' ? (row.target as PlanTask['target']) : null,
    };
  });

export function toStatus(raw: unknown): PlanStatus {
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const allowed = Array.isArray(row.allowed_plan_types)
    ? row.allowed_plan_types.filter((t): t is PlanType => t === 'revision' || t === 'learning_cum_practice')
    : [];
  return {
    state: text(row.state) ?? '',
    canCreate: row.can_create !== false,
    allowedPlanTypes: allowed,
    hasPlan: !!row.has_plan,
    examDate: text(row.exam_date) ? isoDay(row.exam_date) : null,
    maxTargetDate: text(row.max_target_date) ? isoDay(row.max_target_date) : null,
  };
}

/** Subjects → courses → chapters; drops courses with nothing selectable (no diagnostic questions yet). */
export function toSyllabus(raw: unknown): SyllabusSubject[] {
  return list(raw)
    .map((subject) => {
      const courses = list(subject.courses)
        .map((course) => ({
          id: num(course.course_id),
          name: text(course.course_name) ?? '',
          modules: list(course.modules).map((m) => ({
            id: num(m.module_id),
            name: text(m.module_name) ?? '',
            topicCount: num(m.topic_count),
            selectable: m.is_selectable !== false,
          })),
        }))
        .filter((course) => course.modules.some((m) => m.selectable));
      return {
        id: num(subject.subject_id),
        name: text(subject.subject_name) ?? '',
        courses,
        moduleCount: courses.reduce((sum, c) => sum + c.modules.length, 0),
      };
    })
    .filter((subject) => subject.courses.length > 0);
}

export function toRules(raw: unknown): DiagnosticRules {
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return { minTotal: num(row.min_chapters_total) || 5, maxPerSubject: num(row.max_chapters_per_subject) || 5 };
}

export const modulesOf = (subject: SyllabusSubject) => subject.courses.flatMap((course) => course.modules);

const JOURNEY_STATES: JourneyState[] = [
  'take_diagnostic',
  'resume_diagnostic',
  'build_plan',
  'weekly_progress',
  'tasks_partial',
  'tasks_done',
  'rest_day',
  'catch_up',
  'halfway',
  'plan_complete',
  'plan_ended',
];

export function toJourney(raw: unknown): Journey | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const state = JOURNEY_STATES.find((s) => s === row.state);
  if (!state) return null;
  return {
    state,
    assessmentId: row.assessment_id ? num(row.assessment_id) : null,
    taskCount: num(row.task_count),
    completedCount: num(row.completed_count),
    missedTasks: num(row.missed_tasks),
    remainingTasks: num(row.remaining_tasks),
    week: list(row.week).map((d) => ({
      date: isoDay(d.date ?? d.plan_date),
      label: text(d.label) ?? text(d.day) ?? '',
      total: num(d.task_count ?? d.total),
      done: num(d.completed_count ?? d.done),
      isToday: !!d.is_today,
      isRest: !!d.is_rest_day,
    })),
    canRetakeDiagnostic: !!row.can_retake_diagnostic,
  };
}

const pad = (n: number) => String(n).padStart(2, '0');
export const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
};

/** "1 hr", "1.5 hrs" */
export function formatStudyHours(minutes: number): string {
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${hours} ${hours === 1 ? 'hr' : 'hrs'}`;
}
export const formatDailyTime = (minutes: number) => (minutes < 60 ? `${minutes} min` : formatStudyHours(minutes));
/** "Mar 31, 2026" */
export function formatFinishDate(iso: string): string {
  const date = fromIso(iso);
  return `${date.toLocaleDateString('en-GB', { month: 'short' })} ${date.getDate()}, ${date.getFullYear()}`;
}
/** "05 Mar, 2026" */
export function formatPlanDate(iso: string): string {
  const date = fromIso(iso);
  return `${pad(date.getDate())} ${date.toLocaleDateString('en-GB', { month: 'short' })}, ${date.getFullYear()}`;
}
/** "Monday, 2 March 2026" */
export const formatDayHeading = (iso: string) =>
  fromIso(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const monthLabel = (year: number, month: number) =>
  new Date(year, month, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

/** Monday-first month grid: day numbers with nulls for the leading/trailing blanks. */
export function monthCells(year: number, month: number): (number | null)[] {
  const leading = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: Math.ceil((leading + days) / 7) * 7 }, (_, i) => {
    const day = i - leading + 1;
    return day >= 1 && day <= days ? day : null;
  });
}

/** Whole-plan progress; 100 only when every task is done. */
export function planPercent(days: PlanDay[]): number {
  const tasks = days.reduce((sum, d) => sum + d.taskCount, 0);
  const done = days.reduce((sum, d) => sum + d.completedCount, 0);
  if (tasks === 0) return 0;
  return done >= tasks ? 100 : Math.min(99, Math.floor((done / tasks) * 100));
}

/** Opening day: the day we came back to, else today, else the plan's first day. */
export function initialDate(days: PlanDay[], today: string, returnedTo?: string | null): string {
  const has = (date?: string | null) => !!date && days.some((d) => d.date === date);
  if (has(returnedTo)) return returnedTo!;
  return has(today) ? today : (days[0]?.date ?? today);
}

/** Calendar dots: done (green), in progress (amber), scheduled (purple); at most 5. */
export function dayDots(day: PlanDay): ('done' | 'started' | 'scheduled')[] {
  const shown = Math.min(day.taskCount, 5);
  const done = Math.min(day.completedCount, shown);
  const started = Math.min(day.inProgressCount, shown - done);
  return Array.from({ length: shown }, (_, i) => (i < done ? 'done' : i >= shown - started ? 'started' : 'scheduled'));
}

/** Where a task opens in the new app, or null when it can't be opened. */
export function taskHref(exam: string, task: PlanTask): string | null {
  const t = task.target;
  if (!t || !task.isAvailable) return null;
  const course = t.course_id ?? '';
  const chapter = t.module_id ?? '';
  switch (t.type) {
    case 'lecture':
      return routes.lecture(exam, course, chapter, t.lecture_id ?? '');
    case 'lecture_quiz':
    case 'unit_test':
      return routes.boardModule(exam, course, chapter, 'practice');
    case 'notes':
      return routes.notesView(exam, course, chapter);
    case 'summary_video':
      return t.note_id ? routes.summaryVideo(exam, t.note_id) : null;
    case 'pyq':
      return routes.chapterPyqs(exam, course, chapter);
    case 'doubt_solver':
      return routes.doubtSolver(exam);
    case 'custom_test':
      return `${routes.assessments(exam)}?open=custom-test`;
    default:
      return null;
  }
}

export const toSentenceCase = (value: string) => (value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : value);

export function infeasibleCopy(verdict: { message: string | null; minPerDay: number | null }, dailyMinutes: number) {
  const needed = verdict.minPerDay ? Math.ceil(verdict.minPerDay / 30) * 30 : null;
  return {
    body:
      verdict.message ??
      'We cannot create a practical study plan with this information. Please relax your study plan criteria and try again.',
    hint: needed
      ? `This plan needs about ${formatStudyHours(needed)} a day and you chose ${formatStudyHours(dailyMinutes)}. Add more time per day, or move your completion date later.`
      : 'Adjust your topic, timeline, or daily study time so the plan feels more realistic.',
  };
}

/** "DD / MM / YYYY" typing mask. */
export function formatMask(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join(' / ');
}
export function maskToIso(mask: string): string | null {
  const digits = mask.replace(/\D/g, '');
  if (digits.length !== 8) return null;
  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return toIso(date);
}
export const isoToMask = (iso: string) => iso.split('-').reverse().join(' / ');

export const studyPlanApi = {
  async plan(classId: number): Promise<{ plan: PlanHeader | null; days: PlanDay[] }> {
    const body = assertOk(await apiClient.get<Envelope<{ plan?: unknown; days?: unknown }>>(`/api/v1/study-plan/${classId}`));
    return { plan: toHeader(body.data?.plan), days: toDays(body.data?.days) };
  },
  async day(planId: number, date: string): Promise<PlanTask[]> {
    const body = assertOk(await apiClient.get<Envelope<{ tasks?: unknown }>>(`/api/v1/study-plan/day/${planId}/${date}`));
    return toTasks(body.data?.tasks);
  },
  async setTask(taskId: number, status: TaskStatus): Promise<void> {
    assertOk(await apiClient.patch<Envelope<unknown>>(`/api/v1/study-plan/task/${taskId}`, { status }));
  },
  async completeDay(dayId: number): Promise<void> {
    assertOk(await apiClient.patch<Envelope<unknown>>(`/api/v1/study-plan/day/${dayId}/complete`));
  },
  async status(classId: number): Promise<PlanStatus> {
    return toStatus(assertOk(await apiClient.get<Envelope<unknown>>(`/api/v1/study-plan/status/${classId}`)).data);
  },
  async create(input: { classId: number; planType: PlanType; moduleIds: number[]; dailyMinutes: number; targetDate: string }): Promise<CreateResult> {
    const body = await apiClient.post<Envelope<{ feasible?: boolean; plan_id?: number; message?: string; min_per_day?: number }>>(
      '/api/v1/study-plan/create',
      {
        class_id: input.classId,
        plan_type: input.planType,
        module_ids: input.moduleIds,
        daily_minutes: input.dailyMinutes,
        target_date: input.targetDate,
      },
    );
    const data = body?.data;
    if (data?.feasible && data.plan_id) return { feasible: true, planId: data.plan_id };
    return { feasible: false, message: data?.message ?? body?.message ?? null, minPerDay: data?.min_per_day ?? null };
  },
  async journey(classId: number): Promise<Journey | null> {
    return toJourney((await apiClient.get<Envelope<unknown>>(`/api/v1/study-plan/dashboard/${classId}`))?.data);
  },
  /** Chapters (shared with the diagnostic setup). `exam_id` comes from the exam registry. */
  async syllabus(classId: number, examId: number): Promise<{ subjects: SyllabusSubject[]; rules: DiagnosticRules }> {
    const body = assertOk(
      await apiClient.get<Envelope<{ subject_chapter_list?: unknown; rules?: unknown }>>(`/api/v1/diagnostic/subject-chapter-list/${classId}`, {
        params: { exam_id: examId },
      }),
    );
    return { subjects: toSyllabus(body.data?.subject_chapter_list), rules: toRules(body.data?.rules) };
  },
};
