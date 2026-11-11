import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { navigation } from '@/test/setup';
import { ExamPlayer } from './exam-player';
import { testExam } from '@/test/exams';

const cbse = testExam('cbse');

function mockBoardPaper(onSubmit: (body: unknown) => void = () => undefined) {
  server.use(
    http.get(`${API}/api/v4/student/plans/active`, () =>
      HttpResponse.json({
        success: true,
        data: { plans: [{ plan_id: 1, class_id: 12, class_name: 'CLASS 12', duration_months: 12, status: 'active' }] },
      }),
    ),
    http.post(`${API}/api/v4/assessments/board/1/mid/sets/:setId/attempts`, () =>
      HttpResponse.json({
        success: true,
        data: {
          attempt_id: 61,
          time_left: 3600,
          questions: [
            {
              question_id: 1,
              question_type: 'mcq',
              question_text: 'SI unit of charge?',
              marks: 1,
              options: [
                { option_id: 11, option_text: 'Ampere' },
                { option_id: 12, option_text: 'Coulomb' },
              ],
              sub_questions: [],
            },
            {
              question_id: 2,
              question_type: 'short_answer',
              question_text: 'State Gauss law.',
              marks: 3,
              sub_questions: [],
            },
          ],
        },
      }),
    ),
    http.put(`${API}/api/v4/assessments/board/1/mid/attempts/61`, () =>
      HttpResponse.json({ success: true, data: { attempt_id: 61, time_left: 3500 } }),
    ),
    http.post(`${API}/api/v4/assessments/board/1/mid/attempts/61/submit`, async ({ request }) => {
      onSubmit(await request.json());
      return HttpResponse.json({
        success: true,
        data: {
          attempt_id: 42,
          summary: {
            total_questions: 2,
            total_marks: 4,
            total_marks_obtained: 3,
            correct_answers: 1,
            incorrect_answers: 0,
            partially_correct: 1,
          },
        },
      });
    }),
  );
}

