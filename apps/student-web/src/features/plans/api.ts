import type { ExamCategory, ExamRef } from '@/shared/config/exams';
import { findExam } from '@/shared/config/exams';
import { apiClient } from '@/shared/lib/api-client';
import { isApiError, userMessage } from '@/shared/lib/errors';
import { assertOk } from '@/shared/lib/unwrap';
import {
  composePlanName,
  tierOf,
  titleCase,
  type ApiPlan,
  type ApiVariant,
  type BundledCourse,
  type CatalogExam,
  type FeatureLimit,
  type GroupKey,
  type PlanTier,
} from './catalog';
import { toOverview, toRefundDetails, toRefundPreview, type Overview, type RefundDetails, type RefundPreview } from './manage-data';

type Envelope<T> = { success?: boolean; message?: string; error?: unknown; data?: T };

/** Categories that can be bought. Reference books have no plans (the billing API answers 404 PURCHASE_NOT_AVAILABLE). */
export type PlanCategory = Extract<ExamCategory, 'board' | 'competitive'>;

export const isPlanCategory = (category: ExamCategory | null | undefined): category is PlanCategory =>
  category === 'board' || category === 'competitive';

/** v4 billing routes of an exam (catalog, quote, orders, purchases, payments …). Same shape as assessmentsApiBase. */
export const billingApiBase = (exam: ExamRef): string => `/api/v4/billing/${exam.category}/${exam.examId}`;

/** 502 from the billing API: Razorpay was unreachable or rejected the call. */
export const PAYMENT_SERVICE_DOWN = 'The payment service is unavailable right now. Please try again in a few minutes.';

/**
 * Message for a billing error: the server's message for 4xx (INVALID_COUPON, PLAN_ALREADY_ACTIVE …), a "payment
 * service unavailable" note for 502 PAYMENT_PROVIDER_ERROR, else the fallback.
 */
export function billingMessage(error: unknown, fallback: string): string {
  if (isApiError(error) && (error.code === 'PAYMENT_PROVIDER_ERROR' || error.code === 'PAYMENTS_NOT_CONFIGURED')) return PAYMENT_SERVICE_DOWN;
  return userMessage(error, fallback);
}

const text = (value: unknown) => (typeof value === 'string' ? value : value == null ? '' : String(value));
const num = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const numOrNull = (value: unknown) => (value == null || value === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null);
const flag = (value: unknown) => value === true || num(value) === 1;
const data = <T>(body: Envelope<T> | undefined): Partial<T> => (assertOk(body ?? {}) as Envelope<T>).data ?? {};

export interface Coupon {
  code: string;
  description: string;
  expiry: string | null;
}

/** POST /quote: the server's bill, in rupees. Checkout shows these numbers, never local maths. */
export interface Quote {
  priceId: number;
  planId: number;
  durationMonths: number;
  basePrice: number;
  discountPercentage: number;
  discountAmount: number;
  discountedPrice: number;
  gstAmount: number;
  totalAmount: number;
  amountPaise: number;
  currency: string;
  coupon: { code: string; discountPercentage: number } | null;
}

export type OrderStatus = 'pending' | 'paid' | 'failed';

export interface Order {
  orderId: string;
  /** 'paid' = settled without a payment (100% coupon); 'created' = open Razorpay. */
  status: 'created' | 'paid';
  amountPaise: number;
  currency: string;
  /** Razorpay key from the server; null falls back to NEXT_PUBLIC_RAZORPAY_KEY_ID. */
  keyId: string | null;
}

export type PurchaseStatus = 'active' | 'pending' | 'expired' | 'cancelled' | 'refunded';

/** PurchaseDto from GET /purchases: one card on the Manage Plans page. */
export interface Purchase {
  purchaseId: number;
  planId: number;
  planTitle: string;
  /** Server-composed name ("Topper {exam} 2027 + {bundle}", "Topper {exam} Monthly"); composed by the same rule when an older backend omits it. */
  displayName: string;
  examId: number;
  /** Exam name from the API ('' on an older backend). */
  examTitle: string;
  category: ExamCategory | null;
  tier: PlanTier;
  classId: number;
  className: string;
  streamName: string;
  durationMonths: number;
  status: PurchaseStatus;
  /** Price 0: free Basic or free premium. The server refuses to cancel these. */
  isFree: boolean;
  purchaseDate: string | null;
  startDate: string | null;
  expiryDate: string | null;
  remainingDays: number | null;
  paidAmount: number;
  orderId: string;
  invoiceNumber: string | null;
  invoiceUrl: string | null;
  hasPendingPlan: boolean;
  pendingStartDate: string | null;
  /** Courses a combo unlocks. */
  courses: { classId: number; className: string; examTitle: string }[];
}

const PURCHASE_STATUSES: readonly PurchaseStatus[] = ['active', 'pending', 'expired', 'cancelled', 'refunded'];

