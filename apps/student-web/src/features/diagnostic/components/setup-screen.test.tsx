import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { navigation } from '@/test/setup';
import { DiagnosticSetupScreen } from './setup-screen';
import { testExam } from '@/test/exams';

const cbse = testExam('cbse');
/** The v4 diagnostic routes of the test exam. */
const DIAGNOSTIC = `${API}/api/v4/diagnostic/${cbse.category}/${cbse.examId}`;

const activePlan = http.get(`${API}/api/v4/student/plans/active`, () =>
  HttpResponse.json({ success: true, data: { plans: [{ plan_id: 1, class_id: 12, class_name: 'CLASS 12', duration_months: 12, status: 'active' }] } }),
);
const status = (data: Record<string, unknown>) => http.get(`${DIAGNOSTIC}/classes/12/status`, () => HttpResponse.json({ success: true, data }));
const chapters = (list: unknown[], rules = { min_chapters_total: 2, max_chapters_per_subject: 2 }) =>
  http.get(`${DIAGNOSTIC}/classes/12/chapters`, () => HttpResponse.json({ success: true, data: { subject_chapter_list: list, rules } }));

const syllabus = [
  {
    subject_id: 1,
    subject_name: 'Physics',
    courses: [
      { course_id: 3, course_name: 'Physics Part 1', modules: [{ module_id: 4, module_name: 'CHARGES', topic_count: 1, is_selectable: true }, { module_id: 9, module_name: 'Magnets', topic_count: 2, is_selectable: false }] },
      { course_id: 7, course_name: 'Physics Part 2', modules: [{ module_id: 5, module_name: 'OPTICS', topic_count: 2, is_selectable: true }] },
    ],
  },
  { subject_id: 2, subject_name: 'Chemistry', courses: [{ course_id: 8, course_name: 'Chemistry Part 1', modules: [{ module_id: 6, module_name: 'ATOMS', topic_count: 4, is_selectable: true }] }] },
];
const blueprint = http.post(`${DIAGNOSTIC}/classes/12/blueprint`, async ({ request }) => {
  const { module_ids: ids } = (await request.json()) as { module_ids: number[] };
  return ids.length >= 2
    ? HttpResponse.json({ success: true, data: { is_valid: true, subject_count: 2, chapter_count: ids.length, total_questions: 1, duration_seconds: 60 } })
    : HttpResponse.json({ success: true, data: { is_valid: false, errors: ['Pick at least 2 chapters.'], subject_count: 1, chapter_count: 1, total_questions: 5, duration_seconds: 300 } });
});

/** The desktop layout (subject list + chapters); phones get an accordion with the same tiles. */
const desktop = () => screen.getByRole('heading', { name: 'Select a subject' }).closest('aside')!.parentElement!;