describe('board player', () => {
  it('shows the status column, skips, opens submit on the last question and shows the score before the result', async () => {
    const onSubmit = vi.fn();
    mockBoardPaper(onSubmit);
    renderWithProviders(<ExamPlayer testType="mid" setId="5" />, { exam: cbse });

    expect(await screen.findByText('SI unit of charge?')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Status' })).toBeInTheDocument();
    expect(screen.getAllByRole('timer')[0]).toHaveTextContent(/0\d:\d{2}:\d{2}/);
    expect(screen.getAllByRole('tab', { name: 'Multiple choice' })[0]).toHaveAttribute('aria-selected', 'true');

    await userEvent.click(screen.getByRole('radio', { name: /Coulomb/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Skip' }));
    // Skipping clears the answer and moves on.
    expect(await screen.findByText('State Gauss law.')).toBeInTheDocument();
    expect(screen.getAllByRole('tab', { name: 'Short answer' })[0]).toHaveAttribute('aria-selected', 'true');
    // The side panel numbers questions across the paper, like the question card (not 1, 2 … per type).
    const panel = screen.getAllByRole('navigation', { name: 'Questions' })[0]!;
    expect(within(panel).getByRole('button', { name: 'Question 2' })).toHaveTextContent('Question 2');
    expect(within(panel).queryByText('Question 1')).not.toBeInTheDocument();

    await userEvent.type(
      await screen.findByRole('textbox', { name: 'Your answer' }),
      'Flux equals charge over epsilon',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save & Next' }));
    const dialog = await screen.findByRole('dialog', { name: 'Submit your test?' });
    expect(dialog).toHaveTextContent('You have answered 1 of 2 questions.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Submit' }));

    const done = await screen.findByRole('dialog', { name: 'Test Completed!' });
    expect(within(done).getByLabelText('Score 3 out of 4')).toBeInTheDocument();
    expect(done).toHaveTextContent('Partially Correct');
    expect(onSubmit).toHaveBeenCalledWith(
      {
        class_id: 12,
        answers: [
          { question_id: 1, status: 'skipped', selected_answer: { text: null, images: [] } },
          { question_id: 2, status: 'saved', selected_answer: { text: '<p>Flux equals charge over epsilon</p>', images: [] } },
        ],
      },
    );
    await userEvent.click(within(done).getByRole('button', { name: 'View result' }));
    expect(navigation.replace).toHaveBeenCalledWith('/cbse/tests/mid/result/42');
  });

  it('moves the highlighted question type when Skip goes into the next type, even after a tab was clicked', async () => {
    mockBoardPaper();
    renderWithProviders(<ExamPlayer testType="mid" setId="5" />, { exam: cbse });
    expect(await screen.findByText('SI unit of charge?')).toBeInTheDocument();
    const tab = (name: string) => screen.getAllByRole('tab', { name })[0]!;

    // Jump to the written question by its tab, then back to the MCQ from the side panel.
    await userEvent.click(tab('Short answer'));
    expect(await screen.findByText('State Gauss law.')).toBeInTheDocument();
    await userEvent.click(tab('Multiple choice'));
    expect(await screen.findByText('SI unit of charge?')).toBeInTheDocument();
    expect(tab('Multiple choice')).toHaveAttribute('aria-selected', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(await screen.findByText('State Gauss law.')).toBeInTheDocument();
    expect(tab('Short answer')).toHaveAttribute('aria-selected', 'true');
    expect(tab('Multiple choice')).toHaveAttribute('aria-selected', 'false');
    const panel = screen.getAllByRole('navigation', { name: 'Questions' })[0]!;
    expect(within(panel).getByRole('button', { name: 'Question 2' })).toHaveAttribute('aria-current', 'step');
  });

  it('shows a question listed twice in a session only once, with paper-wide numbers in the side panel', async () => {
    const short = (id: number) => ({ question_id: id, question_type: 'short_answer', question_text: `Short ${id}`, marks: 2, sub_questions: [] });
    server.use(
      http.get(`${API}/api/v4/student/plans/active`, () =>
        HttpResponse.json({ success: true, data: { plans: [{ plan_id: 1, class_id: 12, class_name: 'CLASS 12', status: 'active' }] } }),
      ),
      http.post(`${API}/api/v4/assessments/board/1/quiz/sets/:setId/attempts`, () =>
        HttpResponse.json({ success: true, data: { attempt_id: 7, time_left: 1800, questions: [short(17), short(26), short(17), short(18)] } }),
      ),
    );
    renderWithProviders(<ExamPlayer testType="quiz" setId="3" />, { exam: cbse });

    expect(await screen.findByText('Short 17')).toBeInTheDocument();
    const panel = screen.getAllByRole('navigation', { name: 'Questions' })[0]!;
    expect(within(panel).getAllByRole('button').map((b) => b.textContent?.trim())).toEqual(['Question 1', 'Question 2', 'Question 3']);
  });

  it('uploads a photo of a written answer', async () => {
    mockBoardPaper();
    server.use(
      http.post(`${API}/api/v4/assessments/answer-images`, () =>
        HttpResponse.json({ success: true, data: { url: 'https://img/answer.png', public_id: 'p1' } }),
      ),
    );
    renderWithProviders(<ExamPlayer testType="mid" setId="5" />, { exam: cbse });
    await screen.findByText('SI unit of charge?');
    await userEvent.click(screen.getAllByRole('tab', { name: 'Short answer' })[0]!);
    const input = await screen.findByTestId('answer-gallery');
    await userEvent.upload(input, new File(['x'], 'answer.png', { type: 'image/png' }));
    // The photo is inserted into the rich-text answer, like the previous editor.
    const editor = await screen.findByRole('textbox', { name: 'Your answer' });
    await waitFor(() =>
      expect(within(editor).getByAltText('Uploaded answer')).toHaveAttribute('src', 'https://img/answer.png'),
    );
  });

  it('types a spoken answer through the transcription API', async () => {
    mockBoardPaper();
    let contentType = '';
    server.use(
      http.post(`${API}/api/v4/chat/transcribe`, ({ request }) => {
        contentType = request.headers.get('content-type') ?? '';
        return HttpResponse.json({
          success: true,
          message: 'Audio transcribed',
          data: { text: 'Flux is proportional to charge' },
        });
      }),
    );
    class FakeRecorder {
      state = 'inactive';
      mimeType = 'audio/webm';
      stream: { getTracks: () => { stop: () => void }[] };
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      constructor(stream: FakeRecorder['stream']) {
        this.stream = stream;
      }
      start() {
        this.state = 'recording';
      }
      stop() {
        this.state = 'inactive';
        this.ondataavailable?.({ data: new Blob(['a'], { type: 'audio/webm' }) });
        this.onstop?.();
      }
    }
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: () => Promise.resolve({ getTracks: () => [{ stop: () => undefined }] }) },
    });

    renderWithProviders(<ExamPlayer testType="mid" setId="5" />, { exam: cbse });
    await screen.findByText('SI unit of charge?');
    await userEvent.click(screen.getAllByRole('tab', { name: 'Short answer' })[0]!);
    await userEvent.click(await screen.findByRole('button', { name: 'Answer by voice' }));
    expect(await screen.findByRole('button', { name: 'Stop recording' })).toHaveAttribute('aria-pressed', 'true');
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Stop recording' }));
    });
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Your answer' })).toHaveTextContent('Flux is proportional to charge'),
    );
    expect(contentType).toMatch(/multipart\/form-data/);
    vi.unstubAllGlobals();
  });
});
