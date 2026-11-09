import type { ExamCategory } from '@/shared/config/exams';
import { apiClient } from '@/shared/lib/api-client';
import { assertOk } from '@/shared/lib/unwrap';
import { toCatalog, type ApiVariant, type CatalogExam, type FeatureLimit } from './catalog';

type Envelope<T> = { success?: boolean; message?: string; error?: string; data?: T };

/** Categories that can be bought. Reference books have no plans. */
export type PlanCategory = Extract<ExamCategory, 'board' | 'competitive'>;

export const isPlanCategory = (category: ExamCategory | null | undefined): category is PlanCategory =>
  category === 'board' || category === 'competitive';

/** Checkout endpoints per exam category (the previous app's two purchase APIs). */
export const PURCHASE_ENDPOINTS: Record<
  PlanCategory,
  { freePlan: string; freePremium: string; order: string; verify: string; failed: string; cancel: string; extend: string }
> = {
  board: {
    freePlan: '/api/v1/purchase/purchase-free-plan',
    freePremium: '/api/v1/purchase/purchase-free-premium',
    order: '/api/v1/purchase/purchase-plan-1',
    verify: '/api/v1/purchase/verify-purchase-plan-1',
    failed: '/api/v1/purchase/update-failed-purchase-status',
    cancel: '/api/v1/purchase/cancel-active-plan',
    extend: '/api/v1/purchase/apply-custom-duration-coupon',
  },
  competitive: {
    freePlan: '/api/neet/v1/purchase/purchase-free-plan',
    freePremium: '/api/neet/v1/purchase/purchase-free-premium',
    order: '/api/neet/v1/purchase/purchase-plan',
    verify: '/api/neet/v1/purchase/verify-purchase',
    // The backend has no NEET route for this yet; the call is kept so the record updates once it exists.
    failed: '/api/neet/v1/purchase/update-failed-purchase-status',
    cancel: '/api/neet/v1/purchase/cancel-active-plan',
    extend: '/api/v1/purchase/apply-custom-duration-coupon-neet',
  },
};

const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const text = (value: unknown) => (typeof value === 'string' ? value : value == null ? '' : String(value));
const num = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export interface Coupon {
  code: string;
  description: string;
  expiry: string | null;
}

/** Board plan row on the manage page (/api/subscriptions/get-active-student-plans). */
export interface BoardPlan {
  planId: number;
  classId: number;
  className: string;
  streamName: string;
  durationMonths: number;
  startDate: string | null;
  expiryDate: string | null;
  status: 'active' | 'expired' | string;
  pendingRenewal: { startDate: string; purchaseDate: string } | null;
}

export interface BoardPayment {
  amount: string;
  status: string;
  invoiceUrl: string | null;
  createdAt: string;
  durationMonths: number | null;
}

export type PlanStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED';

/** Competitive plan row on the manage page (/api/neet/v1/purchase/purchase-history). */
export interface LearningPlan {
  id: number;
  planId: number | null;
  name: string;
  billingCycle: string;
  status: PlanStatus;
  startDate: string;
  expiryDate: string;
  remainingDays: number;
  durationMonths: number;
  courses: { id: number; label: string; title: string; status: PlanStatus }[];
}

export type InvoiceStatus = 'paid' | 'refunded' | 'failed' | 'pending';

export interface Transaction {
  id: number;
  invoiceNo: string;
  description: string;
  date: string;
  amount: number;
  status: InvoiceStatus;
  invoiceUrl: string | null;
}

export interface Order {
  /** The backend settled it without a payment (full coupon, credit). */
  skipPayment: boolean;
  orderId: string;
  amount: number;
  currency: string;
  couponId: number | null;
}

export interface VerifyPayload {
  payment_id: string;
  order_id: string;
  signature: string;
  coupon_id: number | null;
  userTimeZone: string;
}

const toStatus = (value: unknown): PlanStatus => {
  const upper = text(value).toUpperCase();
  return upper === 'EXPIRED' || upper === 'CANCELLED' ? upper : 'ACTIVE';
};

