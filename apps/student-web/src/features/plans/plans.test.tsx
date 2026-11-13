import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { navigation } from '@/test/setup';
import { billingError, billingOk, billingUrl, purchaseDto, quoteData } from '@/test/billing';
import { billingApiBase, toPurchase } from './api';
import { buildSections, durationLabel, toPlans, yearVariants, type ApiPlan } from './catalog';
import { Checkout } from './components/checkout/checkout';
import { Welcome } from './components/welcome';
import { formatAmount, formatInr, formatInrExact } from './money';
import type { RazorpayOptions } from './razorpay';
import { testExam } from '@/test/exams';

vi.mock('@/shared/config/env', async (importOriginal) => {
  const actual = await importOriginal<{ env: Record<string, unknown> }>();
  return { env: { ...actual.env, razorpayKeyId: 'rzp_test_key' } };
});

const cbse = testExam('cbse');
const neet = testExam('neet');
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

const boardPlans = [
  apiPlan({ price_id: 1, duration_months: 0, price: 0, cost_price: 0 }),
  apiPlan({ price_id: 2, duration_months: 1, price: 499, cost_price: 999 }),
  apiPlan({ price_id: 3, duration_months: 12, price: 3999, cost_price: 9999 }),
];

const variants = [
  { variant_id: 'c12', class_id: 12, class_title: 'CLASS 12', stream_id: null, stream_name: null, target_year: null, has_combo: false, plans: boardPlans },
];

const common = [
  http.get(billingUrl(cbse, '/catalog'), () => billingOk({ exam: { exam_id: cbse.examId, exam_key: 'cbse', title: 'CBSE', exam_date: null }, variants })),
  http.get(billingUrl(neet, '/catalog'), () => billingOk({ exam: { exam_id: neet.examId, exam_key: 'neet-ug', title: 'NEET', exam_date: null }, variants: [] })),
  http.get(billingUrl(cbse, '/feature-limits'), () => billingOk({ features: [{ id: 1, feature_name: 'Quiz', free_limit: 2, premium_limit: null }] })),
  http.get(billingUrl(cbse, '/coupons'), () => billingOk({ coupons: [{ coupon_code: 'SAVE10', description: '10% off', discount: 10, expiry: '2099-01-01' }] })),
  http.post(billingUrl(cbse, '/quote'), async ({ request }) => {
    const { price_id, coupon_code } = (await request.json()) as { price_id: number; coupon_code?: string };
    if (coupon_code && coupon_code !== 'SAVE10') return billingError(400, 'INVALID_COUPON', 'Coupon expired', { reason: 'expired' });
    const price = boardPlans.find((p) => p.price_id === price_id)?.price ?? 0;
    return billingOk(quoteData(price_id, price, coupon_code ? 10 : 0, coupon_code ?? null));
  }),
  http.get(`${API}/api/v4/student/account`, () => HttpResponse.json({ success: true, data: { account_id: 1, first_name: 'Ravi', phone: '+919876543210' } })),
];

