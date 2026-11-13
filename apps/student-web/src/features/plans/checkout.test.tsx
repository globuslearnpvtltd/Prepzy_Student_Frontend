import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { navigation } from '@/test/setup';
import type { ApiPlan } from './catalog';
import { Checkout } from './components/checkout/checkout';
import type { RazorpayFailure, RazorpayOptions } from './razorpay';
import { billingError, billingOk, billingUrl, quoteData } from '@/test/billing';
import { testExam } from '@/test/exams';

vi.mock('@/shared/config/env', async (importOriginal) => {
  const actual = await importOriginal<{ env: Record<string, unknown> }>();
  return { env: { ...actual.env, razorpayKeyId: 'rzp_test_key' } };
});

const cbse = testExam('cbse');
const neet = testExam('neet');

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

// Board variants carry no display fields, so the names below come from the fallback (an older backend).
const variant = (variant_id: string, class_id: number, class_title: string, plans: ApiPlan[], stream?: [number, string]) => ({
  variant_id,
  class_id,
  class_title,
  stream_id: stream?.[0] ?? null,
  stream_name: stream?.[1] ?? null,
  target_year: null as number | null,
  has_combo: false,
  plans,
});

const bundle = [
  { exam_id: 1, exam_title: 'CBSE', class_id: 11, class_title: 'Class 11 PCB' },
  { exam_id: 1, exam_title: 'CBSE', class_id: 12, class_title: 'Class 12 PCB' },
];

/** A target-year variant with the addendum's display fields, as the new backend sends it. */
const yearVariant = (year: number, plans: ApiPlan[]) => ({
  ...variant(`neet-${year}`, 20, 'NEET', plans),
  target_year: year,
  has_combo: plans.some((plan) => plan.is_combo),
  variant_label: `NEET ${year}`,
  group_key: 'target_year',
  bundle_options: plans.some((plan) => plan.is_combo) ? [{ exam_id: 1, title: 'CBSE' }] : [],
});

const cbseVariants = [
  variant('c12', 12, 'CLASS 12', [apiPlan({ price_id: 1, duration_months: 0, price: 0, cost_price: 0 }), apiPlan({ price_id: 2 })]),
  variant('c11-pcm', 11, 'CLASS 11', [apiPlan({ price_id: 11, duration_months: 0, price: 0, cost_price: 0 }), apiPlan({ price_id: 12 })], [1, 'PCM']),
  variant('c11-pcb', 11, 'CLASS 11', [apiPlan({ price_id: 13, duration_months: 12, price: 3999, cost_price: 9999 })], [2, 'PCB']),
  variant('c10', 10, 'CLASS 10', []),
];

const neetVariants = [
  yearVariant(2027, [
    apiPlan({ price_id: 31, plan_id: 20, plan_title: 'NEET 2027', display_name: 'Topper NEET UG Monthly', tier: 'monthly' }),
    apiPlan({ price_id: 32, plan_id: 20, plan_title: 'NEET 2027', duration_months: 12, price: 3999, cost_price: 9999, display_name: 'Topper NEET UG 2027', tier: 'yearly' }),
    apiPlan({ price_id: 33, plan_id: 21, plan_title: 'NEET 2027', is_combo: true, price: 699, display_name: 'Topper NEET UG + CBSE Monthly', tier: 'monthly', bundled: bundle }),
  ]),
  yearVariant(2028, [apiPlan({ price_id: 41, plan_id: 22, plan_title: 'NEET 2028', display_name: 'Topper NEET UG Monthly' })]),
  yearVariant(2029, [apiPlan({ price_id: 51, plan_id: 23, plan_title: 'NEET 2029', is_combo: true, display_name: 'Topper NEET UG + CBSE Monthly', bundled: bundle })]),
];

const PRICES = new Map([...cbseVariants, ...neetVariants].flatMap((v) => v.plans.map((p) => [p.price_id, p.price] as const)));

