import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { navigation } from '@/test/setup';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import {
  dayDots,
  formatDailyTime,
  formatMask,
  infeasibleCopy,
  initialDate,
  maskToIso,
  monthCells,
  planPercent,
  taskHref,
  toDays,
  toHeader,
  toIso,
  toJourney,
  toStatus,
  toSyllabus,
  toTasks,
} from './api';
import { ChaptersScreen } from './components/chapters-screen';
import { CreatePlanScreen } from './components/create-plan-screen';
import { journeyCopy, JourneyCard } from './components/journey-card';
import { StudyPlanScreen } from './components/study-plan-screen';
import { useStudyPlanDraft } from './draft-store';
import { testExam } from '@/test/exams';

const cbse = testExam('cbse');
const today = toIso(new Date());

const activePlan = http.get(`${API}/api/v4/student/plans/active`, () =>
  HttpResponse.json({ success: true, data: { plans: [{ plan_id: 1, class_id: 12, class_name: 'CLASS 12', duration_months: 12, status: 'active' }] } }),
);

const planBody = (plan: unknown = { plan_id: 5, plan_type: 'revision', status: 'superseded', start_date: today, target_date: '2026-03-31', daily_minutes: 90, total_days: 40, chapter_count: 6 }) => ({
  success: true,
  data: {
    plan,
    days: [
      { day_id: 1, plan_date: today, is_rest_day: false, total_minutes: 90, task_count: 2, completed_count: 1, in_progress_count: 0, is_completed: false },
    ],
  },
});

const tasks = [
  { task_id: 11, task_code: 'L', label: 'Lecture', title: 'ELECTRIC CHARGES', subject_title: 'Physics', status: 'completed', is_completed: true, is_started: true, is_available: true, target: { type: 'lecture', course_id: 3, module_id: 4, lecture_id: 9 } },
  { task_id: 12, task_code: 'DS', label: 'Doubts', title: null, subject_title: null, status: 'todo', is_completed: false, is_started: false, is_available: true, target: null },
];

const syllabusRaw = [
  {
    subject_id: 1,
    subject_name: 'Physics',
    courses: [
      { course_id: 3, course_name: 'Physics Part 1', modules: [{ module_id: 4, module_name: 'ELECTRIC CHARGES', topic_count: 3, is_selectable: true }, { module_id: 5, module_name: 'Current', topic_count: 1, is_selectable: true }] },
      { course_id: 6, course_name: 'Empty', modules: [{ module_id: 7, module_name: 'X', topic_count: 0, is_selectable: false }] },
    ],
  },
  { subject_id: 2, subject_name: 'Nothing', courses: [] },
];

