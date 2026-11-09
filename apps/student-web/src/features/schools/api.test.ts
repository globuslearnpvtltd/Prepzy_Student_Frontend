import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { API, server } from '@/test/server';
import { schoolsApi } from './api';

const AUTH = `${API}/api/mentor/v1/auth`;
const SCHOOLS = `${API}/api/mentor/v1/schools`;
const ok = (data?: unknown) => HttpResponse.json(data === undefined ? { success: true } : { success: true, data });
const query = { classId: 10, institutionId: 3 };

describe('schools api: edge cases', () => {
  it('treats an OTP response without success: true as a failure', async () => {
    server.use(
      http.post(`${AUTH}/generate-teacher-login-otp`, () => HttpResponse.json({ message: 'queued' })),
      http.post(`${AUTH}/verify-teacher-login-otp`, () => HttpResponse.json({ message: 'hmm' })),
    );
    await expect(schoolsApi.requestOtp('t@school.in')).rejects.toThrow('Failed to send code. Please try again.');
    await expect(schoolsApi.verifyOtp('t@school.in', '123456')).rejects.toThrow('Invalid OTP. Please try again.');
  });

  it('returns the teacher from the verify body (the backend spreads the account into it)', async () => {
    server.use(
      http.post(`${AUTH}/verify-teacher-login-otp`, () =>
        HttpResponse.json({ account_id: 4, first_name: 'Meera', last_name: 'Iyer', email: 't@school.in', success: true }),
      ),
    );
    await expect(schoolsApi.verifyOtp('t@school.in', '123456')).resolves.toEqual({ id: '4', firstName: 'Meera', lastName: 'Iyer', email: 't@school.in' });
  });

  it('defaults class stats and feature usage when data is missing', async () => {
    server.use(http.get(`${SCHOOLS}/get-hours-data`, () => ok()), http.get(`${SCHOOLS}/get-feature-usage`, () => ok()));
    await expect(schoolsApi.classStats(query)).resolves.toEqual({ studentCount: 0, activeStudents: 0, totalHours: 0 });
    await expect(schoolsApi.featureUsage(query)).resolves.toEqual({
      exams: 0,
      doubts: 0,
      lectures: 0,
      doubtSolverChats: 0,
      customExams: 0,
      postAssessmentChats: 0,
    });
  });

  it('skips non-object students and fills a student profile without a join date', async () => {
    server.use(
      http.get(`${SCHOOLS}/get-student-list`, () => ok({ student_list: [null, 'x', { account_id: '9', first_name: 'Isha', last_name: null }] })),
      http.get(`${SCHOOLS}/get-student-info`, () => ok({ student_data: { account_id: 9, first_name: 'Isha', class_title: 'Class 10' } })),
    );
    await expect(schoolsApi.students(query)).resolves.toEqual([{ id: 9, firstName: 'Isha', lastName: '' }]);
    await expect(schoolsApi.student('9')).resolves.toEqual({ id: 9, firstName: 'Isha', lastName: '', school: '', className: 'Class 10', joinedAt: null });
  });

  it('reads learning hours, lectures, doubts and assessments when sections are missing or partial', async () => {
    server.use(
      http.get(`${SCHOOLS}/get-student-learning-hours-info`, ({ request }) => {
        expect(new URL(request.url).searchParams.get('class_id')).toBe('10');
        return ok({ graph_data: { Mon: '30', Tue: 'x' }, study_engagement: { this_week: { hours: 2 }, total_since_joining_hours: '12.5' } });
      }),
      http.get(`${SCHOOLS}/get-student-video-completion-info`, () => ok()),
      http.get(`${SCHOOLS}/get-student-doubts-section-info`, () => ok({ doubts: { total: 3, subjects: [{ name: '', count: 2 }, { name: 'Physics', count: '1' }], categories: 'none' } })),
      http.get(`${SCHOOLS}/get-student-assessment-section-info`, () => ok()),
    );
    await expect(schoolsApi.learningHours({ studentId: '9', classId: '10' })).resolves.toEqual({
      graph: { Mon: 30, Tue: 0 },
      thisWeek: 2,
      totalSinceJoining: 12.5,
      avgMinutesPerActiveDay: 0,
    });
    await expect(schoolsApi.lectures({ studentId: '9' })).resolves.toEqual({ total: 0, subjects: [], chapters: [] });
    await expect(schoolsApi.doubts({ studentId: '9' })).resolves.toEqual({
      total: 3,
      subjects: [
        { name: 'Others', count: 2 },
        { name: 'Physics', count: 1 },
      ],
      categories: [],
    });
    await expect(schoolsApi.assessments({ studentId: '9' })).resolves.toEqual({ total: 0, categories: [] });

    server.use(
      http.get(`${SCHOOLS}/get-student-learning-hours-info`, () => ok({ study_engagement: null })),
      http.get(`${SCHOOLS}/get-student-video-completion-info`, () => ok({ video_completion: { total: 2, chapters: ['Light', '', 3] } })),
      http.get(`${SCHOOLS}/get-student-doubts-section-info`, () => ok()),
      http.get(`${SCHOOLS}/get-student-assessment-section-info`, () =>
        ok({ assessments: { total: 1, categories: [{ label: 'Mock', count: 1, percentage: '50' }] } }),
      ),
    );
    await expect(schoolsApi.learningHours({ studentId: '9' })).resolves.toMatchObject({ graph: {}, thisWeek: 0 });
    await expect(schoolsApi.lectures({ studentId: '9' })).resolves.toEqual({ total: 2, subjects: [], chapters: ['Light', '3'] });
    await expect(schoolsApi.doubts({ studentId: '9' })).resolves.toEqual({ total: 0, subjects: [], categories: [] });
    await expect(schoolsApi.assessments({ studentId: '9' })).resolves.toEqual({ total: 1, categories: [{ name: 'Mock', count: 1, percentage: 50 }] });
  });
});
