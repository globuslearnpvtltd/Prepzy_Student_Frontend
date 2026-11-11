import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { navigation } from '@/test/setup';
import { BoardAssessments } from './board';
import { BoardCustomTestBuilder, BoardSavedTests } from './board-custom';
import { testExam } from '@/test/exams';

const cbse = testExam('cbse');

const plan = http.get(`${API}/api/v4/student/plans/active`, () =>
  HttpResponse.json({ success: true, data: { plans: [{ plan_id: 1, class_id: 12, class_name: 'XII', duration_months: 12, status: 'active' }] } }),
);
const topics = Array.from({ length: 7 }, (_, i) => ({ topic_id: i + 1, topic_name: `Topic ${i + 1}` }));
const builderApi = (generate: Record<string, unknown>, onBody?: (body: unknown) => void) => [
  plan,
  http.get(`${API}/api/v4/assessments/board/1/custom/courses`, ({ request }) => {
    expect(new URL(request.url).searchParams.get('class_id')).toBe('12');
    return HttpResponse.json({ success: true, data: [{ course_id: 11, course_name: 'Physics Part 1', subject_name: 'Physics' }] });
  }),
  http.get(`${API}/api/v4/assessments/board/1/custom/courses/11/modules`, () =>
    HttpResponse.json({ success: true, data: [{ module_id: 101, module_name: 'ELECTRIC CHARGES', topics }] }),
  ),
  http.post(`${API}/api/v4/assessments/board/1/custom/sets`, async ({ request }) => {
    onBody?.(await request.json());
    return HttpResponse.json({ success: true, data: generate });
  }),
];

async function buildTest(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Physics Part 1/ }));
  await user.click(screen.getByRole('button', { name: /Next/ }));
  await user.click(await screen.findByRole('button', { name: /Electric Charges/ }));
  await user.click(screen.getByRole('button', { name: /Next/ }));
  for (let i = 1; i <= 6; i++) await user.click(screen.getByRole('button', { name: `Topic ${i}` }));
  // At most five topics.
  expect(screen.getByRole('button', { name: 'Topic 6' })).toHaveAttribute('aria-pressed', 'false');
  await user.click(screen.getByRole('button', { name: /Next/ }));
  await user.click(screen.getByRole('button', { name: /Hard/ }));
  await user.click(screen.getByRole('button', { name: 'Generate Test' }));
}

describe('board custom test builder', () => {
  it('builds course → chapter → topics → difficulty and opens the new set in the player', async () => {
    let body: unknown;
    server.use(...builderApi({ set_id: 77, total: 20 }, (b) => (body = b)));
    const user = userEvent.setup();
    renderWithProviders(<BoardCustomTestBuilder open onOpenChange={() => {}} />, { exam: cbse });
    // Next does nothing until a course is picked.
    await user.click(await screen.findByRole('button', { name: /Next/ }));
    expect(screen.getByPlaceholderText('Search courses...')).toBeInTheDocument();
    await buildTest(user);
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/cbse/tests/custom/77'));
    expect(body).toEqual({ module_id: 101, topic_ids: [1, 2, 3, 4, 5], difficulty_level: 'hard' });
    expect(within(screen.getByRole('complementary', { name: 'Selection Summary' })).getByText('5')).toBeInTheDocument();
  });

  it('explains when the chosen topics have no questions', async () => {
    server.use(...builderApi({ total: 0, set_id: null }));
    const user = userEvent.setup();
    renderWithProviders(<BoardCustomTestBuilder open onOpenChange={() => {}} />, { exam: cbse });
    await buildTest(user);
    expect(await screen.findByText('Questions Not Available')).toBeInTheDocument();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it('opens from the Assessments page buttons', async () => {
    server.use(...builderApi({}), http.get(`${API}/api/v4/assessments/board/1/custom/sets`, () => HttpResponse.json({ success: true, data: { sets: [] } })));
    const user = userEvent.setup();
    renderWithProviders(<BoardAssessments />, { exam: cbse });
    await user.click(screen.getByRole('button', { name: 'Customize Test' }));
    expect(await screen.findByRole('dialog', { name: 'Create Custom Test' })).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Close' })[0]!);
    await user.click(screen.getByRole('button', { name: 'Saved Tests' }));
    expect(await screen.findByText('No Saved Tests Yet')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Create Your First Test/ }));
    expect(await screen.findByRole('dialog', { name: 'Create Custom Test' })).toBeInTheDocument();
  });
});

describe('board saved custom tests', () => {
  it('lists saved sets, links to the player and shows submissions with score cards', async () => {
    server.use(
      plan,
      http.get(`${API}/api/v4/assessments/board/1/custom/sets`, ({ request }) => {
        expect(new URL(request.url).searchParams.get('class_id')).toBe('12');
        return HttpResponse.json({
          success: true,
          data: {
            sets: [{ set_id: 71, course_name: 'Physics Part 1', subject_name: 'Physics', difficulty_level: 'easy', total_marks: 40, total_questions: 20, created_at: '2026-10-02T10:00:00Z' }],
          },
        });
      }),
      http.get(`${API}/api/v4/assessments/board/1/custom/sets/71/attempts`, () =>
        HttpResponse.json({
          success: true,
          data: {
            set_id: 71,
            attempts: [{ attempt_id: 501, attempt_number: 1, attempt_date: '2026-10-03T10:00:00Z', total_questions: 20, total_marks: 40, total_marks_obtained: 28 }],
          },
        }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<BoardSavedTests open onOpenChange={() => {}} onCreate={() => {}} />, { exam: cbse });
    expect(await screen.findByText('Physics Part 1 - Physics')).toBeInTheDocument();
    expect(screen.getByText('02 Oct 2026')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Attempt Exam' })).toHaveAttribute('href', '/cbse/tests/custom/71');
    await user.click(screen.getByRole('button', { name: 'View Submissions' }));
    expect(await screen.findByText('Score: 28 / 40 (70%)')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View Score Card' })).toHaveAttribute('href', '/cbse/tests/custom/result/501');
  });
});
