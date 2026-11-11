import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { navigation } from '@/test/setup';
import { ExamPlayer } from './exam-player';
import { ResultContent } from './result-view';
import { testExam } from '@/test/exams';

const neet = testExam('neet');

function mockNeetPaper(onSubmit: (body: unknown) => void) {
  server.use(
    http.get(`${API}/api/v4/student/plans/active`, () =>
      HttpResponse.json({
        success: true,
        data: { plans: [{ plan_id: 1, class_id: 20, class_name: 'NEET', duration_months: 12, status: 'active' }] },
      }),
    ),
    http.post(`${API}/api/v4/assessments/competitive/2/mock/sets/4/attempts`, () =>
      HttpResponse.json({
        success: true,
        data: {
          attempt_id: 61,
          set_id: 4,
          status: 'in_progress',
          time_left: 3600,
          questions: [
            {
              question_id: 1,
              question_text: '<p>Powerhouse of the cell?</p>',
              options: [
                { option_id: 11, text: 'Ribosome' },
                { option_id: 12, text: 'Mitochondria' },
              ],
            },
            {
              question_id: 2,
              question_text: '<p>Unit of force?</p>',
              options: [
                { option_id: 21, text: 'Newton' },
                { option_id: 22, text: 'Joule' },
              ],
            },
          ],
        },
      }),
    ),
    http.put(`${API}/api/v4/assessments/competitive/2/mock/attempts/61`, () => HttpResponse.json({ success: true, data: { attempt_id: 61 } })),
    http.post(`${API}/api/v4/assessments/competitive/2/mock/attempts/61/submit`, async ({ request }) => {
      onSubmit(await request.json());
      return HttpResponse.json({ success: true, data: { attempt_id: 77 } });
    }),
  );
}

