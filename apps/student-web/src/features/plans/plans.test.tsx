import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { navigation } from '@/test/setup';
import { billingError, billingOk, billingUrl, paymentDto, purchaseDto, quoteData } from '@/test/billing';
import { billingApiBase, toPurchase, toTransaction } from './api';
import { buildSections, durationLabel, toPlans, yearVariants, type ApiPlan } from './catalog';
import { Checkout } from './components/checkout/checkout';
import { BillingHistory } from './components/billing-history';
import { BillingPage, ManagePlans } from './components/manage-plans';
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

  it('normalises manage-page and billing rows defensively', () => {
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
    expect(toTransaction(paymentDto({ amount: '590', status: 'REFUNDED', invoice_url: '' }))).toMatchObject({ amount: 590, status: 'refunded', invoiceUrl: null });
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
    renderWithProviders(<Checkout />, { exam: cbse });
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

describe('manage plans', () => {
  const payments = (exam: typeof cbse) => http.get(billingUrl(exam, '/payments'), () => billingOk({ payments: [], pagination: { page: 1, limit: 10, total: 0, total_pages: 1 } }));

  it('cancels a paid plan after confirmation, sending the reason', async () => {
    let body: unknown = null;
    let cancelled: unknown = null;
    server.use(
      payments(neet),
      http.get(billingUrl(neet, '/purchases'), () =>
        billingOk({
          purchases: [
            purchaseDto({
              purchase_id: 70,
              plan_id: 7,
              display_name: 'Topper NEET-UG 2027 + CBSE',
              exam_title: 'NEET-UG',
              courses: [{ class_id: 11, class_name: 'CLASS 11', exam_title: 'CBSE' }],
            }),
          ],
        }),
      ),
      http.post(billingUrl(neet, '/purchases/:id/cancel'), async ({ request, params }) => {
        cancelled = params.id;
        body = await request.json();
        return billingOk({ purchase: purchaseDto({ status: 'cancelled' }), refund: null });
      }),
    );
    renderWithProviders(<ManagePlans />, { exam: neet });
    expect(await screen.findByRole('heading', { name: 'Topper NEET-UG 2027 + CBSE' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Included courses' })).toHaveTextContent('CBSE · Class 11');
    // Backing out keeps the plan.
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await userEvent.click(screen.getByRole('button', { name: 'Keep my plan' }));
    expect(cancelled).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    const dialog = screen.getByRole('dialog', { name: 'Cancel plan' });
    await userEvent.selectOptions(within(dialog).getByLabelText('Please tell us why you are leaving'), 'Too expensive');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Yes, cancel plan' }));
    expect(await screen.findByText('Cancellation confirmed')).toBeInTheDocument();
    expect(cancelled).toBe('70');
    expect(body).toEqual({ reason: 'Too expensive' });
  });

  it('shows the server message when a cancellation is refused', async () => {
    server.use(
      payments(cbse),
      http.get(billingUrl(cbse, '/purchases'), () => billingOk({ purchases: [purchaseDto({ purchase_id: 55 })] })),
      http.post(billingUrl(cbse, '/purchases/:id/cancel'), () => billingError(409, 'REFUND_LIMIT_REACHED', 'Refund already used for this plan')),
    );
    renderWithProviders(<ManagePlans />, { exam: cbse });
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, cancel plan' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Refund already used for this plan');
  });

  it('extends a plan with a coupon (POST /extensions with the purchase)', async () => {
    let body: unknown = null;
    server.use(
      payments(cbse),
      http.get(billingUrl(cbse, '/purchases'), () => billingOk({ purchases: [purchaseDto({ purchase_id: 56, duration_months: 1, display_name: 'Topper CBSE Monthly' })] })),
      http.post(billingUrl(cbse, '/extensions'), async ({ request }) => {
        body = await request.json();
        return billingOk({ months: 2, expiry_date: '2026-09-01', purchase: purchaseDto() });
      }),
    );
    renderWithProviders(<ManagePlans />, { exam: cbse });
    await userEvent.click(await screen.findByRole('button', { name: 'Extend with coupon' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Coupon code' }), 'MORE');
    await userEvent.click(screen.getByRole('button', { name: 'Extend' }));
    expect(await screen.findByText('2 months added to Topper CBSE Monthly')).toBeInTheDocument();
    expect(body).toEqual({ coupon_code: 'MORE', purchase_id: 56 });
  });

  it('offers no Renew: an active paid plan shows Upgrade, an expired one Buy plan with its class', async () => {
    server.use(
      payments(cbse),
      http.get(billingUrl(cbse, '/purchases'), () =>
        billingOk({
          purchases: [
            purchaseDto({ purchase_id: 1, plan_id: 5, class_id: 12, class_name: 'CLASS 12', status: 'active' }),
            purchaseDto({ purchase_id: 2, plan_id: 6, class_id: 11, class_name: 'CLASS 11', status: 'expired', duration_months: 1 }),
          ],
        }),
      ),
    );
    renderWithProviders(<ManagePlans />, { exam: cbse });
    expect(await screen.findByRole('heading', { name: 'Topper CBSE Academic' })).toBeInTheDocument();
    expect(screen.queryByText(/Renew/)).toBeNull();
    expect(screen.getByRole('link', { name: 'Upgrade' })).toHaveAttribute('href', '/cbse/plans/purchase?CLASSID=12');
    expect(screen.getByRole('link', { name: 'Buy plan' })).toHaveAttribute('href', '/cbse/plans/purchase?CLASSID=11');
    // Only the active paid plan can be cancelled.
    expect(screen.getAllByRole('button', { name: 'Cancel' })).toHaveLength(1);
  });
});

describe('billing history', () => {
  it('lists the exam\'s payments a page at a time, with status chips and invoices', async () => {
    const pages: string[] = [];
    server.use(
      http.get(billingUrl(neet, '/payments'), ({ request }) => {
        const page = new URL(request.url).searchParams.get('page')!;
        pages.push(page);
        return billingOk({
          payments:
            page === '1'
              ? [paymentDto({ id: 1, invoice_number: 'INV-1', display_name: 'Topper NEET-UG Monthly', amount: 589, invoice_url: 'https://x.test/inv.pdf' })]
              : [paymentDto({ id: 2, invoice_number: null, description: 'old text', display_name: 'Topper NEET-UG 2027', status: 'failed' })],
          pagination: { page: Number(page), limit: 10, total: 11, total_pages: 2 },
        });
      }),
    );
    renderWithProviders(<BillingHistory exam={neet} />, { exam: neet });
    const table = await screen.findByRole('table', { name: 'Billing history' });
    expect(within(table).getByText('INV-1')).toBeInTheDocument();
    expect(within(table).getByText('₹589.00')).toBeInTheDocument();
    expect(within(table).getByRole('link', { name: 'Invoice' })).toHaveAttribute('href', 'https://x.test/inv.pdf');
    expect(within(table).getByText('Paid')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(await within(screen.getByRole('table', { name: 'Billing history' })).findByText('Topper NEET-UG 2027')).toBeInTheDocument();
    expect(within(screen.getByRole('table', { name: 'Billing history' })).getByText('Failed')).toBeInTheDocument();
    expect(pages).toEqual(['1', '2']);
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
  it('shows the same empty state for every exam, and the billing page for every exam', async () => {
    server.use(
      http.get(billingUrl(neet, '/purchases'), () => billingOk({ purchases: [] })),
      http.get(billingUrl(neet, '/payments'), () => billingOk({ payments: [] })),
      http.get(billingUrl(cbse, '/payments'), () => billingOk({ payments: [paymentDto({ status: 'pending' })] })),
    );
    renderWithProviders(<ManagePlans />, { exam: neet });
    expect(await screen.findByText('No plans yet')).toBeInTheDocument();
    expect(await screen.findByText('No payments yet')).toBeInTheDocument();
    renderWithProviders(<BillingPage />, { exam: cbse });
    expect(await screen.findByRole('heading', { level: 1, name: 'Billing history' })).toBeInTheDocument();
    expect((await screen.findAllByText('Pending')).length).toBeGreaterThan(0);
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('expands a plan to its paginated payments, pending and failed rows included', async () => {
    let asked = '';
    server.use(
      http.get(billingUrl(cbse, '/payments'), () => billingOk({ payments: [] })),
      http.get(billingUrl(cbse, '/purchases'), () =>
        billingOk({ purchases: [purchaseDto({ plan_id: 5, class_id: 12, class_name: 'CLASS 12', stream_name: 'PCM', duration_months: 0, price: 0, status: 'expired', expiry_date: null })] }),
      ),
      http.get(billingUrl(cbse, '/purchases/:planId/payments'), ({ request, params }) => {
        asked = `${params.planId}?${new URL(request.url).searchParams}`;
        return billingOk({
          payments: [
            paymentDto({ id: 1, amount: 499, status: 'paid', invoice_url: 'https://x.test/i.pdf' }),
            paymentDto({ id: 2, amount: 499, status: 'refunded' }),
            paymentDto({ id: 3, amount: 588.82, status: 'pending' }),
            paymentDto({ id: 4, amount: 588.82, status: 'failed' }),
          ],
          pagination: { page: 1, limit: 10, total: 14, total_pages: 2 },
        });
      }),
    );
    renderWithProviders(<ManagePlans />, { exam: cbse });
    expect(await screen.findByRole('heading', { name: 'Basic CBSE' })).toBeInTheDocument();
    expect(screen.getByText(/Free forever/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Extend with coupon' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /View payments/ }));
    const table = await screen.findByRole('table', { name: 'Plan payments' });
    expect(asked).toBe('5?page=1');
    expect(within(table).getAllByText('− ₹499.00').length).toBeGreaterThan(0);
    expect(within(table).getByText('Pending')).toBeInTheDocument();
    expect(within(table).getByText('Failed')).toBeInTheDocument();
    expect(within(table).getAllByText('₹588.82').length).toBeGreaterThan(0);
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Next/ }));
    await waitFor(() => expect(asked).toBe('5?page=2'));
  });

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
    renderWithProviders(<Checkout />, { exam: cbse });
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
