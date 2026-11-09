import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { navigation } from '@/test/setup';
import { toLearningPlan, toTransaction, toBoardPlan } from './api';
import { bill, buildSections, durationLabel, planNameFor, toCatalog, toPlans, yearVariants, type ApiPlan } from './catalog';
import { Checkout } from './components/checkout/checkout';
import { BillingHistory } from './components/billing-history';
import { BoardManagePlans } from './components/manage-board';
import { CompetitiveManagePlans } from './components/manage-competitive';
import { BillingPage, ManagePlans } from './components/manage-plans';
import { Welcome } from './components/welcome';
import { formatInr, formatInrExact } from './money';
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

const catalogHandler = http.get(`${API}/api/v2/purchase/purchase-plans`, () =>
  HttpResponse.json({
    success: true,
    data: {
      exams: [
        {
          exam_id: 1,
          exam_key: 'cbse',
          title: 'CBSE',
          is_active: 1,
          variants: [
            { variant_id: 'c12', class_id: 12, class_title: 'CLASS 12', stream_id: null, stream_name: null, target_year: null, has_combo: false, plans: boardPlans },
          ],
        },
      ],
    },
  }),
);

const common = [
  catalogHandler,
  http.get(`${API}/api/v2/purchase/feature-limits`, () =>
    HttpResponse.json({ success: true, data: { exams: [{ exam_key: 'cbse', features: [{ feature_name: 'Quiz', free_limit: 2, premium_limit: null }] }] } }),
  ),
  http.get(`${API}/api/subscriptions/active-coupons`, () =>
    HttpResponse.json({ coupons: [{ coupon_code: 'SAVE10', description: '10% off', expiry: '2099-01-01' }] }),
  ),
  http.get(`${API}/api/v4/student/account`, () => HttpResponse.json({ success: true, data: { account_id: 1, first_name: 'Ravi', phone: '+919876543210' } })),
];

