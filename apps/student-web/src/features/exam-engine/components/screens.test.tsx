import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { usePlanSelection } from '@/features/auth';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { navigation } from '@/test/setup';
import type { Answer, ExamQuestion, ResultQuestion, TestSetSummary } from '../model';
import { QuestionView } from './question-view';
import { ResultContent, ResultView } from './result-view';
import { SetCard } from './set-card';
import { CompletedDialog, SubmitDialog, SubmittingScreen } from './submit-flow';
import { TestHub } from './test-hub';
import { TestSets } from './test-sets';
import { testExam } from '@/test/exams';

vi.mock('@/features/assistant/ui', () => ({
  ReviewChat: ({ onClose, context }: { onClose: () => void; context: { questionId: string; attemptId: string } }) => (
    <div role="dialog" aria-label="Review chat">
      chat {context.questionId} {context.attemptId}
      <button type="button" onClick={onClose}>
        Close chat
      </button>
    </div>
  ),
}));

const cbse = testExam('cbse');
const neet = testExam('neet');

const plans = (list: unknown[]) =>
  http.get(`${API}/api/v4/student/plans/active`, () => HttpResponse.json({ success: true, data: { plans: list } }));
const cbsePlan = { plan_id: 1, class_id: 12, class_name: 'CLASS 12', duration_months: 12, status: 'active' };

beforeEach(() => usePlanSelection.setState({ planId: null }));

/* -------------------------------- test hub -------------------------------- */

describe('TestHub', () => {
  it('links every listable test type of the exam', () => {
    renderWithProviders(<TestHub />, { exam: neet });
    expect(screen.getByRole('link', { name: /Mock tests/ })).toHaveAttribute('href', '/neet/tests/mock');
    expect(screen.getByRole('link', { name: /Daily practice/ })).toHaveAttribute('href', '/neet/tests/dpp');
    expect(screen.queryByRole('link', { name: /Chapter PYQs/ })).not.toBeInTheDocument();
  });
});

/* -------------------------------- set card -------------------------------- */

const set = (overrides: Partial<TestSetSummary> = {}): TestSetSummary => ({
  id: '8',
  title: 'Paper 2',
  subtitle: 'Physics',
  questionCount: 30,
  durationMinutes: 180,
  status: 'new',
  lastScore: null,
  lastAttemptId: null,
  ...overrides,
});

