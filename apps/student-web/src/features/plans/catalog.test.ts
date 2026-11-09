import { http, HttpResponse } from 'msw';
import { API, server } from '@/test/server';
import { boardPlanName, isPlanCategory, plansApi, toBoardPlan, toLearningPlan, toTransaction, withoutClassWord } from './api';
import {
  accessLabel,
  addMonths,
  buildSections,
  columnEyebrow,
  columnName,
  durationLabel,
  formatLimit,
  monthsUntilExam,
  perDayLabel,
  perDayRate,
  planEndDate,
  planHighlights,
  planNameFor,
  priceCadence,
  priceSection,
  sortedClassTitles,
  tierPill,
  titleCase,
  toPlans,
  variantValidityLabel,
  withGst,
  yearFromTitle,
  yearVariants,
  type ApiPlan,
  type ApiVariant,
} from './catalog';
import { formatGbDate, formatInDate, formatPlanDate, formatShortDate, longDate } from './money';

const NOW = new Date(2026, 5, 15);

const apiPlan = (extra: Partial<ApiPlan>): ApiPlan => ({
  price_id: 1,
  plan_id: 10,
  plan_title: 'CLASS 12',
  duration_months: 1,
  price: 499,
  cost_price: 999,
  exam_date: null,
  is_combo: false,
  is_active_plan: 0,
  ...extra,
});

const variant = (extra: Partial<ApiVariant>): ApiVariant => ({
  variant_id: 'v',
  class_id: 12,
  class_title: 'CLASS 12',
  stream_id: null,
  stream_name: null,
  target_year: null,
  has_combo: false,
  plans: [],
  ...extra,
});

describe('plan dates and durations', () => {
  it('adds months without rolling into the next month', () => {
    expect(addMonths(1, new Date(2026, 0, 31))).toEqual(new Date(2026, 1, 28));
    expect(addMonths(12, new Date(2026, 5, 15))).toEqual(new Date(2027, 5, 15));
  });

  it('counts months to the exam, never below one', () => {
    expect(monthsUntilExam(2027, 5, NOW)).toBe(12);
    expect(monthsUntilExam(2026, 1, NOW)).toBe(1);
  });

  it('labels durations and per-day rates', () => {
    expect(durationLabel(0)).toBe('');
    expect(durationLabel(1)).toBe('1 Month');
    expect(durationLabel(3)).toBe('3 Months');
    expect(durationLabel(24)).toBe('2 Years');
    expect(perDayRate(0, 1)).toBeNull();
    expect(perDayRate(499, 0)).toBeNull();
    expect(perDayRate(10, 1)).toBe(1);
    expect(yearFromTitle('NEET')).toBeNull();
    expect(yearFromTitle(undefined as unknown as string)).toBeNull();
  });

  it('ends academic plans on a future exam date, else counts months', () => {
    const exam = apiPlan({ duration_months: 12, exam_date: '2027-05-03' });
    expect(planEndDate(exam, NOW)).toEqual(new Date('2027-05-03'));
    expect(planEndDate({ ...exam, exam_date: '2026-01-01' }, NOW)).toEqual(new Date(2027, 5, 15));
    expect(planEndDate({ ...exam, exam_date: 'not a date' }, NOW)).toEqual(new Date(2027, 5, 15));
    expect(planEndDate(apiPlan({ duration_months: 0 }), NOW)).toBeNull();
  });

  it('formats dates defensively', () => {
    expect(formatPlanDate(new Date(2026, 8, 4))).toBe('4 Sept 2026');
    expect(formatShortDate(null)).toBe('—');
    expect(formatShortDate('soon')).toBe('soon');
    expect(formatShortDate(new Date(Number.NaN))).toBe('—');
    expect(formatShortDate(new Date(2026, 8, 4))).toBe('04 Sep 2026');
    expect(formatGbDate(undefined)).toBe('—');
    expect(formatGbDate('later')).toBe('later');
    expect(formatGbDate('2026-09-04')).toBe('4 Sept 2026');
    expect(formatInDate('bad')).toBe('bad');
    expect(formatInDate('2026-09-04')).toMatch(/4 Sept? 2026/);
    expect(longDate(new Date(2026, 8, 4))).toMatch(/4 September 2026/);
  });
});

