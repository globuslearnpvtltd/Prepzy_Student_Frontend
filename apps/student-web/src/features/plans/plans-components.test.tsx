import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import type { ReactNode } from 'react';
import { ExamProvider } from '@/shared/hooks/use-exam';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { navigation } from '@/test/setup';
import AccountLayout from '@/app/(student)/[exam]/(account)/layout';
import type { Plan } from './catalog';
import { PaymentFailed, PaymentPending, PaymentSuccess } from './components/checkout/outcome-overlays';
import { EmptyPlans, ExamCard, MobileActionBar, OptionCard, PlanCard, PlanSkeleton, Switch } from './components/checkout/primitives';
import { PaymentStatusChip } from './components/billing-history';
import { ExtendDialog } from './components/extend-dialogs';
import { BillingPage, ManagePlans } from './components/manage-plans';
import { Modal, WarningDialog } from './components/modal';
import { CheckoutChrome } from './components/plans-chrome';
import { billingError, billingOk, billingUrl, paymentDto, purchaseDto } from '@/test/billing';
import { testExam } from '@/test/exams';

vi.mock('@/shared/layout/app-header', () => ({
  AppHeader: ({ category }: { category: string }) => <header>header:{category}</header>,
}));
vi.mock('@/shared/layout/exam-shell', () => ({
  AppChrome: ({ children }: { children: ReactNode }) => <div data-testid="app-chrome">{children}</div>,
}));

const cbse = testExam('cbse');
const neet = testExam('neet');
const DATE = new Date(2026, 8, 4);

