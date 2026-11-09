import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { EXAMS } from '@/shared/config/exams';
import { apiClient } from '@/shared/lib/api-client';
import { createTestQueryClient } from '@/test/render';
import { API, server } from '@/test/server';
import { navigation } from '@/test/setup';
import { authApi } from './api';
import {
  authKeys,
  homeFor,
  useActivePlan,
  useCurrentUser,
  useLogout,
  usePlanSelection,
  usePlans,
  usePurchasedExams,
  useSessionExpiryRedirect,
} from './hooks';

type JsdomGlobal = { jsdom: { reconfigure: (options: { url: string }) => void } };
const setUrl = (url: string) => (globalThis as unknown as JsdomGlobal).jsdom.reconfigure({ url });

function setup() {
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

const RAW_PLANS = {
  success: true,
  data: {
    plans: [
      {
        plan_id: 4,
        exam_id: 2,
        class_id: 20,
        class_name: 'NEET',
        duration_months: 12,
        expiry_date: '2027-05-01',
        status: 'expired',
        related_exams: '[1, 2]',
        year: 2027,
      },
      { plan_id: 5, class_id: 20, class_name: 'NEET', duration_months: 0, status: 'active', related_exams: [2] },
      {
        plan_id: 6,
        class_id: 20,
        class_name: 'NEET',
        duration_months: 1,
        status: 'active',
        related_exams: 'not json',
        stream_name: 'PCB',
      },
    ],
  },
};

afterEach(() => {
  setUrl('http://localhost:3000/');
  localStorage.clear();
  usePlanSelection.setState({ planId: null });
});

describe('useLogout', () => {
  it('logs out, forgets the exam, clears the cache and opens login even when the call fails', async () => {
    server.use(http.post(`${API}/api/auth/logoutStudent`, () => HttpResponse.json({}, { status: 500 })));
    document.cookie = 'prepzy_exam=neet; path=/';
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(authKeys.me, { accountId: 1 });
    const { result } = renderHook(() => useLogout(), { wrapper });
    result.current.mutate();
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/login'));
    expect(queryClient.getQueryData(authKeys.me)).toBeUndefined();
    expect(document.cookie).not.toContain('prepzy_exam=neet');
  });
});

describe('useSessionExpiryRedirect', () => {
  const unauthorized = () => http.get(`${API}/api/accounts`, () => HttpResponse.json({}, { status: 401 }));

  it('redirects students to login once, however many requests fail', async () => {
    server.use(unauthorized());
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(authKeys.me, { accountId: 1 });
    renderHook(() => useSessionExpiryRedirect(), { wrapper });
    await Promise.allSettled([apiClient.get('/api/accounts'), apiClient.get('/api/accounts')]);
    expect(navigation.replace).toHaveBeenCalledTimes(1);
    expect(navigation.replace).toHaveBeenCalledWith('/login');
    expect(queryClient.getQueryData(authKeys.me)).toBeUndefined();
  });

  it("sends portal users to their portal's login by base path", async () => {
    server.use(unauthorized());
    setUrl('http://localhost:3000/schools/dashboard');
    renderHook(() => useSessionExpiryRedirect(), { wrapper: setup().wrapper });
    await apiClient.get('/api/accounts').catch(() => undefined);
    expect(navigation.replace).toHaveBeenCalledWith('/schools/login');
  });

  it("sends portal users to their portal's login by subdomain", async () => {
    server.use(unauthorized());
    setUrl('http://parents.prepzy.test/dashboard');
    renderHook(() => useSessionExpiryRedirect(), { wrapper: setup().wrapper });
    await apiClient.get('/api/accounts').catch(() => undefined);
    expect(navigation.replace).toHaveBeenCalledWith('/parents/login');
  });

  it('stops listening after unmount', async () => {
    server.use(unauthorized());
    const { unmount } = renderHook(() => useSessionExpiryRedirect(), { wrapper: setup().wrapper });
    unmount();
    await apiClient.get('/api/accounts').catch(() => undefined);
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});

describe('usePlanSelection', () => {
  it('remembers the picked class in the same storage key as the old app', () => {
    usePlanSelection.getState().select(9);
    expect(usePlanSelection.getState().planId).toBe(9);
    expect(localStorage.getItem('selectedPlanId')).toBe('9');
  });

  it('still applies the choice when storage is unavailable', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('private mode');
    });
    usePlanSelection.getState().select(3);
    expect(usePlanSelection.getState().planId).toBe(3);
    spy.mockRestore();
  });

  it('restores a valid stored choice on load and ignores junk', async () => {
    localStorage.setItem('selectedPlanId', '12');
    vi.resetModules();
    expect((await import('./hooks')).usePlanSelection.getState().planId).toBe(12);

    localStorage.setItem('selectedPlanId', 'abc');
    vi.resetModules();
    expect((await import('./hooks')).usePlanSelection.getState().planId).toBeNull();

    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.resetModules();
    expect((await import('./hooks')).usePlanSelection.getState().planId).toBeNull();
    spy.mockRestore();
  });
});