describe('DiagnosticSetupScreen', () => {
  it('asks for a class without an active plan', async () => {
    server.use(http.get(`${API}/api/v4/student/plans/active`, () => HttpResponse.json({ success: true, data: { plans: [] } })));
    renderWithProviders(<DiagnosticSetupScreen />, { exam: cbse });
    expect(await screen.findByText('No active class')).toBeInTheDocument();
  });

  it('says when the class has no diagnostic chapters', async () => {
    server.use(activePlan, status({ state: 'available' }), chapters([]));
    renderWithProviders(<DiagnosticSetupScreen />, { exam: cbse });
    expect(await screen.findByText('No chapters available yet')).toBeInTheDocument();
  });

  it('sends a student on cooldown to their report', async () => {
    server.use(activePlan, status({ state: 'cooldown' }), chapters(syllabus));
    renderWithProviders(<DiagnosticSetupScreen />, { exam: cbse });
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/cbse/diagnostic-result'));
  });

  it('switches subjects and books, then reviews, adds and removes chapters', async () => {
    server.use(activePlan, status({ state: 'available' }), chapters(syllabus), blueprint);
    renderWithProviders(<DiagnosticSetupScreen />, { exam: cbse });
    await screen.findByRole('heading', { name: 'Select a subject' });
    expect(within(desktop()).getByRole('button', { name: /Magnets/ })).toBeDisabled();
    expect(within(desktop()).getByText(/2 topics · no questions yet/)).toBeInTheDocument();

    // the second book starts collapsed; open it, pick a chapter, then fold the first book
    const partTwo = within(desktop()).getByRole('button', { name: /Physics Part 2/ });
    expect(partTwo).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(partTwo);
    await userEvent.click(within(desktop()).getByRole('button', { name: /Optics/ }));
    expect(within(desktop()).getByText('· 1 selected')).toBeInTheDocument();
    await userEvent.click(within(desktop()).getByRole('button', { name: /Physics Part 1/ }));
    expect(within(desktop()).queryByRole('button', { name: /Charges/ })).not.toBeInTheDocument();
    // unselect and select again
    await userEvent.click(within(desktop()).getByRole('button', { name: /Optics/, pressed: true }));
    await userEvent.click(within(desktop()).getByRole('button', { name: /Optics/, pressed: false }));

    await userEvent.click(within(desktop()).getByRole('button', { name: /Chemistry/ }));
    await userEvent.click(within(desktop()).getByRole('button', { name: /Atoms/ }));
    expect(screen.getByText('2 chapters selected')).toBeInTheDocument();
    expect(screen.getByText('out of 04 total')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('1 Min')).toBeInTheDocument();
    expect(screen.getByText('MCQ')).toBeInTheDocument();
    expect(screen.getByText('2 core syllabus topics')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove Optics' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Pick at least 2 chapters.');
    expect(screen.getByRole('button', { name: 'Start Test' })).toBeDisabled();

    // "Add Chapter" goes back to the chapters with that subject open
    await userEvent.click(screen.getByRole('button', { name: 'Add Chapter' }));
    expect(within(desktop()).getByText('1 of 2 chapters')).toBeInTheDocument();
    expect(within(desktop()).getByRole('button', { name: /Atoms/, pressed: true })).toBeInTheDocument();
    const physics = within(desktop()).getByRole('button', { name: /^Physics/ });
    expect(physics).toHaveTextContent('0 of 3 selected');
    await userEvent.click(physics);
    expect(within(desktop()).getByText('0 of 2 chapters')).toBeInTheDocument();
  });

  it('goes back from the blueprint, and back to chapters when everything is removed', async () => {
    server.use(activePlan, status({ state: 'available' }), chapters(syllabus, { min_chapters_total: 1, max_chapters_per_subject: 1 }), blueprint);
    renderWithProviders(<DiagnosticSetupScreen />, { exam: cbse });
    await screen.findByRole('heading', { name: 'Select a subject' });
    await userEvent.click(within(desktop()).getByRole('button', { name: /Charges/ }));
    expect(screen.getByText('1 chapter selected')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Pick at least 2 chapters.')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Go back' })[0]!);
    expect(screen.getByRole('heading', { name: 'Select a subject' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Remove Charges' }));
    expect(await screen.findByRole('heading', { name: 'Select a subject' })).toBeInTheDocument();
  });

  it('phones: one subject open at a time, and its chapters', async () => {
    server.use(activePlan, status({ state: 'available' }), chapters(syllabus));
    renderWithProviders(<DiagnosticSetupScreen />, { exam: cbse });
    const physics = await screen.findByRole('button', { name: /Physics3 Chapters · 0 selected/ });
    const chemistry = screen.getByRole('button', { name: /Chemistry1 Chapters · 0 selected/ });
    expect(physics).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(physics);
    expect(physics).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(physics);
    expect(physics).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(chemistry);
    expect(chemistry).toHaveAttribute('aria-expanded', 'true');
    expect(physics).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows why the test could not start, and sends a rate-limited student to the report', async () => {
    let calls = 0;
    server.use(
      activePlan,
      status({ state: 'available' }),
      chapters(syllabus, { min_chapters_total: 1, max_chapters_per_subject: 2 }),
      http.post(`${DIAGNOSTIC}/classes/12/blueprint`, () =>
        HttpResponse.json({ success: true, data: { is_valid: true, subject_count: 1, chapter_count: 1, total_questions: 5, duration_seconds: 300 } }),
      ),
      http.post(`${DIAGNOSTIC}/classes/12/attempts`, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ success: true, data: {} })
          : HttpResponse.json({ success: false, message: 'You can take the diagnostic again in 3 day(s).', code: 'DIAGNOSTIC_COOLDOWN', data: null, details: { days_until_next: 3 } }, { status: 429 });
      }),
    );
    renderWithProviders(<DiagnosticSetupScreen />, { exam: cbse });
    await screen.findByRole('heading', { name: 'Select a subject' });
    await userEvent.click(within(desktop()).getByRole('button', { name: /Charges/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Start Test' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't start your test. Please try again.");

    await userEvent.click(screen.getByRole('button', { name: 'Start Test' }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/cbse/diagnostic-result'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