const toPurchaseStatus = (value: unknown): PurchaseStatus => {
  const lower = text(value).toLowerCase();
  return (PURCHASE_STATUSES as readonly string[]).includes(lower) ? (lower as PurchaseStatus) : 'active';
};

const toCategory = (value: unknown): ExamCategory | null => {
  const lower = text(value).toLowerCase();
  return lower === 'board' || lower === 'competitive' || lower === 'reference' ? lower : null;
};

const toTier = (value: unknown): PlanTier | null => {
  const lower = text(value).toLowerCase();
  return lower === 'basic' || lower === 'monthly' || lower === 'yearly' || lower === 'custom' ? lower : null;
};

const url = (value: unknown) => (typeof value === 'string' && value ? value : null);

/** "Class 12 PCB" from a purchase's class and stream ("CLASS 12" reads "Class 12"; other names stay as sent). */
export const classLabel = (className: string, streamName?: string | null) =>
  `${/^class\b/i.test(className) ? titleCase(className) : className}${streamName ? ` ${streamName}` : ''}`.trim();

export function toPurchase(raw: Record<string, unknown>): Purchase {
  const courses = (Array.isArray(raw.courses) ? (raw.courses as Record<string, unknown>[]) : []).map((c) => ({
    classId: num(c.class_id),
    className: text(c.class_name),
    examTitle: text(c.exam_title),
  }));
  const durationMonths = num(raw.duration_months);
  const tier = tierOf(toTier(raw.tier), durationMonths);
  const className = text(raw.class_name);
  const streamName = text(raw.stream_name);
  const bundles = [...new Set(courses.map((course) => course.examTitle).filter(Boolean))];
  return {
    purchaseId: num(raw.purchase_id),
    planId: num(raw.plan_id),
    planTitle: text(raw.plan_title),
    displayName:
      text(raw.display_name) ||
      composePlanName({
        durationMonths,
        exam: text(raw.exam_title),
        groupKey: toCategory(raw.category) === 'competitive' ? 'target_year' : 'class',
        bundles,
      }),
    examId: num(raw.exam_id),
    examTitle: text(raw.exam_title),
    category: toCategory(raw.category),
    tier,
    classId: num(raw.class_id),
    className,
    streamName,
    durationMonths,
    status: toPurchaseStatus(raw.status),
    isFree: raw.is_free == null ? num(raw.price) === 0 : flag(raw.is_free),
    purchaseDate: text(raw.purchase_date) || null,
    startDate: text(raw.purchase_start_date) || null,
    expiryDate: text(raw.expiry_date) || null,
    remainingDays: numOrNull(raw.remaining_days),
    paidAmount: num(raw.paid_amount),
    orderId: text(raw.order_id),
    invoiceNumber: text(raw.invoice_number) || null,
    invoiceUrl: url(raw.invoice_url),
    hasPendingPlan: flag(raw.has_pending_plan),
    pendingStartDate: text(raw.pending_start_date) || null,
    courses,
  };
}

export function toQuote(raw: Record<string, unknown>): Quote {
  const coupon = raw.coupon && typeof raw.coupon === 'object' ? (raw.coupon as Record<string, unknown>) : null;
  return {
    priceId: num(raw.price_id),
    planId: num(raw.plan_id),
    durationMonths: num(raw.duration_months),
    basePrice: num(raw.base_price),
    discountPercentage: num(raw.discount_percentage),
    discountAmount: num(raw.discount_amount),
    discountedPrice: num(raw.discounted_price),
    gstAmount: num(raw.gst_amount),
    totalAmount: num(raw.total_amount),
    amountPaise: num(raw.amount_paise),
    currency: text(raw.currency) || 'INR',
    coupon: coupon ? { code: text(coupon.coupon_code), discountPercentage: num(coupon.discount_percentage) } : null,
  };
}

const toOrderStatus = (value: unknown): OrderStatus => {
  const status = text(value).toLowerCase();
  return status === 'paid' || status === 'failed' ? status : 'pending';
};

function toBundled(value: unknown): BundledCourse[] {
  if (!Array.isArray(value)) return [];
  return (value as Record<string, unknown>[]).map((b) => ({
    exam_id: num(b.exam_id),
    exam_title: text(b.exam_title),
    class_id: num(b.class_id),
    class_title: text(b.class_title),
  }));
}

function toApiPlan(raw: Record<string, unknown>): ApiPlan {
  return {
    price_id: num(raw.price_id),
    plan_id: num(raw.plan_id),
    plan_title: text(raw.plan_title),
    duration_months: num(raw.duration_months),
    price: num(raw.price),
    cost_price: num(raw.cost_price),
    exam_date: text(raw.exam_date) || null,
    is_combo: flag(raw.is_combo),
    is_active_plan: flag(raw.is_active_plan),
    display_name: text(raw.display_name) || null,
    tier: toTier(raw.tier),
    bundled: toBundled(raw.bundled),
  };
}

