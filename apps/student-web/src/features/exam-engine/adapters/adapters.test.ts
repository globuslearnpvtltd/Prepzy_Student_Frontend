import { http, HttpResponse } from 'msw';
import { API, server } from '@/test/server';
import { emptySnapshot, withAnswer, withMarkToggled, withVisit } from '../attempt';
import { AlreadySubmittedError, type TestContext } from '../model';
import { boardSnapshot, toBoardAnswers, toBoardQuestion, toBoardResultQuestion, type RawBoardQuestion } from './board';
import {
  competitiveSnapshot,
  toCompetitiveAnswers,
  toCompetitiveResultQuestion,
  type RawCompetitiveQuestion,
} from './competitive';
import { getTestAdapter } from './index';
import { testExam } from '@/test/exams';

const cbse: TestContext = { exam: testExam('cbse'), classId: 12 };
const neet: TestContext = { exam: testExam('neet'), classId: 20 };

const boardMcq: RawBoardQuestion = {
  question_id: 1,
  question_type: 'mcq',
  question_text: '<p>2 + 2?</p>',
  marks: 1,
  options: [
    { option_id: 10, option_text: '3' },
    { option_id: 11, option_text: '4', option_image: 'https://img/4.png' },
  ],
  sub_questions: [],
};
const boardWritten: RawBoardQuestion = {
  question_id: 2,
  question_type: 'short_answer',
  question_text: 'Explain',
  sub_questions: [],
};
const boardCase: RawBoardQuestion = {
  question_id: 3,
  question_type: 'case_based',
  sub_questions: [
    { id: 31, sub_question_text: 'a)', mark: 2 },
    { id: 32, sub_question_text: 'b)', mark: 2 },
  ],
};

describe('board adapter mapping', () => {
  it('detects question kinds — an empty sub_questions list is NOT multipart', () => {
    expect(toBoardQuestion(boardMcq).kind).toBe('mcq');
    expect(toBoardQuestion(boardWritten).kind).toBe('written');
    expect(toBoardQuestion(boardCase).kind).toBe('multipart');
    expect(toBoardQuestion(boardWritten).typeLabel).toBe('Short answer');
    expect(toBoardQuestion({ question_id: 9, question_type: 'odd_type' }).typeLabel).toBe('Odd type');
  });

  it('sends every answer by question id (not just the current question, never the questions)', () => {
    let snap = withAnswer(emptySnapshot(), '1', { kind: 'option', optionId: '11' });
    snap = withAnswer(snap, '2', {
      kind: 'written',
      text: 'Because <light>',
      images: [{ url: 'https://img/a.png', publicId: 'a' }],
    });
    snap = withAnswer(snap, '3', { kind: 'parts', parts: { '31': { text: 'Part A', images: [] } } });
    const [mcq, written, multipart] = toBoardAnswers([boardMcq, boardWritten, boardCase], snap);

    expect(mcq).toEqual({ question_id: 1, status: 'saved', selected_answer: { text: '11', images: [] } });
    expect(written?.selected_answer).toEqual({
      text: '<p>Because &lt;light&gt;</p><p><img src="https://img/a.png" alt="Answer image"></p>',
      images: [{ url: 'https://img/a.png', public_id: 'a' }],
    });
    expect(multipart?.sub_answers?.[0]).toMatchObject({ id: 31, selected_answer: { text: '<p>Part A</p>' } });
    expect(multipart?.sub_answers?.[1]?.selected_answer).toEqual({ text: null, images: [] });
    expect(JSON.stringify([mcq, written, multipart])).not.toMatch(/question_text|options/);
  });

  it('marks visited-but-blank questions as skipped and untouched ones as unanswered', () => {
    const payload = toBoardAnswers([boardMcq, boardWritten], withVisit(emptySnapshot(), '1'));
    expect(payload.map((q) => q.status)).toEqual(['skipped', 'unanswered']);
  });

  it('restores progress when resuming', () => {
    const snap = boardSnapshot([
      { ...boardMcq, selected_answer: { text: 11 }, status: 'saved' },
      { ...boardWritten, selected_answer: { text: '<p>Hello<br>world</p>', images: [] }, status: 'saved' },
    ]);
    expect(snap.answers['1']).toEqual({ kind: 'option', optionId: '11' });
    expect(snap.answers['2']).toMatchObject({ kind: 'written', text: 'Hello\nworld' });
    expect(snap.visited).toEqual(['1', '2']);
  });

  it('maps graded responses to outcomes', () => {
    const correct = toBoardResultQuestion(
      {
        id: 1,
        question_type: 'mcq',
        total_marks: 1,
        marks_obtained: 1,
        options: [{ option_id: 1, option_text: 'x', isSelected: true, isCorrectAnswer: true }],
      },
      0,
    );
    const partial = toBoardResultQuestion(
      { id: 2, question_type: 'long_answer', total_marks: 5, marks_obtained: 3, selected_answer: { text: '<p>a</p>' } },
      1,
    );
    const blank = toBoardResultQuestion(
      { id: 3, question_type: 'long_answer', total_marks: 5, marks_obtained: 0, selected_answer: {} },
      2,
    );
    const wrong = toBoardResultQuestion(
      {
        id: 4,
        question_type: 'short_answer',
        total_marks: 2,
        marks_obtained: 0,
        selected_answer: { text: '<p>no</p>' },
      },
      3,
    );
    expect([correct.outcome, partial.outcome, blank.outcome, wrong.outcome]).toEqual([
      'correct',
      'partial',
      'unattempted',
      'incorrect',
    ]);
    expect(partial.answerHtml).toBe('<p>a</p>');
  });
});

