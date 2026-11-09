import { http, HttpResponse } from 'msw';
import { API, server } from '@/test/server';
import { withAnswer } from '../attempt';
import { AlreadySubmittedError, type TestContext } from '../model';
import { getTestAdapter, listableTestTypes } from './index';
import { testExam } from '@/test/exams';

const cbse: TestContext = { exam: testExam('cbse'), classId: 12 };
const neet: TestContext = { exam: testExam('neet'), classId: 20 };

const boardQuestion = {
  question_id: 1,
  question_type: 'mcq',
  question_text: '2 + 2?',
  marks: 1,
  options: [
    { option_id: 10, option_text: '3' },
    { option_id: 11, option_text: '4' },
  ],
  sub_questions: [],
};
const neetQuestion = { question_id: 1, question_text: 'Q', options: [{ option_id: 5, text: 'A' }], status: 'not_visited' };
const submitStats = {
  total_questions: 1,
  total_marks: 4,
  total_marks_obtained: 4,
  correct_answers: 1,
  incorrect_answers: 0,
  partially_correct: 0,
};

/** Board test types opened from Learn: same payloads as mock papers, their own endpoints. */
const BOARD_TYPES = [
  {
    type: 'chapter-pyq',
    fetch: '/api/v1/exams/chapter-pyqs/fetch-chapter-pyqs-questions',
    save: '/api/v1/exams/chapter-pyqs/update-chapter-pyqs-session-questions',
    submit: '/api/v1/exams/chapter-pyqs/submit-exam',
    result: '/api/v1/exams/chapter-pyqs/fetch-chapter-pyqs-responses',
  },
  {
    type: 'custom',
    fetch: '/api/v1/exams/custom-exam/fetch-custom-exam',
    save: '/api/custom-exams/update-custom-exam-session-questions',
    submit: '/api/v1/exams/custom-exam/submit-exam',
    result: '/api/v1/exams/custom-exam/fetch-custom-exam-responses',
  },
  {
    type: 'mid',
    fetch: '/api/v1/exams/mid-exam/fetch-mid-questions',
    save: '/api/mid-exams/update-mid-session-questions',
    submit: '/api/v1/exams/mid-exam/submit-exam',
    result: '/api/v1/exams/mid-exam/fetch-mid-responses',
  },
  {
    type: 'final',
    fetch: '/api/v1/exams/final-exam/fetch-final-questions',
    save: '/api/final-exams/update-final-session-questions',
    submit: '/api/v1/exams/final-exam/submit-exam',
    result: '/api/v1/exams/final-exam/fetch-final-responses',
  },
  {
    type: 'quiz',
    fetch: '/api/v1/exams/quiz/fetch-quiz-questions',
    save: '/api/quiz-exams/update-quiz-session-questions',
    submit: '/api/v1/exams/quiz/submit-exam',
    result: '/api/quiz-exams/fetch-quiz-responses',
  },
] as const;

describe.each(BOARD_TYPES)('board $type adapter', ({ type, fetch, save, submit, result }) => {
  it('fetches, saves, submits with stats and maps the graded result', async () => {
    const bodies: Record<string, unknown> = {};
    server.use(
      http.get(`${API}${fetch}`, ({ request }) => {
        const params = new URL(request.url).searchParams;
        expect(params.get('set_id')).toBe('31');
        expect(params.get('class_id')).toBe('12');
        return HttpResponse.json({ success: true, questions: [boardQuestion], time_left: 600 });
      }),
      http.put(`${API}${save}`, async ({ request }) => {
        bodies.save = await request.json();
        return HttpResponse.json({ success: true });
      }),
      http.post(`${API}${submit}`, async ({ request }) => {
        bodies.submit = await request.json();
        return HttpResponse.json({ success: true, data: { ...submitStats, attempt_id: 700 } });
      }),
      http.get(`${API}${result}`, () =>
        HttpResponse.json({
          success: true,
          marks: { total_marks: 1, total_marks_obtained: 1 },
          responses: [
            {
              id: 1,
              question_type: 'mcq',
              question_text: '2 + 2?',
              total_marks: 1,
              marks_obtained: 1,
              options: [{ option_id: 11, option_text: '4', isSelected: true, isCorrectAnswer: true }],
            },
          ],
        }),
      ),
    );
    const adapter = getTestAdapter(cbse.exam, type)!;
    expect(adapter.listSets).toBeUndefined();

    const before = Date.now();
    const session = await adapter.start(cbse, '31');
    expect(session.deadline).toBeGreaterThanOrEqual(before + 600_000);
    const snapshot = withAnswer(session.initial, '1', { kind: 'option', optionId: '11' });

    await adapter.save(session, snapshot, cbse);
    expect(bodies.save).toMatchObject({ set_id: '31', questions: [{ status: 'saved', selected_answer: { text: 11 } }] });

    const outcome = await adapter.submit(session, snapshot, cbse);
    expect(outcome).toEqual({
      attemptId: '700',
      summary: { totalQuestions: 1, totalMarks: 4, obtained: 4, correct: 1, incorrect: 0, partial: 0 },
    });
    expect(bodies.submit).toMatchObject({ set_id: '31', class_id: 12 });

    const graded = await adapter.result('700');
    expect(graded).toMatchObject({ totalMarks: 1, obtained: 1, counts: { correct: 1 } });
  });
});

