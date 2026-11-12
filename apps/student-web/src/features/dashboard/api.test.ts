import { http, HttpResponse } from 'msw';
import { API, server } from '@/test/server';
import { dashboardApi, formatHours, toActivity, weeklyAverage } from './api';

const BOARD = { category: 'board', examId: 1 } as const;
const COMPETITIVE = { category: 'competitive', examId: 2 } as const;

const get = (path: string, body: unknown) => http.get(`${API}${path}`, () => HttpResponse.json(body as Record<string, unknown>));

describe('dashboard normalisers: missing and odd fields', () => {
  it('reads activity from arrays and maps, defaulting bad hours to 0', () => {
    expect(toActivity([{ day: 'Mon', hours: 'x' }, { hours: 2 }])).toEqual([
      { day: 'Mon', hours: 0 },
      { day: '', hours: 2 },
    ]);
    expect(toActivity({ Tue: '1.5', Wed: null })).toEqual([
      { day: 'Tue', hours: 1.5 },
      { day: 'Wed', hours: 0 },
    ]);
    expect(toActivity('nope')).toEqual([]);
    expect(formatHours(1.9999)).toBe('2h 0m');
    expect(weeklyAverage([])).toBe(0);
  });

  it('PYQ teasers: blanks, "null" strings and missing subject', async () => {
    server.use(
      get('/api/v4/dashboard/board/1/pyq-subjects', {
        success: true,
        data: { pyq: [{ year: '2024', subject: 7, title: 'Science', image: 'null', class: 'Class 10' }, { title: '  ', subject: null }] },
      }),
    );
    expect(await dashboardApi.pyqTeasers(BOARD)).toEqual([
      { title: 'Science', className: 'Class 10', year: 2024, subjectId: '7', image: null },
      { title: '', className: '', year: 0, subjectId: '', image: null },
    ]);
    server.use(get('/api/v4/dashboard/board/1/pyq-subjects', { success: true }));
    expect(await dashboardApi.pyqTeasers(BOARD)).toEqual([]);
  });

  it('rejects an HTTP-200 failure body', async () => {
    server.use(get('/api/v4/dashboard/board/1/pyq-subjects', { success: false, message: 'Plan expired' }));
    await expect(dashboardApi.pyqTeasers(BOARD)).rejects.toThrow('Plan expired');
  });

  it('board overview without a profile or activity', async () => {
    server.use(get('/api/v4/dashboard/board/1/overview', { success: true, data: { profileProgress: null } }));
    expect(await dashboardApi.boardOverview(BOARD, 12)).toEqual({ activity: [], profile: null });
    server.use(
      get('/api/v4/dashboard/board/1/overview', {
        success: true,
        data: { profileProgress: { name: 'AK', image: '', completion_percentage: '66.6' } },
      }),
    );
    expect((await dashboardApi.boardOverview(BOARD, 12)).profile).toEqual({ initials: 'AK', image: null, percent: 67 });
  });

  it('subject scores, subjects, courses and tests with missing lists', async () => {
    server.use(
      get('/api/v4/dashboard/board/1/classes/12/subject-scores', { success: true }),
      get('/api/v4/dashboard/board/1/classes/12/subjects', { success: true, data: {} }),
      get('/api/v4/dashboard/board/1/classes/12/continue-courses', { success: true, data: {} }),
      get('/api/v4/dashboard/board/1/classes/12/continue-exams', { success: true }),
    );
    expect(await dashboardApi.subjectScores(BOARD, 12)).toEqual({ overall: 0, subjects: [] });
    expect(await dashboardApi.boardSubjects(BOARD, 12)).toEqual([]);
    expect(await dashboardApi.continueCourses(BOARD, 12)).toEqual([]);
    expect(await dashboardApi.continueTests(BOARD, 12)).toEqual([]);
  });

  it('subjects and courses fill defaults for missing fields', async () => {
    server.use(
      get('/api/v4/dashboard/board/1/classes/12/subjects', { success: true, data: { subjects: [{ subject_id: 3, subject_name: 'Physics' }] } }),
      get('/api/v4/dashboard/board/1/classes/12/continue-courses', { success: true, data: { courses: [{ course_id: 9 }] } }),
    );
    expect(await dashboardApi.boardSubjects(BOARD, 12)).toEqual([{ id: '3', name: 'Physics', courseCount: 0, chapterCount: 0 }]);
    expect(await dashboardApi.continueCourses(BOARD, 12)).toEqual([{ courseId: '9', name: '', className: '', subjectName: '', image: null, percent: 0 }]);
  });

  it('continue tests: array or { exams } body, unknown exam types and missing set numbers', async () => {
    server.use(
      get('/api/v4/dashboard/board/1/classes/12/continue-exams', {
        success: true,
        data: [
          { set_id: 5, exam_type: 'mid_term', set_number: 2, class_name: 'Class 12', progress_percentage: 40.4 },
          { set_id: 6, exam_type: 'weekly' },
        ],
      }),
    );
    expect(await dashboardApi.continueTests(BOARD, 12)).toEqual([
      { kind: 'mid_term', testType: 'mid', setId: '5', setNumber: '2', className: 'Class 12', percent: 40 },
      { kind: 'other', testType: null, setId: '6', setNumber: '6', className: '', percent: 0 },
    ]);
  });

  it('competitive progress: course ids as JSON, broken JSON, arrays or missing', async () => {
    server.use(
      get('/api/v4/dashboard/competitive/2/subject-progress', {
        success: true,
        data: [
          { subject_name: 'NEET-PHYSICS', completed_chapters: 2, total_chapters: 10, progress_percentage: 20, course_ids: '[214, 215]' },
          { subject_name: 'NEET Chemistry', course_ids: '[broken' },
          { subject_name: 'Biology', course_ids: [null] },
          { subject_name: 'Botany', course_ids: 7 },
        ],
      }),
    );
    expect(await dashboardApi.competitiveProgress(COMPETITIVE)).toEqual([
      { name: 'PHYSICS', completed: 2, total: 10, percent: 20, courseId: '214' },
      { name: 'Chemistry', completed: 0, total: 0, percent: 0, courseId: null },
      { name: 'Biology', completed: 0, total: 0, percent: 0, courseId: null },
      { name: 'Botany', completed: 0, total: 0, percent: 0, courseId: null },
    ]);
    server.use(get('/api/v4/dashboard/competitive/2/subject-progress', { success: true }));
    expect(await dashboardApi.competitiveProgress(COMPETITIVE)).toEqual([]);
  });

  it('referral summary is null for failures and empty data, otherwise defaults the tier', async () => {
    server.use(get('/api/v4/referral/me', { success: false, message: 'No referral' }));
    expect(await dashboardApi.referralSummary()).toBeNull();
    server.use(get('/api/v4/referral/me', { success: true, data: [] }));
    expect(await dashboardApi.referralSummary()).toBeNull();
    server.use(get('/api/v4/referral/me', { success: true, data: { balance: '150', tier: 'gold' } }));
    expect(await dashboardApi.referralSummary()).toEqual({ balance: 150, friendCount: 0, tier: 'free' });
    server.use(get('/api/v4/referral/me', { success: true, data: { balance: 0, friendCount: 3, tier: 'paid' } }));
    expect(await dashboardApi.referralSummary()).toEqual({ balance: 0, friendCount: 3, tier: 'paid' });
  });
});
