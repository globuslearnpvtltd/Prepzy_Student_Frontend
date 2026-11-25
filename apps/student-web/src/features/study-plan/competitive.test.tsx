import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { testExam } from '@/test/exams';
import { isFutureDay, taskHref, toIso, toStatus, toTasks, unlockMessage } from './api';
import { ChaptersScreen } from './components/chapters-screen';
import { CreatePlanScreen } from './components/create-plan-screen';
import { journeyCopy } from './components/journey-card';
import { StudyPlanScreen } from './components/study-plan-screen';
import { keepPicksForReturn, useStudyPlanDraft } from './draft-store';

// Competitive (NEET) study plan: chapter-step links, locked future days, NEET copy and chapter picker.

const neet = testExam('neet');
const today = toIso(new Date());
const inDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return toIso(d);
};

const neetPlan = http.get(`${API}/api/v4/student/plans/active`, () =>
  HttpResponse.json({ success: true, data: { plans: [{ plan_id: 1, class_id: 20, class_name: 'NEET', duration_months: 12, status: 'active' }] } }),
);

const make = (target: Record<string, unknown> | null, available = true) => toTasks([{ target, is_available: available }])[0]!;

describe('competitive task links', () => {
  it('opens the chapter step pages, solver, custom test and daily practice', () => {
    const href = (target: Record<string, unknown>) => taskHref('neet', make(target), 'competitive');
    expect(href({ type: 'summary_video', course_id: 1, module_id: 2, has_content: false })).toBe('/neet/learn/1/2/video-lectures');
    expect(href({ type: 'notes', course_id: 1, module_id: 2 })).toBe('/neet/learn/1/2/study-notes');
    expect(href({ type: 'unit_test', course_id: 1, module_id: 2 })).toBe('/neet/learn/1/2/practice-questions');
    expect(href({ type: 'pyq', course_id: 1, module_id: 2 })).toBe('/neet/learn/1/2/chapter-pyq');
    expect(href({ type: 'doubt_solver' })).toBe('/neet/doubt-solver');
    expect(href({ type: 'custom_test' })).toBe('/neet/custom-test');
    expect(href({ type: 'dpp' })).toBe('/neet/daily-practice');
    // No per-lecture page, no chapter without a course, nothing for review-type tasks.
    expect(href({ type: 'lecture', course_id: 1, module_id: 2, lecture_id: 3 })).toBeNull();
    expect(href({ type: 'notes', module_id: 2 })).toBeNull();
    expect(href({ type: 'review' })).toBeNull();
    expect(taskHref('neet', make({ type: 'notes', course_id: 1, module_id: 2 }, false), 'competitive')).toBeNull();
    // Board links are unchanged.
    expect(taskHref('cbse', make({ type: 'notes', course_id: 1, module_id: 2 }))).toBe('/cbse/notes/1?module_id=2');
  });

  it('knows future days, the unlock message and the revise-only window label', () => {
    expect(isFutureDay('2026-03-06', '2026-03-05')).toBe(true);
    expect(isFutureDay('2026-03-05', '2026-03-05')).toBe(false);
    expect(unlockMessage('2026-03-06')).toBe('These tasks unlock on 6 Mar. You can complete them on that day.');
    expect(toStatus({ revision_window_from: '1 March' }).revisionWindowFrom).toBe('1 March');
    expect(toStatus({}).revisionWindowFrom).toBeNull();
  });

  it('invites building a plan once the diagnostic is done', () => {
    const data = { state: 'build_plan', width: 'full', week: [] } as unknown as Parameters<typeof journeyCopy>[0];
    expect(journeyCopy(data, 'neet', 'competitive')).toMatchObject({
      lead: 'Your diagnostic test is done',
      hand: 'BUILD YOUR STUDY PLAN!',
      href: '/neet/study-plan/chapters',
    });
    expect(journeyCopy(data, 'cbse')).toMatchObject({ hand: 'STUDY PLAN IS READY!' });
  });
});

