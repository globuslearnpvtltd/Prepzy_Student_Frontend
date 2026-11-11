import { http, HttpResponse } from 'msw';
import { apiClient } from '@/shared/lib/api-client';
import { API, server } from '@/test/server';
import { emptySnapshot, withAnswer, withMarkToggled, withVisit } from '../attempt';
import { AlreadySubmittedError, type TestContext } from '../model';
import { competitiveSnapshot, toCompetitiveAnswers, toCompetitiveResultQuestion } from './competitive';
import { getTestAdapter } from './index';
import { testExam } from '@/test/exams';

const neet: TestContext = { exam: testExam('neet'), classId: 20 };
const V4 = `${API}/api/v4/assessments/competitive/${neet.exam.examId}`;
const question = {
  question_id: 1,
  question_text: 'Q',
  options: [
    { option_id: 5, text: 'A' },
    { option_id: 6, text: 'B' },
  ],
  status: 'not_visited',
};

describe('competitive mapping edge cases', () => {
  it('serialises review marks, skips and unknown options', () => {
    const raws = [question, { ...question, question_id: 2 }, { ...question, question_id: 3 }, { question_id: 4 }];
    let snap = withMarkToggled(emptySnapshot(), '1');
    snap = withVisit(snap, '2');
    snap = withAnswer(snap, '3', { kind: 'option', optionId: '99' });
    expect(toCompetitiveAnswers(raws, snap).map((q) => [q.selected_option, q.status])).toEqual([
      [null, 'marked_for_review'],
      [null, 'skipped'],
      [null, 'skipped'],
      [null, 'not_visited'],
    ]);
  });

  it('restores visits and ignores empty selections', () => {
    const snap = competitiveSnapshot([
      { ...question, selected_option: '', status: 'skipped' },
      { question_id: 2, selected_option: 6, status: 'marked_for_review' },
      { question_id: 3 },
    ]);
    expect(snap.answers).toEqual({ '2': { kind: 'option', optionId: '6' } });
    expect(snap.visited).toEqual(['1', '2']);
    expect(snap.marked).toEqual(['2']);
  });

  it('falls back to per-option correctness and explanation text', () => {
    const result = toCompetitiveResultQuestion({
      question_id: 1,
      options: [{ option_id: 5, is_correct: 1 }, { option_id: 6 }],
      selected_option_id: 6,
      is_correct: 0,
      explanation: '<p>Because</p>',
      marks_obtained: '-1',
    });
    expect(result.options.map((o) => [o.isCorrect, o.isSelected])).toEqual([
      [true, false],
      [false, true],
    ]);
    expect(result).toMatchObject({ outcome: 'incorrect', obtained: -1, sampleAnswerHtml: '<p>Because</p>', html: '' });
    expect(toCompetitiveResultQuestion({ question_id: 2 })).toMatchObject({ outcome: 'unattempted', options: [] });
  });
});

describe('NEET paper lists', () => {
  it('maps mock papers with their status and fallback titles', async () => {
    const seen = { params: new URLSearchParams() };
    server.use(
      http.get(`${API}/api/v4/assessments/competitive/2/mock/sets`, ({ request }) => {
        seen.params = new URL(request.url).searchParams;
        return HttpResponse.json({
          success: true,
          data: {
            sets: [
              { set_id: 1, name: 'Full mock 1', duration: '180', question_count: 180, ongoing_session: { session_id: 3 } },
              { set_id: 2, name: 'Mock 2', year: null, set_number: '2', attempt_count: 2 },
              { set_id: 3, status: 'completed' },
              { set_id: 4, status: 'in_progress' },
              { set_id: 5 },
            ],
          },
        });
      }),
    );
    const sets = await getTestAdapter(neet.exam, 'mock')!.listSets!(neet);
    expect([...seen.params.keys()]).toEqual(['class_id']);
    expect(seen.params.get('class_id')).toBe('20');
    expect(sets.map((s) => [s.id, s.title, s.subtitle, s.status])).toEqual([
      ['1', 'Full mock 1', null, 'in-progress'],
      ['2', 'Mock 2', null, 'completed'],
      ['3', 'Paper 3', null, 'completed'],
      ['4', 'Paper 4', null, 'in-progress'],
      ['5', 'Paper 5', null, 'new'],
    ]);
    expect(sets[0]).toMatchObject({ durationMinutes: 180, questionCount: 180 });
  });

  it('is empty when the list key is missing and rejects HTTP 200 failures', async () => {
    server.use(
      http.get(`${API}/api/v4/assessments/competitive/2/pyq/sets`, ({ request }) => {
        expect(new URL(request.url).search).toBe('');
        return HttpResponse.json({ success: true, data: { sets: [{ set_id: 9, name: 'NEET 2024', year: 2024, set_number: 'Set A' }] } });
      }),
    );
    expect((await getTestAdapter(neet.exam, 'pyq')!.listSets!(neet)).map((s) => [s.title, s.subtitle])).toEqual([['NEET 2024', '2024 · Set A']]);
    server.use(http.get(`${API}/api/v4/assessments/competitive/2/pyq/sets`, () => HttpResponse.json({ success: true })));
    expect(await getTestAdapter(neet.exam, 'pyq')!.listSets!(neet)).toEqual([]);
    server.use(
      http.get(`${API}/api/v4/assessments/competitive/2/pyq/sets`, () =>
        HttpResponse.json({ success: false, message: 'No plan' }),
      ),
    );
    await expect(getTestAdapter(neet.exam, 'pyq')!.listSets!(neet)).rejects.toThrow('No plan');
  });
});