describe('plan names and cards', () => {
  it('names every competitive and board duration', () => {
    expect(planNameFor(apiPlan({ duration_months: 12, plan_title: 'NEET' }), 'competitive', null)).toBe('Topper NEET Target Year');
    expect(planNameFor(apiPlan({ duration_months: 12, plan_title: 'NEET' }), 'competitive', 2027)).toBe('Topper NEET 2027');
    expect(planNameFor(apiPlan({ duration_months: 6 }), 'competitive', null)).toBe('Topper NEET 6 Months');
    expect(planNameFor(apiPlan({ duration_months: 6 }), 'board', null)).toBe('Topper 6 Months');
    expect(planNameFor(apiPlan({ duration_months: 0, is_combo: true }), 'board', null)).toBe('Basic + CBSE');
  });

  it('bills an academic plan against the months left to the exam', () => {
    const plans = toPlans(
      [
        apiPlan({ price_id: 2, duration_months: 1, price: 500, cost_price: 400 }),
        apiPlan({ price_id: 3, duration_months: 12, price: 3600, cost_price: 3000, exam_date: '2027-05-03' }),
        apiPlan({ price_id: 4, duration_months: 12, price: 3600, cost_price: 3000, exam_date: 'bad' }),
      ],
      'board',
      null,
      NOW,
    );
    // No discount on the monthly plan: no strike-through price.
    expect(plans[0]).toMatchObject({ mrp: null, saved: 0 });
    // 12 months left × ₹500 − ₹3,600.
    expect(plans[1]).toMatchObject({ saved: 2400, perDay: 10, badge: { label: 'Best value', tone: 'value' } });
    expect(plans[2]!.saved).toBe(2400);
    expect(toPlans([apiPlan({ duration_months: 6, price: 0, cost_price: 0 })], 'board', null, NOW)[0]!.badge).toBeNull();
  });

  it('sorts class titles and title-cases upper-case names only', () => {
    expect(sortedClassTitles([variant({ class_title: 'Dropper' }), variant({ class_title: 'CLASS 12' }), variant({ class_title: 'CLASS 9' })])).toEqual([
      'CLASS 9',
      'CLASS 12',
      'Dropper',
    ]);
    expect(titleCase('CLASS 9')).toBe('Class 9');
    expect(titleCase('Class 9th')).toBe('Class 9th');
  });

  it('splits target years, skipping plans without a year', () => {
    const years = yearVariants([
      variant({
        plans: [apiPlan({ plan_title: 'NEET 2028' }), apiPlan({ plan_title: 'NEET' }), apiPlan({ plan_title: 'NEET 2028', is_combo: true })],
      }),
    ]);
    expect(years).toHaveLength(1);
    expect(years[0]).toMatchObject({ variant_id: 'year-2028', has_combo: true });
    expect(years[0]!.plans).toHaveLength(2);
  });

  it('labels a target-year card by its academic plan or June of the year', () => {
    expect(variantValidityLabel(variant({ plans: [apiPlan({ duration_months: 12, exam_date: '2027-05-03' })] }), NOW)).toBe('Till 3 May 2027');
    expect(variantValidityLabel(variant({ target_year: 2028, plans: [apiPlan({ duration_months: 1 })] }), NOW)).toBe('Till June 2028');
    expect(variantValidityLabel(variant({}), NOW)).toBe('');
  });

  it('fills the comparison table helpers for every plan length', () => {
    const [free, monthly, six, annual] = toPlans(
      [
        apiPlan({ price_id: 1, duration_months: 0, price: 0, cost_price: 0 }),
        apiPlan({ price_id: 2, duration_months: 1, price: 500 }),
        apiPlan({ price_id: 3, duration_months: 6, price: 2400, cost_price: 2400 }),
        apiPlan({ price_id: 4, duration_months: 12, price: 3600, cost_price: 6000 }),
      ],
      'board',
      null,
      NOW,
    ) as [ReturnType<typeof toPlans>[number], ReturnType<typeof toPlans>[number], ReturnType<typeof toPlans>[number], ReturnType<typeof toPlans>[number]];
    expect(priceSection([free, monthly, six, annual]).rows[0]!.values).toEqual(['Free', '₹500 / 30 days', '₹2,400 / 6 months', '₹3,600 / year']);
    expect(priceSection([free]).rows[1]!.values).toEqual(['Forever']);
    expect([free, monthly, six, annual].map(columnName)).toEqual(['Basic', 'Topper Monthly', 'Topper 6 Months', 'Topper Annual']);
    expect([free, monthly, six, annual].map(tierPill)).toEqual(['Free plan', 'Monthly plan', '6 Months plan', 'Annual plan']);
    expect([free, monthly, annual].map(priceCadence)).toEqual(['no payment', 'per month', 'one-time']);
    expect(columnEyebrow(free)).toBe('Essential');
    expect(columnEyebrow({ ...six, badge: null })).toBe('Topper');
    expect(perDayLabel(monthly)).toBe('₹16');
    expect(perDayLabel({ ...free, perDay: null })).toBe('≈₹0');
    expect([free, monthly, annual].map(accessLabel)).toEqual(['Free forever', '30-day access', '']);
    expect(planHighlights(free, 'CBSE')[0]).toBe('Core CBSE lessons and notes');
    expect(planHighlights(annual, 'NEET')[0]).toBe('Topper access for NEET');
    expect(withGst(100)).toBe(118);
    expect(formatLimit(3, 'total')).toBe('3 total');
    const sections = buildSections('competitive', [free, annual], [{ name: ' Step by Step Doubt Solver ', free: 3, premium: 30 }]);
    expect(sections[0]).toEqual({ title: 'AI & doubt support', rows: [{ label: 'Doubt Solver', values: ['3 / day', '30 / day'] }] });
    expect(sections[1]!.rows[0]!.values).toEqual(['Starter limits', 'Topper caps']);
  });
});