describe('plan normalisers', () => {
  it('names, badges, savings and per-day rates follow the plan sheet', () => {
    const plans = toPlans(boardPlans, { exam: 'Board Y', groupKey: 'class' }, NOW);
    expect(plans.map((p) => p.name)).toEqual(['Basic Board Y', 'Topper Board Y Monthly', 'Topper Board Y Academic']);
    expect(plans.map((p) => p.badge?.label ?? null)).toEqual([null, 'Most popular', 'Best value']);
    expect(plans[0]).toMatchObject({ isFree: true, validityLabel: 'Free forever', perDay: null, saved: 0 });
    expect(plans[1]).toMatchObject({ mrp: 999, saved: 500, perDay: 16, validityLabel: 'Till 15 Jul 2026' });
    // Academic plan without an exam date: 12 monthly payments vs one price.
    expect(plans[2]!.saved).toBe(499 * 12 - 3999);
  });

  it('names plans from display_name, and marks the current plan', () => {
    const [plan] = toPlans([apiPlan({ is_active_plan: 1, display_name: 'Topper NEET-UG + CBSE Monthly', tier: 'monthly' })], {}, NOW);
    expect(plan).toMatchObject({ name: 'Topper NEET-UG + CBSE Monthly', tier: 'monthly', badge: { label: 'Current plan' } });
    expect(durationLabel(18)).toBe('1 Year 6 Months');
  });

  it('groups a target-year catalog by the variants\' target_year (never by plan title)', () => {
    const variant = (target_year: number, has_combo: boolean) => ({
      variant_id: `v${target_year}`,
      class_id: 20,
      class_title: 'NEET',
      stream_id: null,
      stream_name: null,
      target_year,
      has_combo,
      plans: [apiPlan({ plan_title: 'NEET 2099' })],
    });
    const years = yearVariants([variant(2028, false), variant(2027, true)], 'NEET');
    expect(years.map((v) => [v.target_year, v.has_combo, v.variant_label])).toEqual([
      [2027, true, 'NEET 2027'],
      [2028, false, 'NEET 2028'],
    ]);
    expect(billingApiBase(neet)).toBe(`/api/v4/billing/competitive/${neet.examId}`);
  });

  it('builds comparison rows from feature limits (free vs premium), with no exam-specific rows', () => {
    const plans = toPlans(boardPlans, {}, NOW);
    const sections = buildSections(plans, [{ name: 'quiz', label: null, unit: null, free: 2, premium: null }]);
    expect(sections).toEqual([{ title: 'Practice & assessments', rows: [{ label: 'quiz', values: ['2 / day', 'Unlimited', 'Unlimited'] }] }]);
    expect(buildSections(plans, [])).toEqual([]);
  });

  it('formats rupees for India, keeping the paise of server amounts', () => {
    expect(formatInr(1499)).toBe('₹1,499');
    expect(formatInrExact(1768.8)).toBe('₹1,768.80');
    expect(formatAmount(1499)).toBe('₹1,499');
    expect(formatAmount(588.82)).toBe('₹588.82');
  });

  it('normalises purchase rows defensively', () => {
    const combo = toPurchase(
      purchaseDto({
        purchase_id: '3',
        plan_id: 7,
        display_name: 'Topper NEET-UG 2027 + CBSE',
        exam_title: 'NEET-UG',
        category: 'competitive',
        tier: 'yearly',
        status: 'expired',
        courses: [{ class_id: 11, class_name: 'CLASS 11 PCB', exam_title: 'CBSE' }],
      }),
    );
    expect(combo).toMatchObject({
      purchaseId: 3,
      planId: 7,
      displayName: 'Topper NEET-UG 2027 + CBSE',
      examTitle: 'NEET-UG',
      category: 'competitive',
      tier: 'yearly',
      status: 'expired',
      startDate: '2026-01-01T00:00:00.000Z',
      courses: [{ classId: 11, className: 'CLASS 11 PCB', examTitle: 'CBSE' }],
    });
    // An older backend: the name is composed from the DTO's own fields.
    expect(toPurchase(purchaseDto({ status: 'refunded', duration_months: 0, price: 0 }))).toMatchObject({
      status: 'refunded',
      displayName: 'Basic CBSE',
      tier: 'basic',
      isFree: true,
      courses: [],
    });
    expect(toPurchase(purchaseDto({ has_pending_plan: true, pending_start_date: '2026-01-01', status: 'ACTIVE' }))).toMatchObject({
      purchaseId: 100,
      status: 'active',
      hasPendingPlan: true,
      pendingStartDate: '2026-01-01',
    });
  });
});

