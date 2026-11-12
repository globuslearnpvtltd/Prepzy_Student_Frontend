import { act, renderHook, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { billingError, billingOk, billingUrl } from '@/test/billing';
import { testExam } from '@/test/exams';
import { server } from '@/test/server';
import type { Plan } from './catalog';
import type { RazorpayFailure, RazorpayOptions } from './razorpay';
import { loadPending, PENDING_ORDER_KEY, usePayment, VERIFY_RETRY_DELAYS } from './use-payment';

const mocks = vi.hoisted(() => ({ keyId: 'rzp_test_key' as string | undefined, load: vi.fn() }));

vi.mock('@/shared/config/env', async (importOriginal) => {
  const actual = await importOriginal<{ env: Record<string, unknown> }>();
  return {
    env: new Proxy(actual.env, { get: (target, prop) => (prop === 'razorpayKeyId' ? mocks.keyId : target[prop as string]) }),
  };
});

vi.mock('./razorpay', () => ({ loadRazorpay: mocks.load }));

const cbse = testExam('cbse');

const plan = (extra: Partial<Plan> = {}): Plan => ({
  priceId: 2,
  planId: 10,
  name: 'Topper Monthly',
  tier: 'monthly',
  durationName: '1 Month',
  badge: null,
  price: 499,
  mrp: 999,
  saved: 500,
  validTill: null,
  validityLabel: 'Till 15 Jul 2026',
  perDay: 16,
  durationMonths: 1,
  isCombo: false,
  bundled: [],
  isFree: false,
  isCurrent: false,
  ...extra,
});

let sheet: { options: RazorpayOptions; failed: ((failure: RazorpayFailure) => void) | null; opened: number } | null;

class FakeRazorpay {
  constructor(options: RazorpayOptions) {
    sheet = { options, failed: null, opened: 0 };
  }
  open() {
    sheet!.opened += 1;
  }
  on(_event: string, handler: (failure: RazorpayFailure) => void) {
    sheet!.failed = handler;
  }
}

const success = { razorpay_payment_id: 'pay_1', razorpay_order_id: 'order_1', razorpay_signature: 'sig' };

function setup() {
  return renderHook(() =>
    usePayment({ exam: cbse, coupon: 'SAVE10', describe: (p) => `${p.name} · test`, prefill: { name: 'Ravi', contact: '+91', email: '' } }),
  );
}

let orders: unknown[] = [];
function orderHandler(data: Record<string, unknown> = { order_id: 'order_1', status: 'created', amount_paise: 58882, currency: 'INR', key_id: 'rzp_server' }) {
  return http.post(billingUrl(cbse, '/orders'), async ({ request }) => {
    orders.push(await request.json());
    return billingOk(data, 201);
  });
}

describe('usePayment', () => {
  const failures: { url: string; body: unknown }[] = [];

  beforeEach(() => {
    sheet = null;
    orders = [];
    failures.length = 0;
    mocks.keyId = 'rzp_test_key';
    mocks.load.mockResolvedValue(FakeRazorpay);
    server.use(
      http.post(billingUrl(cbse, '/orders/:id/fail'), async ({ request, params }) => {
        failures.push({ url: String(params.id), body: await request.json() });
        return billingOk({ order_id: params.id, status: 'failed' });
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a server order, opens Razorpay with its amount and key, and verifies the signature', async () => {
    let verified: unknown = null;
    server.use(
      orderHandler(),
      http.post(billingUrl(cbse, '/orders/order_1/verify'), async ({ request }) => {
        verified = await request.json();
        return billingOk({ order_id: 'order_1', status: 'paid', purchase: {} });
      }),
    );
    const { result } = setup();
    await act(() => result.current.pay(plan()));
    expect(orders).toEqual([{ price_id: 2, coupon_code: 'SAVE10' }]);
    expect(sheet!.opened).toBe(1);
    expect(sheet!.options).toMatchObject({ key: 'rzp_server', amount: 58882, order_id: 'order_1', description: 'Topper Monthly · test', name: 'Prepzy' });
    expect(result.current.busy).toBe(true);
    // A second tap while the sheet is open does nothing.
    await act(() => result.current.pay(plan()));
    expect(mocks.load).toHaveBeenCalledTimes(1);
    await act(async () => sheet!.options.handler(success));
    expect(result.current.succeeded?.name).toBe('Topper Monthly');
    expect(result.current.busy).toBe(false);
    expect(verified).toEqual({ payment_id: 'pay_1', signature: 'sig' });
    // Dismissing after a captured payment is not recorded as a failure.
    act(() => sheet!.options.modal.ondismiss());
    expect(failures).toEqual([]);
  });

  it('falls back to the app key when the order has none', async () => {
    server.use(orderHandler({ order_id: 'order_1', status: 'created', amount_paise: 100, currency: 'INR' }));
    const { result } = setup();
    await act(() => result.current.pay(plan()));
    expect(sheet!.options.key).toBe('rzp_test_key');
  });

  it('shows success without Razorpay when a 100% coupon settles the order (status paid)', async () => {
    server.use(orderHandler({ order_id: 'free-000123', status: 'paid', amount_paise: 0, currency: 'INR', key_id: null, purchase: {} }));
    const { result } = setup();
    await act(() => result.current.pay(plan()));
    expect(result.current.succeeded?.priceId).toBe(2);
    expect(mocks.load).not.toHaveBeenCalled();
  });

  it('warns when online payments are switched off', async () => {
    mocks.keyId = '';
    server.use(orderHandler({ order_id: 'order_1', status: 'created', amount_paise: 100, currency: 'INR', key_id: null }));
    const { result } = setup();
    await act(() => result.current.pay(plan()));
    expect(result.current.warning).toBe('Online payments are not available right now. Please try again later.');
    expect(result.current.busy).toBe(false);
    act(() => result.current.dismissWarning());
    expect(result.current.warning).toBeNull();
  });

  it('warns when the gateway script did not load', async () => {
    mocks.load.mockResolvedValue(null);
    server.use(orderHandler());
    const { result } = setup();
    await act(() => result.current.pay(plan()));
    expect(result.current.warning).toBe("Payment gateway didn't load. Check your connection and retry.");
  });

  it('activates Basic with /free-plan and a free premium with /free-premium', async () => {
    const calls: { path: string; body: unknown }[] = [];
    server.use(
      http.post(billingUrl(cbse, '/free-plan'), async ({ request }) => {
        calls.push({ path: 'free-plan', body: await request.json() });
        return billingOk({ purchase: {} }, 201);
      }),
      http.post(billingUrl(cbse, '/free-premium'), async ({ request }) => {
        calls.push({ path: 'free-premium', body: await request.json() });
        return billingOk({ purchase: {} }, 201);
      }),
    );
    const { result } = setup();
    await act(() => result.current.pay(plan({ isFree: true, durationMonths: 0, price: 0, priceId: 1 })));
    await act(() => result.current.pay(plan({ isFree: true, durationMonths: 1, price: 0, priceId: 7 })));
    expect(calls).toEqual([
      { path: 'free-plan', body: { plan_id: 10 } },
      { path: 'free-premium', body: { price_id: 7 } },
    ]);
    expect(result.current.succeeded).not.toBeNull();
  });

  it('shows the server message when a free plan or an order is refused, or a fallback', async () => {
    server.use(http.post(billingUrl(cbse, '/free-premium'), () => billingError(409, 'ALREADY_CLAIMED', 'You already claimed this offer')));
    const { result } = setup();
    await act(() => result.current.pay(plan({ isFree: true, durationMonths: 1, price: 0 })));
    expect(result.current.warning).toBe('You already claimed this offer');
    expect(result.current.succeeded).toBeNull();

    server.use(http.post(billingUrl(cbse, '/orders'), () => billingError(409, 'PLAN_ALREADY_ACTIVE', 'This plan is already active')));
    await act(() => result.current.pay(plan()));
    expect(result.current.warning).toBe('This plan is already active');

    server.use(http.post(billingUrl(cbse, '/orders'), () => billingError(502, 'PAYMENT_PROVIDER_ERROR', 'Razorpay said no')));
    await act(() => result.current.pay(plan()));
    expect(result.current.warning).toBe('The payment service is unavailable right now. Please try again in a few minutes.');

    server.use(http.post(billingUrl(cbse, '/orders'), () => billingError(500, 'INTERNAL', 'db exploded')));
    await act(() => result.current.pay(plan()));
    expect(result.current.warning).toBe("Couldn't start this payment. Please try again.");
    expect(result.current.busy).toBe(false);
  });

  it('records a failure once, falls back to the order id and retries', async () => {
    server.use(orderHandler());
    const { result } = setup();
    await act(() => result.current.pay(plan()));
    act(() => sheet!.failed!({}));
    expect(result.current.failed).toMatchObject({ transactionId: 'order_1', reason: null });
    act(() => sheet!.failed!({ error: { description: 'Bank down', metadata: { payment_id: 'pay_9' } } }));
    expect(result.current.failed).toMatchObject({ transactionId: 'pay_9', reason: 'Bank down' });
    act(() => sheet!.options.modal.ondismiss());
    await waitFor(() => expect(failures).toHaveLength(1));
    expect(failures[0]).toEqual({ url: 'order_1', body: {} });

    const first = sheet;
    await act(async () => result.current.retry());
    await waitFor(() => expect(sheet).not.toBe(first));
    expect(result.current.failed).toBeNull();
    act(() => result.current.clearFailed());
  });

  it('calls fail exactly once when the sheet is dismissed', async () => {
    server.use(orderHandler());
    const { result } = setup();
    await act(() => result.current.pay(plan()));
    act(() => sheet!.options.modal.ondismiss());
    act(() => sheet!.options.modal.ondismiss());
    await waitFor(() => expect(failures).toHaveLength(1));
    expect(failures[0]).toEqual({ url: 'order_1', body: { reason: 'Payment cancelled by the student' } });
    expect(result.current.busy).toBe(false);
  });

  it('retry without a failed payment does nothing', () => {
    const { result } = setup();
    act(() => result.current.retry());
    expect(mocks.load).not.toHaveBeenCalled();
  });

  it('holds a 202 verify as pending, saves it, and re-checks GET /orders/:id until it is paid', async () => {
    let verifyCalls = 0;
    let checks = 0;
    server.use(
      orderHandler(),
      http.post(billingUrl(cbse, '/orders/order_1/verify'), () => {
        verifyCalls += 1;
        return billingOk({ order_id: 'order_1', status: 'pending' }, 202);
      }),
      http.get(billingUrl(cbse, '/orders/order_1'), () => {
        checks += 1;
        return billingOk({ order_id: 'order_1', status: checks >= 2 ? 'paid' : 'pending' });
      }),
    );
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = setup();
    await act(() => result.current.pay(plan()));
    await act(async () => sheet!.options.handler({ ...success, razorpay_payment_id: '' }));
    expect(result.current.pending).toMatchObject({ transactionId: 'order_1', orderId: 'order_1' });
    expect(loadPending()).toMatchObject({ orderId: 'order_1', exam: { category: 'board', examId: cbse.examId } });
    await act(() => vi.advanceTimersByTimeAsync(VERIFY_RETRY_DELAYS[0]!));
    await waitFor(() => expect(checks).toBe(1));
    await waitFor(() => expect(result.current.verifying).toBe(false));
    expect(result.current.pending).not.toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(VERIFY_RETRY_DELAYS[1]!));
    await waitFor(() => expect(result.current.succeeded?.name).toBe('Topper Monthly'));
    expect(result.current.pending).toBeNull();
    // Re-checks never call verify again, and a settled order is forgotten.
    expect(verifyCalls).toBe(1);
    expect(sessionStorage.getItem(PENDING_ORDER_KEY)).toBeNull();
  });

  it('treats a verify error as pending and shows a re-check that failed as a failed payment', async () => {
    server.use(
      orderHandler(),
      http.post(billingUrl(cbse, '/orders/order_1/verify'), () => billingError(503, 'PAYMENTS_NOT_CONFIGURED', 'down')),
      http.get(billingUrl(cbse, '/orders/order_1'), () => billingOk({ order_id: 'order_1', status: 'failed' })),
    );
    const { result } = setup();
    await act(() => result.current.pay(plan()));
    await act(async () => sheet!.options.handler(success));
    expect(result.current.pending).not.toBeNull();
    await act(() => result.current.recheck());
    expect(result.current.pending).toBeNull();
    expect(result.current.failed).toMatchObject({ transactionId: 'pay_1', reason: null });
  });

  it('parks the automatic checks after a manual re-check that is still pending', async () => {
    let checks = 0;
    server.use(
      orderHandler(),
      http.post(billingUrl(cbse, '/orders/order_1/verify'), () => billingOk({ order_id: 'order_1', status: 'pending' }, 202)),
      http.get(billingUrl(cbse, '/orders/order_1'), () => {
        checks += 1;
        return billingOk({ order_id: 'order_1', status: 'pending' });
      }),
    );
    const { result } = setup();
    await act(() => result.current.pay(plan()));
    await act(async () => sheet!.options.handler(success));
    await act(() => result.current.recheck());
    expect(checks).toBe(1);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await act(() => vi.advanceTimersByTimeAsync(VERIFY_RETRY_DELAYS.reduce((a, b) => a + b, 0)));
    expect(checks).toBe(1);
    act(() => result.current.clearPending());
    expect(result.current.pending).toBeNull();
    expect(sessionStorage.getItem(PENDING_ORDER_KEY)).toBeNull();
    // Nothing to re-check any more.
    await act(() => result.current.recheck());
    expect(checks).toBe(1);
  });

  it('restores a pending order saved before a reload and re-checks it', async () => {
    sessionStorage.setItem(
      PENDING_ORDER_KEY,
      JSON.stringify({
        plan: { ...plan(), validTill: '2026-07-15T00:00:00.000Z' },
        exam: { category: cbse.category, examId: cbse.examId },
        orderId: 'order_r',
        transactionId: 'pay_r',
        initiatedAt: '2026-06-15T10:00:00.000Z',
      }),
    );
    server.use(http.get(billingUrl(cbse, '/orders/order_r'), () => billingOk({ order_id: 'order_r', status: 'paid', purchase: {} })));
    const { result } = setup();
    await waitFor(() => expect(result.current.pending).toMatchObject({ orderId: 'order_r', transactionId: 'pay_r' }));
    expect(result.current.pending!.plan.validTill).toBeInstanceOf(Date);
    await act(() => result.current.recheck());
    expect(result.current.succeeded?.name).toBe('Topper Monthly');
  });

  it('ignores unreadable or blocked storage', () => {
    sessionStorage.setItem(PENDING_ORDER_KEY, '{not json');
    expect(loadPending()).toBeNull();
    sessionStorage.setItem(PENDING_ORDER_KEY, JSON.stringify({ orderId: '' }));
    expect(loadPending()).toBeNull();
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(loadPending()).toBeNull();
    spy.mockRestore();
  });
});