describe('competitive session adapters', () => {
  it('chapter PYQ is keyed by module id', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${API}/api/neet/chapter-pyq-exam/start-chapter-pyq-exam`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({
          success: true,
          data: { module_id: 14, session_expiry_time: '2030-01-01T00:00:00.000Z', questions: [neetQuestion] },
        });
      }),
      http.put(`${API}/api/neet/chapter-pyq-exam/update-chapter-pyq-session-questions`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ success: true });
      }),
      http.post(`${API}/api/neet/chapter-pyq-exam/submit-chapter-pyq-exam`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ success: true, data: { ...submitStats, attempt_id: 81 } });
      }),
      http.get(`${API}/api/neet/chapter-pyq-exam/get-chapter-pyq-result`, () =>
        HttpResponse.json({
          success: true,
          data: {
            summary: { total_marks: 4, total_marks_obtained: 4 },
            questions: [{ ...neetQuestion, selected_option_id: 5, correct_option_id: 5, is_correct: true }],
          },
        }),
      ),
    );
    const adapter = getTestAdapter(neet.exam, 'chapter-pyq')!;
    const session = await adapter.start(neet, '14');
    expect(session.deadline).toBe(Date.parse('2030-01-01T00:00:00.000Z'));
    const snap = withAnswer(session.initial, '1', { kind: 'option', optionId: '5' });
    await adapter.save(session, snap, neet);
    const outcome = await adapter.submit(session, snap, neet);
    expect(outcome.attemptId).toBe('81');
    expect(outcome.summary?.correct).toBe(1);
    expect(bodies).toEqual([
      { module_id: '14', class_id: 20 },
      { module_id: '14', questions: [expect.objectContaining({ selected_option: 5, status: 'answered' })] },
      expect.objectContaining({ module_id: '14', class_id: 20 }),
    ]);
    expect((await adapter.result('81')).counts.correct).toBe(1);
  });

  it('custom test: uses remaining seconds and opens the result when time ran out', async () => {
    server.use(
      http.post(`${API}/api/neet/custom-exam/start-custom-exam`, async ({ request }) => {
        const { set_id } = (await request.json()) as { set_id: string };
        if (set_id === '2')
          return HttpResponse.json({ success: true, data: { set_id: 2, expired_submitted: true, attempt_id: 64 } });
        return HttpResponse.json({
          success: true,
          data: { set_id: 1, name: 'Cell biology · Set 1', remaining_seconds: 120, questions: [neetQuestion] },
        });
      }),
    );
    const adapter = getTestAdapter(neet.exam, 'custom')!;
    const before = Date.now();
    const session = await adapter.start(neet, '1');
    expect(session.title).toBe('Cell biology · Set 1');
    expect(session.deadline).toBeGreaterThanOrEqual(before + 120_000);
    const error = await adapter.start(neet, '2').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AlreadySubmittedError);
    expect((error as AlreadySubmittedError).attemptId).toBe('64');
  });

  it('practice questions are keyed by assessment id with a top-level attempt id', async () => {
    let submitted: unknown;
    server.use(
      http.get(`${API}/api/neet/quiz-exam/fetch-quiz-questions`, ({ request }) => {
        expect(new URL(request.url).searchParams.get('assessment_id')).toBe('40');
        return HttpResponse.json({ success: true, questions: [neetQuestion], time_left: 300 });
      }),
      http.put(`${API}/api/neet/quiz-exam/update-quiz-session-questions`, () => HttpResponse.json({ success: true })),
      http.post(`${API}/api/neet/quiz-exam/submit-exam`, async ({ request }) => {
        submitted = await request.json();
        return HttpResponse.json({ success: true, attempt_id: 12, data: submitStats });
      }),
      http.get(`${API}/api/neet/quiz-exam/fetch-quiz-responses`, () =>
        HttpResponse.json({ success: true, data: { summary: { total_marks: 4, total_marks_obtained: 0 }, questions: [] } }),
      ),
    );
    const adapter = getTestAdapter(neet.exam, 'practice')!;
    const session = await adapter.start(neet, '40');
    expect(session.questions).toHaveLength(1);
    await adapter.save(session, session.initial, neet);
    const outcome = await adapter.submit(session, session.initial, neet);
    expect(outcome.attemptId).toBe('12');
    expect(submitted).toMatchObject({ assessment_id: '40', questions: [{ status: 'not_visited' }] });
    expect((await adapter.result('12')).totalMarks).toBe(4);
  });

  it('only paper types with a list appear in the tests hub', () => {
    expect(listableTestTypes(cbse.exam)).toEqual(['mock', 'pyq']);
    expect(listableTestTypes(neet.exam)).toEqual(['mock', 'pyq', 'dpp']);
  });
});
