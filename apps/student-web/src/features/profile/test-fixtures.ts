import { http, HttpResponse } from 'msw';
import { API } from '@/test/server';

/** Shared MSW data for the profile tests. */
export const accountRow = {
  account_id: 7,
  first_name: 'Meera',
  last_name: 'Shah',
  email: '',
  phone: '+919876543210',
  date_of_birth: '2008-02-16T00:00:00.000Z',
  address: '',
  city: 'Pune',
  school: '',
  gender: 'female',
  class: 12,
  profile_picture: null,
  completion_percentage: 60,
  updated_at: '2024-10-12T10:00:00.000Z',
  language: { id: 2, name: 'hindi' },
};

export const ok = <T>(data: T) => HttpResponse.json({ success: true, message: 'OK', data });
export const fail = (status: number, code: string, message = code) =>
  HttpResponse.json({ success: false, code, message, data: null }, { status });

export function accountHandlers({
  account = accountRow as Record<string, unknown>,
  plans = [] as unknown[],
  summary = null as unknown,
} = {}) {
  return [
    http.get(`${API}/api/v4/student/account`, () => ok(account)),
    http.get(`${API}/api/v4/student/plans/active`, () => ok({ plans })),
    http.get(`${API}/api/v4/student/plans/:examId/summary`, () => ok(summary)),
    http.get(`${API}/api/v4/student/account/deletion`, () => ok({ active_paid_plans: 0, grace_days: 30 })),
  ];
}