describe('competitive StudyPlanScreen', () => {
  const planWith = (date: string) =>
    http.get(`${API}/api/v4/study-plan/classes/20`, () =>
      HttpResponse.json({
        success: true,
        data: {
          plan: { plan_id: 5, plan_type: 'learning_cum_practice', status: 'active', start_date: date, target_date: inDays(30), daily_minutes: 60, total_days: 30, chapter_count: 3 },
          days: [{ day_id: 1, plan_date: date, is_rest_day: false, total_minutes: 60, task_count: 1, completed_count: 0, in_progress_count: 0, is_completed: false }],
        },
      }),
    );
  const dayTasks = (date: string) =>
    http.get(`${API}/api/v4/study-plan/plans/5/days/${date}`, () =>
      HttpResponse.json({
        success: true,
        data: {
          tasks: [
            {
              task_id: 21,
              task_code: 'SN',
              label: 'Study notes (Part 1 of 2)',
              title: 'CELL BIOLOGY',
              subject_title: 'NEET-BOTANY',
              status: 'todo',
              is_completed: false,
              is_started: false,
              is_available: true,
              target: { type: 'notes', course_id: 7, module_id: 8, note_id: 3 },
            },
          ],
        },
      }),
    );

  it('opens a future day’s task but does not let it be completed', async () => {
    const future = inDays(3);
    const patched: unknown[] = [];
    server.use(
      neetPlan,
      planWith(future),
      dayTasks(future),
      http.patch(`${API}/api/v4/study-plan/tasks/:id`, async ({ request }) => {
        patched.push(await request.json());
        return HttpResponse.json({ success: true });
      }),
      http.patch(`${API}/api/v4/study-plan/days/:id/complete`, () => {
        patched.push('day');
        return HttpResponse.json({ success: true });
      }),
    );
    const warn = vi.spyOn(toast, 'error');
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    renderWithProviders(<StudyPlanScreen />, { exam: neet });

    const title = await screen.findByText('Study notes (Part 1 of 2) · Cell biology');
    await userEvent.click(screen.getByRole('checkbox', { name: /Cell biology done/ }));
    expect(warn).toHaveBeenCalledWith(unlockMessage(future), { id: 'study-plan-future-day' });

    await userEvent.click(title);
    expect(open).toHaveBeenCalledWith('/neet/learn/7/8/study-notes', '_blank', 'noopener');

    await userEvent.click(screen.getByRole('button', { name: 'Mark Day as Completed' }));
    expect(warn).toHaveBeenCalledTimes(2);
    // Nothing was sent: not completed, and opening a future task doesn't start it either.
    await new Promise((r) => setTimeout(r, 50));
    expect(patched).toEqual([]);
  });

  it('shows the server’s refusal when a task can’t be completed', async () => {
    server.use(
      neetPlan,
      planWith(today),
      dayTasks(today),
      http.patch(`${API}/api/v4/study-plan/tasks/:id`, () =>
        HttpResponse.json(
          { success: false, code: 'PLAN_DAY_NOT_STARTED', message: 'This task is scheduled for later; you can complete it on that day.' },
          { status: 409 },
        ),
      ),
    );
    const warn = vi.spyOn(toast, 'error');
    renderWithProviders(<StudyPlanScreen />, { exam: neet });
    await screen.findByText('Study notes (Part 1 of 2) · Cell biology');
    await userEvent.click(screen.getByRole('checkbox', { name: /Cell biology done/ }));
    await waitFor(() =>
      expect(warn).toHaveBeenCalledWith('This task is scheduled for later; you can complete it on that day.', { id: 'study-plan-error' }),
    );
  });
});

describe('competitive chapter picker and create flow', () => {
  beforeEach(() => useStudyPlanDraft.getState().clear());

  const syllabus = http.get(`${API}/api/v4/diagnostic/competitive/${neet.examId}/classes/20/chapters`, () =>
    HttpResponse.json({
      success: true,
      data: {
        subject_chapter_list: [
          {
            subject_id: 1,
            subject_name: 'NEET-PHYSICS',
            courses: [
              {
                course_id: 3,
                course_name: 'Physics',
                modules: [
                  { module_id: 4, module_name: 'KINEMATICS', topic_count: 6, is_selectable: true, topics: [] },
                  { module_id: 5, module_name: 'OPTICS', topic_count: 2, is_selectable: true, topics: [] },
                ],
              },
            ],
          },
        ],
        rules: { min_chapters_total: 5, max_chapters_per_subject: 5 },
      },
    }),
  );

  it('shows topics in NEET wording, without topic counts, and goes back to the dashboard', async () => {
    server.use(neetPlan, syllabus);
    renderWithProviders(<ChaptersScreen />, { exam: neet });
    expect(await screen.findByRole('heading', { name: 'Choose topics for your study plan' })).toBeInTheDocument();
    for (const back of screen.getAllByRole('link', { name: /back/i })) expect(back).toHaveAttribute('href', '/neet/dashboard');
    const subject = screen.getByRole('button', { name: /Physics/ });
    expect(subject).not.toHaveTextContent('NEET');
    await userEvent.click(subject);
    // Desktop topic card: no chapter number; no topic count anywhere.
    const card = screen.getByRole('button', { name: 'Kinematics' });
    expect(screen.queryByText(/\d+ topics?$/)).not.toBeInTheDocument();
    await userEvent.click(card);
    expect(useStudyPlanDraft.getState().moduleIds).toEqual([4]);
    expect(screen.getAllByRole('button', { name: /Kinematics/, pressed: true }).length).toBeGreaterThan(0);
  });

  it('starts with nothing picked on a new visit (e.g. dashboard and back)', async () => {
    useStudyPlanDraft.getState().setDraft(20, [4]);
    server.use(neetPlan, syllabus);
    renderWithProviders(<ChaptersScreen />, { exam: neet });
    await screen.findByRole('heading', { name: 'Choose topics for your study plan' });
    await waitFor(() => expect(useStudyPlanDraft.getState().moduleIds).toEqual([]));
  });

  it('keeps the picks when the student steps back from the create step', async () => {
    useStudyPlanDraft.getState().setDraft(20, [4]);
    keepPicksForReturn();
    server.use(neetPlan, syllabus);
    renderWithProviders(<ChaptersScreen />, { exam: neet });
    await screen.findByRole('heading', { name: 'Choose topics for your study plan' });
    expect(useStudyPlanDraft.getState().moduleIds).toEqual([4]);
  });

  it('has no revise-only note on the first create step', async () => {
    useStudyPlanDraft.getState().setDraft(20, [4]);
    server.use(
      neetPlan,
      http.get(`${API}/api/v4/study-plan/classes/20/status`, () =>
        HttpResponse.json({
          success: true,
          data: { state: 'available', can_create: true, allowed_plan_types: ['learning_cum_practice', 'revision'], revision_window_from: '1 March' },
        }),
      ),
    );
    renderWithProviders(<CreatePlanScreen />, { exam: neet });
    expect(await screen.findByText('Learn & Practice Concepts')).toBeInTheDocument();
    expect(screen.queryByText('How your plan will change')).not.toBeInTheDocument();
  });
});
