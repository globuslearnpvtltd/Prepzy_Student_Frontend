import { http, HttpResponse } from 'msw';
import { billingError, billingOk, billingUrl, quoteData } from '@/test/billing';
import { testExam } from '@/test/exams';
import { API, server } from '@/test/server';
import { classLabel, isPlanCategory, plansApi, toPurchase, toTransaction } from './api';
import {
  accessLabel,
  addMonths,
  bundleOptionTitles,
  buildSections,
  columnEyebrow,
  composePlanName,
  durationLabel,
  formatLimit,
  groupKeyOf,
  monthsUntilExam,
  perDayLabel,
  perDayRate,
  planEndDate,
  planHighlights,
  priceCadence,
  priceSection,
  sortedClassTitles,
  tierName,
  tierOf,
  tierPill,
  titleCase,
  toPlans,
  variantLabel,
  variantValidityLabel,
  withGst,
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
  it('names plans by the server rule when display_name is missing (tier, exam, year or Academic, bundles)', () => {
    expect([0, 1, 12, 6].map((months) => tierOf(null, months))).toEqual(['basic', 'monthly', 'yearly', 'custom']);
    expect(tierOf('yearly', 6)).toBe('yearly');
    expect(tierName('custom', 6)).toBe('Topper 6 Months');
    expect(composePlanName({ durationMonths: 12, exam: 'Exam X', groupKey: 'target_year', targetYear: 2027, bundles: ['Board Y'] })).toBe(
      'Topper Exam X 2027 + Board Y',
    );
    expect(composePlanName({ durationMonths: 0, exam: '', groupKey: 'class' })).toBe('Basic');
    expect(composePlanName({ durationMonths: 1, exam: 'Board Y', groupKey: 'class', bundles: ['A', 'B'] })).toBe('Topper Board Y + A + B Monthly');
    // display_name wins; a combo without `bundled` names the variant's bundle options.
    const [named, fallback] = toPlans(
      [apiPlan({ price_id: 1, display_name: 'From server' }), apiPlan({ price_id: 2, duration_months: 12, is_combo: true })],
      { exam: 'Exam X', groupKey: 'target_year', targetYear: 2027, bundles: ['Board Y'] },
      NOW,
    );
    expect(named!.name).toBe('From server');
    expect(fallback).toMatchObject({ name: 'Topper Exam X 2027 + Board Y', tier: 'yearly', bundled: [] });
  });

  it('labels variants and picks the grouping from the API, else the category', () => {
    expect(variantLabel(variant({ variant_label: 'Class 11 PCB' }), 'Board Y')).toBe('Class 11 PCB');
    expect(variantLabel(variant({ class_title: 'CLASS 11', stream_name: 'PCM' }), 'Board Y')).toBe('Class 11 PCM');
    expect(variantLabel(variant({ target_year: 2027 }), 'Exam X')).toBe('Exam X 2027');
    expect(groupKeyOf({ category: 'board', variants: [variant({ group_key: 'target_year' })] })).toBe('target_year');
    expect(groupKeyOf({ category: 'competitive', variants: [] })).toBe('target_year');
    expect(groupKeyOf({ category: 'board', variants: [] })).toBe('class');
    expect(groupKeyOf(null)).toBe('class');
    expect(bundleOptionTitles(variant({ bundle_options: [{ exam_id: 1, title: 'Board Y' }] }))).toEqual(['Board Y']);
    expect(
      bundleOptionTitles(variant({ plans: [apiPlan({ bundled: [{ exam_id: 1, exam_title: 'Board Y', class_id: 11, class_title: 'Class 11' }] })] })),
    ).toEqual(['Board Y']);
  });

  it('bills an academic plan against the months left to the exam', () => {
    const plans = toPlans(
      [
        apiPlan({ price_id: 2, duration_months: 1, price: 500, cost_price: 400 }),
        apiPlan({ price_id: 3, duration_months: 12, price: 3600, cost_price: 3000, exam_date: '2027-05-03' }),
        apiPlan({ price_id: 4, duration_months: 12, price: 3600, cost_price: 3000, exam_date: 'bad' }),
      ],
      {},
      NOW,
    );
    // No discount on the monthly plan: no strike-through price.
    expect(plans[0]).toMatchObject({ mrp: null, saved: 0 });
    // 12 months left × ₹500 − ₹3,600.
    expect(plans[1]).toMatchObject({ saved: 2400, perDay: 10, badge: { label: 'Best value', tone: 'value' } });
    expect(plans[2]!.saved).toBe(2400);
    expect(toPlans([apiPlan({ duration_months: 6, price: 0, cost_price: 0 })], {}, NOW)[0]!.badge).toBeNull();
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

  it('merges variants of the same target year and keeps a variant without one', () => {
    const years = yearVariants(
      [
        variant({ variant_id: 'b', target_year: 2028, plans: [apiPlan({ price_id: 1 })], bundle_options: [{ exam_id: 1, title: 'Board Y' }] }),
        variant({ variant_id: 'c', target_year: 2028, has_combo: true, plans: [apiPlan({ price_id: 2, is_combo: true })], bundle_options: [{ exam_id: 1, title: 'Board Y' }] }),
        variant({ variant_id: 'a', target_year: 2027, plans: [apiPlan({ price_id: 3 })] }),
        variant({ variant_id: 'none', plans: [apiPlan({ price_id: 4 })] }),
      ],
      'Exam X',
    );
    expect(years.map((year) => year.variant_id)).toEqual(['year-2027', 'year-2028', 'none']);
    expect(years[1]).toMatchObject({ variant_label: 'Exam X 2028', has_combo: true, bundle_options: [{ exam_id: 1, title: 'Board Y' }] });
    expect(years[1]!.plans).toHaveLength(2);
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
      {},
      NOW,
    ) as [ReturnType<typeof toPlans>[number], ReturnType<typeof toPlans>[number], ReturnType<typeof toPlans>[number], ReturnType<typeof toPlans>[number]];
    expect(priceSection([free, monthly, six, annual]).rows[0]!.values).toEqual(['Free', '₹500 / 30 days', '₹2,400 / 6 months', '₹3,600 / year']);
    expect(priceSection([free]).rows[1]!.values).toEqual(['Forever']);
    // The comparison table heads each column with the plan's name (display_name, else the same rule).
    expect([free, monthly, six, annual].map((plan) => plan.name)).toEqual(['Basic', 'Topper Monthly', 'Topper 6 Months', 'Topper Academic']);
    expect([free, monthly, six, annual].map(tierPill)).toEqual(['Free plan', 'Monthly plan', '6 Months plan', 'Annual plan']);
    expect([free, monthly, annual].map(priceCadence)).toEqual(['no payment', 'per month', 'one-time']);
    expect(columnEyebrow(free)).toBe('Essential');
    expect(columnEyebrow({ ...six, badge: null })).toBe('Topper');
    expect(perDayLabel(monthly)).toBe('₹16');
    expect(perDayLabel({ ...free, perDay: null })).toBe('≈₹0');
    expect([free, monthly, annual].map(accessLabel)).toEqual(['Free forever', '30-day access', '']);
    expect(planHighlights(free, 'Class 9')[0]).toBe('Core Class 9 lessons and notes');
    expect(planHighlights(annual, 'Exam X 2027')[0]).toBe('Topper access for Exam X 2027');
    expect(withGst(100)).toBe(118);
    expect(formatLimit(3, 'total')).toBe('3 total');
    // Every /feature-limits row shows: known names get a nicer label and group, the API's label and unit win.
    const sections = buildSections(
      [free!, annual!],
      [
        { name: ' Step by Step Doubt Solver ', label: null, unit: null, free: 3, premium: 30 },
        { name: 'Diagnostic Test', label: null, unit: null, free: 1, premium: 5 },
        { name: 'Brand new feature', label: 'Shiny', unit: 'week', free: 0, premium: null },
        { name: 'Odd one', label: null, unit: '/ month', free: 1, premium: 2 },
      ],
    );
    expect(sections).toEqual([
      { title: 'AI & doubt support', rows: [{ label: 'Doubt Solver', values: ['3 / day', '30 / day'] }] },
      { title: 'Practice & assessments', rows: [{ label: 'Diagnostic Test', values: ['1 total', '5 total'] }] },
      {
        title: 'More features',
        rows: [
          { label: 'Shiny', values: ['0 / week', 'Unlimited'] },
          { label: 'Odd one', values: ['1 / month', '2 / month'] },
        ],
      },
    ]);
    expect(buildSections([free!], [])).toEqual([]);
  });
});

