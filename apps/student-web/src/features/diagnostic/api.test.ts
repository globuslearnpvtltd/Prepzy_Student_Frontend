import { http, HttpResponse } from 'msw';
import { apiClient } from '@/shared/lib/api-client';
import { API, server } from '@/test/server';
import { testExam } from '@/test/exams';
import { diagnosticApi, diagnosticApiBase, formatDuration, toBlueprint, toQuestions, toResult } from './api';

const cbse = testExam('cbse');
const BASE = `${API}${diagnosticApiBase(cbse)}`;
const ok = (data: unknown) => HttpResponse.json({ success: true, data });

describe('diagnostic mapping edge cases', () => {
  it('defaults a blueprint and reads minutes when seconds are missing', () => {
    expect(toBlueprint(null)).toEqual({ isValid: true, errors: [], subjectCount: 0, chapterCount: 0, totalQuestions: 0, durationSeconds: 0 });
    expect(toBlueprint({ is_valid: false, errors: ['Too few'], duration_minutes: '2' })).toMatchObject({
      isValid: false,
      errors: ['Too few'],
      durationSeconds: 120,
    });
  });

  it('keeps known question types and statuses only', () => {
    const [q] = toQuestions([{ question_type: 'essay', status: 'weird', options: [{ option_index: '2' }], sub_questions: [{ options: 'x' }] }]);
    expect(q).toMatchObject({ question_type: 'conceptual', status: 'not_visited', selected_answer: null, question_image: null });
    expect(q!.options).toEqual([{ option_index: 2, option_text: '', option_image: null }]);
    expect(q!.sub_questions[0]!.options).toEqual([]);
    expect(toQuestions('nope')).toEqual([]);
  });

  it('fills result defaults when the profile and AI summary are partial', () => {
    const r = toResult({ subject_strengths: [{}], ai_summary: { summary: 'x', strongest_subject: { subject_name: ' ' }, how_you_learn: {} } });
    expect(r.subjects[0]!.name).toBe('—');
    expect(r).toMatchObject({ academicBand: 'basic', pace: { band: 'normal' }, thinking: { label: '', leaning: null } });
    expect(r.aiSummary).toEqual({ summary: [], strongest: null, needsTime: null, howYouLearn: null });
    expect(toResult({}).aiSummary).toBeNull();
    expect(formatDuration(60)).toBe('1 Min');
  });
});

describe('diagnosticApi requests', () => {
  it('posts chapter ids for the blueprint and start, and reads status and questions', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.get(`${BASE}/classes/12/status`, () => ok({ state: 'in_progress', assessment_id: '31' })),
      http.post(`${BASE}/classes/12/blueprint`, async ({ request }) => {
        bodies.push(await request.json());
        return ok({ chapter_count: 2, duration_seconds: 900 });
      }),
      http.post(`${BASE}/classes/12/attempts`, async ({ request }) => {
        bodies.push(await request.json());
        return ok({ assessment_id: 31 });
      }),
      http.get(`${BASE}/attempts/31`, () => ok({ questions: [{ question_id: 1 }], time_left: '600' })),
      http.get(`${BASE}/attempts/32`, () => ok({ questions: [] })),
    );
    expect(await diagnosticApi.status(cbse, 12)).toEqual({ state: 'in_progress', assessmentId: 31 });
    expect(await diagnosticApi.blueprint(cbse, 12, [4, 5])).toMatchObject({ chapterCount: 2, durationSeconds: 900 });
    expect(await diagnosticApi.start(cbse, 12, [4, 5])).toBe(31);
    expect(bodies).toEqual([{ module_ids: [4, 5] }, { module_ids: [4, 5] }]);
    const attempt = await diagnosticApi.questions(cbse, '31');
    expect(attempt.timeLeft).toBe(600);
    expect(attempt.questions[0]!.question_id).toBe(1);
    expect((await diagnosticApi.questions(cbse, '32')).timeLeft).toBeNull();
  });

  it('fails a start without an attempt id', async () => {
    server.use(http.post(`${BASE}/classes/12/attempts`, () => ok({})));
    await expect(diagnosticApi.start(cbse, 12, [1])).rejects.toMatchObject({ code: 'EMPTY_RESPONSE' });
  });

  it('saves with PUT or keepalive and submits the whole list', async () => {
    const calls: [string, unknown][] = [];
    server.use(
      http.put(`${BASE}/attempts/31`, async ({ request }) => {
        calls.push(['put', await request.json()]);
        return ok(null);
      }),
      http.post(`${BASE}/attempts/31/submit`, async ({ request }) => {
        calls.push(['submit', await request.json()]);
        return ok(null);
      }),
    );
    const keepalive = vi.spyOn(apiClient, 'keepalive').mockImplementation(() => undefined);
    const questions = toQuestions([{ question_id: 1 }]);
    await diagnosticApi.save(cbse, '31', questions);
    await diagnosticApi.save(cbse, '31', questions, true);
    await diagnosticApi.submit(cbse, '31', questions);
    expect(keepalive).toHaveBeenCalledWith('PUT', `${diagnosticApiBase(cbse)}/attempts/31`, { questions });
    expect(calls).toEqual([
      ['put', { questions }],
      ['submit', { questions }],
    ]);
    keepalive.mockRestore();
  });

  it('asks for a given attempt or the latest report, and 404s when there is none', async () => {
    const params: (string | null)[] = [];
    server.use(
      http.get(`${BASE}/classes/12/result`, ({ request }) => {
        const id = new URL(request.url).searchParams.get('attempt_id');
        params.push(id);
        return ok(id ? { assessment_id: Number(id) } : null);
      }),
    );
    expect((await diagnosticApi.result(cbse, 12, '31')).assessmentId).toBe(31);
    await expect(diagnosticApi.result(cbse, 12, null)).rejects.toMatchObject({ status: 404 });
    expect(params).toEqual(['31', null]);
  });
});