describe('ExamPlayer', () => {
  it('takes a NEET mock end to end: answer, review mark, palette, submit, result page', async () => {
    const onSubmit = vi.fn();
    mockNeetPaper(onSubmit);
    renderWithProviders(<ExamPlayer testType="mock" setId="4" />, { exam: neet });

    expect(await screen.findByText('Powerhouse of the cell?')).toBeInTheDocument();
    expect(screen.getAllByRole('timer')[0]).toHaveTextContent(/\d{1,2}:\d{2}/);

    await userEvent.click(screen.getByRole('radio', { name: /Mitochondria/ }));
    expect(screen.getByText('1 of 2 answered')).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button', { name: 'Save & Next' })[0]!);
    expect(await screen.findByText('Unit of force?')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Mark for review' })[0]!);

    const palette = screen.getAllByRole('navigation', { name: 'Questions' })[0]!;
    expect(within(palette).getByRole('button', { name: 'Question 1, answered' })).toHaveAttribute('data-status', 'answered');
    const second = within(palette).getByRole('button', { name: 'Question 2, marked for review' });
    expect(second).toHaveAttribute('aria-current', 'step');
    expect(second).toHaveAttribute('data-status', 'marked');
    expect(second).toHaveTextContent('02');

    await userEvent.click(screen.getAllByRole('button', { name: 'Submit test' })[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'Submit your test?' });
    expect(dialog).toHaveTextContent('1 are still unanswered');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Submit' }));

    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/neet/tests/mock/result/77'));
    expect(onSubmit).toHaveBeenCalledWith({
      class_id: 20,
      answers: [
        { question_id: 1, selected_option: 12, status: 'answered' },
        { question_id: 2, selected_option: null, status: 'marked_for_review' },
      ],
    });
  });

  it('explains plan limits instead of showing a broken page', async () => {
    server.use(
      http.get(`${API}/api/v4/student/plans/active`, () =>
        HttpResponse.json({
          success: true,
          data: { plans: [{ plan_id: 1, class_id: 20, class_name: 'NEET', duration_months: 0, status: 'active' }] },
        }),
      ),
      http.post(`${API}/api/v4/assessments/competitive/2/mock/sets/4/attempts`, () =>
        HttpResponse.json(
          { success: false, error: { code: 'FEATURE_LIMIT_REACHED', message: 'You have used all 2 free mock tests.' } },
          { status: 429 },
        ),
      ),
    );
    renderWithProviders(<ExamPlayer testType="mock" setId="4" />, { exam: neet });
    expect(await screen.findByRole('heading', { name: 'Test limit reached' })).toBeInTheDocument();
    expect(screen.getByText('You have used all 2 free mock tests.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to Mock Exams/ })).toHaveAttribute('href', '/neet/mock-tests');
  });

  it('opens the result when the paper was already submitted', async () => {
    server.use(
      http.get(`${API}/api/v4/student/plans/active`, () =>
        HttpResponse.json({
          success: true,
          data: { plans: [{ plan_id: 1, class_id: 20, class_name: 'NEET', duration_months: 12, status: 'active' }] },
        }),
      ),
      http.post(`${API}/api/v4/assessments/competitive/2/dpp/sets/7/attempts`, () =>
        HttpResponse.json({ success: true, data: { attempt_id: 55, set_id: 7, status: 'submitted' } }),
      ),
    );
    renderWithProviders(<ExamPlayer testType="dpp" setId="7" />, { exam: neet });
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/neet/tests/dpp/result/55'));
  });
});

describe('ResultContent', () => {
  it('summarises the score and filters questions by outcome', async () => {
    renderWithProviders(
      <ResultContent
        home={{ label: 'Mock Exams', href: '/neet/mock-tests' }}
        category="competitive"
        result={{
          title: 'Mock test result',
          totalMarks: 8,
          obtained: 3,
          attemptedAt: null,
          counts: { correct: 1, incorrect: 1, partial: 0, unattempted: 0 },
          questions: [
            {
              id: '1',
              kind: 'mcq',
              typeLabel: 'MCQ',
              html: 'Q1',
              image: null,
              marks: null,
              obtained: null,
              outcome: 'correct',
              options: [{ id: 'a', html: 'Right', image: null, isCorrect: true, isSelected: true }],
              answerHtml: null,
              feedbackHtml: null,
              sampleAnswerHtml: null,
              explanationImage: null,
              parts: [],
            },
            {
              id: '2',
              kind: 'mcq',
              typeLabel: 'MCQ',
              html: 'Q2',
              image: null,
              marks: null,
              obtained: null,
              outcome: 'incorrect',
              options: [
                { id: 'a', html: 'Picked', image: null, isCorrect: false, isSelected: true },
                { id: 'b', html: 'Answer', image: null, isCorrect: true, isSelected: false },
              ],
              answerHtml: null,
              feedbackHtml: null,
              sampleAnswerHtml: 'Because B',
              explanationImage: null,
              parts: [],
            },
          ],
        }}
      />,
      { exam: neet },
    );
    expect(screen.getByLabelText('Score 3 out of 8')).toBeInTheDocument();
    expect(screen.getByText('Q1')).toBeInTheDocument();
    const palette = screen.getByRole('navigation', { name: 'Questions' });
    expect(within(palette).getByRole('button', { name: 'Question 1, correct' })).toHaveAttribute('data-status', 'correct');
    await userEvent.click(within(palette).getByRole('button', { name: 'Question 2, incorrect' }));
    expect(screen.getByText('Q2')).toBeInTheDocument();
    expect(screen.getByText('Picked').closest('li')).toHaveAttribute('data-result', 'incorrect');
    expect(screen.getByText('Answer').closest('li')).toHaveAttribute('data-result', 'correct');
    expect(await screen.findByText('Because B')).toBeInTheDocument();
    expect(screen.getByText('Detailed Solution & Explanation')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Discuss with Vedica/ })).toHaveAttribute('href', '/neet/doubt-solver');
  });
});