const toInvoiceStatus = (value: unknown): InvoiceStatus => {
  const lower = text(value).toLowerCase();
  return lower === 'refunded' || lower === 'failed' || lower === 'pending' ? lower : 'paid';
};

export function toLearningPlan(raw: Record<string, unknown>): LearningPlan {
  const courses = Array.isArray(raw.courses) ? (raw.courses as Record<string, unknown>[]) : [];
  return {
    id: num(raw.id),
    planId: raw.planId == null ? null : num(raw.planId),
    name: text(raw.name),
    billingCycle: text(raw.billingCycle),
    status: toStatus(raw.status),
    startDate: text(raw.startDate),
    expiryDate: text(raw.expiryDate),
    remainingDays: num(raw.remainingDays),
    durationMonths: num(raw.durationMonths),
    courses: courses.map((c) => ({ id: num(c.id), label: text(c.label), title: text(c.title), status: toStatus(c.status) })),
  };
}

export function toTransaction(raw: Record<string, unknown>): Transaction {
  return {
    id: num(raw.id),
    invoiceNo: text(raw.invoice_no),
    description: text(raw.description),
    date: text(raw.transaction_date),
    amount: num(raw.amount),
    status: toInvoiceStatus(raw.status),
    invoiceUrl: typeof raw.invoice_url === 'string' && raw.invoice_url ? raw.invoice_url : null,
  };
}

export function toBoardPlan(raw: Record<string, unknown>): BoardPlan {
  const pendingStart = text(raw.pending_start_date);
  const pendingPurchase = text(raw.pending_purchase_date);
  return {
    planId: num(raw.plan_id),
    classId: num(raw.class_id),
    className: text(raw.class_name),
    streamName: text(raw.stream_name),
    durationMonths: num(raw.duration_months),
    startDate: text(raw.purchase_start_date) || null,
    expiryDate: text(raw.expiry_date) || null,
    status: text(raw.status).toLowerCase(),
    pendingRenewal:
      num(raw.has_pending_plan) === 1 && pendingStart && pendingPurchase
        ? { startDate: pendingStart, purchaseDate: pendingPurchase }
        : null,
  };
}

/** "CLASS 12" → "12". */
export const withoutClassWord = (name: string) => name.replace(/\bCLASS\b/i, '').trim();

/** Board plan name on the manage page. */
export const boardPlanName = (durationMonths: number) =>
  durationMonths === 12 ? 'Topper Academic Year' : durationMonths === 0 ? 'Basic Plan' : 'Topper Monthly';

