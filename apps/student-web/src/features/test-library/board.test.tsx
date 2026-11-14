import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { BoardAssessments, BoardPaperSets } from './board';
import { testExam } from '@/test/exams';

const cbse = testExam('cbse');

const plan = http.get(`${API}/api/v4/student/plans/active`, () =>
  HttpResponse.json({
    success: true,
    data: { plans: [{ plan_id: 1, class_id: 12, class_name: 'XII', duration_months: 12, status: 'active' }] },
  }),
);

afterEach(() => window.history.replaceState(null, '', '/'));

describe('BoardAssessments: full length exams', () => {
  it('links each subject to its mock or past-year papers', async () => {
    server.use(
      plan,
      http.get(`${API}/api/v4/assessments/board/1/mock/subjects`, () =>
        HttpResponse.json({ success: true, data: [{ subject_id: 3, subject_title: 'PHYSICS', exam_count: 4 }] }),
      ),
      http.get(`${API}/api/v4/assessments/board/1/pyq/subjects`, ({ request }) => {
        expect(new URL(request.url).searchParams.get('class_id')).toBe('12');
        return HttpResponse.json({ success: true, data: [{ subject_id: 5, subject_title: 'CHEMISTRY', exam_count: 2 }] });
      }),
    );
    renderWithProviders(<BoardAssessments />, { exam: cbse });
    const physics = await screen.findByRole('link', { name: /physics/i });
    expect(physics).toHaveAttribute('href', '/cbse/mock-sets/3');
    expect(physics).toHaveTextContent('4 Exams');
    // The dashboard's subject card (same hover: brand fill, zoom, white text).
    expect(physics).toHaveClass('group', 'hover:bg-brand', 'hover:scale-105');

    await userEvent.click(screen.getByRole('tab', { name: 'Past Year Exams' }));
    expect(screen.getByRole('tab', { name: 'Past Year Exams' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByRole('link', { name: /chemistry/i })).toHaveAttribute('href', '/cbse/pyq-sets/5');
    expect(screen.getByText(/Actual CBSE board papers/)).toBeInTheDocument();
  });

  it('says "Coming Soon" without subjects and shows load errors', async () => {
    server.use(plan, http.get(`${API}/api/v4/assessments/board/1/mock/subjects`, () => HttpResponse.json({ success: true, data: [] })));
    const { unmount } = renderWithProviders(<BoardAssessments />, { exam: cbse });
    expect(await screen.findByText('Coming Soon...')).toBeInTheDocument();
    unmount();

    server.use(http.get(`${API}/api/v4/assessments/board/1/mock/subjects`, () => HttpResponse.json({ success: false, message: 'No subjects' })));
    renderWithProviders(<BoardAssessments />, { exam: cbse });
    expect(await screen.findByText('No subjects')).toBeInTheDocument();
  });

  it('opens the custom test builder from a study-plan link and cleans the URL', async () => {
    server.use(
      plan,
      http.get(`${API}/api/v4/assessments/board/1/mock/subjects`, () => HttpResponse.json({ success: true })),
      http.get(`${API}/api/v4/assessments/board/1/custom/courses`, () => HttpResponse.json({ success: true, data: [] })),
    );
    window.history.replaceState(null, '', '/cbse/assessments?open=custom-test&x=1');
    renderWithProviders(<BoardAssessments />, { exam: cbse });
    expect(await screen.findByRole('dialog', { name: 'Create Custom Test' })).toBeInTheDocument();
    expect(window.location.search).toBe('?x=1');
  });
});

describe('BoardPaperSets', () => {
  it('filters by subject and status and shows progress and attempt details', async () => {
    const asked: string[] = [];
    server.use(
      plan,
      http.get(`${API}/api/v4/assessments/board/1/mock/sets`, ({ request }) => {
        const params = new URL(request.url).searchParams;
        asked.push(`${params.get('subject_id')}:${params.get('status') ?? ''}`);
        return HttpResponse.json({
          success: true,
          data: {
            papers: [
              { set_id: 8, set_number: 2, subject_name: 'Physics', status: 'in_progress', current_progress: 40, duration: '2 hrs', total_questions: 30, total_marks: 70 },
              { set_id: 9, set_number: 3, subject_name: 'Physics', status: 'completed', total_marks: 0, latest_marks: 0, last_attempted_at: '2026-10-01', attempt_count: 1 },
            ],
            subjects: [
              { subject_id: 3, subject_title: 'Physics' },
              { subject_id: 4, subject_title: 'Chemistry' },
            ],
          },
        });
      }),
    );
    renderWithProviders(<BoardPaperSets kind="mock" subjectId="3" />, { exam: cbse });
    expect(await screen.findByRole('heading', { name: 'Mock Exams' })).toBeInTheDocument();
    const continuing = await screen.findByRole('link', { name: 'Continue' });
    expect(continuing).toHaveAttribute('href', '/cbse/tests/mock/8');
    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(screen.getByText('2 Hours')).toBeInTheDocument();
    expect(screen.getByText('SET 2')).toBeInTheDocument();
    expect(screen.getByText('01/10/2026')).toBeInTheDocument();
    // Completed without an attempt id: retake only.
    const completed = screen.getByLabelText('completed').closest('article')!;
    expect(within(completed).queryByRole('link', { name: 'Review' })).not.toBeInTheDocument();
    expect(within(completed).getByText('0%')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Subject' }), '4');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'in_progress');
    await waitFor(() => expect(asked).toEqual(['3:', '4:', '4:in_progress']));
  });

  it('shows plan errors', async () => {
    server.use(
      http.get(`${API}/api/v4/student/plans/active`, () => HttpResponse.json({ success: false, message: 'Plan service down' })),
    );
    renderWithProviders(<BoardPaperSets kind="pyq" subjectId="3" />, { exam: cbse });
    expect(await screen.findByText('Plan service down')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Previous Year Papers' })).toBeInTheDocument();
  });
});
