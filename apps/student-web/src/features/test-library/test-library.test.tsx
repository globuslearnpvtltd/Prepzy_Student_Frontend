import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { navigation } from '@/test/setup';
import { BoardPaperSets } from './board';
import { CustomTestCreate, CustomTests } from './custom-tests';
import { DailyPractice } from './daily-practice';
import { TestLibrary } from './library';
import { testExam } from '@/test/exams';

const neet = testExam('neet');
const cbse = testExam('cbse');

const plan = (classId: number) =>
  http.get(`${API}/api/v4/student/plans/active`, () =>
    HttpResponse.json({ success: true, data: { plans: [{ plan_id: 1, class_id: classId, class_name: 'X', duration_months: 12, status: 'active' }] } }),
  );

const mockSet = (id: number, extra: Record<string, unknown>) => ({
  set_id: id,
  name: `NEET Full Mock ${id}`,
  duration: 180,
  question_count: 180,
  attempt_count: 0,
  status: 'pending',
  ongoing_session: null,
  ...extra,
});

describe('NEET mock tests', () => {
  it('shows stats, the ongoing test, paper cards and previous submissions', async () => {
    server.use(
      plan(20),
      http.get(`${API}/api/v4/assessments/competitive/2/mock/sets`, ({ request }) => {
        const query = new URL(request.url).searchParams;
        expect([query.get('class_id'), query.get('variant')]).toEqual(['20', 'full']);
        return HttpResponse.json({
          success: true,
          data: {
            sets: [
              mockSet(4, { attempt_count: 1, status: 'completed' }),
              mockSet(5, { status: 'in_progress', ongoing_session: { remaining_seconds: 5400 } }),
              mockSet(6, {}),
            ],
          },
        });
      }),
      http.get(`${API}/api/v4/assessments/competitive/2/mock/best-score`, () => HttpResponse.json({ success: true, data: { obtained: 486, total: 720 } })),
      http.get(`${API}/api/v4/assessments/competitive/2/mock/attempts`, () =>
        HttpResponse.json({
          success: true,
          data: [{ attempt_id: 1, set_id: 4, name: 'NEET Full Mock 4', total_marks: 720, total_marks_obtained: 486, attempt_date: '2026-11-10T09:30:00Z' }],
        }),
      ),
      http.get(`${API}/api/v4/assessments/competitive/2/mock/sets/4/attempts`, () =>
        HttpResponse.json({
          success: true,
          data: { name: 'NEET Full Mock 4', attempts: [{ attempt_id: 9, attempt_number: 1, total_marks: 720, total_marks_obtained: 400, attempt_date: '2026-11-01T00:00:00Z' }] },
        }),
      ),
    );
    renderWithProviders(<TestLibrary kind="mock" />, { exam: neet });

    expect(await screen.findByText('1H 30M LEFT')).toBeInTheDocument();
    expect(screen.getByText('486/720')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Resume Test' })).toHaveAttribute('href', '/neet/tests/mock/5');
    expect(screen.getByRole('link', { name: 'Start Test' })).toHaveAttribute('href', '/neet/tests/mock/6');
    expect(screen.getByRole('link', { name: 'Attempt Again' })).toHaveAttribute('href', '/neet/tests/mock/4');
    expect(await screen.findByRole('link', { name: 'Review' })).toHaveAttribute('href', '/neet/tests/mock/result/1');

    await userEvent.selectOptions(screen.getByRole('combobox'), 'completed');
    expect(screen.queryByText('NEET Full Mock 6')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'View Attempts' }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByRole('link', { name: 'Review' })).toHaveAttribute('href', '/neet/tests/mock/result/9');
  });

  it('shows an empty state and an error', async () => {
    server.use(plan(20), http.get(`${API}/api/v4/assessments/competitive/2/pyq/sets`, () => HttpResponse.json({ success: true, data: { sets: [] } })));
    const { unmount } = renderWithProviders(<TestLibrary kind="pyq" />, { exam: neet });
    expect(await screen.findByText('No tests yet')).toBeInTheDocument();
    unmount();

    server.use(http.get(`${API}/api/v4/assessments/competitive/2/pyq/sets`, () => HttpResponse.json({ success: false, message: 'Server down' }, { status: 500 })));
    renderWithProviders(<TestLibrary kind="pyq" />, { exam: neet });
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});

describe('board paper sets', () => {
  it('lists papers with stats and the right actions per status', async () => {
    server.use(
      plan(12),
      http.get(`${API}/api/v4/assessments/board/1/pyq/sets`, ({ request }) => {
        expect(new URL(request.url).searchParams.get('subject_id')).toBe('3');
        return HttpResponse.json({
          success: true,
          data: {
            papers: [
              { set_id: 18, set_number: 1, year: 2024, subject_name: 'Physics', total_questions: 33, status: 'pending', total_marks: 70 },
              { set_id: 19, set_number: 1, year: 2023, subject_name: 'Physics', total_questions: 33, status: 'completed', total_marks: 70, latest_marks: 61, latest_attempt_id: 301, attempt_count: 2 },
            ],
            stats: { total: 2, completed: 1, in_progress: 0, pending: 1 },
          },
        });
      }),
    );
    renderWithProviders(<BoardPaperSets kind="pyq" subjectId="3" />, { exam: cbse });
    expect(await screen.findByText('61/70')).toBeInTheDocument();
    expect(screen.getByText('87%')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start Now' })).toHaveAttribute('href', '/cbse/tests/pyq/18');
    expect(screen.getByRole('link', { name: 'Review' })).toHaveAttribute('href', '/cbse/tests/pyq/result/301');
    expect(screen.getByRole('link', { name: 'Retake' })).toHaveAttribute('href', '/cbse/tests/pyq/19');
    expect(screen.getByText('Total Papers').nextSibling).toHaveTextContent('02');
  });

  it('explains when nothing matches', async () => {
    server.use(plan(12), http.get(`${API}/api/v4/assessments/board/1/mock/sets`, () => HttpResponse.json({ success: true, data: { papers: [] } })));
    renderWithProviders(<BoardPaperSets kind="mock" subjectId="1" />, { exam: cbse });
    expect(await screen.findByText('No papers found')).toBeInTheDocument();
  });
});

describe('custom tests', () => {
  it('lists saved tests and past attempts', async () => {
    server.use(
      http.get(`${API}/api/v4/assessments/competitive/2/custom/sets`, () =>
        HttpResponse.json({
          success: true,
          data: {
            sets: [{ set_id: 2, set_number: 2, subject_name: 'NEET-Botany', module_name: 'Plant kingdom', topics: [{ title: 'Algae' }], total_questions: 10, attempt_count: 0 }],
          },
        }),
      ),
      http.get(`${API}/api/v4/assessments/competitive/2/custom/attempts`, () =>
        HttpResponse.json({
          success: true,
          data: [{ attempt_id: 64, set_id: 1, attempt_number: 1, subject_name: 'NEET-Biology', module_name: 'Cell', total_marks: 80, total_marks_obtained: 56 }],
        }),
      ),
    );
    renderWithProviders(<CustomTests />, { exam: neet });
    expect(await screen.findByText('Plant kingdom')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start' })).toHaveAttribute('href', '/neet/tests/custom/2');
    await userEvent.click(screen.getByRole('tab', { name: /Past exams/ }));
    expect(await screen.findByRole('link', { name: 'Review' })).toHaveAttribute('href', '/neet/tests/custom/result/64');
  });

  it('builds a test: subject → chapter → topics → generate opens the player', async () => {
    let generated: unknown;
    server.use(
      http.get(`${API}/api/v4/dashboard/competitive/2/subject-progress`, () =>
        HttpResponse.json({ success: true, data: [{ subject_id: 3, subject_name: 'NEET-Botany', total_chapters: 18, course_ids: '1' }] }),
      ),
      http.get(`${API}/api/v4/assessments/competitive/2/custom/chapters/3`, () =>
        HttpResponse.json({ success: true, data: [{ module_id: 14, module_name: 'Cell', topic_count: 3 }] }),
      ),
      http.get(`${API}/api/v4/assessments/competitive/2/custom/chapters/14/topics`, () =>
        HttpResponse.json({ success: true, data: [{ lecture_id: 1, title: 'Cell theory' }, { lecture_id: 2, title: 'Organelles' }] }),
      ),
      http.post(`${API}/api/v4/assessments/competitive/2/custom/sets`, async ({ request }) => {
        generated = await request.json();
        return HttpResponse.json({ success: true, message: 'Custom test created', data: { set_id: 77 } });
      }),
    );
    renderWithProviders(<CustomTestCreate />, { exam: neet });
    await userEvent.click(await screen.findByRole('button', { name: /Botany/ }));
    await userEvent.click(screen.getByRole('button', { name: /Continue/ }));
    await userEvent.click(await screen.findByRole('button', { name: /3 topics/ }));
    await userEvent.click(screen.getByRole('button', { name: /Continue/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Organelles/ }));
    await userEvent.click(screen.getByRole('button', { name: 'hard' }));
    await userEvent.click(screen.getByRole('button', { name: /Create test/ }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/neet/tests/custom/77'));
    expect(generated).toEqual({ module_id: 14, topic_ids: [2], difficulty_level: 'hard' });
  });
});

describe('daily practice', () => {
  it("shows today's paper and the month's papers", async () => {
    server.use(
      http.get(`${API}/api/v4/assessments/competitive/2/dpp/live`, () =>
        HttpResponse.json({ success: true, data: { dpp: { dpp_id: 9, dpp_name: 'DPP 14 Nov' }, question_count: 15, attempt: null } }),
      ),
      http.get(`${API}/api/v4/assessments/competitive/2/dpp/months`, () => HttpResponse.json({ success: true, data: [{ year: 2026, month: 11, first_dpp_id: 7 }] })),
      http.get(`${API}/api/v4/assessments/competitive/2/dpp/sets`, ({ request }) => {
        const query = new URL(request.url).searchParams;
        expect([query.get('month'), query.get('year')]).toEqual(['11', '2026']);
        return HttpResponse.json({
          success: true,
          data: [
            { dpp_id: 7, dpp_name: 'DPP 12 Nov', dpp_date: '2026-11-12', attempted: true, attempt_id: 55 },
            { dpp_id: 8, dpp_name: 'DPP 13 Nov', dpp_date: '2026-11-13', attempted: false, attempt_id: null },
          ],
        });
      }),
    );
    renderWithProviders(<DailyPractice />, { exam: neet });
    expect(await screen.findByRole('link', { name: 'Start Now' })).toHaveAttribute('href', '/neet/tests/dpp/9');
    expect(await screen.findByRole('link', { name: 'Result' })).toHaveAttribute('href', '/neet/tests/dpp/result/55');
    expect(screen.getByRole('link', { name: 'Start' })).toHaveAttribute('href', '/neet/tests/dpp/8');
  });

  it('says when there are no papers yet', async () => {
    server.use(
      http.get(`${API}/api/v4/assessments/competitive/2/dpp/live`, () => HttpResponse.json({ success: true, data: null })),
      http.get(`${API}/api/v4/assessments/competitive/2/dpp/months`, () => HttpResponse.json({ success: true, data: [] })),
    );
    renderWithProviders(<DailyPractice />, { exam: neet });
    expect(await screen.findByText('No practice papers yet')).toBeInTheDocument();
  });
});