describe('checkout', () => {
  let options: RazorpayOptions | null;
  let failedHandler: ((failure: { error?: { description?: string } }) => void) | null;
  beforeEach(() => {
    options = null;
    failedHandler = null;
    window.Razorpay = class {
      constructor(opts: RazorpayOptions) {
        options = opts;
      }
      open() {}
      on(_event: string, handler: (failure: { error?: { description?: string } }) => void) {
        failedHandler = handler;
      }
    } as unknown as typeof window.Razorpay;
    window.scrollTo = vi.fn();
  });

  async function openReview(planName: RegExp) {
    renderWithProviders(<Checkout />);
    await userEvent.click(await screen.findByRole('button', { name: planName }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    return screen.findByText("You're almost there! 🌟");
  }

  it('applies coupons through /quote (invalid shows the reason, valid shows the server total)', async () => {
    server.use(...common);
    await openReview(/^Topper CBSE Monthly$/);
    await waitFor(() => expect(screen.getByTestId('order-total')).toHaveTextContent('₹588.82'));
    await userEvent.type(screen.getByRole('textbox', { name: 'Coupon code' }), 'OLD');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Coupon expired');
    await userEvent.click(screen.getByRole('button', { name: 'Apply SAVE10' }));
    expect(await screen.findByText('Coupon Code applied!')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('order-total')).toHaveTextContent('₹529.94'));
  });

  it('pays with Razorpay and verifies the payment on the server', async () => {
    let verified: unknown = null;
    let order: unknown = null;
    server.use(
      ...common,
      http.post(billingUrl(cbse, '/orders'), async ({ request }) => {
        order = await request.json();
        return billingOk({ order_id: 'order_1', status: 'created', amount_paise: 58882, currency: 'INR', key_id: null }, 201);
      }),
      http.post(billingUrl(cbse, '/orders/order_1/verify'), async ({ request }) => {
        verified = await request.json();
        return billingOk({ order_id: 'order_1', status: 'paid', purchase: purchaseDto() });
      }),
    );
    await openReview(/^Topper CBSE Monthly$/);
    await userEvent.click((await screen.findAllByRole('button', { name: /Pay ₹588.82/ }))[0]!);
    await waitFor(() => expect(options).not.toBeNull());
    expect(order).toEqual({ price_id: 2 });
    expect(options).toMatchObject({ key: 'rzp_test_key', order_id: 'order_1', amount: 58882 });
    options!.handler({ razorpay_payment_id: 'pay_1', razorpay_order_id: 'order_1', razorpay_signature: 'sig' });
    expect(await screen.findByText('Payment Successful')).toBeInTheDocument();
    expect(verified).toEqual({ payment_id: 'pay_1', signature: 'sig' });
    await userEvent.click(screen.getByRole('button', { name: 'Start learning' }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/cbse/dashboard'));
  });

  it('records a dismissed sheet and a failed payment with POST /orders/:id/fail', async () => {
    const failures: unknown[] = [];
    let orders = 0;
    server.use(
      ...common,
      http.post(billingUrl(cbse, '/orders'), () => {
        orders += 1;
        return billingOk({ order_id: `order_${orders}`, status: 'created', amount_paise: 58882, currency: 'INR', key_id: 'rzp_k' }, 201);
      }),
      http.post(billingUrl(cbse, '/orders/:id/fail'), async ({ request, params }) => {
        failures.push({ id: params.id, ...((await request.json()) as object) });
        return billingOk({ order_id: params.id, status: 'failed' });
      }),
    );
    await openReview(/^Topper CBSE Monthly$/);
    await userEvent.click((await screen.findAllByRole('button', { name: /Pay ₹588.82/ }))[0]!);
    await waitFor(() => expect(options).not.toBeNull());
    options!.modal.ondismiss();
    await waitFor(() => expect(failures).toEqual([{ id: 'order_1', reason: 'Payment cancelled by the student' }]));

    options = null;
    await userEvent.click(screen.getAllByRole('button', { name: /Pay ₹588.82/ })[0]!);
    await waitFor(() => expect(options).not.toBeNull());
    failedHandler!({ error: { description: 'Card declined' } });
    expect(await screen.findByText("Payment didn't go through")).toBeInTheDocument();
    expect(screen.getByText('Card declined')).toBeInTheDocument();
    await waitFor(() => expect(failures).toEqual([
      { id: 'order_1', reason: 'Payment cancelled by the student' },
      { id: 'order_2', reason: 'Card declined' },
    ]));
  });

  it('activates a free plan without Razorpay', async () => {
    let body: unknown = null;
    server.use(
      ...common,
      http.post(billingUrl(cbse, '/free-plan'), async ({ request }) => {
        body = await request.json();
        return billingOk({ purchase: purchaseDto({ duration_months: 0 }) }, 201);
      }),
    );
    await openReview(/^Basic CBSE$/);
    await userEvent.click(screen.getByRole('button', { name: /Activate free plan/ }));
    expect(await screen.findByText('Payment Successful')).toBeInTheDocument();
    expect(body).toEqual({ plan_id: 10 });
    expect(options).toBeNull();
  });

  it('shows the server message when the order is refused (409 PLAN_ALREADY_ACTIVE)', async () => {
    server.use(...common, http.post(billingUrl(cbse, '/orders'), () => billingError(409, 'PLAN_ALREADY_ACTIVE', 'Plan already active')));
    await openReview(/^Topper CBSE Monthly$/);
    await userEvent.click((await screen.findAllByRole('button', { name: /Pay ₹588.82/ }))[0]!);
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Plan already active');
  });
});

describe('welcome', () => {
  beforeEach(() => {
    localStorage.clear();
    navigation.searchParams = new URLSearchParams('exam=neet');
  });
  afterEach(() => {
    navigation.searchParams = new URLSearchParams();
  });

  const base = [
    http.get(`${API}/api/v4/student/account`, () => HttpResponse.json({ success: true, data: { account_id: 1 } })),
    http.get(`${API}/api/v4/student/plans/active`, () => HttpResponse.json({ success: true, data: { plans: [] } })),
  ];

  it('validates and applies a referral code from a referral link', async () => {
    localStorage.setItem('prepzy_referral_code', 'FRIEND1');
    let applied: unknown = null;
    server.use(
      ...base,
      http.get(`${API}/api/v4/referral/status`, () => HttpResponse.json({ success: true, data: { alreadyReferred: false } })),
      http.post(`${API}/api/v4/referral/validate`, () => HttpResponse.json({ success: true, data: { valid: true, referrerName: 'Asha', joiningCredit: 50 } })),
      http.post(`${API}/api/v4/referral/apply`, async ({ request }) => {
        applied = await request.json();
        return HttpResponse.json({ success: true, data: { joiningCredit: 50 } });
      }),
    );
    renderWithProviders(<Welcome />);
    expect(await screen.findByText('₹50 credited to your wallet!')).toBeInTheDocument();
    expect(applied).toEqual({ code: 'FRIEND1', exam_id: neet.examId });
    expect(localStorage.getItem('prepzy_referral_code')).toBeNull();
  });

  it('extends the free month with a NEET coupon and shows invalid codes', async () => {
    server.use(
      ...base,
      http.get(`${API}/api/v4/referral/status`, () => HttpResponse.json({ success: true, data: {} })),
      http.post(billingUrl(neet, '/extensions'), async ({ request }) => {
        const body = (await request.json()) as { coupon_code: string; purchase_id?: number };
        // The server picks the newest eligible plan of the exam.
        expect(body.purchase_id).toBeUndefined();
        return body.coupon_code === 'GOOD'
          ? billingOk({ months: 2, expiry_date: '2026-09-01', purchase: purchaseDto() })
          : billingError(400, 'INVALID_COUPON', 'Invalid coupon code', { reason: 'not_found' });
      }),
    );
    renderWithProviders(<Welcome />);
    const input = await screen.findByRole('textbox', { name: 'Enter coupon code' });
    await screen.findByText('Free for 1 month', { selector: 'p' });
    await userEvent.type(input, 'BAD');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid coupon code');
    await userEvent.clear(input);
    await userEvent.type(input, 'GOOD');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(await screen.findByText(/2 extra months added/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Go to my dashboard' }));
    expect(navigation.replace).toHaveBeenCalledWith('/neet/dashboard');
  });

  it('sends a returning student straight to the dashboard', async () => {
    localStorage.setItem('first_visit_pre_dashboard', 'true');
    server.use(...base, http.get(`${API}/api/v4/referral/status`, () => HttpResponse.json({ success: true, data: {} })));
    renderWithProviders(<Welcome />);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/neet/dashboard'));
  });
});

describe('plan pages', () => {
  it('re-checks a pending payment with GET /orders/:id until the server confirms it', async () => {
    let verifyCalls = 0;
    let checks = 0;
    let options: RazorpayOptions | null = null;
    window.Razorpay = class {
      constructor(opts: RazorpayOptions) {
        options = opts;
      }
      open() {}
      on() {}
    } as unknown as typeof window.Razorpay;
    window.scrollTo = vi.fn();
    server.use(
      ...common,
      http.post(billingUrl(cbse, '/orders'), () => billingOk({ order_id: 'o3', status: 'created', amount_paise: 58882, currency: 'INR', key_id: 'k' }, 201)),
      http.post(billingUrl(cbse, '/orders/o3/verify'), () => {
        verifyCalls += 1;
        return billingOk({ order_id: 'o3', status: 'pending' }, 202);
      }),
      http.get(billingUrl(cbse, '/orders/o3'), () => {
        checks += 1;
        return billingOk({ order_id: 'o3', status: 'paid' });
      }),
    );
    renderWithProviders(<Checkout />);
    await userEvent.click(await screen.findByRole('button', { name: /^Topper CBSE Monthly$/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click((await screen.findAllByRole('button', { name: /Pay ₹588.82/ }))[0]!);
    await waitFor(() => expect(options).not.toBeNull());
    options!.handler({ razorpay_payment_id: 'p3', razorpay_order_id: 'o3', razorpay_signature: 's' });
    expect(await screen.findByText('Payment is being processed')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Refresh/ }));
    expect(await screen.findByText('Payment Successful')).toBeInTheDocument();
    expect(verifyCalls).toBe(1);
    expect(checks).toBe(1);
  });
});
