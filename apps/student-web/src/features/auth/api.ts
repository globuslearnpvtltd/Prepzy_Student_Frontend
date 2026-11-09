import { apiClient } from '@/shared/lib/api-client';
import { assertOk, unwrapData } from '@/shared/lib/unwrap';
import {
  toStudent,
  type ActivePlan,
  type ClassOption,
  type ExamOption,
  type PurchasedExam,
  type Student,
} from './model';

/** related_exams arrives as a JSON array or a JSON string of one. */
function toIdList(value: unknown): number[] {
  let list = value;
  if (typeof value === 'string') {
    try {
      list = JSON.parse(value);
    } catch {
      return [];
    }
  }
  return Array.isArray(list) ? list.map(Number).filter(Number.isFinite) : [];
}

type Envelope<T> = { success?: boolean; message?: string; error?: string; data?: T };

/** Backend contract for student auth and onboarding (legacy endpoints, kept as-is). */
export const authApi = {
  /** Step 1 of sign-up. `otpVerified` = the number was already verified earlier, skip the OTP step. */
  async register(phone: string): Promise<{ otpVerified: boolean }> {
    const body = await apiClient.post<Envelope<{ otp_verified?: boolean }>>('/api/v1/auth/register', { phone });
    return { otpVerified: !!unwrapData(body).otp_verified };
  },

  async requestLoginOtp(phone: string, fingerprint: string): Promise<void> {
    assertOk(await apiClient.post<Envelope<never>>('/api/v4/auth/login-otp', { phone, fingerprint }));
  },

  async resendOtp(phone: string, flow: 'login' | 'signup'): Promise<void> {
    assertOk(await apiClient.post<Envelope<never>>('/api/auth/v2/resend-otp', { phone }, { params: { flow } }));
  },

  async verifySignupOtp(phone: string, otp: string): Promise<void> {
    assertOk(await apiClient.post<Envelope<never>>('/api/auth/v2/verify-otp', { phone, otp }));
  },

  /** Sets the session cookies and returns the student. */
  async verifyLoginOtp(phone: string, otp: string, fingerprint: string): Promise<Student> {
    const body = await apiClient.post<Envelope<never> & Record<string, unknown>>('/api/v4/auth/verify-login-otp', {
      phone,
      otp,
      fingerprint,
    });
    console.log('authApi.verifyLoginOtp', body);
    return toStudent(assertOk(body.data));
  },

  async examOptions(): Promise<ExamOption[]> {
    const body =
      await apiClient.get<Envelope<{ exam_id: number; exam_name: string; exam_slice: string }[]>>('/api/exam-list');
    return unwrapData(body).map((exam) => ({
      examId: exam.exam_id,
      name: exam.exam_name,
      examSlice: exam.exam_slice,
      comingSoon: /jee/i.test(exam.exam_name),
    }));
  },

  async classOptions(): Promise<ClassOption[]> {
    const body =
      await apiClient.get<Envelope<{ class_id: number; title: string; stream_name?: string | null }[]>>(
        '/api/class-list',
      );
    return unwrapData(body).map((c) => ({ classId: c.class_id, title: c.title, streamName: c.stream_name ?? '' }));
  },

  /** NEET preparation lengths in years (target year = current session year + length). */
  async neetPlanLengths(): Promise<number[]> {
    return unwrapData(await apiClient.get<Envelope<number[]>>('/api/neet-plan-lengths'));
  },

  /** Activates the account, grants the free plan and sets the session cookies. */
  async completeOnboarding(input: {
    phone: string;
    examId: number;
    classId: number;
    fingerprint: string;
    planLength?: number;
    withCbse?: boolean;
  }): Promise<Student> {
    const body = await apiClient.post<Envelope<never> & Record<string, unknown>>('/api/auth/v3/complete-onboarding', {
      phone: input.phone,
      exam_id: input.examId,
      class_id: input.classId,
      fingerprint: input.fingerprint,
      plan_length: input.planLength,
      with_cbse: input.withCbse,
    });
    return toStudent(assertOk(body));
  },

  async me(): Promise<Student> {
    return toStudent(unwrapData(await apiClient.get<Envelope<unknown>>('/api/accounts')));
  },

  async purchasedExams(): Promise<PurchasedExam[]> {
    const body = await apiClient.get<Envelope<{ exams: { exam_id: number; exam_slice: string; exam_name: string }[] }>>(
      '/api/v1/student/exams/purchased',
    );
    return unwrapData(body).exams.map((e) => ({ examId: e.exam_id, examSlice: e.exam_slice, name: e.exam_name }));
  },

  async activePlans(examId: number): Promise<ActivePlan[]> {
    type RawPlan = {
      plan_id: number;
      exam_id?: number;
      class_id: number;
      class_name: string;
      stream_name?: string;
      duration_months: number;
      expiry_date?: string | null;
      status: string;
      related_exams?: number[] | string | null;
      year?: number | null;
    };
    const body = await apiClient.get<Envelope<{ plans: RawPlan[] }>>('/api/v1/student/plans/active', {
      params: { exam_id: examId },
    });
    return unwrapData(body).plans.map((p) => ({
      planId: p.plan_id,
      examId: p.exam_id ?? null,
      classId: p.class_id,
      className: p.class_name,
      streamName: p.stream_name ?? '',
      durationMonths: p.duration_months,
      expiryDate: p.expiry_date ?? null,
      status: p.status,
      relatedExams: toIdList(p.related_exams),
      year: typeof p.year === 'number' ? p.year : null,
    }));
  },

  async logout(): Promise<void> {
    await apiClient.post('/api/auth/logoutStudent');
  },
};
