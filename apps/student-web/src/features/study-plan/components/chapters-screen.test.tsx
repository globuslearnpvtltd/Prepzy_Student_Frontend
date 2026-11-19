import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { toIso } from '../api';
import { useStudyPlanDraft } from '../draft-store';
import { ChaptersScreen } from './chapters-screen';
import { JourneyCard } from './journey-card';
import { testExam } from '@/test/exams';

const cbse = testExam('cbse');

const activePlan = http.get(`${API}/api/v4/student/plans/active`, () =>
  HttpResponse.json({
    success: true,
    data: { plans: [{ plan_id: 1, class_id: 12, class_name: 'CLASS 12', duration_months: 12, status: 'active' }] },
  }),
);
const syllabusUrl = `${API}/api/v4/diagnostic/${cbse.category}/${cbse.examId}/classes/12/chapters`;
const syllabus = [
  {
    subject_id: 1,
    subject_name: 'Physics',
    courses: [
      {
        course_id: 3,
        course_name: 'Part 1',
        modules: [{ module_id: 4, module_name: 'ELECTRIC CHARGES', topic_count: 1, is_selectable: true }],
      },
      {
        course_id: 6,
        course_name: 'Part 2',
        modules: [{ module_id: 8, module_name: 'OPTICS', topic_count: 2, is_selectable: true }],
      },
    ],
  },
];

beforeEach(() => useStudyPlanDraft.getState().clear());