describe('plan api normalisers', () => {
  it('handles odd values', () => {
    expect(isPlanCategory('reference')).toBe(false);
    expect(isPlanCategory(null)).toBe(false);
    expect(withoutClassWord('CLASS 12')).toBe('12');
    expect([0, 1, 12].map(boardPlanName)).toEqual(['Basic Plan', 'Topper Monthly', 'Topper Academic Year']);
    expect(toLearningPlan({ id: 'x', status: 'cancelled', durationMonths: 3 })).toMatchObject({ id: 0, status: 'CANCELLED', courses: [], name: '' });
    expect(toTransaction({ status: 'failed', invoice_url: 'https://x.test/i.pdf', amount: null })).toMatchObject({
      status: 'failed',
      amount: 0,
      invoiceUrl: 'https://x.test/i.pdf',
    });
    expect(toTransaction({ status: 'pending' }).status).toBe('pending');
    expect(toBoardPlan({ has_pending_plan: 1, pending_start_date: '2026-01-01' })).toMatchObject({ pendingRenewal: null, startDate: null });
  });
});

describe('plansApi', () => {
  it('treats an unreachable verify endpoint as not confirmed', async () => {
    server.use(http.post(`${API}/api/neet/v1/purchase/verify-purchase`, () => HttpResponse.error()));
    const payload = { payment_id: 'p', order_id: 'o', signature: 's', coupon_id: null, userTimeZone: 'Asia/Kolkata' };
    await expect(plansApi.verify('competitive', payload)).resolves.toBe(false);
  });

  it('never throws when recording a failed payment', async () => {
    server.use(http.put(`${API}/api/neet/v1/purchase/update-failed-purchase-status`, () => HttpResponse.json({}, { status: 404 })));
    await expect(plansApi.markFailed('competitive', 'o', null)).resolves.toBeUndefined();
  });

  it('reads order defaults and the free premium endpoint', async () => {
    let premium: unknown = null;
    server.use(
      http.post(`${API}/api/neet/v1/purchase/purchase-plan`, () => HttpResponse.json({ success: true, data: { skip_payment: true } })),
      http.post(`${API}/api/neet/v1/purchase/purchase-free-premium`, async ({ request }) => {
        premium = await request.json();
        return HttpResponse.json({ success: true });
      }),
    );
    await expect(plansApi.createOrder('competitive', { planId: 1, priceId: 2, coupon: 'X' })).resolves.toEqual({
      skipPayment: true,
      orderId: '',
      amount: 0,
      currency: 'INR',
      couponId: null,
    });
    await plansApi.activateFree('competitive', { planId: 1, priceId: 2, durationMonths: 1 });
    expect(premium).toMatchObject({ plan_id: 1, price_id: 2, duration_months: 1 });
  });

  it('rejects an invalid order with the backend message (HTTP 200)', async () => {
    server.use(http.post(`${API}/api/v1/purchase/purchase-plan-1`, () => HttpResponse.json({ success: false, message: 'Plan inactive' })));
    await expect(plansApi.createOrder('board', { planId: 1, priceId: 2, coupon: null })).rejects.toThrow('Plan inactive');
  });

  it('extends, cancels and lists with empty bodies', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${API}/api/v1/purchase/apply-custom-duration-coupon`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ success: true });
      }),
      http.post(`${API}/api/neet/v1/purchase/cancel-active-plan`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ success: true });
      }),
      http.get(`${API}/api/subscriptions/active-coupons`, () => HttpResponse.json({ coupons: [{ coupon_code: 'A' }] })),
      http.get(`${API}/api/subscriptions/get-active-student-plans`, () => HttpResponse.json({})),
      http.get(`${API}/api/subscriptions/get-purchase-payment-history`, () => HttpResponse.json({})),
      http.get(`${API}/api/neet/v1/purchase/purchase-history`, () => HttpResponse.json({ success: true })),
      http.get(`${API}/api/neet/v1/purchase/billing-history`, () => HttpResponse.json({ success: true })),
      http.get(`${API}/api/v2/purchase/purchase-plans`, () => HttpResponse.json({ success: true })),
      http.get(`${API}/api/v2/purchase/feature-limits`, () => HttpResponse.json({ success: true, data: { exams: [{ exam_key: 'cbse' }] } })),
    );
    await expect(plansApi.extend('board', 'CODE', null)).resolves.toEqual({ months: null, expiryDate: null });
    await plansApi.cancel('competitive', 7);
    expect(bodies).toEqual([{ coupon_code: 'CODE' }, { plan_id: 7 }]);
    await expect(plansApi.coupons()).resolves.toEqual([{ code: 'A', description: '', expiry: null }]);
    await expect(plansApi.boardPlans()).resolves.toEqual([]);
    await expect(plansApi.boardPayments(1, 1)).resolves.toEqual({ payments: [], page: 1, totalPages: 1 });
    await expect(plansApi.learningPlans()).resolves.toEqual([]);
    await expect(plansApi.billingHistory()).resolves.toEqual([]);
    await expect(plansApi.catalog()).resolves.toEqual([]);
    await expect(plansApi.featureLimits()).resolves.toEqual({ cbse: [] });
  });

  it('reads sign-up plan, limits and prices', async () => {
    server.use(
      http.get(`${API}/api/v1/student/plans/active-for-signup`, () => HttpResponse.json({ success: true, data: { plans: [] } })),
      http.get(`${API}/api/v1/purchase/feature-limits`, () =>
        HttpResponse.json({
          success: true,
          data: [
            { id: 1, feature_name: 'Quiz', free_limits: 2, premium_limits: -1 },
            { id: 2, feature_name: 'Atlas', free_limits: null, premium_limits: 50 },
          ],
        }),
      ),
      http.get(`${API}/api/v1/purchase/signup-plan-prices/12/44`, () =>
        HttpResponse.json({
          success: true,
          data: {
            plans: [
              { plan_id: 44, title: 'NEET 2027', related_exams: [1], year: 2027, duration_months: 12, price: '3999', cost_price: null },
              { plan_id: 44, title: 'NEET 2027', duration_months: 1, price: 499, cost_price: 999 },
            ],
          },
        }),
      ),
    );
    await expect(plansApi.signupPlanId(2)).resolves.toBeNull();
    await expect(plansApi.signupLimits(2)).resolves.toEqual([
      { name: 'Quiz', free: 2, premium: null },
      { name: 'Atlas', free: null, premium: 50 },
    ]);
    await expect(plansApi.signupPrices(12, 44)).resolves.toEqual([
      { title: 'NEET 2027', bundled: false, year: null, durationMonths: 1, price: 499, costPrice: 999 },
      { title: 'NEET 2027', bundled: true, year: 2027, durationMonths: 12, price: 3999, costPrice: null },
    ]);
  });

  it('treats a non-list limits body as empty', async () => {
    server.use(http.get(`${API}/api/v1/purchase/feature-limits`, () => HttpResponse.json({ success: true, data: {} })));
    await expect(plansApi.signupLimits(1)).resolves.toEqual([]);
  });

  it('checks referral codes', async () => {
    let applied: unknown = null;
    server.use(
      http.get(`${API}/api/referral/status`, () => HttpResponse.json({ success: false, data: { alreadyReferred: true } })),
      http.post(`${API}/api/referral/validate`, () => HttpResponse.json({ success: true, data: { valid: false } })),
      http.post(`${API}/api/referral/apply`, async ({ request }) => {
        applied = await request.json();
        return HttpResponse.json({ success: true, data: {} });
      }),
    );
    await expect(plansApi.referralStatus()).resolves.toBe(false);
    await expect(plansApi.validateReferral('X')).resolves.toBeNull();
    await expect(plansApi.applyReferral('X', null)).resolves.toBeNull();
    expect(applied).toEqual({ code: 'X' });
  });
});