const catalog = (exam: typeof cbse, variants: ReturnType<typeof variant>[]) =>
  http.get(billingUrl(exam, '/catalog'), () =>
    billingOk({ exam: { exam_id: exam.examId, exam_key: exam.examSlice, title: exam.label, exam_date: null }, variants }),
  );

/** POST /quote for both exams: list price, optional SAVE10 (10%), anything else is an invalid coupon. */
const quote = (exam: typeof cbse) =>
  http.post(billingUrl(exam, '/quote'), async ({ request }) => {
    const { price_id, coupon_code } = (await request.json()) as { price_id: number; coupon_code?: string };
    if (coupon_code && coupon_code !== 'SAVE10') {
      return billingError(400, 'INVALID_COUPON', 'This coupon has expired', { reason: 'expired' });
    }
    return billingOk(quoteData(price_id, PRICES.get(price_id) ?? 0, coupon_code ? 10 : 0, coupon_code ?? null));
  });

function handlers(account: Record<string, unknown> = { account_id: 1, first_name: 'Ravi' }) {
  return [
    catalog(cbse, cbseVariants),
    catalog(neet, neetVariants),
    http.get(billingUrl(cbse, '/feature-limits'), () =>
      billingOk({ features: [{ id: 1, feature_name: 'Quiz', free_limit: 2, premium_limit: null }] }),
    ),
    http.get(billingUrl(neet, '/feature-limits'), () => billingOk({ features: [] })),
    http.get(billingUrl(cbse, '/coupons'), () => billingOk({ coupons: [] })),
    http.get(billingUrl(neet, '/coupons'), () => billingOk({ coupons: [{ coupon_code: 'SAVE10', description: '10% off', discount: 10, expiry: '2099-01-01' }] })),
    quote(cbse),
    quote(neet),
    http.get(`${API}/api/v4/student/account`, () => HttpResponse.json({ success: true, data: account })),
  ];
}

const pressed = (name: RegExp | string) => screen.getByRole('button', { name }).getAttribute('aria-pressed');