describe('ChaptersScreen', () => {
  it('asks for a class when the student has no active plan', async () => {
    server.use(
      http.get(`${API}/api/v4/student/plans/active`, () => HttpResponse.json({ success: true, data: { plans: [] } })),
    );
    renderWithProviders(<ChaptersScreen />, { exam: cbse });
    expect(await screen.findByText('No active class')).toBeInTheDocument();
  });

  it('shows a retry when the chapters fail to load', async () => {
    let calls = 0;
    server.use(
      activePlan,
      http.get(syllabusUrl, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ message: 'down' }, { status: 500 })
          : HttpResponse.json({ success: true, data: { subject_chapter_list: syllabus } });
      }),
    );
    renderWithProviders(<ChaptersScreen />, { exam: cbse });
    expect(await screen.findByText("Couldn't load your chapters")).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Choose chapters for your study plan' })).toBeInTheDocument();
  });

  it('drops chapters no longer offered, switches book on mobile and unselects a chapter', async () => {
    useStudyPlanDraft.getState().setDraft(12, [8, 99]);
    server.use(
      activePlan,
      http.get(syllabusUrl, () => HttpResponse.json({ success: true, data: { subject_chapter_list: syllabus } })),
    );
    renderWithProviders(<ChaptersScreen />, { exam: cbse });
    await screen.findByRole('heading', { name: 'Choose chapters for your study plan' });
    await waitFor(() => expect(useStudyPlanDraft.getState().moduleIds).toEqual([8]));
    expect(screen.getByText('1 chapter selected')).toBeInTheDocument();
    expect(screen.getByText('02 total')).toBeInTheDocument();

    const subject = screen.getByRole('button', { name: /Physics/ });
    await userEvent.click(subject);
    expect(subject).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByText('1 topic').length).toBeGreaterThan(0);

    // mobile: one book at a time, chapters keep their subject-wide number
    const partTwo = screen.getByRole('button', { name: 'Part 2' });
    expect(screen.getByRole('button', { name: 'Part 1' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(partTwo);
    expect(partTwo).toHaveAttribute('aria-pressed', 'true');
    const optics = screen.getAllByRole('button', { name: /Chapter 2 · Optics/ });
    expect(optics).toHaveLength(2);
    expect(optics[1]).toHaveAttribute('aria-pressed', 'true');
    expect(within(optics[1]!).getByText('Selected')).toBeInTheDocument();

    await userEvent.click(optics[1]!);
    expect(useStudyPlanDraft.getState().moduleIds).toEqual([]);
    expect(screen.getByText('0 chapters selected')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Build/ })[0]).toBeDisabled();

    await userEvent.click(subject);
    expect(subject).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('JourneyCard states', () => {
  const journey = (data: Record<string, unknown>) =>
    http.get(`${API}/api/v4/study-plan/classes/12/dashboard`, () => HttpResponse.json({ success: true, data }));

  it('offers a diagnostic retake when the plan is complete (finish-line notebook card on phones)', async () => {
    server.use(activePlan, journey({ state: 'plan_complete', can_retake_diagnostic: true }));
    const { container } = renderWithProviders(<JourneyCard />, { exam: cbse });
    // phone card + simplified card for wider screens (switched by CSS)
    expect(await screen.findAllByText('Finish Line!')).toHaveLength(2);
    const retake = screen.getAllByRole('link', { name: /Retake Diagnostic Test/ });
    expect(retake).toHaveLength(2);
    for (const link of retake) expect(link).toHaveAttribute('href', '/cbse/diagnostic');
    expect(container.querySelector('img[src="/illustrations/journey/finish-illustration.svg"]')).not.toBeNull();
    expect(container.querySelector('.md\\:hidden')).toHaveTextContent('Keep Going');
  });

  it.each([
    ['take_diagnostic', {}, 'Take a', 'Start Diagnostic Test', '/cbse/diagnostic', 'Find your current level and get a'],
    [
      'resume_diagnostic',
      { assessment_id: 7 },
      'Finish your',
      'Resume Test',
      '/cbse/diagnostic-test/7',
      'exactly where you left off',
    ],
    [
      'plan_ended',
      { remaining_tasks: 4 },
      'Your plan has ended',
      'Open My Plan',
      '/cbse/study-plan',
      'with a new diagnostic test',
    ],
  ])('draws the notebook artwork for %s', async (state, extra, lead, cta, href, line) => {
    server.use(activePlan, journey({ state, ...extra }));
    const { container } = renderWithProviders(<JourneyCard />, { exam: cbse });
    // desktop artwork (an SVG link) + phone notebook card, each with a real link named by its label
    const links = await screen.findAllByRole('link', { name: cta });
    expect(links).toHaveLength(2);
    for (const link of links) expect(link).toHaveAttribute('href', href);
    const art = container.querySelector('svg[viewBox="20 0 553 276"]');
    expect(art).not.toBeNull();
    expect(art).toHaveTextContent(lead);
    expect(art).toHaveTextContent(line);
    expect(container.querySelector('img[src="/illustrations/journey/diag-doodles.svg"]')).not.toBeNull();
    if (state === 'plan_ended') expect(screen.getAllByText('4 tasks left')).toHaveLength(2);
  });

  it('shows the weekly progress card with today, finished and rest days', async () => {
    const today = toIso(new Date());
    server.use(
      activePlan,
      journey({
        state: 'weekly_progress',
        week: [
          { plan_date: '2026-11-16', is_rest_day: false, task_count: 2, completed_count: 2 },
          { plan_date: '2026-11-17', is_rest_day: true },
          { plan_date: '2026-11-18', task_count: 3, completed_count: 0 },
          { plan_date: today, is_today: true, task_count: 4, completed_count: 1 },
        ],
      }),
    );
    renderWithProviders(<JourneyCard />, { exam: cbse });
    expect(await screen.findByRole('heading', { name: 'Weekly Study Plan Progress' })).toBeInTheDocument();
    const done = screen.getByText('Completed');
    expect(done).toHaveClass('text-success-400');
    expect(screen.getByText('Rest day')).toBeInTheDocument();
    expect(screen.getByText('3 Tasks')).toBeInTheDocument();
    expect(screen.getByText('3 of 4 tasks Left')).toBeInTheDocument();
    expect(screen.getByText(/^Nov 16 - /)).toBeInTheDocument();
    const start = screen.getAllByRole('link', { name: "Start today's task" });
    expect(start).toHaveLength(2);
    for (const link of start) expect(link).toHaveAttribute('href', '/cbse/study-plan');
    expect(screen.queryByRole('link', { name: 'Retake Diagnostic Test' })).not.toBeInTheDocument();
  });

  it('marks today as a rest day or completed and falls back to the label without a date', async () => {
    server.use(
      activePlan,
      journey({
        state: 'weekly_progress',
        week: [
          { plan_date: '2026-11-16', is_today: true, is_rest_day: true },
          { label: 'Wed', task_count: 1, completed_count: 1, is_today: true },
        ],
      }),
    );
    renderWithProviders(<JourneyCard />, { exam: cbse });
    expect(await screen.findByText('Rest day')).toBeInTheDocument();
    expect(screen.getByText('Wed')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it.each([
    ['tasks_partial', { completed_count: 2, task_count: 5 }, 'You have completed', '2 of 5 tasks', 'Continue task', '/cbse/study-plan', 'inline'],
    ['tasks_done', { task_count: 3 }, 'You have completed all', '3 tasks for today', 'View next day', '/cbse/study-plan', 'inline'],
    ['catch_up', { missed_tasks: 6 }, 'Waiting from earlier days', '6 tasks to catch up', 'Catch up now', '/cbse/study-plan', 'inline'],
    ['build_plan', {}, 'Your next steps just got clearer', 'STUDY PLAN IS READY!', 'Build My Plan', '/cbse/study-plan/chapters', 'stacked'],
    ['rest_day', {}, 'Nothing scheduled today', 'ENJOY YOUR REST DAY!', 'Preview tomorrow', '/cbse/study-plan', 'stacked'],
    ['halfway', {}, 'You’ve already covered', 'HALF THE PLAN for your study plan!', 'Keep Going', '/cbse/study-plan', 'stacked'],
  ])('draws the slim card for %s', async (state, extra, lead, hand, cta, href, layout) => {
    server.use(activePlan, journey({ state, ...extra }));
    const { container } = renderWithProviders(<JourneyCard />, { exam: cbse });
    // desktop slim shell (an SVG link) + phone slim card
    const links = await screen.findAllByRole('link', { name: cta });
    expect(links).toHaveLength(2);
    for (const link of links) expect(link).toHaveAttribute('href', href);
    const art = container.querySelector('svg[viewBox="28 8 841 106"]');
    expect(art).toHaveTextContent(lead);
    expect(art).toHaveTextContent(hand);
    const doodles = layout === 'inline' ? 'slim-doodles-a.svg' : 'slim-doodles-b.svg';
    expect(container.querySelector(`img[src="/illustrations/journey/${doodles}"]`)).not.toBeNull();
  });

  it('draws the finish line card on wide screens, without a retake when it is not allowed', async () => {
    server.use(activePlan, journey({ state: 'plan_complete', can_retake_diagnostic: false }));
    const { container } = renderWithProviders(<JourneyCard />, { exam: cbse });
    const keep = await screen.findAllByRole('link', { name: 'Keep Going' });
    expect(keep).toHaveLength(2);
    for (const link of keep) expect(link).toHaveAttribute('href', '/cbse/study-plan');
    expect(container.querySelector('img[src="/illustrations/journey/finish-line-bg.svg"]')).not.toBeNull();
    expect(container.querySelector('svg[viewBox="0 0 897 332"]')).toHaveTextContent('Finish Line!');
    expect(screen.queryByRole('link', { name: 'Retake Diagnostic Test' })).not.toBeInTheDocument();
  });

  it('renders nothing for an unknown state', async () => {
    let served = false;
    server.use(
      activePlan,
      http.get(`${API}/api/v4/study-plan/classes/12/dashboard`, () => {
        served = true;
        return HttpResponse.json({ success: true, data: { state: 'mystery' } });
      }),
    );
    const { container } = renderWithProviders(<JourneyCard />, { exam: cbse });
    await waitFor(() => expect(served).toBe(true));
    expect(container).toBeEmptyDOMElement();
  });
});
