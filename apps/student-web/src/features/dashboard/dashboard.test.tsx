import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { getExam } from '@/shared/config/exams';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { formatHours, syllabusCards, toActivity, weeklyAverage } from './api';
import { daysUntil, planCopy, planState } from './board-widgets';
import { untilMidnight } from './competitive-widgets';
import { Dashboard, DASHBOARD_WIDGETS } from './dashboard';
import { toBars } from './performance-widgets';
import { boardSubjectArt, competitiveSubjectArt } from './subject-art';

const cbse = getExam('cbse')!;
const neet = getExam('neet')!;

const plan = (classId: number, extra: Record<string, unknown> = {}) =>
  http.get(`${API}/api/v1/student/plans/active`, () =>
    HttpResponse.json({
      success: true,
      data: {
        plans: [
          {
            plan_id: 1,
            class_id: classId,
            class_name: classId === 20 ? 'NEET' : 'CLASS 12',
            stream_name: classId === 20 ? '' : 'PCB',
            duration_months: 12,
            expiry_date: '2099-03-31',
            status: 'active',
            ...extra,
          },
        ],
      },
    }),
  );

const account = (extra: Record<string, unknown> = {}) =>
  http.get(`${API}/api/accounts`, () =>
    HttpResponse.json({ success: true, data: { account_id: 1, first_name: 'Meera', last_name: 'Shah', ...extra } }),
  );

const graph = (classId: number, rows = [{ subject: 'Biology', thisAttempt: 80, lastAttempt: 70 }]) =>
  http.get(`${API}/api/v1/student/getsubjectGraphData/${classId}`, () =>
    HttpResponse.json({ success: true, data: { overall_percent: 72.6, result_data: rows } }),
  );

const week = { Monday: 1, Tuesday: 2.5, Sunday: 0.5 };

function boardHandlers(overrides: { courses?: unknown[]; exams?: unknown[]; subjects?: unknown; referral?: unknown } = {}) {
  return [
    plan(12),
    account(),
    graph(12),
    http.get(`${API}/api/v1/student/fetchLearnerBoardData/class`, () =>
      HttpResponse.json({
        success: true,
        data: { week_activity: week, profileProgress: { name: 'MS', image: null, completion_percentage: 40 } },
      }),
    ),
    http.get(`${API}/api/v1/student/continue-dashboard-courses/12`, () =>
      HttpResponse.json({
        success: true,
        data: {
          courses: overrides.courses ?? [
            { course_id: 5, course_name: 'Electrostatics', class_name: 'CLASS 12', subject_name: 'PHYSICS', image: 'null', progress_percentage: 30 },
          ],
        },
      }),
    ),
    http.get(`${API}/api/v1/student/continue-dashboard-exams/12`, () =>
      HttpResponse.json({
        success: true,
        data: {
          exams: overrides.exams ?? [
            { set_id: 8, set_number: 2, exam_type: 'mock', progress_percentage: 40, class_name: 'Class 12' },
            { set_id: 9, set_number: 2019, exam_type: 'final', progress_percentage: 10, class_name: 'Class 12' },
          ],
        },
      }),
    ),
    http.get(`${API}/api/v1/student/classes/12/subjects`, () =>
      overrides.subjects === 'error'
        ? HttpResponse.json({ message: 'boom' }, { status: 500 })
        : HttpResponse.json({
            success: true,
            data: {
              subjects: ['Physics', 'Chemistry', 'Biology', 'English'].map((name, i) => ({
                subject_id: i + 1,
                subject_name: name,
                course_count: 2,
                module_count: 14,
              })),
            },
          }),
    ),
    http.get(`${API}/api/referral/me`, () =>
      HttpResponse.json(overrides.referral ?? { success: true, data: { balance: 120, friendCount: 0, tier: 'free' } }),
    ),
  ];
}