describe('plan normalisers', () => {
  it('names, badges, savings and per-day rates follow the plan sheet', () => {
    const plans = toPlans(boardPlans, 'board', null, NOW);
    expect(plans.map((p) => p.name)).toEqual(['Basic', 'Topper Monthly', 'Topper Academic']);
    expect(plans.map((p) => p.badge?.label ?? null)).toEqual([null, 'Most popular', 'Best value']);
    expect(plans[0]).toMatchObject({ isFree: true, validityLabel: 'Free forever', perDay: null, saved: 0 });
    expect(plans[1]).toMatchObject({ mrp: 999, saved: 500, perDay: 16, validityLabel: 'Till 15 Jul 2026' });
    // Academic plan without an exam date: 12 monthly payments vs one price.
    expect(plans[2]!.saved).toBe(499 * 12 - 3999);
  });

  it('names competitive plans by target year and bundle, and marks the current plan', () => {
    expect(planNameFor(apiPlan({ duration_months: 12, plan_title: 'NEET 2028', is_combo: true }), 'competitive', null)).toBe('Topper NEET 2028 + CBSE');
    expect(planNameFor(apiPlan({ duration_months: 1, is_combo: true }), 'competitive', null)).toBe('Topper NEET + CBSE Monthly');
    expect(planNameFor(apiPlan({ duration_months: 0 }), 'competitive', null)).toBe('Basic NEET');
    expect(toPlans([apiPlan({ is_active_plan: 1 })], 'board', null, NOW)[0]!.badge?.label).toBe('Current plan');
    expect(durationLabel(18)).toBe('1 Year 6 Months');
  });

  it('splits a competitive catalog by target year and maps exam keys to the registry', () => {
    const years = yearVariants([
      {
        variant_id: 'neet',
        class_id: 20,
        class_title: 'NEET',
        stream_id: null,
        stream_name: null,
        target_year: null,
        has_combo: false,
        plans: [apiPlan({ plan_title: 'NEET 2028' }), apiPlan({ plan_title: 'NEET 2027', is_combo: true })],
      },
    ]);
    expect(years.map((v) => [v.target_year, v.has_combo])).toEqual([
      [2027, true],
      [2028, false],
    ]);
    expect(toCatalog([{ exam_id: 2, exam_key: 'neet-ug', title: 'NEET' }, { exam_id: 9, exam_key: 'x', title: 'X', is_active: 0 }])).toEqual([
      { examId: 2, examKey: 'neet-ug', title: 'NEET', category: 'competitive', variants: [] },
    ]);
  });

  it('builds comparison rows from feature limits (free vs premium) and adds board access for competitive', () => {
    const plans = toPlans(boardPlans, 'board', null, NOW);
    const sections = buildSections('board', plans, [{ name: 'quiz', free: 2, premium: null }]);
    expect(sections).toEqual([{ title: 'Practice & assessments', rows: [{ label: 'Quiz', values: ['2 / day', 'Unlimited', 'Unlimited'] }] }]);
    expect(buildSections('competitive', plans, []).map((s) => s.title)).toEqual(['CBSE access']);
    expect(buildSections('reference', plans, [])).toEqual([]);
  });

  it('computes the bill with coupon discount and GST, formatting rupees for India', () => {
    expect(bill(1000, 10)).toEqual({ price: 1000, discount: 100, subtotal: 900, gst: 162, total: 1062 });
    expect(formatInr(1499)).toBe('₹1,499');
    expect(formatInrExact(1768.8)).toBe('₹1,768.80');
  });

  it('normalises manage-page and billing rows defensively', () => {
    expect(toLearningPlan({ id: '3', planId: null, status: 'expired', courses: [{ id: 1, status: 'weird' }] })).toMatchObject({
      id: 3,
      planId: null,
      status: 'EXPIRED',
      courses: [{ id: 1, status: 'ACTIVE' }],
    });
    expect(toTransaction({ id: 1, amount: '590', status: 'REFUNDED', invoice_url: '' })).toMatchObject({ amount: 590, status: 'refunded', invoiceUrl: null });
    expect(toBoardPlan({ plan_id: 1, has_pending_plan: 1, pending_start_date: '2026-01-01', pending_purchase_date: '2025-12-01', status: 'ACTIVE' })).toMatchObject({
      status: 'active',
      pendingRenewal: { startDate: '2026-01-01', purchaseDate: '2025-12-01' },
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

  it('applies coupons (invalid shows the reason, valid discounts the total)', async () => {
    server.use(
      ...common,
      http.post(`${API}/api/v1/purchase/apply-coupon`, async ({ request }) => {
        const { coupon_code } = (await request.json()) as { coupon_code: string };
        return coupon_code === 'SAVE10'
          ? HttpResponse.json({ success: true, data: { discount: 10 } })
          : HttpResponse.json({ success: false, message: 'Coupon expired' });
      }),
    );
    await openReview(/^Topper Monthly$/);
    expect(screen.getByTestId('order-total')).toHaveTextContent('₹589');
    await userEvent.type(screen.getByRole('textbox', { name: 'Coupon code' }), 'OLD');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Coupon expired');
    await userEvent.click(screen.getByRole('button', { name: 'Apply SAVE10' }));
    expect(await screen.findByText('Coupon Code applied!')).toBeInTheDocument();
    expect(screen.getByTestId('order-total')).toHaveTextContent('₹530');
  });

  it('pays with Razorpay and verifies the payment on the server', async () => {
    let verified: unknown = null;
    let order: unknown = null;
    server.use(
      ...common,
      http.post(`${API}/api/v1/purchase/purchase-plan-1`, async ({ request }) => {
        order = await request.json();
        return HttpResponse.json({ success: true, data: { order_id: 'order_1', amount: 58900, currency: 'INR', coupon_id: null } });
      }),
      http.post(`${API}/api/v1/purchase/verify-purchase-plan-1`, async ({ request }) => {
        verified = await request.json();
        return HttpResponse.json({ success: true });
      }),
    );
    await openReview(/^Topper Monthly$/);
    await userEvent.click(screen.getAllByRole('button', { name: /Pay ₹589/ })[0]!);
    await waitFor(() => expect(options).not.toBeNull());
    expect(order).toMatchObject({ plan_id: 10, price_id: 2, coupon: null });
    expect(options).toMatchObject({ key: 'rzp_test_key', order_id: 'order_1', amount: 58900 });
    options!.handler({ razorpay_payment_id: 'pay_1', razorpay_order_id: 'order_1', razorpay_signature: 'sig' });
    expect(await screen.findByText('Payment Successful')).toBeInTheDocument();
    expect(verified).toMatchObject({ payment_id: 'pay_1', order_id: 'order_1', signature: 'sig' });
    await userEvent.click(screen.getByRole('button', { name: 'Start learning' }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/cbse/dashboard'));
  });

  it('records a dismissed sheet and a failed payment with update-failed-purchase-status', async () => {
    const failures: unknown[] = [];
    server.use(
      ...common,
      http.post(`${API}/api/v1/purchase/purchase-plan-1`, () =>
        HttpResponse.json({ success: true, data: { order_id: 'order_2', amount: 58900, currency: 'INR' } }),
      ),
      http.put(`${API}/api/v1/purchase/update-failed-purchase-status`, async ({ request }) => {
        failures.push(await request.json());
        return HttpResponse.json({ success: true });
      }),
    );
    await openReview(/^Topper Monthly$/);
    const pay = screen.getAllByRole('button', { name: /Pay ₹589/ })[0]!;
    await userEvent.click(pay);
    await waitFor(() => expect(options).not.toBeNull());
    options!.modal.ondismiss();
    await waitFor(() => expect(failures).toEqual([{ order_id: 'order_2', description: 'Payment cancelled by the student' }]));

    options = null;
    await userEvent.click(screen.getAllByRole('button', { name: /Pay ₹589/ })[0]!);
    await waitFor(() => expect(options).not.toBeNull());
    failedHandler!({ error: { description: 'Card declined' } });
    expect(await screen.findByText("Payment didn't go through")).toBeInTheDocument();
    expect(screen.getByText('Card declined')).toBeInTheDocument();
    await waitFor(() => expect(failures).toHaveLength(2));
  });

  it('activates a free plan without Razorpay', async () => {
    let body: unknown = null;
    server.use(
      ...common,
      http.post(`${API}/api/v1/purchase/purchase-free-plan`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ success: true });
      }),
    );
    await openReview(/^Basic$/);
    await userEvent.click(screen.getByRole('button', { name: /Activate free plan/ }));
    expect(await screen.findByText('Payment Successful')).toBeInTheDocument();
    expect(body).toMatchObject({ plan_id: 10, price_id: 1, duration_months: 0 });
    expect(options).toBeNull();
  });

  it('shows a warning when the order cannot be created', async () => {
    server.use(
      ...common,
      http.post(`${API}/api/v1/purchase/purchase-plan-1`, () => HttpResponse.json({ success: false, message: 'Plan already active' })),
    );
    await openReview(/^Topper Monthly$/);
    await userEvent.click(screen.getAllByRole('button', { name: /Pay ₹589/ })[0]!);
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Plan already active');
  });
});

describe('manage plans', () => {
  it('cancels a competitive plan after confirmation, sending the reason', async () => {
    let body: unknown = null;
    server.use(
      http.get(`${API}/api/neet/v1/purchase/purchase-history`, () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              id: 1,
              planId: 7,
              name: 'Topper NEET 2027',
              billingCycle: 'Target Year',
              status: 'ACTIVE',
              startDate: '01 Apr, 2026',
              expiryDate: '31 May, 2027',
              remainingDays: 300,
              courses: [{ id: 1, label: 'MAIN PLAN', title: 'NEET 2027', status: 'ACTIVE' }],
            },
          ],
        }),
      ),
      http.post(`${API}/api/neet/v1/purchase/cancel-active-plan`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ success: true });
      }),
    );
    renderWithProviders(<CompetitiveManagePlans exam={neet} />, { exam: neet });
    await userEvent.click((await screen.findAllByRole('button', { name: 'Cancel Plan' }))[0]!);
    const dialog = screen.getByRole('dialog', { name: 'Cancel Subscription' });
    await userEvent.selectOptions(within(dialog).getByLabelText('Please tell us why you are leaving'), 'Too expensive');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Yes, Cancel Plan' }));
    expect(await screen.findByText('Cancellation Confirmed')).toBeInTheDocument();
    expect(body).toEqual({ plan_id: 7, reason: 'Too expensive' });
  });

  it('keeps a board plan when the student backs out, and cancels on confirm', async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/api/subscriptions/get-active-student-plans`, () =>
        HttpResponse.json({
          plans: [{ plan_id: 5, class_id: 12, class_name: 'CLASS 12', duration_months: 12, purchase_start_date: '2026-01-01', expiry_date: '2027-03-31', status: 'active' }],
        }),
      ),
      http.post(`${API}/api/v1/purchase/cancel-active-plan`, () => {
        calls += 1;
        return HttpResponse.json({ success: true });
      }),
    );
    renderWithProviders(<BoardManagePlans exam={cbse} />, { exam: cbse });
    await userEvent.click((await screen.findAllByRole('button', { name: 'Cancel Plan' }))[0]!);
    await userEvent.click(screen.getByRole('button', { name: 'No, keep it' }));
    expect(calls).toBe(0);
    await userEvent.click(screen.getAllByRole('button', { name: 'Cancel Plan' })[0]!);
    await userEvent.click(screen.getByRole('button', { name: 'Yes, cancel it!' }));
    expect(await screen.findByText('Cancelled!')).toBeInTheDocument();
    expect(calls).toBe(1);
  });

  it('extends a board plan with a coupon', async () => {
    server.use(
      http.get(`${API}/api/subscriptions/get-active-student-plans`, () =>
        HttpResponse.json({ plans: [{ plan_id: 5, class_name: 'CLASS 12', duration_months: 1, expiry_date: '2026-07-01', status: 'active' }] }),
      ),
      http.post(`${API}/api/v1/purchase/apply-custom-duration-coupon`, () =>
        HttpResponse.json({ success: true, data: { months: 2, expiry_date: '2026-09-01' } }),
      ),
    );
    renderWithProviders(<BoardManagePlans exam={cbse} />, { exam: cbse });
    await userEvent.click((await screen.findAllByRole('button', { name: 'Extend plan' }))[0]!);
    await userEvent.type(screen.getByRole('textbox', { name: 'Coupon code' }), 'MORE');
    await userEvent.click(screen.getByRole('button', { name: 'Extend' }));
    expect(await screen.findByText('2 months added')).toBeInTheDocument();
  });
});

describe('billing history', () => {
  it('lists transactions with amounts and invoices', async () => {
    server.use(
      http.get(`${API}/api/neet/v1/purchase/billing-history`, () =>
        HttpResponse.json({
          success: true,
          data: [{ id: 1, invoice_no: 'INV-1', description: 'Topper NEET Monthly', transaction_date: '2026-05-02', amount: 589, status: 'paid', invoice_url: 'https://x.test/inv.pdf' }],
        }),
      ),
    );
    renderWithProviders(<BillingHistory exam={neet} />, { exam: neet });
    const table = await screen.findByRole('table');
    expect(within(table).getByText('INV-1')).toBeInTheDocument();
    expect(within(table).getByText('₹589.00')).toBeInTheDocument();
    expect(within(table).getByRole('link', { name: 'PDF' })).toHaveAttribute('href', 'https://x.test/inv.pdf');
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
    http.get(`${API}/api/v1/student/plans/active-for-signup`, () => HttpResponse.json({ success: true, data: { plans: [{ plan_id: 44 }] } })),
  ];

  it('validates and applies a referral code from a referral link', async () => {
    localStorage.setItem('prepzy_referral_code', 'FRIEND1');
    let applied: unknown = null;
    server.use(
      ...base,
      http.get(`${API}/api/referral/status`, () => HttpResponse.json({ success: true, data: { alreadyReferred: false } })),
      http.post(`${API}/api/referral/validate`, () => HttpResponse.json({ success: true, data: { valid: true, referrerName: 'Asha', joiningCredit: 50 } })),
      http.post(`${API}/api/referral/apply`, async ({ request }) => {
        applied = await request.json();
        return HttpResponse.json({ success: true, data: { joiningCredit: 50 } });
      }),
    );
    renderWithProviders(<Welcome />);
    expect(await screen.findByText('₹50 credited to your wallet!')).toBeInTheDocument();
    expect(applied).toEqual({ code: 'FRIEND1', exam_id: 2 });
    expect(localStorage.getItem('prepzy_referral_code')).toBeNull();
  });

  it('extends the free month with a NEET coupon and shows invalid codes', async () => {
    server.use(
      ...base,
      http.get(`${API}/api/referral/status`, () => HttpResponse.json({ success: true, data: {} })),
      http.post(`${API}/api/v1/purchase/apply-custom-duration-coupon-neet`, async ({ request }) => {
        const { coupon_code, plan_id } = (await request.json()) as { coupon_code: string; plan_id: number };
        expect(plan_id).toBe(44);
        return coupon_code === 'GOOD'
          ? HttpResponse.json({ success: true, data: { months: 2, expiry_date: '2026-09-01' } })
          : HttpResponse.json({ success: false, message: 'Invalid coupon code' }, { status: 400 });
      }),
    );
    renderWithProviders(<Welcome />);
    const input = await screen.findByRole('textbox', { name: 'Enter coupon code' });
    await screen.findByText('Free for 1 month', { selector: 'p' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'See pricing' })).toBeInTheDocument());
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
    server.use(...base, http.get(`${API}/api/referral/status`, () => HttpResponse.json({ success: true, data: {} })));
    renderWithProviders(<Welcome />);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/neet/dashboard'));
  });
});

describe('plan pages', () => {
  it('shows the competitive design for NEET and redirects board billing to the plans page', async () => {
    server.use(http.get(`${API}/api/neet/v1/purchase/purchase-history`, () => HttpResponse.json({ success: true, data: [] })));
    renderWithProviders(<ManagePlans />, { exam: neet });
    expect(await screen.findByText('No active plans yet')).toBeInTheDocument();
    renderWithProviders(<BillingPage />, { exam: cbse });
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/cbse/plans'));
  });

  it('expands a board plan to its paginated billing history', async () => {
    server.use(
      http.get(`${API}/api/subscriptions/get-active-student-plans`, () =>
        HttpResponse.json({ plans: [{ plan_id: 5, class_id: 12, class_name: 'CLASS 12', stream_name: 'PCM', duration_months: 0, status: 'expired' }] }),
      ),
      http.get(`${API}/api/subscriptions/get-purchase-payment-history`, () =>
        HttpResponse.json({
          data: [
            { amount: '499', status: 'success', invoice: 'https://x.test/i.pdf', created_at: '2026-01-02', duration: 1 },
            { amount: '499', status: 'refunded', invoice: null, created_at: '2026-01-03', duration: 1 },
          ],
          pagination: { page: 1, totalPages: 2 },
        }),
      ),
    );
    renderWithProviders(<ManagePlans />, { exam: cbse });
    expect(await screen.findAllByText('12 PCM')).not.toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Cancel Plan' })).toBeNull();
    await userEvent.click(screen.getAllByRole('button', { name: 'Show billing history' })[0]!);
    expect(await screen.findByText('Billing History for this Plan')).toBeInTheDocument();
    expect(screen.getAllByText('-₹499').length).toBeGreaterThan(0);
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
  });

  it('holds a captured payment as pending until the server confirms it', async () => {
    let verifyCalls = 0;
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
      http.post(`${API}/api/v1/purchase/purchase-plan-1`, () => HttpResponse.json({ success: true, data: { order_id: 'o3', amount: 1, currency: 'INR' } })),
      http.post(`${API}/api/v1/purchase/verify-purchase-plan-1`, () => {
        verifyCalls += 1;
        return HttpResponse.json({ success: verifyCalls > 1 });
      }),
    );
    renderWithProviders(<Checkout />, { exam: cbse });
    await userEvent.click(await screen.findByRole('button', { name: /^Topper Monthly$/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click((await screen.findAllByRole('button', { name: /Pay ₹589/ }))[0]!);
    await waitFor(() => expect(options).not.toBeNull());
    options!.handler({ razorpay_payment_id: 'p3', razorpay_order_id: 'o3', razorpay_signature: 's' });
    expect(await screen.findByText('Payment is being processed')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Refresh/ }));
    expect(await screen.findByText('Payment Successful')).toBeInTheDocument();
  });
});