const plan = (extra: Partial<Plan> = {}): Plan => ({
  priceId: 2,
  planId: 10,
  name: 'Topper Monthly',
  tier: 'monthly',
  durationName: '1 Month',
  badge: { label: 'Most popular', tone: 'popular' },
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

describe('payment outcome overlays', () => {
  it('pending: refresh, back to dashboard, and a busy state while checking', async () => {
    const onRefresh = vi.fn();
    const onBack = vi.fn();
    const { rerender } = render(
      <PaymentPending planName="Topper Monthly" transactionId="" planDetails="30-day access" date={DATE} refreshing={false} onRefresh={onRefresh} onBackToDashboard={onBack} />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Payment is being processed' });
    expect(within(dialog).getByText('—')).toBeInTheDocument();
    expect(within(dialog).getByText(/Initiated on 4 September 2026/)).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: /Refresh/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Go back to dashboard' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
    rerender(
      <PaymentPending planName="Topper Monthly" transactionId="pay_1" planDetails="" date={DATE} refreshing onRefresh={onRefresh} onBackToDashboard={onBack} />,
    );
    expect(screen.getByRole('button', { name: /Checking/ })).toBeDisabled();
    expect(screen.getByText('pay_1')).toBeInTheDocument();
  });

  it('failed: shows the reason or a default, retries and closes on Escape', async () => {
    const onRetry = vi.fn();
    const onExplore = vi.fn();
    const { rerender, unmount } = render(
      <PaymentFailed planName="Topper Monthly" transactionId="order_1" planDetails="" date={DATE} reason={null} retrying={false} onRetry={onRetry} onExplorePlans={onExplore} />,
    );
    expect(screen.getByText(/Nothing was charged/)).toBeInTheDocument();
    expect(screen.getByText(/Attempted on 4 September 2026/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry payment' }));
    await userEvent.click(screen.getByRole('button', { name: 'Explore plans' }));
    await userEvent.keyboard('{Escape}');
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onExplore).toHaveBeenCalledTimes(2);
    rerender(
      <PaymentFailed planName="Topper Monthly" transactionId="order_1" planDetails="" date={DATE} reason="Card declined" retrying onRetry={onRetry} onExplorePlans={onExplore} />,
    );
    expect(screen.getByText('Card declined')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Opening payment/ })).toBeDisabled();
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('success: shows the validity when known and a fallback plan line', async () => {
    const onStart = vi.fn();
    const onHome = vi.fn();
    const { rerender } = render(
      <PaymentSuccess planName="Basic" courseAccess="Class 12" planDetails="" validUntil={null} onStartLearning={onStart} onBackHome={onHome} />,
    );
    expect(screen.getByText('Access activated')).toBeInTheDocument();
    expect(screen.queryByText(/Valid until/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Back to home' }));
    expect(onHome).toHaveBeenCalled();
    rerender(<PaymentSuccess planName="Topper" courseAccess="Class 12" planDetails="30-day access" validUntil="4 Sept 2026" onStartLearning={onStart} onBackHome={onHome} />);
    expect(screen.getByText('Valid until 4 Sept 2026')).toBeInTheDocument();
    expect(screen.getByText('30-day access')).toBeInTheDocument();
  });
});

describe('checkout primitives', () => {
  it('exam and option cards, switch, skeleton and empty hint', async () => {
    const onExam = vi.fn();
    const onOption = vi.fn();
    const onSwitch = vi.fn();
    render(
      <>
        <ExamCard icon={null} label="JEE" description="Soon" active={false} disabled onClick={onExam} />
        <ExamCard icon={null} label="CBSE" description="Boards" active onClick={onExam} />
        <OptionCard icon={null} title="NEET 2027" subtitle="Till May 2027" active={false} onClick={onOption} />
        <OptionCard icon={null} title="Class 12" active onClick={onOption} />
        <Switch checked label="Add CBSE boards" onChange={onSwitch} />
        <PlanSkeleton />
        <EmptyPlans hint="Pick a year" />
      </>,
    );
    expect(screen.getByRole('button', { name: /JEE/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /CBSE/ })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: /NEET 2027/ }));
    expect(screen.getByText('Till May 2027')).toBeInTheDocument();
    expect(onOption).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('switch', { name: 'Add CBSE boards' }));
    expect(onSwitch).toHaveBeenCalled();
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText('Loading plans')).toBeInTheDocument();
    expect(screen.getByText('Pick a year')).toBeInTheDocument();
  });

  it('mobile action bar shows GST prices or Free', async () => {
    const onClick = vi.fn();
    const { rerender } = render(<MobileActionBar label="Topper Monthly" amount={589} strikeAmount={999} cta="Continue" onClick={onClick} />);
    expect(screen.getByText('Topper Monthly · incl. GST')).toBeInTheDocument();
    expect(screen.getByText('₹999')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onClick).toHaveBeenCalled();
    rerender(<MobileActionBar label="Basic" amount={0} strikeAmount={null} cta="Continue" disabled onClick={onClick} />);
    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.getByText('Basic')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('plan card selects with Enter or Space and continues without reselecting', async () => {
    const onSelect = vi.fn();
    const onContinue = vi.fn();
    const { rerender } = render(<PlanCard plan={plan()} active={false} onSelect={onSelect} onContinue={onContinue} />);
    const card = screen.getByRole('button', { name: 'Topper Monthly' });
    expect(screen.getByText('Most popular')).toBeInTheDocument();
    expect(screen.getByText('You save ₹500*')).toBeInTheDocument();
    expect(screen.getByText('₹999 / month')).toBeInTheDocument();
    fireEvent.keyDown(card, { key: 'Enter' });
    fireEvent.keyDown(card, { key: ' ' });
    fireEvent.keyDown(card, { key: 'a' });
    expect(onSelect).toHaveBeenCalledTimes(2);
    rerender(<PlanCard plan={plan({ isCurrent: true, badge: { label: 'Current plan', tone: 'current' } })} active onSelect={onSelect} onContinue={onContinue} />);
    // Renewal is blocked: the active plan shows as current, with nothing to continue to.
    expect(screen.getByText('Your current active plan')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Renew|Continue with this plan/ })).toBeNull();
    rerender(<PlanCard plan={plan()} active onSelect={onSelect} onContinue={onContinue} />);
    await userEvent.click(screen.getByRole('button', { name: /Continue with this plan/ }));
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it('plan card marks a free plan without a badge', () => {
    const free = plan({ name: 'Basic', badge: null, isFree: true, price: 0, mrp: null, saved: 0, perDay: null });
    const { rerender } = render(<PlanCard plan={free} active={false} onSelect={vi.fn()} onContinue={vi.fn()} />);
    expect(screen.getByText('Free Plan')).toBeInTheDocument();
    expect(screen.getByText('Free Forever')).toBeInTheDocument();
    expect(screen.queryByText(/You save/)).toBeNull();
    rerender(<PlanCard plan={free} active onSelect={vi.fn()} onContinue={vi.fn()} />);
    expect(screen.getByText('Free Plan')).toBeInTheDocument();
    rerender(<PlanCard plan={{ ...free, isFree: false }} active={false} onSelect={vi.fn()} onContinue={vi.fn()} />);
    expect(screen.queryByText('Free Plan')).toBeNull();
  });
});

describe('plan modals', () => {
  it('Modal closes on the backdrop and Escape, not on its content', () => {
    const onClose = vi.fn();
    render(
      <Modal label="Sheet" onClose={onClose}>
        <p>Body</p>
      </Modal>,
    );
    fireEvent.mouseDown(screen.getByText('Body'));
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.mouseDown(screen.getByRole('dialog', { name: 'Sheet' }).parentElement!);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('Modal without a close handler ignores the backdrop', () => {
    render(
      <Modal label="Locked">
        <p>Busy</p>
      </Modal>,
    );
    fireEvent.mouseDown(screen.getByRole('dialog', { name: 'Locked' }).parentElement!);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: 'Locked' })).toBeInTheDocument();
  });

  it('WarningDialog uses the default title and closes from the backdrop', async () => {
    const onClose = vi.fn();
    render(<WarningDialog message="Plan already active" onClose={onClose} />);
    const dialog = screen.getByRole('alertdialog', { name: 'Something went wrong' });
    fireEvent.mouseDown(dialog);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.mouseDown(dialog.parentElement!);
    await userEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('payment status chips', () => {
    render(
      <>
        <PaymentStatusChip status="paid" />
        <PaymentStatusChip status="refunded" />
      </>,
    );
    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.getByText('Refunded')).toBeInTheDocument();
  });
});

describe('extend dialog', () => {
  const target = { purchaseId: 50, name: 'Topper CBSE Monthly', expiryDate: '2026-07-01' };

  it('shows an error, then a success with the new date', async () => {
    let calls = 0;
    server.use(
      http.post(billingUrl(cbse, '/extensions'), async ({ request }) => {
        calls += 1;
        expect(await request.json()).toMatchObject({ purchase_id: 50 });
        return calls === 1
          ? billingError(400, 'INVALID_COUPON', 'Invalid coupon code', { reason: 'not_found' })
          : billingOk({ months: 1, expiry_date: '2026-08-01', purchase: purchaseDto() });
      }),
    );
    const onClose = vi.fn();
    renderWithProviders(<ExtendDialog exam={cbse} plan={target} onClose={onClose} />);
    expect(screen.getByText('Use a coupon code to add more days to Topper CBSE Monthly')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Extend' })).toBeDisabled();
    await userEvent.type(screen.getByRole('textbox', { name: 'Coupon code' }), 'BAD');
    await userEvent.click(screen.getByRole('button', { name: 'Extend' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid coupon code');
    await userEvent.click(screen.getByRole('button', { name: 'Extend' }));
    expect(await screen.findByText(/Your plan now runs till 01 Aug 2026/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('succeeds without a new date', async () => {
    server.use(http.post(billingUrl(cbse, '/extensions'), () => billingOk({ months: 2, purchase: purchaseDto() })));
    renderWithProviders(<ExtendDialog exam={cbse} plan={target} onClose={vi.fn()} />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Coupon code' }), 'MORE');
    await userEvent.click(screen.getByRole('button', { name: 'Extend' }));
    expect(await screen.findByText('2 months added to Topper CBSE Monthly')).toBeInTheDocument();
    expect(screen.getByText('MORE')).toBeInTheDocument();
    expect(screen.queryByText(/Your plan now runs till/)).toBeNull();
  });
});

describe('ManagePlans', () => {
  const purchases = (rows: Record<string, unknown>[]) => http.get(billingUrl(cbse, '/purchases'), () => billingOk({ purchases: rows }));
  const noPayments = http.get(billingUrl(cbse, '/payments'), () => billingOk({ payments: [] }));

  it('invites a student without plans to the purchase page', async () => {
    server.use(purchases([]), noPayments);
    renderWithProviders(<ManagePlans />, { exam: cbse });
    expect(await screen.findByText('No plans yet')).toBeInTheDocument();
    for (const link of screen.getAllByRole('link', { name: /Explore plans/ })) expect(link).toHaveAttribute('href', '/cbse/plans/purchase');
    expect(screen.getByRole('link', { name: /Billing history/ })).toHaveAttribute('href', '#billing');
  });

  it('shows a load error with a retry', async () => {
    let calls = 0;
    server.use(
      noPayments,
      http.get(billingUrl(cbse, '/purchases'), () => {
        calls += 1;
        return calls === 1 ? billingError(500, 'INTERNAL', 'Server down') : billingOk({ purchases: [] });
      }),
    );
    renderWithProviders(<ManagePlans />, { exam: cbse });
    expect(await screen.findByText("We couldn't load your plans")).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('No plans yet')).toBeInTheDocument();
  });

  it('shows dates, days left, amount, invoice and a queued renewal', async () => {
    server.use(
      noPayments,
      purchases([
        purchaseDto({
          display_name: 'Topper CBSE Monthly',
          exam_title: 'CBSE',
          class_name: 'CLASS 11',
          stream_name: 'PCB',
          duration_months: 1,
          purchase_start_date: '2026-06-01',
          expiry_date: '2026-07-01',
          remaining_days: 6,
          paid_amount: 588.82,
          invoice_number: 'INV-9',
          invoice_url: 'https://x.test/9.pdf',
          has_pending_plan: true,
          pending_start_date: '2026-07-02',
        }),
      ]),
    );
    renderWithProviders(<ManagePlans />, { exam: cbse });
    const card = await screen.findByRole('heading', { name: 'Topper CBSE Monthly' });
    expect(screen.getByText('CBSE · Class 11 PCB')).toBeInTheDocument();
    expect(card).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('1 Jun 2026 – 1 Jul 2026')).toBeInTheDocument();
    expect(screen.getByText('6 days left')).toBeInTheDocument();
    expect(screen.getByText('20% remaining')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Time remaining' })).toBeInTheDocument();
    expect(screen.getByText('₹588.82')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'INV-9' })).toHaveAttribute('href', 'https://x.test/9.pdf');
    expect(screen.getByText(/Renews on/)).toHaveTextContent('Renews on 2 Jul 2026');
  });

  it('labels every status and pages a plan\'s payments both ways', async () => {
    const pages: string[] = [];
    server.use(
      noPayments,
      purchases(
        (['pending', 'expired', 'cancelled', 'refunded'] as const).map((status, index) =>
          purchaseDto({ purchase_id: index + 1, plan_id: index + 7, status, display_name: `Plan ${status}` }),
        ),
      ),
      http.get(billingUrl(cbse, '/purchases/7/payments'), ({ request }) => {
        const page = new URL(request.url).searchParams.get('page')!;
        pages.push(page);
        return billingOk({
          payments: [paymentDto({ id: Number(page), amount: 0, status: 'failed', invoice_url: '' })],
          pagination: { page: Number(page), limit: 10, total: 12, total_pages: 2 },
        });
      }),
    );
    renderWithProviders(<ManagePlans />, { exam: cbse });
    await screen.findByRole('heading', { name: 'Plan pending' });
    for (const label of ['Pending', 'Expired', 'Cancelled', 'Refunded']) expect(screen.getByText(label)).toBeInTheDocument();
    // Cancel only for an active paid plan; extend for active or expired ones.
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Extend with coupon' })).toHaveLength(1);
    expect(screen.getAllByRole('link', { name: 'Upgrade' })).toHaveLength(1);
    await userEvent.click(screen.getAllByRole('button', { name: /View payments/ })[0]!);
    expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Prev/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(await screen.findByText('Page 2 of 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Next/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /Prev/ }));
    expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument();
    expect(pages.slice(0, 2)).toEqual(['1', '2']);
    await userEvent.click(screen.getAllByRole('button', { name: /View payments/ })[0]!);
    expect(screen.queryByText('Page 1 of 2')).toBeNull();
  });

  it('shows an empty or failed plan payments list', async () => {
    server.use(
      noPayments,
      purchases([purchaseDto({ plan_id: 5 }), purchaseDto({ purchase_id: 2, plan_id: 6, display_name: 'Second' })]),
      http.get(billingUrl(cbse, '/purchases/5/payments'), () => billingOk({ payments: [] })),
      http.get(billingUrl(cbse, '/purchases/6/payments'), () => billingError(500, 'INTERNAL', 'History offline')),
    );
    renderWithProviders(<ManagePlans />, { exam: cbse });
    const [first, second] = await screen.findAllByRole('button', { name: /View payments/ });
    await userEvent.click(first!);
    expect(await screen.findByText('No payments for this plan yet.')).toBeInTheDocument();
    await userEvent.click(second!);
    // A 5xx shows the generic message, not the server's.
    expect(await screen.findByText("Couldn't load this plan's payments.")).toBeInTheDocument();
  });

  it('offers no cancel on free plans (Basic or free premium) and shows a payment-provider outage plainly', async () => {
    server.use(
      noPayments,
      purchases([
        purchaseDto({ purchase_id: 1, plan_id: 5, class_name: 'CLASS 12', duration_months: 0, price: 0, paid_amount: 0, expiry_date: null }),
        // The free sign-up Topper month: a list price, but nothing paid (is_free).
        purchaseDto({ purchase_id: 2, plan_id: 6, class_name: 'CLASS 11', duration_months: 1, price: 499, paid_amount: 0, is_free: true }),
        purchaseDto({ purchase_id: 3, plan_id: 7, class_name: 'CLASS 10', duration_months: 1, price: 499 }),
      ]),
      http.post(billingUrl(cbse, '/purchases/3/cancel'), () => billingError(502, 'PAYMENT_PROVIDER_ERROR', 'Razorpay refund failed')),
    );
    renderWithProviders(<ManagePlans />, { exam: cbse });
    // Only the paid Class 10 plan can be cancelled.
    const cancel = await screen.findAllByRole('button', { name: 'Cancel' });
    expect(cancel).toHaveLength(1);
    await userEvent.click(cancel[0]!);
    await userEvent.click(screen.getByRole('button', { name: 'Yes, cancel plan' }));
    expect(await screen.findByText('The payment service is unavailable right now. Please try again in a few minutes.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('closes the cancellation receipt and reloads the plans after an extension', async () => {
    let loads = 0;
    server.use(
      noPayments,
      http.get(billingUrl(cbse, '/purchases'), () => {
        loads += 1;
        return billingOk({ purchases: [purchaseDto({ purchase_id: 9, plan_id: 5, duration_months: 1, expiry_date: '2026-07-01' })] });
      }),
      http.post(billingUrl(cbse, '/purchases/9/cancel'), () => billingOk({ purchase: purchaseDto(), refund: null })),
    );
    renderWithProviders(<ManagePlans />, { exam: cbse });
    await userEvent.click(await screen.findByRole('button', { name: 'Extend with coupon' }));
    expect(screen.getByRole('dialog', { name: 'Extend your plan' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'Extend your plan' })).toBeNull();
    await waitFor(() => expect(loads).toBe(2));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, cancel plan' }));
    const receipt = await screen.findByRole('dialog', { name: 'Cancellation confirmed' });
    expect(within(receipt).getByRole('link', { name: /Explore plans/ })).toHaveAttribute('href', '/cbse/plans/purchase');
    await userEvent.click(within(receipt).getByRole('button', { name: 'Back to my plans' }));
    expect(screen.queryByRole('dialog', { name: 'Cancellation confirmed' })).toBeNull();
  });
});

describe('BillingPage and chrome', () => {
  it('shows the same billing page for every exam, with a retry on errors', async () => {
    let calls = 0;
    server.use(
      http.get(billingUrl(neet, '/payments'), () => billingOk({ payments: [], pagination: { page: 1, limit: 10, total: 0, total_pages: 0 } })),
      http.get(billingUrl(cbse, '/payments'), () => {
        calls += 1;
        return calls === 1 ? billingError(500, 'INTERNAL', 'Payments offline') : billingOk({ payments: [paymentDto({ description: '', display_name: null })] });
      }),
    );
    const { unmount } = renderWithProviders(<BillingPage />, { exam: neet });
    expect(await screen.findByText('No payments yet')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Billing history' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to my plans' })).toHaveAttribute('href', '/neet/plans');
    unmount();
    renderWithProviders(<BillingPage />, { exam: cbse });
    expect(await screen.findByText("Couldn't load your payments. Try again.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect((await screen.findAllByText('Plan purchase')).length).toBeGreaterThan(0);
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('gives the plans pages the app chrome for every exam', () => {
    for (const exam of [cbse, neet]) {
      const { unmount } = render(
        <ExamProvider value={exam}>
          <AccountLayout>
            <p>plans</p>
          </AccountLayout>
        </ExamProvider>,
      );
      expect(screen.getByTestId('app-chrome')).toHaveTextContent('plans');
      unmount();
    }
  });

  it('gives the purchase page the app header, with no navigation rail, for every exam', () => {
    for (const exam of [cbse, neet]) {
      const { unmount } = render(
        <ExamProvider value={exam}>
          <CheckoutChrome>
            <p>checkout</p>
          </CheckoutChrome>
        </ExamProvider>,
      );
      expect(screen.getByText(`header:${exam.category}`)).toBeInTheDocument();
      expect(screen.queryByTestId('app-chrome')).toBeNull();
      expect(screen.getByRole('main')).toHaveTextContent('checkout');
      unmount();
    }
  });
});
