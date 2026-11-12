import { findExam, learnApiBase, type ExamRef } from '@/shared/config/exams';
import { fetchExamCatalog } from '@/shared/hooks/use-exam-catalog';
import { apiClient } from '@/shared/lib/api-client';
import { assertOk, unwrapData } from '@/shared/lib/unwrap';
import {
  toStudent,
  type ActivePlan,
  type ClassOption,
  type ExamOption,
  type OnboardingOptions,
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

/**
 * Student auth and onboarding: the v4 routes. Every response is the standard envelope
 * `{ success, message, data }`; failures are non-2xx `{ success: false, message, code, details? }`,
 * which the api client throws as ApiError (e.g. code INVALID_OTP, OTP_EXPIRED, ALREADY_REGISTERED,
 * MAX_LOGIN_SESSIONS with details.active_sessions, TOO_MANY_REQUESTS).
 */
const AUTH = '/api/v4/auth';

export const authApi = {
  /** Step 1 of sign-up. `otpVerified` = the number was already verified earlier, skip the OTP step. */
  async register(phone: string): Promise<{ otpVerified: boolean }> {
    const body = await apiClient.post<Envelope<{ otp_verified: boolean }>>(`${AUTH}/register`, { phone });
    return { otpVerified: unwrapData(body).otp_verified === true };
  },

  async requestLoginOtp(phone: string, fingerprint: string): Promise<void> {
    assertOk(await apiClient.post<Envelope<null>>(`${AUTH}/login-otp`, { phone, fingerprint }));
  },

  async resendOtp(phone: string, flow: 'login' | 'signup'): Promise<void> {
    assertOk(await apiClient.post<Envelope<null>>(`${AUTH}/resend-otp`, { phone }, { params: { flow } }));
  },

  async verifySignupOtp(phone: string, otp: string): Promise<void> {
    assertOk(await apiClient.post<Envelope<null>>(`${AUTH}/verify-otp`, { phone, otp }));
  },

  /** Sets the session cookies and returns the student. */
  async verifyLoginOtp(phone: string, otp: string, fingerprint: string): Promise<Student> {
    const body = await apiClient.post<Envelope<unknown>>(`${AUTH}/verify-login-otp`, { phone, otp, fingerprint });
    return toStudent(unwrapData(body));
  },

  /**
   * Exams a student can sign up for: the active exams of GET /api/v4/exams (reference books are not an exam).
   * One the app has no pages for yet is listed as coming soon.
   */
  async examOptions(): Promise<ExamOption[]> {
    return (await fetchExamCatalog())
      .filter((exam) => exam.category !== 'reference')
      .map((exam) => ({
        examId: exam.examId,
        name: exam.name,
        examSlice: exam.examSlice,
        comingSoon: !findExam(exam.examSlice),
      }));
  },

  /** Classes of the exam being signed up for. */
  async classOptions(exam: ExamRef): Promise<ClassOption[]> {
    const body = await apiClient.get<
      Envelope<{ classes: { class_id: number; title: string; stream_name?: string | null }[] }>
    >(`${learnApiBase(exam)}/classes`);
    return unwrapData(body).classes.map((c) => ({ classId: c.class_id, title: c.title, streamName: c.stream_name ?? '' }));
  },

  /** What sign-up asks for this exam: a class, or a target year from the exam's plan lengths. */
  async onboardingOptions(exam: ExamRef): Promise<OnboardingOptions> {
    type Raw = {
      choose: 'class' | 'target_year';
      plan_lengths: {
        plan_length: number;
        target_year: number | null;
        class_id: number;
        has_bundle: boolean;
        bundle_options?: { exam_id: number; title: string }[];
      }[];
    };
    const data = unwrapData(
      await apiClient.get<Envelope<Raw>>(`/api/v4/billing/${exam.category}/${exam.examId}/onboarding-options`),
    );
    return {
      choose: data.choose === 'target_year' ? 'target_year' : 'class',
      planLengths: (data.plan_lengths ?? []).map((p) => ({
        planLength: p.plan_length,
        targetYear: typeof p.target_year === 'number' ? p.target_year : null,
        classId: p.class_id,
        hasBundle: p.has_bundle === true,
        bundleTitles: (p.bundle_options ?? []).map((o) => o.title),
      })),
    };
  },

  /** Activates the account, grants the free plan and sets the session cookies. */
  async completeOnboarding(input: {
    phone: string;
    examId: number;
    classId: number;
    fingerprint: string;
    planLength?: number;
    withBundle?: boolean;
  }): Promise<Student> {
    const body = await apiClient.post<Envelope<unknown>>(`${AUTH}/complete-onboarding`, {
      phone: input.phone,
      exam_id: input.examId,
      class_id: input.classId,
      fingerprint: input.fingerprint,
      plan_length: input.planLength,
      with_bundle: input.withBundle,
    });
    return toStudent(unwrapData(body));
  },

  async me(): Promise<Student> {
    return toStudent(unwrapData(await apiClient.get<Envelope<unknown>>('/api/v4/student/account')));
  },

  async purchasedExams(): Promise<PurchasedExam[]> {
    const body = await apiClient.get<Envelope<{ exams: { exam_id: number; exam_slice: string; exam_name: string }[] }>>(
      '/api/v4/student/exams/purchased',
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
    const body = await apiClient.get<Envelope<{ plans: RawPlan[] }>>('/api/v4/student/plans/active', {
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
    await apiClient.post(`${AUTH}/logout`);
  },
};
