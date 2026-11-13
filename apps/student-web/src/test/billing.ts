import { HttpResponse } from 'msw';
import type { ExamRef } from '@/shared/config/exams';
import { API } from './server';

/** Mock URL of a v4 billing route: billingUrl(cbse, '/orders') → http://api.test/api/v4/billing/board/1/orders. */
export const billingUrl = (exam: ExamRef, path = '') => `${API}/api/v4/billing/${exam.category}/${exam.examId}${path}`;

/** v4 success envelope. */
export const billingOk = (data: unknown, status = 200) => HttpResponse.json({ success: true, message: 'OK', data }, { status });

/** v4 error envelope: { success:false, message, code, data:null, details? }. */
export const billingError = (status: number, code: string, message: string, details?: unknown) =>
  HttpResponse.json({ success: false, message, code, data: null, ...(details ? { details } : {}) }, { status });

/** The contract's quote maths in paise (discount and GST rounded), returned in rupees like the server. */
export function quoteData(priceId: number, price: number, discountPct = 0, coupon: string | null = null) {
  const base = Math.round(price * 100);
  const discount = Math.round((base * discountPct) / 100);
  const gst = Math.round(((base - discount) * 18) / 100);
  const total = base - discount + gst;
  return {
    price_id: priceId,
    plan_id: 10,
    duration_months: 1,
    base_price: base / 100,
    discount_percentage: discountPct,
    discount_amount: discount / 100,
    discounted_price: (base - discount) / 100,
    gst_amount: gst / 100,
    total_amount: total / 100,
    amount_paise: total,
    currency: 'INR',
    coupon: coupon ? { coupon_code: coupon, discount_percentage: discountPct } : null,
  };
}

/** A PurchaseDto with sensible defaults. */
export const purchaseDto = (extra: Record<string, unknown> = {}) => ({
  purchase_id: 100,
  plan_id: 5,
  plan_title: 'CLASS 12',
  exam_id: 1,
  exam_title: 'CBSE',
  category: 'board',
  class_id: 12,
  class_name: 'CLASS 12',
  stream_name: null,
  duration_months: 12,
  status: 'active',
  purchase_date: '2026-01-01T00:00:00.000Z',
  purchase_start_date: '2026-01-01T00:00:00.000Z',
  expiry_date: '2027-03-31T00:00:00.000Z',
  remaining_days: 200,
  price: 3999,
  paid_amount: 4718.82,
  order_id: 'order_x',
  invoice_number: null,
  invoice_url: null,
  has_pending_plan: false,
  pending_start_date: null,
  courses: [],
  ...extra,
});

/** GET /api/v4/billing/overview: one invoice row with sensible defaults. */
export const overviewHistoryDto = (extra: Record<string, unknown> = {}) => ({
  payment_history_id: 501,
  order_id: 'order_x',
  plan_id: 5,
  invoice_number: 'INV-501',
  invoice_url: 'https://cdn.test/inv-501.pdf',
  amount: 588.82,
  currency: 'INR',
  paid_on: '2026-06-10T06:00:00.000Z',
  plan_name: 'Topper CBSE Monthly',
  duration_months: 1,
  purchase_status: 'active',
  ended_on: null,
  ...extra,
});

/** GET /api/v4/billing/overview: one active plan (a board monthly plan by default). */
export const overviewPlanDto = (extra: Record<string, unknown> = {}) => ({
  exam_id: 1,
  exam_name: 'CBSE',
  exam_slice: 'cbse',
  category: 'board',
  group_key: 'class',
  class_id: 12,
  class_title: 'Class 12',
  stream_name: null,
  target_year: null,
  scope_label: 'Class 12',
  purchase_id: 100,
  plan_id: 5,
  order_id: 'order_x',
  plan_name: 'Topper CBSE Monthly',
  tier: 'monthly',
  duration_months: 1,
  paid_amount: 588.82,
  is_free: false,
  purchase_start_date: '2026-06-10T06:00:00.000Z',
  expiry_date: '2026-07-10T06:00:00.000Z',
  has_pending_plan: false,
  pending_purchase_date: null,
  pending_start_date: null,
  cancel_falls_back_to_basic: false,
  history: [overviewHistoryDto()],
  ...extra,
});

export const overviewUrl = `${API}/api/v4/billing/overview`;
