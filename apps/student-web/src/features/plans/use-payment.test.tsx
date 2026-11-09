import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { API, server } from '@/test/server';
import type { Plan } from './catalog';
import type { RazorpayFailure, RazorpayOptions } from './razorpay';
import { usePayment, VERIFY_RETRY_DELAYS } from './use-payment';

const mocks = vi.hoisted(() => ({ keyId: 'rzp_test_key' as string | undefined, load: vi.fn() }));

vi.mock('@/shared/config/env', async (importOriginal) => {
  const actual = await importOriginal<{ env: Record<string, unknown> }>();
  return {
    env: new Proxy(actual.env, { get: (target, prop) => (prop === 'razorpayKeyId' ? mocks.keyId : target[prop as string]) }),
  };
});

vi.mock('./razorpay', () => ({ loadRazorpay: mocks.load }));

const plan = (extra: Partial<Plan> = {}): Plan => ({
  priceId: 2,
  planId: 10,
  name: 'Topper Monthly',
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

function setup(category: 'board' | 'competitive' = 'board') {
  return renderHook(() =>
    usePayment({ category, coupon: 'SAVE10', describe: (p) => `${p.name} · test`, prefill: { name: 'Ravi', contact: '+91', email: '' } }),
  );
}

function orderHandler(data: Record<string, unknown> = { order_id: 'order_1', amount: 58900, currency: 'INR', coupon_id: 3 }) {
  return http.post(`${API}/api/v1/purchase/purchase-plan-1`, () => HttpResponse.json({ success: true, data }));
}

describe('usePayment', () => {
  const failures: unknown[] = [];

  beforeEach(() => {
    sheet = null;
    failures.length = 0;
    mocks.keyId = 'rzp_test_key';
    mocks.load.mockResolvedValue(FakeRazorpay);
    server.use(
      http.put(`${API}/api/v1/purchase/update-failed-purchase-status`, async ({ request }) => {
        failures.push(await request.json());
        return HttpResponse.json({ success: true });
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens Razorpay with the backend amount and verifies the signature', async () => {
    let verified: unknown = null;
    server.use(
      orderHandler(),
      http.post(`${API}/api/v1/purchase/verify-purchase-plan-1`, async ({ request }) => {
        verified = await request.json();
        return HttpResponse.json({ success: true });
      }),
    );
    const { result } = setup();
    await act(() => result.current.pay(plan()));
    expect(sheet!.opened).toBe(1);
    expect(sheet!.options).toMatchObject({ amount: 58900, order_id: 'order_1', description: 'Topper Monthly · test', name: 'Prepzy' });
    expect(result.current.busy).toBe(true);
    // A second tap while the sheet is open does nothing.
    await act(() => result.current.pay(plan()));
    expect(mocks.load).toHaveBeenCalledTimes(1);
    await act(async () => sheet!.options.handler(success));
    expect(result.current.succeeded?.name).toBe('Topper Monthly');
    expect(result.current.busy).toBe(false);
    expect(verified).toMatchObject({ payment_id: 'pay_1', order_id: 'order_1', signature: 'sig', coupon_id: 3 });
    // Dismissing after a captured payment is not recorded as a failure.
    act(() => sheet!.options.modal.ondismiss());
    expect(failures).toEqual([]);
  });

  it('skips Razorpay when the backend settles the order', async () => {
    server.use(orderHandler({ skip_payment: true }));
    const { result } = setup();
    await act(() => result.current.pay(plan()));
    expect(result.current.succeeded?.priceId).toBe(2);
    expect(mocks.load).not.toHaveBeenCalled();
  });

  it('warns when online payments are switched off', async () => {
    mocks.keyId = '';
    server.use(orderHandler());
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

  it('shows the backend message when a free plan cannot be activated, or a fallback', async () => {
    server.use(http.post(`${API}/api/v1/purchase/purchase-free-plan`, () => HttpResponse.json({ success: false, message: 'Already on Basic' })));
    const { result } = setup();
    await act(() => result.current.pay(plan({ isFree: true, durationMonths: 0, price: 0 })));
    expect(result.current.warning).toBe('Already on Basic');
    expect(result.current.succeeded).toBeNull();

    server.use(http.post(`${API}/api/v1/purchase/purchase-plan-1`, () => HttpResponse.json({}, { status: 500 })));
    await act(() => result.current.pay(plan()));
    expect(result.current.warning).toBeTruthy();
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
    expect(failures[0]).toEqual({ order_id: 'order_1', description: null });

    const first = sheet;
    await act(async () => result.current.retry());
    await waitFor(() => expect(sheet).not.toBe(first));
    expect(result.current.failed).toBeNull();
    act(() => result.current.clearFailed());
  });

  it('retry without a failed payment does nothing', () => {
    const { result } = setup();
    act(() => result.current.retry());
    expect(mocks.load).not.toHaveBeenCalled();
  });

  it('keeps an unconfirmed payment pending and re-checks it automatically', async () => {
    let calls = 0;
    server.use(
      orderHandler({ order_id: 'order_1', amount: 1, currency: 'INR' }),
      http.post(`${API}/api/v1/purchase/verify-purchase-plan-1`, () => {
        calls += 1;
        return HttpResponse.json({ success: calls >= 3 });
      }),
    );
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = setup();
    await act(() => result.current.pay(plan()));
    await act(async () => sheet!.options.handler({ ...success, razorpay_payment_id: '' }));
    expect(result.current.pending).toMatchObject({ transactionId: 'order_1' });
    expect(result.current.pending!.payload.coupon_id).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(VERIFY_RETRY_DELAYS[0]!));
    await waitFor(() => expect(calls).toBe(2));
    await waitFor(() => expect(result.current.verifying).toBe(false));
    expect(result.current.pending).not.toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(VERIFY_RETRY_DELAYS[1]!));
    await waitFor(() => expect(result.current.succeeded?.name).toBe('Topper Monthly'));
    expect(result.current.pending).toBeNull();
  });

  it('parks the automatic checks after a failed manual re-check', async () => {
    let calls = 0;
    server.use(
      orderHandler(),
      http.post(`${API}/api/v1/purchase/verify-purchase-plan-1`, () => {
        calls += 1;
        return HttpResponse.json({ success: false });
      }),
    );
    const { result } = setup();
    await act(() => result.current.pay(plan()));
    await act(async () => sheet!.options.handler(success));
    await act(() => result.current.recheck());
    expect(calls).toBe(2);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await act(() => vi.advanceTimersByTimeAsync(VERIFY_RETRY_DELAYS.reduce((a, b) => a + b, 0)));
    expect(calls).toBe(2);
    act(() => result.current.clearPending());
    expect(result.current.pending).toBeNull();
    // Nothing to re-check any more.
    await act(() => result.current.recheck());
    expect(calls).toBe(2);
  });
});
