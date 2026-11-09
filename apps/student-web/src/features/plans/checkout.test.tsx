import { renderHook, screen, waitFor, within } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { getExam } from '@/shared/config/exams';
import { createTestQueryClient, renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { navigation } from '@/test/setup';
import type { ApiPlan } from './catalog';
import { Checkout } from './components/checkout/checkout';
import { useBoardPayments } from './hooks';
import type { RazorpayFailure, RazorpayOptions } from './razorpay';

vi.mock('@/shared/config/env', async (importOriginal) => {
  const actual = await importOriginal<{ env: Record<string, unknown> }>();
  return { env: { ...actual.env, razorpayKeyId: 'rzp_test_key' } };
});

const cbse = getExam('cbse')!;

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

const variant = (variant_id: string, class_id: number, class_title: string, plans: ApiPlan[], stream?: [number, string]) => ({
  variant_id,
  class_id,
  class_title,
  stream_id: stream?.[0] ?? null,
  stream_name: stream?.[1] ?? null,
  target_year: null,
  has_combo: false,
  plans,
});

const exams = [
  {
    exam_id: 1,
    exam_key: 'cbse',
    title: 'CBSE',
    is_active: 1,
    variants: [
      variant('c12', 12, 'CLASS 12', [apiPlan({ price_id: 1, duration_months: 0, price: 0, cost_price: 0 }), apiPlan({ price_id: 2 })]),
      variant('c11-pcm', 11, 'CLASS 11', [apiPlan({ price_id: 11, duration_months: 0, price: 0, cost_price: 0 }), apiPlan({ price_id: 12 })], [1, 'PCM']),
      variant('c11-pcb', 11, 'CLASS 11', [apiPlan({ price_id: 13, duration_months: 12, price: 3999, cost_price: 9999 })], [2, 'PCB']),
      variant('c10', 10, 'CLASS 10', []),
    ],
  },
  {
    exam_id: 2,
    exam_key: 'neet-ug',
    title: 'NEET',
    is_active: 1,
    variants: [
      variant('neet', 20, 'NEET', [
        apiPlan({ price_id: 31, plan_id: 20, plan_title: 'NEET 2027' }),
        apiPlan({ price_id: 32, plan_id: 20, plan_title: 'NEET 2027', duration_months: 12, price: 3999, cost_price: 9999 }),
        apiPlan({ price_id: 33, plan_id: 21, plan_title: 'NEET 2027', is_combo: true, price: 699 }),
        apiPlan({ price_id: 41, plan_id: 22, plan_title: 'NEET 2028' }),
        apiPlan({ price_id: 51, plan_id: 23, plan_title: 'NEET 2029', is_combo: true }),
      ]),
    ],
  },
];

function handlers(account: Record<string, unknown> = { account_id: 1, first_name: 'Ravi' }) {
  return [
    http.get(`${API}/api/v2/purchase/purchase-plans`, () => HttpResponse.json({ success: true, data: { exams } })),
    http.get(`${API}/api/v2/purchase/feature-limits`, () =>
      HttpResponse.json({ success: true, data: { exams: [{ exam_key: 'cbse', features: [{ feature_name: 'Quiz', free_limit: 2, premium_limit: null }] }] } }),
    ),
    http.get(`${API}/api/subscriptions/active-coupons`, () => HttpResponse.json({ coupons: [] })),
    http.get(`${API}/api/accounts`, () => HttpResponse.json({ success: true, data: account })),
  ];
}

const pressed = (name: RegExp | string) => screen.getByRole('button', { name }).getAttribute('aria-pressed');

describe('Checkout plan picker', () => {
  afterEach(() => {
    navigation.searchParams = new URLSearchParams();
  });

  it('shows a loading panel, then switches class, stream and exam', async () => {
    server.use(...handlers());
    renderWithProviders(<Checkout />, { exam: cbse });
    expect(screen.getByLabelText('Loading plans')).toBeInTheDocument();
    // Class 10 is first and has nothing on sale yet.
    expect(await screen.findByText('No plans are live for this selection yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /JEE/ })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Class 11' }));
    expect(screen.getByText('Stream · Class 11')).toBeInTheDocument();
    expect(pressed('PCM')).toBe('true');
    expect(screen.getByRole('button', { name: /^Basic$/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'PCB' }));
    expect(screen.getByRole('button', { name: /^Topper Academic$/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Basic$/ })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /View All Limits/ }));
    expect(screen.getByRole('button', { name: /View less/ })).toHaveAttribute('aria-expanded', 'true');

    await userEvent.click(screen.getByRole('button', { name: /NEET/ }));
    expect(screen.getByText('Target year')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^NEET 2027/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^Topper NEET Monthly$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Topper NEET 2027$/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('switch', { name: 'Add CBSE boards' }));
    expect(screen.getByText('CBSE included')).toBeInTheDocument();
    expect(screen.getByText('CBSE · Class 12')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Topper NEET \+ CBSE Monthly$/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Topper NEET Monthly$/ })).toBeNull();
    await userEvent.click(screen.getByRole('switch', { name: 'Add CBSE boards' }));

    // 2028 has no combo, so no boards switch; 2029 is combo-only.
    await userEvent.click(screen.getByRole('button', { name: /^NEET 2028/ }));
    expect(screen.queryByRole('switch')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /^NEET 2029/ }));
    expect(screen.getByText('No plans are live for this selection yet.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /CBSE/ }));
    expect(screen.getByText('Choose your class')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(navigation.back).toHaveBeenCalled();
  });

  it('asks for an exam when the link names one without plans', async () => {
    navigation.searchParams = new URLSearchParams('exam=jee');
    server.use(...handlers());
    renderWithProviders(<Checkout />, { exam: cbse });
    expect(await screen.findByText('Select your exam to explore the best plan for your preparation.')).toBeInTheDocument();
    expect(pressed(/JEE/)).toBe('true');
  });

  it('preselects class and stream from an old link', async () => {
    navigation.searchParams = new URLSearchParams('CLASSID=11&stream_id=2');
    server.use(...handlers());
    renderWithProviders(<Checkout />, { exam: cbse });
    expect(await screen.findByRole('button', { name: /^Topper Academic$/ })).toBeInTheDocument();
    expect(pressed('PCB')).toBe('true');
    expect(pressed('Class 11')).toBe('true');
  });

  it('preselects the student’s own class, and ignores an unknown one', async () => {
    server.use(...handlers({ account_id: 1, class: 12 }));
    const { unmount } = renderWithProviders(<Checkout />, { exam: cbse });
    await waitFor(() => expect(pressed('Class 12')).toBe('true'));
    unmount();

    navigation.searchParams = new URLSearchParams('class=99');
    renderWithProviders(<Checkout />, { exam: cbse });
    expect(await screen.findByText('No plans are live for this selection yet.')).toBeInTheDocument();
  });

  it('shows an error screen when the catalog fails', async () => {
    server.use(...handlers());
    server.use(http.get(`${API}/api/v2/purchase/purchase-plans`, () => HttpResponse.json({ success: false, message: 'Catalog offline' })));
    renderWithProviders(<Checkout />, { exam: cbse });
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

  const neetOrder = http.post(`${API}/api/neet/v1/purchase/purchase-plan`, () =>
    HttpResponse.json({ success: true, data: { order_id: 'order_n', amount: 58900, currency: 'INR' } }),
  );
  const markFailed = http.put(`${API}/api/neet/v1/purchase/update-failed-purchase-status`, () => HttpResponse.json({ success: true }));

  async function reviewNeetMonthly() {
    renderWithProviders(<Checkout />, { exam: cbse });
    await userEvent.click(await screen.findByRole('button', { name: /^Topper NEET 2027$/ }));
    await userEvent.click(screen.getByRole('button', { name: /^Topper NEET Monthly$/ }));
    await userEvent.click(screen.getByRole('button', { name: /Continue with this plan/ }));
    await screen.findByText("You're almost there! 🌟");
  }

  it('goes back from review, then retries and abandons a failed payment', async () => {
    let orders = 0;
    server.use(
      ...handlers(),
      markFailed,
      http.post(`${API}/api/neet/v1/purchase/purchase-plan`, () => {
        orders += 1;
        return HttpResponse.json({ success: true, data: { order_id: `order_${orders}`, amount: 58900, currency: 'INR' } });
      }),
    );
    await reviewNeetMonthly();
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByText('What are you preparing for?')).toBeInTheDocument();
    // The mobile bar continues with the selected plan.
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByText("You're almost there! 🌟");

    await userEvent.click(screen.getAllByRole('button', { name: /Pay ₹589/ })[0]!);
    await waitFor(() => expect(sheet).not.toBeNull());
    expect(sheet!.options.description).toBe('Topper NEET Monthly · 1 Month · NEET 2027');
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

  it('leaves a pending payment for the purchased exam’s dashboard', async () => {
    server.use(
      ...handlers(),
      neetOrder,
      http.post(`${API}/api/neet/v1/purchase/verify-purchase`, () => HttpResponse.json({ success: false })),
    );
    await reviewNeetMonthly();
    await userEvent.click(screen.getAllByRole('button', { name: /Pay ₹589/ })[0]!);
    await waitFor(() => expect(sheet).not.toBeNull());
    sheet!.options.handler({ razorpay_payment_id: 'pay_p', razorpay_order_id: 'order_n', razorpay_signature: 's' });
    const pending = await screen.findByRole('dialog', { name: 'Payment is being processed' });
    expect(within(pending).getByText('pay_p')).toBeInTheDocument();
    await userEvent.click(within(pending).getByRole('button', { name: 'Go back to dashboard' }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/neet/dashboard'));
    expect(screen.queryByText('Payment is being processed')).toBeNull();
  });

  it('confirms a NEET purchase and opens its dashboard', async () => {
    server.use(...handlers(), neetOrder, http.post(`${API}/api/neet/v1/purchase/verify-purchase`, () => HttpResponse.json({ success: true })));
    await reviewNeetMonthly();
    await userEvent.click(screen.getAllByRole('button', { name: /Pay ₹589/ })[0]!);
    await waitFor(() => expect(sheet).not.toBeNull());
    sheet!.options.handler({ razorpay_payment_id: 'pay_s', razorpay_order_id: 'order_n', razorpay_signature: 's' });
    expect(await screen.findByText('Payment Successful')).toBeInTheDocument();
    expect(screen.getByText('NEET 2027')).toBeInTheDocument();
    expect(screen.getByText(/^Valid until /)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Back to home' }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/neet/dashboard'));
  });

  it('dismisses the warning when the order is refused', async () => {
    server.use(...handlers(), http.post(`${API}/api/neet/v1/purchase/purchase-plan`, () => HttpResponse.json({ success: false, message: 'Already subscribed' })));
    await reviewNeetMonthly();
    await userEvent.click(screen.getAllByRole('button', { name: /Pay ₹589/ })[0]!);
    const warning = await screen.findByRole('alertdialog');
    expect(warning).toHaveTextContent('Already subscribed');
    await userEvent.click(within(warning).getByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});

describe('useBoardPayments', () => {
  it('stays idle without a plan', () => {
    const client = createTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useBoardPayments(null, 1), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(client.getQueryCache().find({ queryKey: ['plans', 'board-payments', 0, 1] })).toBeDefined();
  });
});