export const plansApi = {
  async catalog(): Promise<CatalogExam[]> {
    type Raw = { exam_id: number; exam_key: string; title: string; is_active?: number; variants?: ApiVariant[] };
    const body = assertOk(await apiClient.get<Envelope<{ exams?: Raw[] }>>('/api/v2/purchase/purchase-plans'));
    return toCatalog(body.data?.exams ?? []);
  },

  /** Feature limits per exam key ('cbse', 'neet-ug'). */
  async featureLimits(): Promise<Record<string, FeatureLimit[]>> {
    type Raw = { exam_key: string; features?: { feature_name: string; free_limit: number | null; premium_limit: number | null }[] };
    const body = assertOk(await apiClient.get<Envelope<{ exams?: Raw[] }>>('/api/v2/purchase/feature-limits'));
    return Object.fromEntries(
      (body.data?.exams ?? []).map((exam) => [
        exam.exam_key,
        (exam.features ?? []).map((f) => ({ name: f.feature_name, free: f.free_limit, premium: f.premium_limit })),
      ]),
    );
  },

  async coupons(): Promise<Coupon[]> {
    type Raw = { coupon_code: string; description?: string; expiry?: string };
    const body = await apiClient.get<{ coupons?: Raw[] }>('/api/subscriptions/active-coupons');
    return (body?.coupons ?? []).map((c) => ({ code: c.coupon_code, description: c.description ?? '', expiry: c.expiry ?? null }));
  },

  /** Percentage discount of a checkout coupon. Throws with the backend's message when it's invalid. */
  async applyCoupon(code: string): Promise<number> {
    const body = assertOk(
      await apiClient.post<Envelope<{ discount?: number }>>('/api/v1/purchase/apply-coupon', { coupon_code: code, duration: 'ALL' }),
    );
    return num(body.data?.discount);
  },

  async createOrder(category: PlanCategory, input: { planId: number; priceId: number; coupon: string | null }): Promise<Order> {
    type Raw = { skip_payment?: boolean; order_id?: string; amount?: number; currency?: string; coupon_id?: number | null };
    const body = assertOk(
      await apiClient.post<Envelope<Raw>>(PURCHASE_ENDPOINTS[category].order, {
        plan_id: input.planId,
        price_id: input.priceId,
        coupon: input.coupon,
        userTimeZone: timeZone(),
      }),
    );
    const data = body.data ?? {};
    return {
      skipPayment: !!data.skip_payment,
      orderId: text(data.order_id),
      amount: num(data.amount),
      currency: text(data.currency) || 'INR',
      couponId: data.coupon_id ?? null,
    };
  },

  /** Server-side signature check. Resolves false when the payment isn't confirmed (yet). */
  async verify(category: PlanCategory, payload: VerifyPayload): Promise<boolean> {
    try {
      const body = await apiClient.post<Envelope<unknown>>(PURCHASE_ENDPOINTS[category].verify, payload);
      return !!body?.success;
    } catch {
      return false;
    }
  },

  /** Records a dismissed or failed payment. Best effort: never throws. */
  async markFailed(category: PlanCategory, orderId: string, description: string | null): Promise<void> {
    await apiClient.put(PURCHASE_ENDPOINTS[category].failed, { order_id: orderId, description }).catch(() => undefined);
  },

  async activateFree(category: PlanCategory, plan: { planId: number; priceId: number; durationMonths: number }): Promise<void> {
    const url = plan.durationMonths === 0 ? PURCHASE_ENDPOINTS[category].freePlan : PURCHASE_ENDPOINTS[category].freePremium;
    assertOk(
      await apiClient.post<Envelope<unknown>>(url, {
        plan_id: plan.planId,
        price_id: plan.priceId,
        duration_months: plan.durationMonths,
        userTimeZone: timeZone(),
      }),
    );
  },

  /** Coupon-only plan extension: a valid code moves the expiry, nothing is charged. */
  async extend(category: PlanCategory, code: string, planId: number | null): Promise<{ months: number | null; expiryDate: string | null }> {
    const body = assertOk(
      await apiClient.post<Envelope<{ months?: number; expiry_date?: string }>>(PURCHASE_ENDPOINTS[category].extend, {
        coupon_code: code,
        ...(planId ? { plan_id: planId } : {}),
      }),
    );
    return { months: body.data?.months ?? null, expiryDate: body.data?.expiry_date ?? null };
  },

  async cancel(category: PlanCategory, planId: number, reason?: string): Promise<void> {
    const extra = category === 'board' ? { userTimeZone: timeZone() } : reason ? { reason } : {};
    assertOk(await apiClient.post<Envelope<unknown>>(PURCHASE_ENDPOINTS[category].cancel, { plan_id: planId, ...extra }));
  },

  async boardPlans(): Promise<BoardPlan[]> {
    const body = await apiClient.get<{ plans?: Record<string, unknown>[] }>('/api/subscriptions/get-active-student-plans');
    return (body?.plans ?? []).map(toBoardPlan);
  },

  async boardPayments(planId: number, page: number): Promise<{ payments: BoardPayment[]; page: number; totalPages: number }> {
    type Raw = { amount: string | number; status: string; invoice: string | null; created_at: string; duration?: number | null };
    const body = await apiClient.get<{ data?: Raw[]; pagination?: { page?: number; totalPages?: number } }>(
      '/api/subscriptions/get-purchase-payment-history',
      { params: { plan_id: planId, page } },
    );
    return {
      payments: (body?.data ?? []).map((p) => ({
        amount: text(p.amount),
        status: text(p.status),
        invoiceUrl: p.invoice || null,
        createdAt: p.created_at,
        durationMonths: p.duration ?? null,
      })),
      page: body?.pagination?.page ?? 1,
      totalPages: body?.pagination?.totalPages ?? 1,
    };
  },

  async learningPlans(): Promise<LearningPlan[]> {
    const body = assertOk(await apiClient.get<Envelope<Record<string, unknown>[]>>('/api/neet/v1/purchase/purchase-history'));
    return (body.data ?? []).map(toLearningPlan);
  },

  async billingHistory(): Promise<Transaction[]> {
    const body = assertOk(await apiClient.get<Envelope<Record<string, unknown>[]>>('/api/neet/v1/purchase/billing-history'));
    return (body.data ?? []).map(toTransaction);
  },

  /* ---- post-signup welcome ---- */

  async signupPlanId(examId: number): Promise<number | null> {
    const body = await apiClient.get<Envelope<{ plans?: { plan_id: number }[] }>>('/api/v1/student/plans/active-for-signup', {
      params: { exam_id: examId },
    });
    const id = body?.data?.plans?.[0]?.plan_id;
    return id == null ? null : Number(id);
  },

  async signupLimits(examId: number): Promise<FeatureLimit[]> {
    type Raw = { id: number; feature_name: string; free_limits: number | null; premium_limits: number | null };
    const body = await apiClient.get<Envelope<Raw[]>>('/api/v1/purchase/feature-limits', { params: { exam: examId } });
    const rows = Array.isArray(body?.data) ? body.data : [];
    // Negative numbers mean "no cap" in this table.
    const cap = (value: number | null) => (value == null || value < 0 ? null : value);
    return rows.map((row) => ({ name: row.feature_name, free: cap(row.free_limits), premium: cap(row.premium_limits) }));
  },

  async signupPrices(classId: number, planId: number) {
    type Raw = { plan_id: number; title: string; related_exams?: number[] | null; year?: number | null; duration_months: number; price: number; cost_price: number | null };
    const body = assertOk(await apiClient.get<Envelope<{ plans?: Raw[] }>>(`/api/v1/purchase/signup-plan-prices/${classId}/${planId}`));
    return [...(body.data?.plans ?? [])]
      .sort((a, b) => a.duration_months - b.duration_months)
      .map((p) => ({
        title: p.title,
        bundled: (p.related_exams?.length ?? 0) > 0,
        year: p.year ?? null,
        durationMonths: p.duration_months,
        price: num(p.price),
        costPrice: p.cost_price == null ? null : num(p.cost_price),
      }));
  },

  async referralStatus(): Promise<boolean> {
    const body = await apiClient.get<Envelope<{ alreadyReferred?: boolean }>>('/api/referral/status');
    return !!(body?.success && body.data?.alreadyReferred);
  },

  async validateReferral(code: string): Promise<{ referrerName: string; joiningCredit: number } | null> {
    const body = await apiClient.post<Envelope<{ valid?: boolean; referrerName?: string; joiningCredit?: number }>>(
      '/api/referral/validate',
      { code },
    );
    return body?.success && body.data?.valid
      ? { referrerName: text(body.data.referrerName), joiningCredit: num(body.data.joiningCredit) }
      : null;
  },

  /** Joining credit in rupees. Throws with the backend's message for an invalid code. */
  async applyReferral(code: string, examId: number | null): Promise<number | null> {
    const body = assertOk(
      await apiClient.post<Envelope<{ joiningCredit?: number }>>('/api/referral/apply', {
        code,
        ...(examId ? { exam_id: examId } : {}),
      }),
    );
    return body.data?.joiningCredit ?? null;
  },
};