describe('plan queries', () => {
  it('maps every plan of the exam (including expired) and picks the selected active one', async () => {
    let examId: string | null = null;
    server.use(
      http.get(`${API}/api/v1/student/plans/active`, ({ request }) => {
        examId = new URL(request.url).searchParams.get('exam_id');
        return HttpResponse.json(RAW_PLANS);
      }),
    );
    const { wrapper } = setup();
    const plans = renderHook(() => usePlans(EXAMS.neet), { wrapper });
    await waitFor(() => expect(plans.result.current.isSuccess).toBe(true));
    expect(examId).toBe('2');
    expect(plans.result.current.data).toEqual([
      expect.objectContaining({ planId: 4, examId: 2, relatedExams: [1, 2], year: 2027, expiryDate: '2027-05-01' }),
      expect.objectContaining({ planId: 5, examId: null, relatedExams: [2], year: null, streamName: '' }),
      expect.objectContaining({ planId: 6, relatedExams: [], streamName: 'PCB' }),
    ]);

    usePlanSelection.setState({ planId: 6 });
    const active = renderHook(() => useActivePlan(EXAMS.neet), { wrapper });
    await waitFor(() => expect(active.result.current.data?.planId).toBe(6));
  });

  it('loads the current user and purchased exams', async () => {
    server.use(
      http.get(`${API}/api/accounts`, () =>
        HttpResponse.json({ success: true, data: { account_id: '3', first_name: 'Asha', gender: 'female' } }),
      ),
      http.get(`${API}/api/v1/student/exams/purchased`, () =>
        HttpResponse.json({ success: true, data: { exams: [{ exam_id: 2, exam_slice: 'neet-ug', exam_name: 'NEET' }] } }),
      ),
    );
    const { wrapper } = setup();
    const me = renderHook(() => useCurrentUser(), { wrapper });
    const exams = renderHook(() => usePurchasedExams(), { wrapper });
    await waitFor(() => expect(me.result.current.data?.fullName).toBe('Asha'));
    await waitFor(() =>
      expect(exams.result.current.data).toEqual([{ examId: 2, examSlice: 'neet-ug', name: 'NEET' }]),
    );
  });

  it('homeFor falls back to the default exam', () => {
    expect(homeFor({ targetExam: 'neet' })).toBe('/neet/dashboard');
    expect(homeFor(null)).toBe('/cbse/dashboard');
  });
});

describe('authApi', () => {
  it('maps class options with a missing stream', async () => {
    server.use(
      http.get(`${API}/api/class-list`, () =>
        HttpResponse.json({ success: true, data: [{ class_id: 11, title: 'CLASS 11', stream_name: null }] }),
      ),
    );
    expect(await authApi.classOptions()).toEqual([{ classId: 11, title: 'CLASS 11', streamName: '' }]);
  });

  it('requests a login OTP and rejects unregistered numbers sent with HTTP 200', async () => {
    server.use(
      http.post(`${API}/api/auth/loginWithOtp`, () =>
        HttpResponse.json({ success: false, message: 'This phone number is not registered.' }),
      ),
    );
    await expect(authApi.requestLoginOtp('+919876543210', 'fp')).rejects.toThrow('not registered');
  });

  it('completes onboarding with the backend field names', async () => {
    let body: unknown;
    server.use(
      http.post(`${API}/api/auth/v3/complete-onboarding`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ success: true, account_id: 9, target_exam: 'cbse' });
      }),
    );
    const student = await authApi.completeOnboarding({ phone: '+91', examId: 1, classId: 12, fingerprint: 'fp' });
    expect(body).toEqual({ phone: '+91', exam_id: 1, class_id: 12, fingerprint: 'fp' });
    expect(student).toMatchObject({ accountId: 9, targetExam: 'cbse' });
  });

  it('treats register without otp_verified as needing an OTP', async () => {
    server.use(http.post(`${API}/api/v1/auth/register`, () => HttpResponse.json({ success: true, data: {} })));
    expect(await authApi.register('+919876543210')).toEqual({ otpVerified: false });
  });
});
