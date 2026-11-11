import { http, HttpResponse } from 'msw';
import { API, server } from '@/test/server';
import { withAnswer } from '../attempt';
import type { TestContext } from '../model';
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

/** Every board test type runs on the v4 exam player: same payloads, its own test type in the URL. */
const BOARD_TYPES = ['mock', 'pyq', 'chapter-pyq', 'custom', 'mid', 'final', 'quiz'] as const;

describe.each(BOARD_TYPES)('board %s adapter', (type) => {
  const base = `${API}/api/v4/assessments/board/${cbse.exam.examId}/${type}`;

  it('starts, saves only the answers, submits with stats and maps the graded result', async () => {
    const bodies: Record<string, unknown> = {};
    server.use(
      http.post(`${base}/sets/31/attempts`, async ({ request }) => {
        bodies.start = await request.json();
        return HttpResponse.json({ success: true, data: { attempt_id: 61, set_id: 31, time_left: 600, questions: [boardQuestion] } });
      }),
      http.put(`${base}/attempts/61`, async ({ request }) => {
        bodies.save = await request.json();
        return HttpResponse.json({ success: true, data: { attempt_id: 61, time_left: 590 } });
      }),
      http.post(`${base}/attempts/61/submit`, async ({ request }) => {
        bodies.submit = await request.json();
        return HttpResponse.json({ success: true, data: { attempt_id: 700, summary: submitStats } });
      }),
      http.get(`${base}/attempts/700/result`, () =>
        HttpResponse.json({
          success: true,
          data: {
            attempt_id: 700,
            set_id: 31,
            total_marks: 1,
            total_marks_obtained: 1,
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
          },
        }),
      ),
    );
    const adapter = getTestAdapter(cbse.exam, type)!;

    const before = Date.now();
    const session = await adapter.start(cbse, '31');
    expect(bodies.start).toEqual({ class_id: 12 });
    expect(session.deadline).toBeGreaterThanOrEqual(before + 600_000);
    const snapshot = withAnswer(session.initial, '1', { kind: 'option', optionId: '11' });

    await adapter.save(session, snapshot, cbse);
    expect(bodies.save).toEqual({ answers: [{ question_id: 1, status: 'saved', selected_answer: { text: '11', images: [] } }] });

    const outcome = await adapter.submit(session, snapshot, cbse);
    expect(outcome).toEqual({
      attemptId: '700',
      summary: { totalQuestions: 1, totalMarks: 4, obtained: 4, correct: 1, incorrect: 0, partial: 0 },
    });
    expect(bodies.submit).toMatchObject({ class_id: 12, answers: [{ question_id: 1, status: 'saved' }] });

    const graded = await adapter.result('700', cbse.exam);
    expect(graded).toMatchObject({ totalMarks: 1, obtained: 1, counts: { correct: 1 }, assessmentId: '31' });
  });
});

/** Every competitive test type runs on the v4 player; chapter PYQs by module id, practice by assessment id. */
const COMPETITIVE_TYPES = [
  ['mock', '4'],
  ['pyq', '5'],
  ['chapter-pyq', '14'],
  ['custom', '1'],
  ['dpp', '7'],
  ['practice', '40'],
] as const;

describe.each(COMPETITIVE_TYPES)('competitive %s adapter', (type, setId) => {
  const base = `${API}/api/v4/assessments/competitive/${neet.exam.examId}/${type}`;

  it('starts, saves only the choices, submits with stats and maps the result', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${base}/sets/${setId}/attempts`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({
          success: true,
          data: { attempt_id: 61, set_id: Number(setId), status: 'in_progress', name: 'Cell biology · Set 1', time_left: 120, questions: [neetQuestion] },
        });
      }),
      http.put(`${base}/attempts/61`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ success: true, data: { attempt_id: 61, time_left: 100 } });
      }),
      http.post(`${base}/attempts/61/submit`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ success: true, data: { attempt_id: 81, summary: submitStats } });
      }),
      http.get(`${base}/attempts/81/result`, () =>
        HttpResponse.json({
          success: true,
          data: {
            summary: { total_marks: 4, total_marks_obtained: 4, set_id: Number(setId) },
            questions: [{ ...neetQuestion, selected_option_id: 5, correct_option_id: 5, is_correct: true }],
          },
        }),
      ),
    );
    const adapter = getTestAdapter(neet.exam, type)!;
    const before = Date.now();
    const session = await adapter.start(neet, setId);
    expect(session.title).toBe('Cell biology · Set 1');
    expect(session.deadline).toBeGreaterThanOrEqual(before + 120_000);
    const snap = withAnswer(session.initial, '1', { kind: 'option', optionId: '5' });
    await adapter.save(session, snap, neet);
    const outcome = await adapter.submit(session, snap, neet);
    expect(outcome.attemptId).toBe('81');
    expect(outcome.summary?.correct).toBe(1);
    const answers = [{ question_id: 1, status: 'answered', selected_option: 5 }];
    expect(bodies).toEqual([{ class_id: 20 }, { answers }, { class_id: 20, answers }]);
    const result = await adapter.result('81', neet.exam);
    expect(result).toMatchObject({ counts: { correct: 1 }, assessmentId: setId });
  });
});

describe('competitive adapters', () => {
  it('only paper types with a list appear in the tests hub', () => {
    expect(listableTestTypes(cbse.exam)).toEqual(['mock', 'pyq']);
    expect(listableTestTypes(neet.exam)).toEqual(['mock', 'pyq', 'dpp']);
  });
});