describe('Checkout plan picker', () => {
  afterEach(() => {
    navigation.searchParams = new URLSearchParams();
  });

  it('shows a loading panel, then switches class, stream and exam', async () => {
    server.use(...handlers());
    renderWithProviders(<Checkout />);
    expect(screen.getByLabelText('Loading plans')).toBeInTheDocument();
    // Class 10 is first and has nothing on sale yet.
    expect(await screen.findByText('No plans are live for this selection yet.')).toBeInTheDocument();
    // Exam cards are the API's exams, named by the API, with a text per category.
    expect(screen.getByRole('button', { name: /^CBSE ?Prepare for your board exams/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^NEET UG ?Prepare for your entrance exam/ })).toBeEnabled();

    await userEvent.click(screen.getByRole('button', { name: 'Class 11' }));
    expect(screen.getByText('Stream · Class 11')).toBeInTheDocument();
    expect(pressed('PCM')).toBe('true');
    expect(screen.getByRole('button', { name: /^Basic CBSE$/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'PCB' }));
    expect(screen.getByRole('button', { name: /^Topper CBSE Academic$/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Basic CBSE$/ })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /View All Limits/ }));
    expect(screen.getByRole('button', { name: /View less/ })).toHaveAttribute('aria-expanded', 'true');

    await userEvent.click(screen.getByRole('button', { name: /NEET/ }));
    // Switching exam names it in the URL of the one common page (replace, not a new history entry).
    expect(navigation.replace).toHaveBeenCalledWith('/purchase?exam=neet', { scroll: false });
    expect(navigation.push).not.toHaveBeenCalled();
    expect(screen.getByText('Target year')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^NEET 2027/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^Topper NEET UG Monthly$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Topper NEET UG 2027$/ })).toBeInTheDocument();

    // The add-on is named from bundle_options, the chips from the combo's `bundled`.
    await userEvent.click(screen.getByRole('switch', { name: 'Add CBSE' }));
    expect(screen.getByText('CBSE included')).toBeInTheDocument();
    const includes = within(screen.getByRole('list', { name: 'Your plan includes' }));
    expect(includes.getAllByRole('listitem').map((chip) => chip.textContent)).toEqual(['NEET 2027', 'CBSE · Class 11 PCB', 'CBSE · Class 12 PCB']);
    expect(screen.getByRole('button', { name: /^Topper NEET UG \+ CBSE Monthly$/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Topper NEET UG Monthly$/ })).toBeNull();
    await userEvent.click(screen.getByRole('switch', { name: 'Add CBSE' }));

    // 2028 has no combo, so no boards switch; 2029 is combo-only.
    await userEvent.click(screen.getByRole('button', { name: /^NEET 2028/ }));
    expect(screen.queryByRole('switch')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /^NEET 2029/ }));
    expect(screen.getByText('No plans are live for this selection yet.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^CBSE ?Prepare/ }));
    expect(screen.getByText('Choose your class')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(navigation.back).toHaveBeenCalled();
  });

  it('asks for an exam when the link names one without plans', async () => {
    navigation.searchParams = new URLSearchParams('exam=unknown-exam');
    server.use(...handlers());
    renderWithProviders(<Checkout />);
    expect(await screen.findByText('Select your exam to explore the best plan for your preparation.')).toBeInTheDocument();
    expect(pressed(/^CBSE ?Prepare/)).toBe('false');
    expect(pressed(/^NEET UG ?Prepare/)).toBe('false');
  });

  it('picks the exam of a ?exam= link by its id', async () => {
    navigation.searchParams = new URLSearchParams(`exam=${neet.examId}`);
    server.use(...handlers());
    renderWithProviders(<Checkout />);
    expect(await screen.findByText('Target year')).toBeInTheDocument();
    expect(pressed(/^NEET UG ?Prepare/)).toBe('true');
  });

  it('opens the remembered exam when the URL names none, else the first purchasable exam', async () => {
    document.cookie = 'prepzy_exam=neet; path=/';
    server.use(...handlers());
    const { unmount } = renderWithProviders(<Checkout />);
    expect(await screen.findByText('Target year')).toBeInTheDocument();
    expect(pressed(/^NEET UG ?Prepare/)).toBe('true');
    unmount();

    document.cookie = 'prepzy_exam=; path=/; max-age=0';
    renderWithProviders(<Checkout />);
    await waitFor(() => expect(pressed(/^CBSE ?Prepare/)).toBe('true'));
    expect(screen.getByText('Choose your class')).toBeInTheDocument();
  });

  it('lets ?exam= win over the remembered exam', async () => {
    document.cookie = 'prepzy_exam=neet; path=/';
    navigation.searchParams = new URLSearchParams('exam=cbse');
    server.use(...handlers());
    renderWithProviders(<Checkout />);
    await waitFor(() => expect(pressed(/^CBSE ?Prepare/)).toBe('true'));
    expect(screen.getByText('Choose your class')).toBeInTheDocument();
  });

  it('preselects the class of a link that names its exam (the routes helper’s URL)', async () => {
    navigation.searchParams = new URLSearchParams('exam=cbse&CLASSID=11&stream_id=2');
    server.use(...handlers());
    renderWithProviders(<Checkout />);
    expect(await screen.findByRole('button', { name: /^Topper CBSE Academic$/ })).toBeInTheDocument();
    expect(pressed('Class 11')).toBe('true');
    expect(pressed('PCB')).toBe('true');
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('moves an old ?CLASSID= link to the exam that has that class, and names it in the URL', async () => {
    navigation.searchParams = new URLSearchParams('CLASSID=20');
    server.use(...handlers());
    renderWithProviders(<Checkout />);
    expect(await screen.findByText('Target year')).toBeInTheDocument();
    expect(pressed(/^NEET UG ?Prepare/)).toBe('true');
    expect(navigation.replace).toHaveBeenCalledWith('/purchase?exam=neet', { scroll: false });
  });

  it('preselects class and stream from an old link', async () => {
    navigation.searchParams = new URLSearchParams('CLASSID=11&stream_id=2');
    server.use(...handlers());
    renderWithProviders(<Checkout />);
    expect(await screen.findByRole('button', { name: /^Topper CBSE Academic$/ })).toBeInTheDocument();
    expect(pressed('PCB')).toBe('true');
    expect(pressed('Class 11')).toBe('true');
  });

  it('preselects the student’s own class, and ignores an unknown one', async () => {
    server.use(...handlers({ account_id: 1, class: 12 }));
    const { unmount } = renderWithProviders(<Checkout />);
    await waitFor(() => expect(pressed('Class 12')).toBe('true'));
    unmount();

    navigation.searchParams = new URLSearchParams('class=99');
    renderWithProviders(<Checkout />);
    expect(await screen.findByText('No plans are live for this selection yet.')).toBeInTheDocument();
  });

  it('shows an error screen when the catalog fails', async () => {
    server.use(...handlers());
    server.use(http.get(billingUrl(cbse, '/catalog'), () => billingError(404, 'PURCHASE_NOT_AVAILABLE', 'Catalog offline')));
    renderWithProviders(<Checkout />);
    expect(await screen.findByText('Something Went Wrong')).toBeInTheDocument();
    expect(screen.getByText('Catalog offline')).toBeInTheDocument();
  });
});

describe('Checkout payment outcomes', () => {
  let sheet: { options: RazorpayOptions; failed: ((failure: RazorpayFailure) => void) | null } | null;
  beforeEach(() => {
    sheet = null;
    navigation.searchParams = new URLSearchParams('exam=neet');
    window.Razorpay = class {
      constructor(options: RazorpayOptions) {
        sheet = { options, failed: null };
      }
      open() {}
      on(_event: string, handler: (failure: RazorpayFailure) => void) {
        sheet!.failed = handler;
      }
    } as unknown as typeof window.Razorpay;
    window.scrollTo = vi.fn();
  });
  afterEach(() => {
    navigation.searchParams = new URLSearchParams();
    Reflect.deleteProperty(window, 'Razorpay');
  });

  const neetOrder = (data: Record<string, unknown> = { order_id: 'order_n', status: 'created', amount_paise: 58882, currency: 'INR', key_id: 'rzp_k' }) =>
    http.post(billingUrl(neet, '/orders'), () => billingOk(data, 201));
  const markFailed = http.post(billingUrl(neet, '/orders/:id/fail'), ({ params }) => billingOk({ order_id: params.id, status: 'failed' }));

  async function reviewNeetMonthly() {
    renderWithProviders(<Checkout />);
    await userEvent.click(await screen.findByRole('button', { name: /^Topper NEET UG 2027$/ }));
    await userEvent.click(screen.getByRole('button', { name: /^Topper NEET UG Monthly$/ }));
    await userEvent.click(screen.getByRole('button', { name: /Continue with this plan/ }));
    await screen.findByText("You're almost there! 🌟");
    // The bill is the server's quote: 499 + 18% GST = 588.82.
    await waitFor(() => expect(screen.getByTestId('order-total')).toHaveTextContent('₹588.82'));
  }

  it('goes back from review, then retries and abandons a failed payment', async () => {
    let orders = 0;
    server.use(
      ...handlers(),
      markFailed,
      http.post(billingUrl(neet, '/orders'), () => {
        orders += 1;
        return billingOk({ order_id: `order_${orders}`, status: 'created', amount_paise: 58882, currency: 'INR', key_id: 'rzp_k' }, 201);
      }),
    );
    await reviewNeetMonthly();
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByText('What are you preparing for?')).toBeInTheDocument();
    // The mobile bar continues with the selected plan.
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByText("You're almost there! 🌟");

    await userEvent.click((await screen.findAllByRole('button', { name: /Pay ₹588.82/ }))[0]!);
    await waitFor(() => expect(sheet).not.toBeNull());
    expect(sheet!.options.description).toBe('Topper NEET UG Monthly · 1 Month · NEET 2027');
    expect(sheet!.options).toMatchObject({ key: 'rzp_k', amount: 58882, order_id: 'order_1' });
    sheet!.failed!({ error: { description: 'Card declined', metadata: { payment_id: 'pay_x' } } });
    const failed = await screen.findByRole('dialog', { name: "Payment didn't go through" });
    expect(within(failed).getByText('pay_x')).toBeInTheDocument();
    expect(within(failed).getByText('30-day access')).toBeInTheDocument();

    const first = sheet;
    await userEvent.click(within(failed).getByRole('button', { name: 'Retry payment' }));
    await waitFor(() => expect(sheet).not.toBe(first));
    expect(orders).toBe(2);
    sheet!.failed!({});
    await userEvent.click(await screen.findByRole('button', { name: 'Explore plans' }));
    expect(await screen.findByText('What are you preparing for?')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('applies a coupon through /quote: an invalid one shows the reason, a valid one shows the server total', async () => {
    let orderBody: unknown = null;
    server.use(
      ...handlers(),
      http.post(billingUrl(neet, '/orders'), async ({ request }) => {
        orderBody = await request.json();
        return billingOk({ order_id: 'order_c', status: 'created', amount_paise: 52994, currency: 'INR', key_id: 'rzp_k' }, 201);
      }),
    );
    await reviewNeetMonthly();
    await userEvent.type(screen.getByRole('textbox', { name: 'Coupon code' }), 'OLD');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This coupon has expired');
    await userEvent.click(screen.getByRole('button', { name: 'Apply SAVE10' }));
    expect(await screen.findByText('Coupon Code applied!')).toBeInTheDocument();
    // 499 − 49.90 = 449.10, + 18% GST 80.84 = 529.94 (the server's numbers, not whole rupees).
    await waitFor(() => expect(screen.getByTestId('order-total')).toHaveTextContent('₹529.94'));
    expect(screen.getByText('− ₹49.90')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: /Pay ₹529.94/ })[0]!);
    await waitFor(() => expect(sheet).not.toBeNull());
    expect(orderBody).toEqual({ price_id: 31, coupon_code: 'SAVE10' });
    expect(sheet!.options.amount).toBe(52994);
  });

  it('shows success without Razorpay when a 100% coupon settles the order', async () => {
    server.use(...handlers(), neetOrder({ order_id: 'free-000042', status: 'paid', amount_paise: 0, currency: 'INR', key_id: null, purchase: {} }));
    await reviewNeetMonthly();
    await userEvent.click(screen.getAllByRole('button', { name: /Pay ₹588.82/ })[0]!);
    expect(await screen.findByText('Payment Successful')).toBeInTheDocument();
    expect(sheet).toBeNull();
  });

  it('holds a 202 verify as pending, re-checks GET /orders/:id and then shows success', async () => {
    let verifyCalls = 0;
    let checks = 0;
    server.use(
      ...handlers(),
      neetOrder(),
      http.post(billingUrl(neet, '/orders/order_n/verify'), () => {
        verifyCalls += 1;
        return billingOk({ order_id: 'order_n', status: 'pending' }, 202);
      }),
      http.get(billingUrl(neet, '/orders/order_n'), () => {
        checks += 1;
        return billingOk({ order_id: 'order_n', status: 'paid', purchase: {} });
      }),
    );
    await reviewNeetMonthly();
    await userEvent.click(screen.getAllByRole('button', { name: /Pay ₹588.82/ })[0]!);
    await waitFor(() => expect(sheet).not.toBeNull());
    sheet!.options.handler({ razorpay_payment_id: 'pay_p', razorpay_order_id: 'order_n', razorpay_signature: 's' });
    const pending = await screen.findByRole('dialog', { name: 'Payment is being processed' });
    expect(within(pending).getByText('pay_p')).toBeInTheDocument();
    await userEvent.click(within(pending).getByRole('button', { name: /Refresh/ }));
    expect(await screen.findByText('Payment Successful')).toBeInTheDocument();
    expect(checks).toBe(1);
    expect(verifyCalls).toBe(1);
  });

  it('leaves a pending payment for the purchased exam’s dashboard', async () => {
    server.use(...handlers(), neetOrder(), http.post(billingUrl(neet, '/orders/order_n/verify'), () => billingOk({ order_id: 'order_n', status: 'pending' }, 202)));
    await reviewNeetMonthly();
    await userEvent.click(screen.getAllByRole('button', { name: /Pay ₹588.82/ })[0]!);
    await waitFor(() => expect(sheet).not.toBeNull());
    sheet!.options.handler({ razorpay_payment_id: 'pay_p', razorpay_order_id: 'order_n', razorpay_signature: 's' });
    const pending = await screen.findByRole('dialog', { name: 'Payment is being processed' });
    await userEvent.click(within(pending).getByRole('button', { name: 'Go back to dashboard' }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/neet/dashboard'));
    expect(screen.queryByText('Payment is being processed')).toBeNull();
  });

  it('confirms a NEET purchase and opens its dashboard', async () => {
    server.use(...handlers(), neetOrder(), http.post(billingUrl(neet, '/orders/order_n/verify'), () => billingOk({ order_id: 'order_n', status: 'paid', purchase: {} })));
    await reviewNeetMonthly();
    await userEvent.click(screen.getAllByRole('button', { name: /Pay ₹588.82/ })[0]!);
    await waitFor(() => expect(sheet).not.toBeNull());
    sheet!.options.handler({ razorpay_payment_id: 'pay_s', razorpay_order_id: 'order_n', razorpay_signature: 's' });
    expect(await screen.findByText('Payment Successful')).toBeInTheDocument();
    expect(screen.getByText('NEET 2027')).toBeInTheDocument();
    expect(screen.getAllByText(/^Valid until /).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'Back to home' }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/neet/dashboard'));
  });

  it('shows the server message of a blocked renewal (409) and dismisses it', async () => {
    server.use(
      ...handlers(),
      http.post(billingUrl(neet, '/orders'), () =>
        billingError(409, 'RELATED_PLAN_ALREADY_ACTIVE', 'You already have an active CBSE plan included in this combo'),
      ),
    );
    await reviewNeetMonthly();
    await userEvent.click(screen.getAllByRole('button', { name: /Pay ₹588.82/ })[0]!);
    const warning = await screen.findByRole('alertdialog');
    expect(warning).toHaveTextContent('You already have an active CBSE plan included in this combo');
    await userEvent.click(within(warning).getByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});

describe('Checkout with an active plan', () => {
  it('shows the active plan as current, with no Renew and no way to buy it again', async () => {
    const active = [
      variant('c12', 12, 'CLASS 12', [
        apiPlan({ price_id: 1, duration_months: 0, price: 0, cost_price: 0 }),
        apiPlan({ price_id: 2, is_active_plan: true }),
        apiPlan({ price_id: 3, duration_months: 12, price: 3999, cost_price: 9999 }),
      ]),
    ];
    server.use(catalog(cbse, active), ...handlers({ account_id: 1, class: 12 }));
    window.scrollTo = vi.fn();
    renderWithProviders(<Checkout />);
    await userEvent.click(await screen.findByRole('button', { name: /^Topper CBSE Monthly$/ }));
    expect(screen.getAllByText('Current plan').length).toBeGreaterThan(0);
    expect(screen.getByText('Your current active plan')).toBeInTheDocument();
    expect(screen.queryByText(/Renew/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Continue with this plan/ })).toBeNull();
    const bar = screen.getByRole('button', { name: 'Current plan' });
    expect(bar).toBeDisabled();
    // Another plan can still be chosen.
    await userEvent.click(screen.getByRole('button', { name: /^Topper CBSE Academic$/ }));
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });
});
