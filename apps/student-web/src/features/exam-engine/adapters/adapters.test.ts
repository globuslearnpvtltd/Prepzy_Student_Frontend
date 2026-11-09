import { http, HttpResponse } from 'msw';
import { getExam } from '@/shared/config/exams';
import { API, server } from '@/test/server';
import { emptySnapshot, withAnswer, withMarkToggled, withVisit } from '../attempt';
import { AlreadySubmittedError, type TestContext } from '../model';
import { boardSnapshot, toBoardPayload, toBoardQuestion, toBoardResultQuestion, type RawBoardQuestion } from './board';
import {
  competitiveSnapshot,
  toCompetitivePayload,
  toCompetitiveResultQuestion,
  type RawCompetitiveQuestion,
} from './competitive';
import { getTestAdapter } from './index';

const cbse: TestContext = { exam: getExam('cbse')!, classId: 12 };
const neet: TestContext = { exam: getExam('neet')!, classId: 20 };

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

  it('writes every answer back in the backend shape (not just the current question)', () => {
    let snap = withAnswer(emptySnapshot(), '1', { kind: 'option', optionId: '11' });
    snap = withAnswer(snap, '2', {
      kind: 'written',
      text: 'Because <light>',
      images: [{ url: 'https://img/a.png', publicId: 'a' }],
    });
    snap = withAnswer(snap, '3', { kind: 'parts', parts: { '31': { text: 'Part A', images: [] } } });
    const [mcq, written, multipart] = toBoardPayload([boardMcq, boardWritten, boardCase], snap);

    expect(mcq).toMatchObject({
      status: 'saved',
      selected_answer: { text: 11, images: [{ url: 'https://img/4.png', public_id: '' }] },
    });
    expect(written?.selected_answer).toEqual({
      text: '<p>Because &lt;light&gt;</p><p><img src="https://img/a.png" alt="Answer image"></p>',
      images: [{ url: 'https://img/a.png', public_id: 'a' }],
    });
    expect(multipart?.sub_questions?.[0]?.selected_answer).toMatchObject({ text: '<p>Part A</p>' });
    expect(multipart?.sub_questions?.[1]?.selected_answer).toEqual({ text: null, images: [] });
  });

  it('marks visited-but-blank questions as skipped and untouched ones as unanswered', () => {
    const payload = toBoardPayload([boardMcq, boardWritten], withVisit(emptySnapshot(), '1'));
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
    const payload = toCompetitivePayload(raws, snap);
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
  it('NEET mock: starts with an absolute deadline and submits the full paper', async () => {
    let submitted: Record<string, unknown> = {};
    server.use(
      http.post(`${API}/api/neet/mock-exam/start-mock-exam`, () =>
        HttpResponse.json({
          success: true,
          data: {
            set_id: 4,
            session_expiry_time: '2030-01-01T10:00:00.000Z',
            questions: [
              { question_id: 1, question_text: 'Q', options: [{ option_id: 5, text: 'A' }], status: 'not_visited' },
            ],
          },
        }),
      ),
      http.post(`${API}/api/neet/mock-exam/submit-mock-exam`, async ({ request }) => {
        submitted = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ success: true, data: { attempt_id: 99 } });
      }),
    );
    const adapter = getTestAdapter(neet.exam, 'mock')!;
    const session = await adapter.start(neet, '4');
    expect(session.deadline).toBe(Date.parse('2030-01-01T10:00:00.000Z'));
    const result = await adapter.submit(
      session,
      withAnswer(session.initial, '1', { kind: 'option', optionId: '5' }),
      neet,
    );
    expect(result.attemptId).toBe('99');
    expect(submitted).toMatchObject({
      set_id: '4',
      class_id: 20,
      questions: [{ selected_option: 5, status: 'answered' }],
    });
  });

  it('DPP: an already-submitted paper raises AlreadySubmittedError with its attempt id', async () => {
    server.use(
      http.get(`${API}/api/neet/start-dpp-attempt`, () =>
        HttpResponse.json({ already_attempted: true, attempt_id: 55 }),
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
      http.get(`${API}/api/v4/assessments/board/subjects`, ({ request }) => {
        expect(new URL(request.url).searchParams.get('class_id')).toBe('12');
        return HttpResponse.json({
          success: true, data: {
          mock_result: [{ subject_id: 3, subject_title: 'Physics', exam_count: 2 }],
          pyq_result: [] } });
      }),
      http.get(`${API}/api/mock-exams/fetch-mock-sets`, () =>
        HttpResponse.json({
          success: true,
          data: {
            papers: [
              {
                set_id: 8,
                set_number: 2,
                subject: 'Physics',
                totalQuestion: 30,
                status: 'completed',
                total_marks: 80,
                latest_mark: 61,
                attempt_id: 300,
              },
            ],
          },
        }),
      ),
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