describe('study plan normalisers and helpers', () => {
  it('maps plan, days, tasks, status, syllabus and journey', () => {
    expect(toHeader(null)).toBeNull();
    expect(toHeader({ plan_id: 1, status: 'weird', target_date: '2026-03-31T00:00:00Z' })).toMatchObject({ status: 'active', targetDate: '2026-03-31', planType: 'learning_cum_practice' });
    expect(toDays([{ plan_date: '2026-01-02T00:00Z', task_count: '3' }])[0]).toMatchObject({ date: '2026-01-02', taskCount: 3 });
    const mapped = toTasks(tasks);
    expect(mapped[0]).toMatchObject({ isCompleted: true, target: { type: 'lecture' } });
    expect(toTasks([{ status: 'bogus' }])[0]!.status).toBe('todo');
    expect(toStatus({ can_create: false, allowed_plan_types: ['revision', 'x'], exam_date: '2026-03-01' })).toMatchObject({ canCreate: false, allowedPlanTypes: ['revision'], examDate: '2026-03-01' });
    const subjects = toSyllabus(syllabusRaw);
    expect(subjects).toHaveLength(1);
    expect(subjects[0]).toMatchObject({ moduleCount: 2 });
    expect(toJourney({ state: 'nope' })).toBeNull();
    expect(toJourney({ state: 'tasks_partial', task_count: 4, completed_count: 1, week: [{ date: today, label: 'Mon', task_count: 2, completed_count: 2 }] })).toMatchObject({ taskCount: 4, week: [{ total: 2, done: 2 }] });
  });

  it('builds the calendar and helpers', () => {
    const feb = monthCells(2026, 1);
    expect(feb).toHaveLength(35);
    expect(feb.slice(0, 7)).toEqual([null, null, null, null, null, null, 1]);
    const days = toDays([
      { plan_date: '2026-01-01', task_count: 4, completed_count: 1, in_progress_count: 2 },
      { plan_date: '2026-01-02', task_count: 2, completed_count: 2 },
    ]);
    expect(planPercent(days)).toBe(50);
    expect(planPercent([])).toBe(0);
    expect(planPercent(toDays([{ task_count: 1, completed_count: 1 }]))).toBe(100);
    expect(dayDots(days[0]!)).toEqual(['done', 'scheduled', 'started', 'started']);
    expect(initialDate(days, '2026-01-02', '2026-01-01')).toBe('2026-01-01');
    expect(initialDate(days, '2026-01-02', null)).toBe('2026-01-02');
    expect(initialDate(days, '2030-01-01', 'x')).toBe('2026-01-01');
    expect(formatDailyTime(45)).toBe('45 min');
    expect(formatDailyTime(90)).toBe('1.5 hrs');
    expect(formatMask('31122026')).toBe('31 / 12 / 2026');
    expect(maskToIso('31 / 12 / 2026')).toBe('2026-12-31');
    expect(maskToIso('31 / 02 / 2026')).toBeNull();
    expect(maskToIso('12')).toBeNull();
    expect(infeasibleCopy({ message: null, minPerDay: 100 }, 60).hint).toContain('about 2 hrs a day and you chose 1 hr');
    expect(infeasibleCopy({ message: 'Too much', minPerDay: null }, 60)).toMatchObject({ body: 'Too much' });
  });

  it('maps tasks to new-app links', () => {
    const [lecture] = toTasks(tasks);
    expect(taskHref('cbse', lecture!)).toBe('/cbse/learn/3/4/lecture/9');
    const make = (target: Record<string, unknown> | null, available = true) => toTasks([{ target, is_available: available }])[0]!;
    expect(taskHref('cbse', make({ type: 'unit_test', course_id: 1, module_id: 2 }))).toBe('/cbse/learn/1/2?tab=practice');
    expect(taskHref('cbse', make({ type: 'notes', course_id: 1, module_id: 2 }))).toBe('/cbse/notes/1?module_id=2');
    expect(taskHref('cbse', make({ type: 'summary_video', note_id: 8 }))).toBe('/cbse/notes/video/8');
    expect(taskHref('cbse', make({ type: 'summary_video' }))).toBeNull();
    expect(taskHref('cbse', make({ type: 'pyq', course_id: 1, module_id: 2 }))).toBe('/cbse/learn/1/2/pyqs');
    expect(taskHref('cbse', make({ type: 'doubt_solver' }))).toBe('/cbse/doubt-solver');
    expect(taskHref('cbse', make({ type: 'custom_test' }))).toBe('/cbse/assessments?open=custom-test');
    expect(taskHref('cbse', make({ type: 'other' }))).toBeNull();
    expect(taskHref('cbse', make({ type: 'lecture' }, false))).toBeNull();
    expect(taskHref('cbse', make(null))).toBeNull();
  });

  it('maps every journey state to copy', () => {
    const states = ['take_diagnostic', 'resume_diagnostic', 'build_plan', 'weekly_progress', 'tasks_partial', 'tasks_done', 'rest_day', 'catch_up', 'halfway', 'plan_complete', 'plan_ended'];
    for (const state of states) expect(journeyCopy(toJourney({ state, assessment_id: 3, can_retake_diagnostic: true })!, 'cbse')).not.toBeNull();
    expect(journeyCopy(toJourney({ state: 'resume_diagnostic', assessment_id: 3 })!, 'cbse')!.href).toBe('/cbse/diagnostic-test/3');
    expect(journeyCopy(toJourney({ state: 'resume_diagnostic' })!, 'cbse')!.href).toBe('/cbse/diagnostic');
  });
});

