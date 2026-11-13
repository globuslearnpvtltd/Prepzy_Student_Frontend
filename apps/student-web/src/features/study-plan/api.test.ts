import { http, HttpResponse } from 'msw';
import { API, server } from '@/test/server';
import { testExam } from '@/test/exams';
import { studyPlanApi, toHeader, toJourney, toRules, toStatus, toTasks } from './api';
import { saveReturnDate, takeReturnDate, useStudyPlanDraft } from './draft-store';

const cbse = testExam('cbse');
const ok = (data: unknown) => HttpResponse.json({ success: true, data });

describe('study plan mapping edge cases', () => {
  it('defaults unknown plan status, task status and empty rules', () => {
    expect(toHeader({ plan_id: 1, status: 'paused', plan_type: 'revision', start_date: '2026-03-01T00:00:00Z' })).toMatchObject({
      status: 'active',
      planType: 'revision',
      startDate: '2026-03-01',
    });
    expect(toHeader({})).toBeNull();
    expect(toTasks([{ task_id: 1, status: 'weird', is_completed: 1, is_available: false, target: 'x' }])[0]).toMatchObject({
      status: 'todo',
      isCompleted: true,
      isAvailable: false,
      target: null,
    });
    expect(toRules(null)).toEqual({ minTotal: 5, maxPerSubject: 5 });
    expect(toStatus({ can_create: false, allowed_plan_types: ['revision', 'other'], exam_date: '2027-03-01T00:00:00Z' })).toMatchObject({
      canCreate: false,
      allowedPlanTypes: ['revision'],
      examDate: '2027-03-01',
      maxTargetDate: null,
    });
  });

  it('reads journey weeks in either backend shape and rejects unknown states', () => {
    const journey = toJourney({ state: 'halfway', week: [{ plan_date: '2026-03-02', day: 'Mon', total: 3, done: 1, is_today: 1 }] });
    expect(journey?.week).toEqual([{ date: '2026-03-02', label: 'Mon', total: 3, done: 1, isToday: true, isRest: false }]);
    expect(journey?.assessmentId).toBeNull();
    expect(toJourney({ state: 'unknown' })).toBeNull();
    expect(toJourney(null)).toBeNull();
  });
});

describe('studyPlanApi requests', () => {
  it('reads the plan, a day, the status, the journey and the syllabus', async () => {
    server.use(
      http.get(`${API}/api/v4/study-plan/classes/12`, () => ok({ plan: { plan_id: 3 }, days: [{ day_id: 1, plan_date: '2026-03-02' }] })),
      http.get(`${API}/api/v4/study-plan/plans/3/days/2026-03-02`, () => ok({ tasks: [{ task_id: 9, status: 'completed' }] })),
      http.get(`${API}/api/v4/study-plan/classes/12/status`, () => ok({ state: 'ready', has_plan: 1 })),
      http.get(`${API}/api/v4/study-plan/classes/12/dashboard`, () => ok({ state: 'build_plan', assessment_id: '31' })),
      http.get(`${API}/api/v4/diagnostic/${cbse.category}/${cbse.examId}/classes/12/chapters`, () =>
        ok({ subject_chapter_list: [], rules: { min_chapters_total: 3 } }),
      ),
    );
    const { plan, days } = await studyPlanApi.plan(12);
    expect(plan?.planId).toBe(3);
    expect(days[0]?.date).toBe('2026-03-02');
    expect((await studyPlanApi.day(3, '2026-03-02'))[0]).toMatchObject({ id: 9, isCompleted: true });
    expect(await studyPlanApi.status(12)).toMatchObject({ state: 'ready', hasPlan: true, canCreate: true });
    expect(await studyPlanApi.journey(12)).toMatchObject({ state: 'build_plan', assessmentId: 31 });
    expect(await studyPlanApi.syllabus(12, cbse)).toEqual({ subjects: [], rules: { minTotal: 3, maxPerSubject: 5 } });
  });

  it('patches task and day completion', async () => {
    const calls: [string, unknown][] = [];
    server.use(
      http.patch(`${API}/api/v4/study-plan/tasks/9`, async ({ request }) => {
        calls.push(['task', await request.json()]);
        return ok(null);
      }),
      http.patch(`${API}/api/v4/study-plan/days/1/complete`, () => {
        calls.push(['day', null]);
        return ok(null);
      }),
    );
    await studyPlanApi.setTask(9, 'in_progress');
    await studyPlanApi.completeDay(1);
    expect(calls).toEqual([
      ['task', { status: 'in_progress' }],
      ['day', null],
    ]);
  });

  it('creates a plan and reports an infeasible one', async () => {
    const bodies: unknown[] = [];
    let reply: object = { success: true, data: { feasible: true, plan_id: 4 } };
    server.use(
      http.post(`${API}/api/v4/study-plan/plans`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(reply);
      }),
    );
    const input = { classId: 12, planType: 'revision' as const, moduleIds: [4, 5], dailyMinutes: 60, targetDate: '2026-05-01' };
    expect(await studyPlanApi.create(input)).toEqual({ feasible: true, planId: 4 });
    expect(bodies[0]).toEqual({ class_id: 12, plan_type: 'revision', module_ids: [4, 5], daily_minutes: 60, target_date: '2026-05-01' });

    reply = { success: true, data: { feasible: false, min_per_day: 95 } };
    expect(await studyPlanApi.create(input)).toEqual({ feasible: false, message: null, minPerDay: 95 });
    reply = { success: true, message: 'Too short' };
    expect(await studyPlanApi.create(input)).toEqual({ feasible: false, message: 'Too short', minPerDay: null });
  });
});

describe('study plan draft store', () => {
  afterEach(() => vi.restoreAllMocks());

  it('keeps and clears the chapter draft', () => {
    useStudyPlanDraft.getState().setDraft(12, [4, 5]);
    expect(useStudyPlanDraft.getState()).toMatchObject({ classId: 12, moduleIds: [4, 5] });
    useStudyPlanDraft.getState().clear();
    expect(useStudyPlanDraft.getState()).toMatchObject({ classId: null, moduleIds: [] });
  });

  it('hands back the return date once, and survives blocked storage', () => {
    saveReturnDate('2026-03-02');
    expect(takeReturnDate()).toBe('2026-03-02');
    expect(takeReturnDate()).toBeNull();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => saveReturnDate('2026-03-03')).not.toThrow();
    expect(takeReturnDate()).toBeNull();
  });
});