const cbse = testExam('cbse');
const neet = testExam('neet');

describe('plan api normalisers', () => {
  it('handles odd values', () => {
    expect(isPlanCategory('reference')).toBe(false);
    expect(isPlanCategory(null)).toBe(false);
    expect(classLabel('CLASS 12', 'PCB')).toBe('Class 12 PCB');
    expect(classLabel('Dropper')).toBe('Dropper');
    const odd = toPurchase({ purchase_id: 'x', status: 'CANCELLED', duration_months: 3, courses: 'none', remaining_days: null, tier: 'nope' });
    expect(odd).toMatchObject({
      purchaseId: 0,
      status: 'cancelled',
      tier: 'custom',
      displayName: 'Topper 3 Months',
      courses: [],
      startDate: null,
      remainingDays: null,
      isFree: true,
      category: null,
      invoiceUrl: null,
    });
    expect(toPurchase({ status: 'weird', is_free: 0, price: 0 })).toMatchObject({ status: 'active', isFree: false });
    expect(toPurchase({ status: 'REFUNDED', display_name: 'From server', category: 'board' })).toMatchObject({
      status: 'refunded',
      displayName: 'From server',
      category: 'board',
    });
    expect(toTransaction({ status: 'failed', invoice_url: 'https://x.test/i.pdf', amount: null })).toMatchObject({
      status: 'failed',
      amount: 0,
      invoiceUrl: 'https://x.test/i.pdf',
    });
    expect(toTransaction({ status: 'pending' }).status).toBe('pending');
    expect(toTransaction({ description: 'Old text', display_name: 'New name', plan_id: '' })).toMatchObject({ description: 'New name', planId: null });
    expect(toPurchase({ has_pending_plan: 1, pending_start_date: null })).toMatchObject({ hasPendingPlan: true, pendingStartDate: null });
  });
});