describe('competitive adapter mapping', () => {
  const raws: RawCompetitiveQuestion[] = [
    {
      question_id: 1,
      options: [
        { option_id: 5, text: 'A' },
        { option_id: 6, text: 'B' },
      ],
    },
    { question_id: 2, options: [{ option_id: 7, text: 'C' }] },
    { question_id: 3, options: [] },
  ];

  it('serialises NEET statuses and selected options', () => {
    let snap = withAnswer(emptySnapshot(), '1', { kind: 'option', optionId: '6' });
    snap = withMarkToggled(snap, '2');
    const payload = toCompetitiveAnswers(raws, snap);
    expect(payload.map((q) => [q.selected_option, q.status])).toEqual([
      [6, 'answered'],
      [null, 'marked_for_review'],
      [null, 'not_visited'],
    ]);
  });

  it('restores answers and review marks from the server', () => {
    const snap = competitiveSnapshot([
      { ...raws[0]!, selected_option: 5, status: 'answered' },
      { ...raws[1]!, status: 'marked_for_review' },
      { ...raws[2]!, status: 'not_visited' },
    ]);
    expect(snap).toEqual({ answers: { '1': { kind: 'option', optionId: '5' } }, visited: ['1', '2'], marked: ['2'] });
  });

  it('marks correct and selected options in results', () => {
    const q = toCompetitiveResultQuestion({
      question_id: 1,
      options: [
        { option_id: 5, text: 'A' },
        { option_id: 6, text: 'B' },
      ],
      selected_option_id: 5,
      correct_option_id: 6,
      is_correct: 0,
      explanation: 'Because B',
    });
    expect(q.outcome).toBe('incorrect');
    expect(q.options.map((o) => [o.isSelected, o.isCorrect])).toEqual([
      [true, false],
      [false, true],
    ]);
    expect(q.sampleAnswerHtml).toBe('Because B');
  });
});

describe('adapters against the API', () => {
  it('NEET mock: starts with the time left and submits only the choices', async () => {
    let submitted: Record<string, unknown> = {};
    const v4 = `${API}/api/v4/assessments/competitive/${neet.exam.examId}/mock`;
    server.use(
      http.post(`${v4}/sets/4/attempts`, () =>
        HttpResponse.json({
          success: true,
          data: {
            attempt_id: 61,
            set_id: 4,
            status: 'in_progress',
            time_left: 3600,
            questions: [{ question_id: 1, question_text: 'Q', options: [{ option_id: 5, text: 'A' }], status: 'not_visited' }],
          },
        }),
      ),
      http.post(`${v4}/attempts/61/submit`, async ({ request }) => {
        submitted = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ success: true, data: { attempt_id: 99, summary: {} } });
      }),
    );
    const adapter = getTestAdapter(neet.exam, 'mock')!;
    const before = Date.now();
    const session = await adapter.start(neet, '4');
    expect(session.deadline).toBeGreaterThanOrEqual(before + 3_600_000);
    const result = await adapter.submit(session, withAnswer(session.initial, '1', { kind: 'option', optionId: '5' }), neet);
    expect(result.attemptId).toBe('99');
    expect(submitted).toEqual({ class_id: 20, answers: [{ question_id: 1, selected_option: 5, status: 'answered' }] });
  });

  it('DPP: an already-submitted paper raises AlreadySubmittedError with its attempt id', async () => {
    server.use(
      http.post(`${API}/api/v4/assessments/competitive/${neet.exam.examId}/dpp/sets/7/attempts`, () =>
        HttpResponse.json({ success: true, data: { attempt_id: 55, set_id: 7, status: 'submitted' } }),
      ),
    );
    const error = await getTestAdapter(neet.exam, 'dpp')!
      .start(neet, '7')
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AlreadySubmittedError);
    expect((error as AlreadySubmittedError).attemptId).toBe('55');
  });

  it('board mock: lists subjects and papers for the class', async () => {
    server.use(
      http.get(`${API}/api/v4/assessments/board/1/mock/subjects`, ({ request }) => {
        expect(new URL(request.url).searchParams.get('class_id')).toBe('12');
        return HttpResponse.json({ success: true, data: [{ subject_id: 3, subject_title: 'Physics', exam_count: 2 }] });
      }),
      http.get(`${API}/api/v4/assessments/board/1/mock/sets`, ({ request }) => {
        const query = new URL(request.url).searchParams;
        expect([query.get('subject_id'), query.get('class_id')]).toEqual(['3', '12']);
        return HttpResponse.json({
          success: true,
          data: {
            papers: [
              {
                set_id: 8,
                set_number: 2,
                subject_name: 'Physics',
                total_questions: 30,
                status: 'completed',
                total_marks: 80,
                latest_marks: 61,
                latest_attempt_id: 300,
              },
            ],
          },
        });
      }),
    );
    const adapter = getTestAdapter(cbse.exam, 'mock')!;
    expect(await adapter.listSubjects!(cbse)).toEqual([{ id: '3', title: 'Physics', count: 2 }]);
    expect(await adapter.listSets!(cbse, "3")).toEqual([
      {
        id: '8',
        title: 'Paper 2',
        subtitle: 'Physics',
        questionCount: 30,
        durationMinutes: 180,
        status: 'completed',
        lastScore: { obtained: 61, total: 80 },
        lastAttemptId: '300',
      },
    ]);
  });
});