describe('competitive player extras', () => {
  it('is untimed without time_left, saves only the choices with keepalive and names results after the paper', async () => {
    server.use(
      http.post(`${V4}/mock/sets/4/attempts`, () => HttpResponse.json({ success: true, data: { attempt_id: 61, status: 'in_progress' } })),
      http.get(`${V4}/mock/attempts/9/result`, () =>
        HttpResponse.json({
          success: true,
          data: {
            summary: { name: 'Full mock 1', total_marks: '720', total_marks_obtained: '600', set_id: 4, attempt_date: '2026-01-01' },
            questions: [{ question_id: 1, selected_option_id: 5, is_correct: true }, { question_id: 2 }],
          },
        }),
      ),
    );
    const keepalive = vi.spyOn(apiClient, 'keepalive').mockImplementation(() => undefined);
    const adapter = getTestAdapter(neet.exam, 'mock')!;
    const session = await adapter.start(neet, '4');
    expect(session).toMatchObject({ deadline: null, title: 'Mock test', questions: [] });
    await adapter.save(session, session.initial, neet, { keepalive: true });
    expect(keepalive).toHaveBeenCalledWith('PUT', '/api/v4/assessments/competitive/2/mock/attempts/61', { answers: [] });
    const result = await adapter.result('9', neet.exam);
    expect(result).toMatchObject({
      title: 'Full mock 1 result',
      totalMarks: 720,
      obtained: 600,
      attemptedAt: '2026-01-01',
      assessmentId: '4',
      counts: { correct: 1, unattempted: 1, incorrect: 0, partial: 0 },
    });
    keepalive.mockRestore();
  });

  it('handles a start without questions and empty submit / result bodies', async () => {
    server.use(
      http.post(`${V4}/pyq/sets/1/attempts`, () => HttpResponse.json({ success: true, data: { attempt_id: 3 } })),
      http.get(`${V4}/pyq/attempts/1/result`, () => HttpResponse.json({ success: true })),
      http.post(`${V4}/pyq/attempts/3/submit`, () => HttpResponse.json({ success: true })),
    );
    const adapter = getTestAdapter(neet.exam, 'pyq')!;
    const session = await adapter.start(neet, '1');
    expect(session.questions).toEqual([]);
    expect(await adapter.submit(session, session.initial, neet)).toEqual({ attemptId: '', summary: null });
    expect(await adapter.result('1', neet.exam)).toMatchObject({ title: 'Previous year paper result', totalMarks: 0, attemptedAt: null });
  });

  it.each([
    ['chapter-pyq', '12'],
    ['practice', '40'],
    ['custom', '7'],
  ] as const)('%s: starts by its own id and submits with the score', async (type, setId) => {
    let submitted: unknown;
    server.use(
      http.post(`${V4}/${type}/sets/${setId}/attempts`, () =>
        HttpResponse.json({ success: true, data: { attempt_id: 31, status: 'in_progress', time_left: 120, questions: [question] } }),
      ),
      http.post(`${V4}/${type}/attempts/31/submit`, async ({ request }) => {
        submitted = await request.json();
        return HttpResponse.json({
          success: true,
          data: { attempt_id: 90, summary: { total_questions: 1, total_marks: 4, total_marks_obtained: 4, correct_answers: 1, incorrect_answers: 0 } },
        });
      }),
    );
    const adapter = getTestAdapter(neet.exam, type)!;
    const session = await adapter.start(neet, setId);
    expect(session.deadline).toBeGreaterThan(Date.now());
    const outcome = await adapter.submit(session, withAnswer(session.initial, '1', { kind: 'option', optionId: '5' }), neet);
    expect(outcome).toMatchObject({ attemptId: '90', summary: { obtained: 4, correct: 1 } });
    expect(submitted).toEqual({ class_id: 20, answers: [{ question_id: 1, status: 'answered', selected_option: 5 }] });
  });

  it('opens the result when a custom test was submitted because its time ran out', async () => {
    server.use(http.post(`${V4}/custom/sets/7/attempts`, () => HttpResponse.json({ success: true, data: { attempt_id: 88, status: 'submitted' } })));
    const error = await getTestAdapter(neet.exam, 'custom')!.start(neet, '7').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AlreadySubmittedError);
    expect((error as AlreadySubmittedError).attemptId).toBe('88');
  });
});