describe('board dashboard (CBSE)', () => {
  it('renders the previous composition from API data', async () => {
    server.use(...boardHandlers());
    renderWithProviders(<Dashboard />, { exam: cbse });

    expect(await screen.findByText('High daily limits, valid till 31 Mar 2099')).toBeInTheDocument();
    expect(screen.getByText('Topper Academic Year')).toBeInTheDocument();

    const learning = await screen.findByRole('region', { name: 'Continue Learning' });
    // No resume point yet, so the card opens the course (its first chapter).
    expect(within(learning).getByRole('link', { name: /Electrostatics/ })).toHaveAttribute('href', '/cbse/learn/5');
    expect(within(learning).getByText('Physics')).toBeInTheDocument();
    expect(within(learning).getByRole('progressbar', { name: 'Electrostatics progress' })).toHaveAttribute('aria-valuenow', '30');

    const tests = await screen.findByRole('region', { name: 'Continue your Assessment' });
    // Mock and final papers resume in the exam player.
    expect(within(tests).getByRole('link', { name: /Resume Mock Exam/ })).toHaveAttribute('href', '/cbse/tests/mock/8');
    expect(within(tests).getByRole('link', { name: /Resume Course Test/ })).toHaveAttribute('href', '/cbse/tests/final/9');
    expect(within(tests).getByRole('link', { name: 'View All Tests' })).toHaveAttribute('href', '/cbse/assessments');

    const subjects = await screen.findByRole('region', { name: 'My Subjects' });
    expect(within(subjects).getAllByText('2 Books')).toHaveLength(4);
    expect(within(subjects).getByRole('button', { name: /Physics/ }).querySelector('img')).toHaveAttribute(
      'src',
      '/illustrations/subjects/board-physics.svg',
    );

    expect(await screen.findByText('1h 20m')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Learning hours per day this week' })).toHaveTextContent('Tuesday2h 30m');
    expect(await screen.findByText('72%')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /last and current attempt/ })).toHaveTextContent('Biology70%80%');

    // Right column
    expect(await screen.findByText('Hey Meera Shah')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Profile completion' })).toHaveAttribute('aria-valuenow', '40');
    expect(screen.getByRole('link', { name: 'Start Solving' })).toHaveAttribute('href', '/cbse/doubt-solver');
    expect(screen.getByRole('link', { name: 'Use Atlas.' })).toHaveAttribute('href', '/cbse/dashboard?atlas=1');
    expect(screen.getByRole('link', { name: 'Add parent details' })).toHaveAttribute('href', '/cbse/profile');
    expect(await screen.findByRole('link', { name: /Invite friends, earn credits/ })).toHaveAttribute(
      'href',
      '/cbse/refer-and-earn',
    );
    expect(screen.getByRole('link', { name: /View Syllabus/ })).toHaveAttribute('href', '/cbse/syllabus');
    expect(screen.getByRole('link', { name: 'View Trend Analysis' })).toHaveAttribute('href', '/cbse/pyq-trends');
  });

  it('expands the plan banner and shows the full plan details', async () => {
    server.use(...boardHandlers());
    renderWithProviders(<Dashboard />, { exam: cbse });
    await userEvent.click(await screen.findByRole('button', { name: 'Show plan details' }));
    expect(screen.getByText('Welcome back! Topper Academic Year is active, with high daily limits.')).toBeInTheDocument();
    expect(screen.getByText('Plan valid till 31 Mar 2099')).toBeInTheDocument();
  });

  it('hides empty sections and keeps the rest working when one endpoint fails', async () => {
    server.use(...boardHandlers({ courses: [], exams: [], subjects: 'error', referral: { success: false } }));
    renderWithProviders(<Dashboard />, { exam: cbse });
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to fetch subjects');
    expect(await screen.findByText('72%')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Continue Learning' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Continue your Assessment' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Invite friends/)).not.toBeInTheDocument();
  });

  it('shows the empty chart state when there is no score data', async () => {
    server.use(graph(12, []), ...boardHandlers());
    renderWithProviders(<Dashboard />, { exam: cbse });
    expect(await screen.findAllByText('Your Data will appear here!')).toHaveLength(1);
  });

  it('offers an upgrade on the Basic plan', async () => {
    server.use(plan(12, { duration_months: 0 }), ...boardHandlers());
    renderWithProviders(<Dashboard />, { exam: cbse });
    expect(await screen.findByText('Basic plan')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Upgrade Plan' })).toHaveAttribute('href', '/cbse/plans');
  });
});

function neetHandlers(dpp: unknown = { dpp: { dpp_id: 9, dpp_name: 'DPP #14' }, questionCount: 15, attempted_questions: 3, subjects: [{ subject_name: 'NEET-PHYSICS' }], attempt: null }) {
  return [
    plan(20),
    account({ gender: 'female' }),
    graph(20),
    http.get(`${API}/api/neet/subject-progress`, () =>
      HttpResponse.json({
        success: true,
        data: [
          { subject_name: 'NEET-Botany', completed_chapters: 4, total_chapters: 10, progress_percentage: 40, course_ids: '[7]' },
        ],
      }),
    ),
    http.get(`${API}/api/neet/get-live-dpp-neet`, () => HttpResponse.json({ success: true, data: dpp })),
    http.get(`${API}/api/neet/weekly-activity/class`, () => HttpResponse.json({ success: true, data: week })),
  ];
}