describe('SetCard', () => {
  it('starts a new paper', () => {
    renderWithProviders(<SetCard set={set()} testType="mock" />, { exam: cbse });
    expect(screen.getByText('Not started')).toBeInTheDocument();
    expect(screen.getByText('30 questions')).toBeInTheDocument();
    expect(screen.getByText('180 min')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start' })).toHaveAttribute('href', '/cbse/tests/mock/8');
    expect(screen.queryByRole('link', { name: 'View result' })).not.toBeInTheDocument();
  });

  it('resumes a paper in progress without optional details', () => {
    renderWithProviders(
      <SetCard set={set({ status: 'in-progress', subtitle: null, questionCount: null, durationMinutes: null })} testType="mock" />,
      { exam: cbse },
    );
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Resume' })).toBeInTheDocument();
    expect(screen.queryByText(/questions/)).not.toBeInTheDocument();
    expect(screen.queryByText('Physics')).not.toBeInTheDocument();
  });

  it('offers a retake and the last result of a completed paper', () => {
    renderWithProviders(
      <SetCard set={set({ status: 'completed', lastScore: { obtained: 61, total: 80 }, lastAttemptId: '300' })} testType="pyq" />,
      { exam: cbse },
    );
    expect(screen.getByText('Last score 61/80')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Retake' })).toHaveAttribute('href', '/cbse/tests/pyq/8');
    expect(screen.getByRole('link', { name: 'View result' })).toHaveAttribute('href', '/cbse/tests/pyq/result/300');
  });

  it('never offers a retake of a submitted daily practice paper', () => {
    renderWithProviders(<SetCard set={set({ status: 'completed', lastAttemptId: '70' })} testType="dpp" />, {
      exam: neet,
    });
    expect(screen.queryByRole('link', { name: 'Retake' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View result' })).toHaveAttribute('href', '/neet/tests/dpp/result/70');
  });
});

/* -------------------------------- test sets ------------------------------- */

describe('TestSets', () => {
  it('explains when the exam has no such test type', () => {
    renderWithProviders(<TestSets testType="dpp" />, { exam: cbse });
    expect(screen.getByRole('heading', { name: "This test type isn't available" })).toBeInTheDocument();
  });

  it('points to Learn for test types without a list', () => {
    renderWithProviders(<TestSets testType="chapter-pyq" />, { exam: neet });
    expect(screen.getByText(/These tests open from your chapters in Learn/)).toBeInTheDocument();
  });

  it('needs an active plan for exams where students pick a class', async () => {
    server.use(plans([{ ...cbsePlan, status: 'expired' }]));
    renderWithProviders(<TestSets testType="mock" />, { exam: cbse });
    expect(screen.getByLabelText('Loading papers')).toBeInTheDocument();
    expect(await screen.findByText('You need an active plan to take tests.')).toBeInTheDocument();
  });

  it('shows plan loading errors', async () => {
    server.use(
      http.get(`${API}/api/v4/student/plans/active`, () => HttpResponse.json({ success: false, message: 'Plan lookup failed' })),
    );
    renderWithProviders(<TestSets testType="mock" />, { exam: cbse });
    expect(await screen.findByText('Plan lookup failed')).toBeInTheDocument();
  });

  it('groups board papers by subject and switches subjects', async () => {
    const subjectsAsked: (string | null)[] = [];
    server.use(
      plans([cbsePlan]),
      http.get(`${API}/api/v4/assessments/board/subjects`, () =>
        HttpResponse.json({
          success: true, data: {
          mock_result: [
            { subject_id: 3, subject_title: 'Physics', exam_count: 1 },
            { subject_id: 4, subject_title: 'Chemistry', exam_count: 0 },
          ] } }),
      ),
      http.get(`${API}/api/mock-exams/fetch-mock-sets`, ({ request }) => {
        const subject = new URL(request.url).searchParams.get('subject');
        subjectsAsked.push(subject);
        const papers = subject === '3' ? [{ set_id: 8, set_number: 2, year: 2024, status: 'completed' }] : [];
        return HttpResponse.json({ success: true, data: { papers } });
      }),
    );
    renderWithProviders(<TestSets testType="mock" />, { exam: cbse });
    expect(await screen.findByRole('heading', { name: '2024 · 2' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Mock tests' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Chemistry' }));
    expect(await screen.findByText('No papers here yet. Check back soon.')).toBeInTheDocument();
    expect(subjectsAsked).toEqual(['3', '4']);
  });

  it('tells the student when their class has no subjects yet', async () => {
    server.use(plans([cbsePlan]), http.get(`${API}/api/v4/assessments/board/subjects`, () => HttpResponse.json({ success: true })));
    renderWithProviders(<TestSets testType="pyq" />, { exam: cbse });
    expect(await screen.findByText('No papers are available for your class yet.')).toBeInTheDocument();
  });

  it('shows subject and paper loading errors', async () => {
    server.use(
      plans([cbsePlan]),
      http.get(`${API}/api/v4/assessments/board/subjects`, () => HttpResponse.json({ success: false, message: 'Subjects down' })),
    );
    const { unmount } = renderWithProviders(<TestSets testType="mock" />, { exam: cbse });
    expect(await screen.findByText('Subjects down')).toBeInTheDocument();
    unmount();

    server.use(
      http.get(`${API}/api/v4/assessments/board/subjects`, () =>
        HttpResponse.json({ success: true, data: { mock_result: [{ subject_id: 3, subject_title: 'Physics' }] } }),
      ),
      http.get(`${API}/api/mock-exams/fetch-mock-sets`, () => HttpResponse.json({ success: false, message: 'Papers down' })),
    );
    renderWithProviders(<TestSets testType="mock" />, { exam: cbse });
    expect(await screen.findByText('Papers down')).toBeInTheDocument();
  });

  it("lists competitive papers directly (NEET's class comes from the exam when there is no plan)", async () => {
    server.use(
      plans([]),
      http.get(`${API}/api/neet/get-live-dpp-neet`, () =>
        HttpResponse.json({ success: true, data: { dpp: { dpp_id: 7, dpp_name: 'DPP 7' }, questionCount: 10, attempt: null } }),
      ),
    );
    renderWithProviders(<TestSets testType="dpp" />, { exam: neet });
    expect(await screen.findByRole('heading', { name: 'DPP 7' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start' })).toHaveAttribute('href', '/neet/tests/dpp/7');
  });
});

/* ------------------------------- result view ------------------------------ */

const resultQuestion = (overrides: Partial<ResultQuestion> = {}): ResultQuestion => ({
  id: '1',
  kind: 'mcq',
  typeLabel: 'MCQ',
  html: 'Q1',
  image: null,
  marks: 1,
  obtained: 1,
  outcome: 'correct',
  options: [],
  answerHtml: null,
  feedbackHtml: null,
  sampleAnswerHtml: null,
  explanationImage: null,
  parts: [],
  ...overrides,
});

describe('ResultView', () => {
  it('loads the result, then lets the student discuss a question with Vedica', async () => {
    server.use(
      http.get(`${API}/api/neet/mock-exam/get-mock-result`, () =>
        HttpResponse.json({
          success: true,
          data: {
            summary: { name: 'Full mock 1', total_marks: 8, total_marks_obtained: 4, set_id: 4, attempt_date: '2026-11-01T10:00:00Z' },
            questions: [
              {
                question_id: 1,
                question_text: 'Q1',
                question_image: 'https://cdn.test/q1.png',
                options: [{ option_id: 5, text: 'A' }, { option_id: 6, text: 'B' }],
                selected_option_id: 5,
                correct_option_id: 5,
                is_correct: true,
                explanation_image: 'https://cdn.test/exp.png',
              },
              { question_id: 2, question_text: 'Q2', options: [{ option_id: 7, text: 'C' }] },
            ],
          },
        }),
      ),
    );
    renderWithProviders(<ResultView testType="mock" attemptId="77" />, { exam: neet });
    expect(screen.getByLabelText('Loading your result')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Full mock 1 result' })).toBeInTheDocument();
    expect(screen.getByLabelText('Score 4 out of 8')).toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Explanation' })).toHaveAttribute('src', 'https://cdn.test/exp.png');
    expect(screen.getByText('Nailed it!')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Discuss with Vedica/ }));
    expect(await screen.findByRole('dialog', { name: 'Review chat' })).toHaveTextContent('chat 1 77');
    await userEvent.click(screen.getByRole('button', { name: 'Close chat' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Review chat' })).not.toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(screen.getByText('Q2')).toBeInTheDocument();
    expect(screen.getByText('Confused by this one?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Next/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /Previous/ }));
    expect(screen.getByText('Q1')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^Back/ }));
    expect(navigation.push).toHaveBeenCalledWith('/neet/mock-tests');
  });

  it('explains a failed load with a way back (HTTP 200 + success:false)', async () => {
    server.use(
      http.get(`${API}/api/v1/exams/mock-exam/fetch-mock-responses`, () =>
        HttpResponse.json({ success: false, message: 'Result not found' }),
      ),
    );
    renderWithProviders(<ResultView testType="mock" attemptId="1" />, { exam: cbse });
    expect(await screen.findByRole('heading', { name: "We couldn't load this result" })).toBeInTheDocument();
    expect(screen.getByText('Result not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Assessments' })).toHaveAttribute('href', '/cbse/assessments');
  });

  it('shows an empty competitive review', () => {
    renderWithProviders(
      <ResultContent
        category="competitive"
        home={{ label: 'Daily Practice', href: '/neet/daily-practice' }}
        result={{
          title: 'Daily practice result',
          totalMarks: 0,
          obtained: 0,
          attemptedAt: null,
          counts: { correct: 0, incorrect: 0, partial: 0, unattempted: 0 },
          questions: [],
        }}
      />,
      { exam: neet },
    );
    expect(screen.getByText('No questions to review.')).toBeInTheDocument();
  });

  it('shows board answers, feedback, parts and the ideal answer', async () => {
    renderWithProviders(
      <ResultContent
        category="board"
        home={{ label: 'Assessments', href: '/cbse/assessments' }}
        result={{
          title: 'Mock test result',
          totalMarks: 10,
          obtained: 6,
          attemptedAt: null,
          counts: { correct: 1, incorrect: 1, partial: 1, unattempted: 1 },
          questions: [
            resultQuestion({
              image: 'https://cdn.test/q.png',
              options: [
                { id: 'a', html: 'Both', image: null, isCorrect: true, isSelected: true },
                { id: 'b', html: 'Wrong pick', image: null, isCorrect: false, isSelected: true },
                { id: 'c', html: 'Right one', image: null, isCorrect: true, isSelected: false },
                { id: 'd', html: 'Other', image: null, isCorrect: false, isSelected: false },
              ],
            }),
            resultQuestion({
              id: '2',
              kind: 'written',
              html: 'Explain osmosis',
              marks: 3,
              obtained: null,
              outcome: 'partial',
              answerHtml: '<p>Water moves</p>',
              feedbackHtml: '<p>Mention membrane</p>',
              sampleAnswerHtml: '<p>Ideal osmosis</p>',
              explanationImage: 'https://cdn.test/osmosis.png',
            }),
            resultQuestion({
              id: '3',
              kind: 'multipart',
              html: 'Two parts',
              marks: null,
              outcome: 'incorrect',
              parts: [
                resultQuestion({ id: '3a', html: 'Part one', marks: null, obtained: null, outcome: 'unattempted' }),
              ],
            }),
          ],
        }}
      />,
      { exam: cbse },
    );
    expect(screen.getByRole('link', { name: 'Back to Assessments' })).toHaveAttribute('href', '/cbse/assessments');
    expect(screen.getByLabelText('Score 6 out of 10')).toBeInTheDocument();
    expect(screen.getByText('· Your answer · correct')).toBeInTheDocument();
    expect(screen.getByText('· Your answer')).toBeInTheDocument();
    expect(screen.getByText('· Correct answer')).toBeInTheDocument();

    const written = screen.getAllByRole('article', { name: 'Question 2' })[0]!;
    expect(within(written).getByText('Water moves')).toBeInTheDocument();
    expect(within(written).getByText('Mention membrane')).toBeInTheDocument();
    expect(within(written).getByText('Partially Correct')).toBeInTheDocument();
    expect(written).toHaveTextContent('Marks Obtained: 0/3');
    await userEvent.click(within(written).getByRole('button', { name: /View Ideal Answer/ }));
    expect(await within(written).findByText('Ideal osmosis')).toBeInTheDocument();
    expect(within(written).getByRole('img', { name: 'Explanation' })).toBeInTheDocument();
    await userEvent.click(within(written).getByRole('button', { name: /Hide Ideal Answer/ }));
    expect(within(written).queryByText('Ideal osmosis')).not.toBeInTheDocument();

    expect(screen.getByText('Part a · 0/0')).toBeInTheDocument();
    expect(screen.getByText('Not Attempted')).toBeInTheDocument();
    expect(screen.getByText('Incorrect')).toBeInTheDocument();
    // No paper id in the result: discussing falls back to the doubt solver.
    expect(screen.getAllByRole('link', { name: /Discuss with Vedica/ })[0]).toHaveAttribute('href', '/cbse/doubt-solver');
  });
});

/* ------------------------------ question view ----------------------------- */

const mcq: ExamQuestion = {
  id: 'q1',
  kind: 'mcq',
  typeLabel: 'Multiple choice',
  html: 'Pick one',
  image: 'https://cdn.test/q.png',
  marks: 1,
  options: [
    { id: 'a', html: 'Alpha', image: 'https://cdn.test/a.png' },
    { id: 'b', html: 'Beta', image: null },
  ],
  parts: [],
};

function Controlled({ question, look }: { question: ExamQuestion; look?: 'board' | 'competitive' }) {
  const [answer, setAnswer] = useState<Answer | undefined>();
  return (
    <>
      <QuestionView question={question} number={3} answer={answer} onAnswer={(a) => setAnswer(a ?? undefined)} look={look} />
      <output>{JSON.stringify(answer ?? null)}</output>
    </>
  );
}

async function insertPi(container: HTMLElement) {
  await userEvent.click(within(container).getByRole('button', { name: 'Math symbols' }));
  await userEvent.click(within(container).getByRole('button', { name: 'Insert π' }));
}

describe('QuestionView', () => {
  it('competitive: lettered options, answer and clear', async () => {
    renderWithProviders(<Controlled question={mcq} />);
    expect(screen.getByRole('heading', { name: 'Question 3' })).toBeVisible();
    expect(screen.getByText('Choose the correct answer from the options given below:')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /Beta/ }));
    expect(screen.getByRole('status')).toHaveTextContent('{"kind":"option","optionId":"b"}');
    await userEvent.click(screen.getByRole('button', { name: 'Clear response' }));
    expect(screen.getByRole('status')).toHaveTextContent('null');
  });

  it('board: numbered question with marks', () => {
    renderWithProviders(<Controlled question={mcq} look="board" />);
    expect(screen.getByText('Multiple choice · 1 mark')).toBeInTheDocument();
    renderWithProviders(<Controlled question={{ ...mcq, id: 'q2', marks: 2 }} look="board" />);
    expect(screen.getByText('Multiple choice · 2 marks')).toBeInTheDocument();
    renderWithProviders(<Controlled question={{ ...mcq, id: 'q3', marks: null, image: null }} look="board" />);
    expect(screen.getAllByText(/Multiple choice ·/)).toHaveLength(2);
  });

  it('written: types an answer', async () => {
    renderWithProviders(<Controlled question={{ ...mcq, kind: 'written', options: [], image: null }} look="board" />);
    await screen.findByRole('textbox', { name: 'Your answer' });
    await insertPi(document.body);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('"kind":"written"'));
    expect(screen.getByRole('status')).toHaveTextContent('"text":"π"');
  });

  it('multipart: answers each part separately', async () => {
    renderWithProviders(
      <Controlled
        question={{
          ...mcq,
          kind: 'multipart',
          options: [],
          parts: [
            { id: 'p1', html: 'First part', image: 'https://cdn.test/p1.png', marks: 2 },
            { id: 'p2', html: 'Second part', image: null, marks: null },
          ],
        }}
      />,
    );
    expect(screen.getByText('· 2 marks')).toBeInTheDocument();
    const partB = (await screen.findByRole('textbox', { name: 'Answer for part b' })).closest('section')!;
    await insertPi(partB);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('"kind":"parts"'));
    expect(screen.getByRole('status')).toHaveTextContent('"p2":{"text":"π"');
  });
});

/* ------------------------------- submit flow ------------------------------ */

describe('submit flow', () => {
  const counts = { answeredTotal: 3, unanswered: 2, marked: 1 } as Parameters<typeof SubmitDialog>[0]['counts'];

  it('summarises the attempt, warns about written grading and shows submit errors', async () => {
    const onSubmit = vi.fn();
    const onOpenChange = vi.fn();
    renderWithProviders(
      <SubmitDialog
        open
        onOpenChange={onOpenChange}
        counts={counts}
        total={5}
        hasWritten
        pending={false}
        error={new Error('x')}
        onSubmit={onSubmit}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Submit your test?' });
    expect(dialog).toHaveTextContent('You have answered 3 of 5 questions. 2 are still unanswered. 1 are marked for review.');
    expect(dialog).toHaveTextContent('Written answers are evaluated');
    expect(dialog).toHaveTextContent("We couldn't submit. Your answers are saved");
    await userEvent.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(onSubmit).toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep going' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('cannot be dismissed while evaluating', async () => {
    const onOpenChange = vi.fn();
    renderWithProviders(
      <SubmitDialog
        open
        onOpenChange={onOpenChange}
        counts={{ ...counts, unanswered: 0, marked: 0 }}
        total={3}
        hasWritten
        pending
        error={null}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByRole('dialog')).toHaveTextContent('You have answered 3 of 3 questions.');
    expect(screen.getByRole('button', { name: /Evaluating/ })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('shows the right waiting screen', () => {
    const { unmount } = renderWithProviders(<SubmittingScreen written />);
    expect(screen.getByRole('heading', { name: /Your answers are submitted/ })).toBeInTheDocument();
    unmount();
    renderWithProviders(<SubmittingScreen written={false} />);
    expect(screen.getByRole('heading', { name: 'Submitting your test' })).toBeInTheDocument();
  });

  it.each([
    [36, 40, 'Brilliant!'],
    [30, 40, 'Passed! Nice work.'],
    [15, 40, 'Keep practicing.'],
    [2, 40, 'Try again, you can!'],
  ])('rates %i/%i as "%s"', (obtained, totalMarks, text) => {
    renderWithProviders(
      <CompletedDialog
        summary={{ totalQuestions: 10, totalMarks, obtained, correct: 6, incorrect: 1, partial: 1 }}
        action={<button type="button">See result</button>}
      />,
    );
    expect(screen.getByText(new RegExp(text.replace('!', '\\!')))).toBeInTheDocument();
    expect(screen.getByLabelText(`Score ${obtained} out of ${totalMarks}`)).toBeInTheDocument();
    expect(screen.getByText('Partially Correct')).toBeInTheDocument();
    expect(screen.getByText('Total Questions: 10')).toBeInTheDocument();
  });

  it('handles a summary without totals', () => {
    renderWithProviders(
      <CompletedDialog
        summary={{ totalQuestions: null, totalMarks: null, obtained: null, correct: null, incorrect: 0, partial: 0 }}
        action={null}
      />,
    );
    expect(screen.getByLabelText('Score 0 out of 0')).toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(2);
    expect(screen.queryByText('Partially Correct')).not.toBeInTheDocument();
    expect(screen.queryByText(/Total Questions/)).not.toBeInTheDocument();
  });
});
