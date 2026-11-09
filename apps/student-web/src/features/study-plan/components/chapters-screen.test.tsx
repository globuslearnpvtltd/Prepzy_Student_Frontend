import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { getExam } from '@/shared/config/exams';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { toIso } from '../api';
import { useStudyPlanDraft } from '../draft-store';
import { ChaptersScreen } from './chapters-screen';
import { JourneyCard } from './journey-card';

const cbse = getExam('cbse')!;

const activePlan = http.get(`${API}/api/v4/student/plans/active`, () =>
  HttpResponse.json({ success: true, data: { plans: [{ plan_id: 1, class_id: 12, class_name: 'CLASS 12', duration_months: 12, status: 'active' }] } }),
);
const syllabusUrl = `${API}/api/v1/diagnostic/subject-chapter-list/12`;
const syllabus = [
  {
    subject_id: 1,
    subject_name: 'Physics',
    courses: [
      { course_id: 3, course_name: 'Part 1', modules: [{ module_id: 4, module_name: 'ELECTRIC CHARGES', topic_count: 1, is_selectable: true }] },
      { course_id: 6, course_name: 'Part 2', modules: [{ module_id: 8, module_name: 'OPTICS', topic_count: 2, is_selectable: true }] },
    ],
  },
];

beforeEach(() => useStudyPlanDraft.getState().clear());

describe('ChaptersScreen', () => {
  it('asks for a class when the student has no active plan', async () => {
    server.use(http.get(`${API}/api/v4/student/plans/active`, () => HttpResponse.json({ success: true, data: { plans: [] } })));
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
    server.use(activePlan, http.get(syllabusUrl, () => HttpResponse.json({ success: true, data: { subject_chapter_list: syllabus } })));
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
    http.get(`${API}/api/v1/study-plan/dashboard/12`, () => HttpResponse.json({ success: true, data }));

  it('offers a diagnostic retake when the plan is complete', async () => {
    server.use(activePlan, journey({ state: 'plan_complete', can_retake_diagnostic: true }));
    renderWithProviders(<JourneyCard />, { exam: cbse });
    expect(await screen.findByText('Finish Line!')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Retake Diagnostic Test' })).toHaveAttribute('href', '/cbse/diagnostic');
  });

  it('marks rest days and finished days in the week strip', async () => {
    const today = toIso(new Date());
    server.use(
      activePlan,
      journey({
        state: 'weekly_progress',
        week: [
          { plan_date: today, day: 'Tue', total: 2, done: 2 },
          { label: 'Wed', is_rest_day: true },
        ],
      }),
    );
    renderWithProviders(<JourneyCard />, { exam: cbse });
    const done = await screen.findByText('2/2');
    expect(done).toHaveClass('text-success-700');
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Retake Diagnostic Test' })).not.toBeInTheDocument();
  });

  it('renders nothing for an unknown state', async () => {
    let served = false;
    server.use(
      activePlan,
      http.get(`${API}/api/v1/study-plan/dashboard/12`, () => {
        served = true;
        return HttpResponse.json({ success: true, data: { state: 'mystery' } });
      }),
    );
    const { container } = renderWithProviders(<JourneyCard />, { exam: cbse });
    await waitFor(() => expect(served).toBe(true));
    expect(container).toBeEmptyDOMElement();
  });
});