describe('daily practice (DPP)', () => {
  const live = (data: unknown) =>
    http.get(`${API}/api/v4/assessments/competitive/2/dpp/live`, ({ request }) => {
      expect(new URL(request.url).search).toBe('');
      return HttpResponse.json({ success: true, message: 'Live DPP fetched', data });
    });

  it('lists nothing when there is no live DPP today', async () => {
    server.use(live(null));
    expect(await getTestAdapter(neet.exam, 'dpp')!.listSets!(neet)).toEqual([]);
  });

  it("lists today's paper with its attempt state", async () => {
    const adapter = getTestAdapter(neet.exam, 'dpp')!;
    server.use(
      live({
        dpp: { dpp_id: 7, dpp_name: 'DPP 7', dpp_date: '2026-11-08' },
        question_count: 15,
        attempt: { status: 'submitted', attempt_id: 70 },
      }),
    );
    const [submitted] = await adapter.listSets!(neet);
    expect(submitted).toMatchObject({
      id: '7',
      title: 'DPP 7',
      questionCount: 15,
      durationMinutes: 30,
      status: 'completed',
      lastAttemptId: '70',
    });
    expect(submitted!.subtitle).toMatch(/2026/);

    server.use(live({ dpp: { dpp_id: 8 }, attempt: { status: 'in_progress', attempt_id: 71 } }));
    expect((await adapter.listSets!(neet))[0]).toMatchObject({
      title: "Today's practice",
      subtitle: null,
      questionCount: null,
      durationMinutes: null,
      status: 'in-progress',
      lastAttemptId: null,
    });

    server.use(live({ dpp: { dpp_id: 9 }, attempt: null }));
    expect((await adapter.listSets!(neet))[0]!.status).toBe('new');
  });

  it('starts, saves (normally and on close), submits and loads the result', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${V4}/dpp/sets/7/attempts`, () =>
        HttpResponse.json({ success: true, data: { attempt_id: 70, status: 'in_progress', time_left: 60, questions: [question] } }),
      ),
      http.put(`${V4}/dpp/attempts/70`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ success: true, data: { attempt_id: 70 } });
      }),
      http.post(`${V4}/dpp/attempts/70/submit`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ success: true, data: { attempt_id: 70, summary: { total_marks: 4, total_marks_obtained: 4 } } });
      }),
      http.get(`${V4}/dpp/attempts/70/result`, () =>
        HttpResponse.json({ success: true, data: { summary: { total_marks: 4, total_marks_obtained: 4 }, questions: [] } }),
      ),
    );
    const keepalive = vi.spyOn(apiClient, 'keepalive').mockImplementation(() => undefined);
    const adapter = getTestAdapter(neet.exam, 'dpp')!;
    const session = await adapter.start(neet, '7');
    expect(session.deadline).toBeGreaterThan(Date.now());
    const snap = withAnswer(session.initial, '1', { kind: 'option', optionId: '6' });
    await adapter.save(session, snap, neet);
    await adapter.save(session, snap, neet, { keepalive: true });
    expect(keepalive).toHaveBeenCalledWith('PUT', '/api/v4/assessments/competitive/2/dpp/attempts/70', {
      answers: [{ question_id: 1, status: 'answered', selected_option: 6 }],
    });
    expect(await adapter.submit(session, snap, neet)).toMatchObject({ attemptId: '70', summary: { obtained: 4 } });
    expect(bodies).toEqual([
      { answers: [{ question_id: 1, status: 'answered', selected_option: 6 }] },
      { class_id: 20, answers: [{ question_id: 1, status: 'answered', selected_option: 6 }] },
    ]);
    expect(await adapter.result('70', neet.exam)).toMatchObject({ title: 'Daily practice result', obtained: 4 });
    keepalive.mockRestore();
  });

  it('starts untimed when the backend sends no timer', async () => {
    server.use(http.post(`${V4}/dpp/sets/7/attempts`, () => HttpResponse.json({ success: true, data: { attempt_id: 70 } })));
    const session = await getTestAdapter(neet.exam, 'dpp')!.start(neet, '7');
    expect(session).toMatchObject({ deadline: null, questions: [] });
  });
});