describe('board dashboard without a plan', () => {
  const freeHandlers = () => [
    http.get(`${API}/api/v1/student/plans/active`, () => HttpResponse.json({ success: true, data: { plans: [] } })),
    account(),
    http.get(`${API}/api/v1/student/free-courses`, () =>
      HttpResponse.json({
        success: true,
        data: {
          free_courses: [
            { course_id: 31, title: 'Physics Part 1', class_name: 'CLASS 12', subject_name: 'Physics', image: 'null', unique_lecture: 24, assessment_count: 6 },
          ],
        },
      }),
    ),
    http.get(`${API}/api/v1/student/pyq-subject-list`, () =>
      HttpResponse.json({ success: true, data: { pyq: [{ year: 2025, subject: 4, title: 'SOCIAL SCIENCE STUDIES', image: '', class: 'CLASS 12' }] } }),
    ),
  ];

  it('shows free courses, locked PYQ papers, empty charts and the plan banner', async () => {
    server.use(...freeHandlers());
    const user = userEvent.setup();
    renderWithProviders(<Dashboard />, { exam: cbse });

    const free = await screen.findByRole('region', { name: 'My Free Courses' });
    expect(await within(free).findByRole('link', { name: /Physics Part 1/ })).toHaveAttribute('href', '/cbse/learn/31');
    expect(within(free).getByText('24 Lessons - 6 Tests')).toBeInTheDocument();
    expect(free.querySelector('img')).toHaveAttribute('src', '/illustrations/dashboard/free-course.jpg');
    expect(screen.queryByRole('region', { name: 'My Subjects' })).not.toBeInTheDocument();

    const ready = await screen.findByRole('region', { name: 'Get Ready For Your Exams' });
    expect(await within(ready).findByText('SOCIAL SCIENCE...')).toBeInTheDocument();
    const banner = screen.getByRole('region', { name: 'Choose your plan' });
    expect(within(banner).getByRole('link', { name: 'Upgrade Now' })).toHaveAttribute('href', '/cbse/plans');
    expect(screen.getAllByText('Your Data will appear here!')).toHaveLength(2);
    await user.click(within(ready).getByRole('button', { name: /Start Now/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Upgrade your Plan' });
    expect(within(dialog).getByRole('link', { name: /Upgrade Now/ })).toHaveAttribute('href', '/cbse/plans');
  });

  it('hides the free-plan widgets for a student with a plan', async () => {
    server.use(...boardHandlers());
    renderWithProviders(<Dashboard />, { exam: cbse });
    expect(await screen.findByRole('region', { name: 'My Subjects' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'My Free Courses' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Get Ready For Your Exams' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Choose your plan' })).not.toBeInTheDocument();
  });
});

describe('competitive dashboard (NEET)', () => {
  it('renders welcome, subject progress, today’s DPP, Ask Socrates and performance', async () => {
    server.use(...neetHandlers());
    renderWithProviders(<Dashboard />, { exam: neet });

    expect(await screen.findByRole('heading', { name: 'Meera Shah' })).toBeInTheDocument();
    expect(screen.getByTestId('doctor')).toHaveAttribute('data-gender', 'female');

    const botany = await screen.findByRole('link', { name: /Botany/ });
    expect(botany).toHaveAttribute('href', '/neet/learn/7');
    expect(within(botany).getByRole('img', { name: 'Botany progress: 40%' })).toBeInTheDocument();
    expect(within(botany).getByText('4/10')).toBeInTheDocument();

    expect(await screen.findByText('Day 14')).toBeInTheDocument();
    expect(screen.getByText('3 / 15')).toBeInTheDocument();
    expect(screen.getByText('Physics')).toBeInTheDocument();
    expect(screen.getByRole('timer')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start Now' })).toHaveAttribute('href', '/neet/tests/dpp/9');

    expect(screen.getByRole('heading', { name: 'Ask Socrates' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start Solving' })).toHaveAttribute('href', '/neet/doubt-solver');
    expect(await screen.findByText('1h 20m')).toBeInTheDocument();
    expect(screen.getByText('All scores shown are rounded off.')).toBeInTheDocument();
  });

  it('links to the result once today’s DPP is submitted', async () => {
    server.use(
      ...neetHandlers({ dpp: { dpp_id: 9, dpp_name: 'DPP' }, questionCount: 15, attempted_questions: 15, attempt: { status: 'submitted', attempt_id: 77 } }),
    );
    renderWithProviders(<Dashboard />, { exam: neet });
    expect(await screen.findByRole('link', { name: 'View Results' })).toHaveAttribute('href', '/neet/tests/dpp/result/77');
    expect(screen.getByText('Attempted')).toBeInTheDocument();
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  });

  it('explains when there is no paper today and lets the student dismiss the welcome card', async () => {
    server.use(...neetHandlers({ dpp: null }));
    renderWithProviders(<Dashboard />, { exam: neet });
    expect(await screen.findByText(/no practice paper today/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Daily Practice' })).toHaveAttribute('href', '/neet/daily-practice');
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('heading', { name: 'Meera Shah' })).not.toBeInTheDocument();
  });
});

describe('dashboard logic', () => {
  it('has a layout per category', () => {
    expect(DASHBOARD_WIDGETS.board.columns).toHaveLength(2);
    expect(DASHBOARD_WIDGETS.competitive.columns).toHaveLength(2);
    expect(DASHBOARD_WIDGETS.reference.columns).toHaveLength(0);
  });

  it('accepts both activity shapes and formats hours', () => {
    expect(toActivity({ Mon: '1.5' })).toEqual([{ day: 'Mon', hours: 1.5 }]);
    expect(toActivity([{ day: 'Tue', hours: 2 }])).toEqual([{ day: 'Tue', hours: 2 }]);
    expect(toActivity(null)).toEqual([]);
    expect(formatHours(1.5)).toBe('1h 30m');
    expect(formatHours(1.999)).toBe('2h 0m');
    expect(weeklyAverage([])).toBe(0);
  });

  it('labels bars like the previous charts', () => {
    const days = toActivity({ Monday: 1, Tuesday: 2, Today: 1 });
    expect(toBars(days, 'initial').map((b) => b.label)).toEqual(['M', 'T', 'Today']);
    expect(toBars(days, 'alternate').map((b) => b.label)).toEqual(['Monday', '', 'Today']);
  });

  it('shows syllabus / trends by class', () => {
    expect(syllabusCards('CLASS 12')).toEqual({ syllabus: true, trends: true });
    expect(syllabusCards('Class 11')).toEqual({ syllabus: true, trends: false });
    expect(syllabusCards('Class 8')).toEqual({ syllabus: false, trends: false });
    expect(syllabusCards(null)).toEqual({ syllabus: false, trends: false });
  });

  it('works out the plan banner state', () => {
    const now = new Date('2026-11-04T10:00:00');
    const base = { planId: 1, examId: 1, classId: 12, className: 'CLASS 12', streamName: '', status: 'active', relatedExams: [], year: null };
    expect(daysUntil('2026-11-10', now)).toBe(6);
    expect(daysUntil(null, now)).toBe(0);
    expect(planState({ durationMonths: 0 }, 5)).toBe('basic');
    expect(planState({ durationMonths: 12 }, -1)).toBe('ended');
    expect(planState({ durationMonths: 12 }, 0)).toBe('lastday');
    expect(planState({ durationMonths: 1 }, 10)).toBe('expiring');
    expect(planCopy({ ...base, durationMonths: 1, expiryDate: '2026-11-10' }, now)).toMatchObject({
      state: 'expiring',
      pill: '6 days left',
    });
    expect(planCopy({ ...base, durationMonths: 12, expiryDate: '2026-11-01' }, now)).toMatchObject({
      state: 'ended',
      pill: 'Academic year plan ended',
    });
    expect(planCopy({ ...base, durationMonths: 1, expiryDate: '2026-11-04' }, now).pill).toBe('Topper Monthly · Last day');
  });

  it('counts down to midnight', () => {
    expect(untilMidnight(new Date('2026-11-04T22:30:15'))).toEqual({ h: '01', m: '29', s: '45' });
  });

  it('maps subjects to illustrations', () => {
    expect(boardSubjectArt('Mathematics').src).toContain('board-maths');
    expect(boardSubjectArt('Sanskrit').src).toContain('board-default');
    expect(competitiveSubjectArt('Botany')).toMatchObject({ left: 8 });
    expect(competitiveSubjectArt('Maths')).toBeNull();
  });
});