describe('StudyPlanScreen', () => {
  it('shows the plan, the day and toggles a task', async () => {
    const patched: unknown[] = [];
    server.use(
      activePlan,
      http.get(`${API}/api/v1/study-plan/12`, () => HttpResponse.json(planBody())),
      http.get(`${API}/api/v1/study-plan/day/5/${today}`, () => HttpResponse.json({ success: true, data: { tasks } })),
      http.patch(`${API}/api/v1/study-plan/task/:id`, async ({ request, params }) => {
        patched.push({ id: params.id, ...((await request.json()) as object) });
        return HttpResponse.json({ success: true });
      }),
      http.patch(`${API}/api/v1/study-plan/day/1/complete`, () => {
        patched.push('day');
        return HttpResponse.json({ success: true });
      }),
    );
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    renderWithProviders(<StudyPlanScreen />, { exam: cbse });
    expect(await screen.findByText('Your Study Plan at a Glance')).toBeInTheDocument();
    expect(screen.getByText(/This plan was replaced/)).toBeInTheDocument();
    expect(screen.getByText('1.5 hrs')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(await screen.findByText('Lecture · Electric charges')).toBeInTheDocument();
    expect(screen.getByText('Solve Doubts with Socrates')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: /Solve Doubts with Socrates done/ }));
    await waitFor(() => expect(patched).toContainEqual({ id: '12', status: 'completed' }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Electric charges not done/ }));
    await waitFor(() => expect(patched).toContainEqual({ id: '11', status: 'in_progress' }));
    await userEvent.click(screen.getByText('Lecture · Electric charges'));
    expect(open).toHaveBeenCalledWith('/cbse/learn/3/4/lecture/9', '_blank', 'noopener');
    await userEvent.click(screen.getByRole('button', { name: 'Mark Day as Completed' }));
    await waitFor(() => expect(patched).toContain('day'));
    await userEvent.click(screen.getByRole('button', { name: 'Next month' }));
  });

  it('offers to build a plan when there is none', async () => {
    server.use(activePlan, http.get(`${API}/api/v1/study-plan/12`, () => HttpResponse.json({ success: true, data: { plan: null, days: [] } })));
    renderWithProviders(<StudyPlanScreen />, { exam: cbse });
    expect(await screen.findByRole('link', { name: 'Build my study plan' })).toHaveAttribute('href', '/cbse/study-plan/chapters');
  });

  it('shows an error', async () => {
    server.use(activePlan, http.get(`${API}/api/v1/study-plan/12`, () => HttpResponse.json({ message: 'x' }, { status: 500 })));
    renderWithProviders(<StudyPlanScreen />, { exam: cbse });
    expect(await screen.findByText("Couldn't load your plan")).toBeInTheDocument();
  });
});