const toGroupKey = (value: unknown): GroupKey | null => {
  const key = text(value);
  return key === 'class' || key === 'target_year' ? key : null;
};

function toVariant(raw: Record<string, unknown>): ApiVariant {
  const plans = Array.isArray(raw.plans) ? (raw.plans as Record<string, unknown>[]) : [];
  const options = Array.isArray(raw.bundle_options) ? (raw.bundle_options as Record<string, unknown>[]) : [];
  return {
    variant_id: text(raw.variant_id),
    class_id: num(raw.class_id),
    class_title: text(raw.class_title),
    stream_id: numOrNull(raw.stream_id),
    stream_name: raw.stream_name == null ? null : text(raw.stream_name),
    target_year: numOrNull(raw.target_year),
    has_combo: flag(raw.has_combo),
    plans: plans.map(toApiPlan),
    variant_label: text(raw.variant_label) || null,
    group_key: toGroupKey(raw.group_key),
    bundle_options: options.map((o) => ({ exam_id: num(o.exam_id), title: text(o.title) })).filter((o) => o.title),
  };
}

export const plansApi = {
  /** Plans on sale for an exam; `classId` narrows it to one class (the welcome pricing sheet). */
  async catalog(exam: ExamRef & { examSlice?: string }, classId?: number | null): Promise<CatalogExam> {
    const body = await apiClient.get<Envelope<{ exam?: Record<string, unknown>; variants?: Record<string, unknown>[] }>>(
      `${billingApiBase(exam)}/catalog`,
      { params: { class_id: classId ?? undefined } },
    );
    const payload = data(body);
    const examKey = text(payload.exam?.exam_key) || exam.examSlice || '';
    const design = findExam(examKey) ?? findExam(exam.examSlice);
    return {
      examId: exam.examId,
      examKey,
      title: text(payload.exam?.title),
      category: toCategory(payload.exam?.category) ?? exam.category,
      slug: design?.slug ?? null,
      variants: (payload.variants ?? []).map(toVariant),
    };
  },

  /** null = unlimited (a negative legacy value is treated the same way). */
  async featureLimits(exam: ExamRef): Promise<FeatureLimit[]> {
    const body = await apiClient.get<Envelope<{ features?: Record<string, unknown>[] }>>(`${billingApiBase(exam)}/feature-limits`);
    const cap = (value: unknown) => (value == null || num(value) < 0 ? null : num(value));
    return (data(body).features ?? []).map((f) => ({
      name: text(f.feature_name),
      label: text(f.label) || null,
      unit: text(f.unit) || null,
      free: cap(f.free_limit),
      premium: cap(f.premium_limit),
    }));
  },

  async coupons(exam: ExamRef): Promise<Coupon[]> {
    const body = await apiClient.get<Envelope<{ coupons?: Record<string, unknown>[] }>>(`${billingApiBase(exam)}/coupons`);
    return (data(body).coupons ?? []).map((c) => ({
      code: text(c.coupon_code),
      description: text(c.description),
      expiry: c.expiry ? text(c.expiry) : null,
    }));
  },

  /** The server's bill for a price, with an optional coupon. An invalid coupon throws 400 INVALID_COUPON with the reason. */
  async quote(exam: ExamRef, priceId: number, coupon: string | null): Promise<Quote> {
    const body = await apiClient.post<Envelope<Record<string, unknown>>>(`${billingApiBase(exam)}/quote`, {
      price_id: priceId,
      ...(coupon ? { coupon_code: coupon } : {}),
    });
    return toQuote(data(body));
  },

  async createOrder(exam: ExamRef, input: { priceId: number; coupon: string | null }): Promise<Order> {
    const body = await apiClient.post<Envelope<Record<string, unknown>>>(`${billingApiBase(exam)}/orders`, {
      price_id: input.priceId,
      ...(input.coupon ? { coupon_code: input.coupon } : {}),
    });
    const order = data(body);
    return {
      orderId: text(order.order_id),
      status: text(order.status).toLowerCase() === 'paid' ? 'paid' : 'created',
      amountPaise: num(order.amount_paise),
      currency: text(order.currency) || 'INR',
      keyId: order.key_id ? text(order.key_id) : null,
    };
  },

  /** Server-side signature and capture check. 'pending' (HTTP 202) means Razorpay hasn't captured it yet. */
  async verify(exam: ExamRef, orderId: string, payment: { payment_id: string; signature: string }): Promise<OrderStatus> {
    const body = await apiClient.post<Envelope<{ status?: string }>>(
      `${billingApiBase(exam)}/orders/${encodeURIComponent(orderId)}/verify`,
      payment,
    );
    return toOrderStatus(data(body).status);
  },

  /** Pending recovery: the server reconciles the order with Razorpay and answers its status. */
  async orderStatus(exam: ExamRef, orderId: string): Promise<OrderStatus> {
    const body = await apiClient.get<Envelope<{ status?: string }>>(`${billingApiBase(exam)}/orders/${encodeURIComponent(orderId)}`);
    return toOrderStatus(data(body).status);
  },

  /** Records a dismissed or failed payment (the server only moves pending → failed). Best effort: never throws. */
  async markFailed(exam: ExamRef, orderId: string, reason: string | null): Promise<void> {
    await apiClient
      .post(`${billingApiBase(exam)}/orders/${encodeURIComponent(orderId)}/fail`, reason ? { reason } : {})
      .catch(() => undefined);
  },

  /** Basic (duration 0) by plan; a free premium price by price. */
  async activateFree(exam: ExamRef, plan: { planId: number; priceId: number; durationMonths: number }): Promise<void> {
    const base = billingApiBase(exam);
    const body =
      plan.durationMonths === 0
        ? await apiClient.post<Envelope<unknown>>(`${base}/free-plan`, { plan_id: plan.planId })
        : await apiClient.post<Envelope<unknown>>(`${base}/free-premium`, { price_id: plan.priceId });
    assertOk(body ?? {});
  },

  /** Coupon-only extension. Without a purchase the server picks the newest eligible plan of this exam. */
  async extend(exam: ExamRef, code: string, purchaseId?: number | null): Promise<{ months: number | null; expiryDate: string | null }> {
    const body = await apiClient.post<Envelope<{ months?: number; expiry_date?: string }>>(`${billingApiBase(exam)}/extensions`, {
      coupon_code: code,
      ...(purchaseId ? { purchase_id: purchaseId } : {}),
    });
    const result = data(body);
    return { months: result.months ?? null, expiryDate: result.expiry_date ?? null };
  },

  async cancel(exam: ExamRef, purchaseId: number, reason?: string): Promise<void> {
    const body = await apiClient.post<Envelope<unknown>>(`${billingApiBase(exam)}/purchases/${purchaseId}/cancel`, reason ? { reason } : {});
    assertOk(body ?? {});
  },

  /** Per plan of the exam: the active purchase, else the latest expired one. */
  async purchases(exam: ExamRef): Promise<Purchase[]> {
    const body = await apiClient.get<Envelope<{ purchases?: Record<string, unknown>[] }>>(`${billingApiBase(exam)}/purchases`);
    return (data(body).purchases ?? []).map(toPurchase);
  },

  /* ---- Manage Plans: every exam of the student (/api/v4/billing/overview …) ---- */

  /** Active plans of every exam with their invoices, plus the invoices of ended plans. */
  async overview(): Promise<Overview> {
    const body = await apiClient.get<Envelope<{ active?: Record<string, unknown>[]; expired?: Record<string, unknown>[] }>>(
      '/api/v4/billing/overview',
    );
    return toOverview(data(body));
  },

  /** What cancelling would do (read only); the exam's cancel endpoint still decides. */
  async refundPreview(purchaseId: number): Promise<RefundPreview> {
    const body = await apiClient.get<Envelope<Record<string, unknown>>>(`/api/v4/billing/purchases/${purchaseId}/refund-preview`);
    return toRefundPreview(data(body));
  },

  /** The stored refund of the purchase's plan; null when there is none. */
  async refundDetails(purchaseId: number): Promise<RefundDetails | null> {
    const body = await apiClient.get<Envelope<Record<string, unknown> | null>>(`/api/v4/billing/purchases/${purchaseId}/refund`);
    return toRefundDetails(assertOk(body ?? {}).data ?? null);
  },

  /* ---- referral (welcome flow): /api/v4/referral ---- */

  async referralStatus(): Promise<boolean> {
    const body = await apiClient.get<Envelope<{ alreadyReferred?: boolean }>>('/api/v4/referral/status');
    return !!(body?.success && body.data?.alreadyReferred);
  },

  async validateReferral(code: string): Promise<{ referrerName: string; joiningCredit: number } | null> {
    const body = await apiClient.post<Envelope<{ valid?: boolean; referrerName?: string; joiningCredit?: number }>>(
      '/api/v4/referral/validate',
      { code },
    );
    return body?.success && body.data?.valid
      ? { referrerName: text(body.data.referrerName), joiningCredit: num(body.data.joiningCredit) }
      : null;
  },

  /** Joining credit in rupees. Throws with the backend's message for an invalid code. */
  async applyReferral(code: string, examId: number | null): Promise<number | null> {
    const body = assertOk(
      await apiClient.post<Envelope<{ joiningCredit?: number }>>('/api/v4/referral/apply', {
        code,
        ...(examId ? { exam_id: examId } : {}),
      }),
    );
    return body.data?.joiningCredit ?? null;
  },
};
