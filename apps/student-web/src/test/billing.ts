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

/** A PaymentDto with sensible defaults. */
export const paymentDto = (extra: Record<string, unknown> = {}) => ({
  id: 1,
  order_id: 'order_x',
  invoice_number: null,
  invoice_url: null,
  description: 'Topper CBSE Monthly',
  display_name: 'Topper CBSE Monthly',
  plan_id: 5,
  class_name: 'CLASS 12',
  duration_months: 1,
  amount: 588.82,
  currency: 'INR',
  status: 'paid',
  payment_method: 'upi',
  created_at: '2026-01-02T10:00:00.000Z',
  updated_at: '2026-01-02T10:00:00.000Z',
  ...extra,
});