describe('creating a study plan', () => {
  beforeEach(() => useStudyPlanDraft.getState().clear());

  it('picks chapters, answers 3 questions and builds the plan', async () => {
    let created: Record<string, unknown> | null = null;
    server.use(
      activePlan,
      http.get(`${API}/api/v1/diagnostic/subject-chapter-list/12`, ({ request }) => {
        expect(new URL(request.url).searchParams.get('exam_id')).toBe('1');
        return HttpResponse.json({ success: true, data: { subject_chapter_list: syllabusRaw } });
      }),
      http.get(`${API}/api/v1/study-plan/status/12`, () =>
        HttpResponse.json({ success: true, data: { state: 'ready', can_create: true, allowed_plan_types: ['learning_cum_practice', 'revision'] } }),
      ),
      http.post(`${API}/api/v1/study-plan/create`, async ({ request }) => {
        created = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ success: true, data: { feasible: true, plan_id: 9 } });
      }),
    );
    const chapters = renderWithProviders(<ChaptersScreen />, { exam: cbse });
    await userEvent.click(await screen.findByRole('button', { name: /Physics/ }));
    const rows = screen.getAllByRole('button', { name: /Chapter 1 · Electric charges/ });
    await userEvent.click(rows[0]!);
    expect(screen.getAllByText('1 selected').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /Build/ })[0]).toHaveAttribute('href', '/cbse/study-plan/create');
    chapters.unmount();

    renderWithProviders(<CreatePlanScreen />, { exam: cbse });
    expect(await screen.findByText('Question 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    await userEvent.click(screen.getByRole('radio', { name: /Revise/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await userEvent.click(screen.getByRole('button', { name: 'Increase by 30 minutes' }));
    expect(screen.getByText('1.5 hrs', { selector: '[aria-live]' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('button', { name: 'Build my Plan' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Target/), '01011999');
    expect(screen.getByText(/That date isn't valid/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Open calendar' }));
    const picker = screen.getByRole('dialog', { name: 'Choose a date' });
    await userEvent.click(within(picker).getByRole('button', { name: 'Next month' }));
    const day = within(picker).getAllByRole('button').find((b) => /^\d{4}-/.test(b.getAttribute('aria-label') ?? '') && !b.hasAttribute('disabled'))!;
    const iso = day.getAttribute('aria-label');
    await userEvent.click(day);
    await userEvent.click(screen.getByRole('button', { name: 'Build my Plan' }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/cbse/study-plan'));
    expect(created).toEqual({ class_id: 12, plan_type: 'revision', module_ids: [4], daily_minutes: 90, target_date: iso });
  });

  it('shows the infeasible plan error and lets the student adjust', async () => {
    useStudyPlanDraft.getState().setDraft(12, [4]);
    server.use(
      activePlan,
      http.get(`${API}/api/v1/study-plan/status/12`, () => HttpResponse.json({ success: true, data: { can_create: true, allowed_plan_types: ['revision'] } })),
      http.post(`${API}/api/v1/study-plan/create`, () => HttpResponse.json({ success: true, data: { feasible: false, min_per_day: 150 } })),
    );
    renderWithProviders(<CreatePlanScreen />, { exam: cbse });
    expect(await screen.findByText(/only Revise is available/)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Learn & Practice/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    const max = new Date();
    max.setDate(max.getDate() + 10);
    const pad = (n: number) => String(n).padStart(2, '0');
    await userEvent.type(screen.getByLabelText(/Target/), `${pad(max.getDate())}${pad(max.getMonth() + 1)}${max.getFullYear()}`);
    await userEvent.click(screen.getByRole('button', { name: 'Build my Plan' }));
    expect(await screen.findByText("We couldn't build your Study plan")).toBeInTheDocument();
    expect(screen.getByText(/needs about 2.5 hrs a day and you chose 1 hr/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Adjust plan criteria' }));
    expect(screen.getByText('Question 2 of 3')).toBeInTheDocument();
  });

  it('blocks building without a fresh diagnostic', async () => {
    useStudyPlanDraft.getState().setDraft(12, [4]);
    server.use(
      activePlan,
      http.get(`${API}/api/v1/study-plan/status/12`, () => HttpResponse.json({ success: true, data: { state: 'diagnostic_used', can_create: false } })),
    );
    renderWithProviders(<CreatePlanScreen />, { exam: cbse });
    expect(await screen.findByRole('link', { name: 'Take a new test' })).toHaveAttribute('href', '/cbse/diagnostic');
  });

  it('asks for chapters first', async () => {
    server.use(activePlan);
    renderWithProviders(<CreatePlanScreen />, { exam: cbse });
    expect(await screen.findByRole('link', { name: 'Choose chapters' })).toHaveAttribute('href', '/cbse/study-plan/chapters');
  });
});

describe('JourneyCard', () => {
  it('shows the next step from the dashboard endpoint', async () => {
    server.use(
      activePlan,
      http.get(`${API}/api/v1/study-plan/dashboard/12`, () =>
        HttpResponse.json({ success: true, data: { state: 'weekly_progress', week: [{ date: today, label: 'Mon', task_count: 2, completed_count: 1, is_today: true }] } }),
      ),
    );
    renderWithProviders(<JourneyCard />, { exam: cbse });
    expect(await screen.findByRole('link', { name: /Start today's tasks/ })).toHaveAttribute('href', '/cbse/study-plan');
    expect(screen.getByText('1/2')).toBeInTheDocument();
  });

  it('renders nothing without journey data', async () => {
    server.use(activePlan, http.get(`${API}/api/v1/study-plan/dashboard/12`, () => HttpResponse.json({ success: true, data: null })));
    const { container } = renderWithProviders(<JourneyCard />, { exam: cbse });
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