describe('plansApi (v4 billing)', () => {
  it('reads the catalog of one exam, filtered by class', async () => {
    let classId: string | null = 'unset';
    server.use(
      http.get(billingUrl(neet, '/catalog'), ({ request }) => {
        classId = new URL(request.url).searchParams.get('class_id');
        return billingOk({
          exam: { exam_id: neet.examId, exam_key: 'neet-ug', title: 'NEET UG', exam_date: '2027-05-03' },
          variants: [
            {
              variant_id: 'y2027',
              class_id: 20,
              class_title: 'NEET',
              stream_id: null,
              stream_name: null,
              target_year: 2027,
              has_combo: 1,
              plans: [{ price_id: 1, plan_id: 2, plan_title: 'NEET', duration_months: 12, price: '3999.00', cost_price: 9999, exam_date: '2027-05-03', is_combo: 1, is_active_plan: false }],
            },
          ],
        });
      }),
    );
    const catalog = await plansApi.catalog(neet, 20);
    expect(classId).toBe('20');
    expect(catalog).toMatchObject({ examId: neet.examId, examKey: 'neet-ug', title: 'NEET UG', category: 'competitive', slug: neet.slug });
    expect(catalog.variants[0]).toMatchObject({ target_year: 2027, has_combo: true, plans: [{ price: 3999, is_combo: true, is_active_plan: false }] });
    server.use(http.get(billingUrl(cbse, '/catalog'), () => billingOk({})));
    await expect(plansApi.catalog({ ...cbse, examSlice: 'cbse' })).resolves.toMatchObject({ examKey: 'cbse', category: 'board', variants: [] });
  });

  it('reads feature limits (null and negative = unlimited) and coupons', async () => {
    server.use(
      http.get(billingUrl(cbse, '/feature-limits'), () =>
        billingOk({
          features: [
            { id: 1, feature_name: 'Quiz', free_limit: 2, premium_limit: null },
            { id: 2, feature_name: 'Atlas', label: 'Atlas chat', unit: 'day', free_limit: -1, premium_limit: 50 },
          ],
        }),
      ),
      http.get(billingUrl(cbse, '/coupons'), () => billingOk({ coupons: [{ coupon_code: 'A' }] })),
    );
    await expect(plansApi.featureLimits(cbse)).resolves.toEqual([
      { name: 'Quiz', label: null, unit: null, free: 2, premium: null },
      { name: 'Atlas', label: 'Atlas chat', unit: 'day', free: null, premium: 50 },
    ]);
    await expect(plansApi.coupons(cbse)).resolves.toEqual([{ code: 'A', description: '', expiry: null }]);
  });

  it('quotes a price, and rejects an invalid coupon with the server reason', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(billingUrl(cbse, '/quote'), async ({ request }) => {
        const body = (await request.json()) as { price_id: number; coupon_code?: string };
        bodies.push(body);
        return body.coupon_code === 'BAD'
          ? billingError(400, 'INVALID_COUPON', 'This coupon is not valid for this plan', { reason: 'wrong_duration' })
          : billingOk(quoteData(body.price_id, 499, body.coupon_code ? 10 : 0, body.coupon_code ?? null));
      }),
    );
    await expect(plansApi.quote(cbse, 2, null)).resolves.toMatchObject({ basePrice: 499, gstAmount: 89.82, totalAmount: 588.82, amountPaise: 58882, coupon: null });
    await expect(plansApi.quote(cbse, 2, 'SAVE10')).resolves.toMatchObject({ discountAmount: 49.9, totalAmount: 529.94, coupon: { code: 'SAVE10', discountPercentage: 10 } });
    await expect(plansApi.quote(cbse, 2, 'BAD')).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_COUPON',
      message: 'This coupon is not valid for this plan',
      details: { reason: 'wrong_duration' },
    });
    expect(bodies).toEqual([{ price_id: 2 }, { price_id: 2, coupon_code: 'SAVE10' }, { price_id: 2, coupon_code: 'BAD' }]);
  });

  it('creates orders, verifies (200 paid / 202 pending), reads order status and records failures', async () => {
    server.use(
      http.post(billingUrl(neet, '/orders'), () => billingOk({}, 201)),
      http.post(billingUrl(neet, '/orders/o%2F1/verify'), () => billingOk({ order_id: 'o/1', status: 'pending' }, 202)),
      http.post(billingUrl(neet, '/orders/o2/verify'), () => billingOk({ order_id: 'o2', status: 'paid' })),
      http.get(billingUrl(neet, '/orders/o2'), () => billingOk({ order_id: 'o2', status: 'failed' })),
      http.post(billingUrl(neet, '/orders/o2/fail'), () => billingError(404, 'ORDER_NOT_FOUND', 'Order not found')),
    );
    await expect(plansApi.createOrder(neet, { priceId: 2, coupon: null })).resolves.toEqual({
      orderId: '',
      status: 'created',
      amountPaise: 0,
      currency: 'INR',
      keyId: null,
    });
    await expect(plansApi.verify(neet, 'o/1', { payment_id: 'p', signature: 's' })).resolves.toBe('pending');
    await expect(plansApi.verify(neet, 'o2', { payment_id: 'p', signature: 's' })).resolves.toBe('paid');
    await expect(plansApi.orderStatus(neet, 'o2')).resolves.toBe('failed');
    await expect(plansApi.markFailed(neet, 'o2', null)).resolves.toBeUndefined();
  });

  it('rejects a refused order with the server code and message', async () => {
    server.use(http.post(billingUrl(cbse, '/orders'), () => billingError(409, 'PLAN_ALREADY_ACTIVE', 'Plan already active')));
    await expect(plansApi.createOrder(cbse, { priceId: 2, coupon: null })).rejects.toMatchObject({ status: 409, code: 'PLAN_ALREADY_ACTIVE', message: 'Plan already active' });
  });

  it('extends, cancels and lists with empty bodies', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(billingUrl(cbse, '/extensions'), async ({ request }) => {
        bodies.push(await request.json());
        return billingOk({});
      }),
      http.post(billingUrl(neet, '/purchases/7/cancel'), async ({ request }) => {
        bodies.push(await request.json());
        return billingOk({ purchase: {}, refund: null });
      }),
      http.get(billingUrl(cbse, '/purchases'), () => billingOk({})),
      http.get(billingUrl(cbse, '/purchases/1/payments'), () => billingOk({})),
      http.get(billingUrl(neet, '/payments'), () => billingOk({})),
    );
    await expect(plansApi.extend(cbse, 'CODE')).resolves.toEqual({ months: null, expiryDate: null });
    await plansApi.cancel(neet, 7);
    expect(bodies).toEqual([{ coupon_code: 'CODE' }, {}]);
    await expect(plansApi.purchases(cbse)).resolves.toEqual([]);
    await expect(plansApi.planPayments(cbse, 1, 3)).resolves.toEqual({ payments: [], page: 3, totalPages: 1 });
    await expect(plansApi.payments(neet, 1)).resolves.toEqual({ payments: [], page: 1, totalPages: 1 });
  });

  it('checks referral codes', async () => {
    let applied: unknown = null;
    server.use(
      http.get(`${API}/api/v4/referral/status`, () => HttpResponse.json({ success: false, data: { alreadyReferred: true } })),
      http.post(`${API}/api/v4/referral/validate`, () => HttpResponse.json({ success: true, data: { valid: false } })),
      http.post(`${API}/api/v4/referral/apply`, async ({ request }) => {
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
