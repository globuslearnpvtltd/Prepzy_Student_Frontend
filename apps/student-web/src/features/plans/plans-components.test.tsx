import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { ExamProvider } from '@/shared/hooks/use-exam';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { navigation } from '@/test/setup';
import type { BoardPlan, LearningPlan } from './api';
import type { Plan } from './catalog';
import { PaymentFailed, PaymentPending, PaymentSuccess } from './components/checkout/outcome-overlays';
import { EmptyPlans, ExamCard, MobileActionBar, OptionCard, PlanCard, PlanSkeleton, Switch } from './components/checkout/primitives';
import { BoardExtendDialog, CompetitiveExtendDialog } from './components/extend-dialogs';
import { BoardManagePlans } from './components/manage-board';
import { BillingPage } from './components/manage-plans';
import { Modal, WarningDialog } from './components/modal';
import { CourseCard, PlanStatusPill } from './components/plan-bits';
import { PlansChrome } from './components/plans-chrome';
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
    await userEvent.click(screen.getByRole('button', { name: /Renew this plan/ }));
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledTimes(2);
    rerender(<PlanCard plan={plan()} active onSelect={onSelect} onContinue={onContinue} />);
    expect(screen.getByRole('button', { name: /Continue with this plan/ })).toBeInTheDocument();
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

  it('status pills and course cards', () => {
    render(
      <>
        <PlanStatusPill status="EXPIRED" />
        <CourseCard course={{ id: 1, label: 'MAIN PLAN', title: 'NEET 2027', status: 'CANCELLED' }} />
      </>,
    );
    expect(screen.getByText('EXPIRED')).toBeInTheDocument();
    expect(screen.getByText('CANCELLED')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'NEET 2027' })).toBeInTheDocument();
  });
});

describe('extend dialogs', () => {
  const learning: LearningPlan = {
    id: 1,
    planId: 7,
    name: 'Topper NEET 2027',
    billingCycle: 'Target Year',
    status: 'ACTIVE',
    startDate: '01 Apr, 2026',
    expiryDate: '2027-05-31',
    remainingDays: 300,
    durationMonths: 12,
    courses: [],
  };
  const board: BoardPlan = {
    planId: 5,
    classId: 12,
    className: 'CLASS 12',
    streamName: '',
    durationMonths: 1,
    startDate: '2026-06-01',
    expiryDate: '2026-07-01',
    status: 'active',
    pendingRenewal: null,
  };
  const neetExtend = (respond: (code: string) => Response) =>
    http.post(`${API}/api/v1/purchase/apply-custom-duration-coupon-neet`, async ({ request }) => {
      const body = (await request.json()) as { coupon_code: string; plan_id?: number };
      expect(body.plan_id).toBe(7);
      return respond(body.coupon_code);
    });

  it('competitive: Enter applies, a 200 error body shows, then the receipt', async () => {
    server.use(
      neetExtend((code) =>
        code === 'GOOD'
          ? HttpResponse.json({ success: true, data: { months: 1, expiry_date: '2027-06-30' } })
          : HttpResponse.json({ success: false, message: 'Coupon expired' }),
      ),
    );
    const onClose = vi.fn();
    renderWithProviders(<CompetitiveExtendDialog plan={learning} onClose={onClose} />);
    expect(screen.getByText('Currently Expires: 31 May 2027')).toBeInTheDocument();
    const input = screen.getByRole('textbox', { name: 'Coupon code' });
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
    await userEvent.type(input, 'OLD{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('Coupon expired');
    await userEvent.clear(input);
    expect(screen.queryByRole('alert')).toBeNull();
    await userEvent.type(input, 'GOOD');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    const receipt = await screen.findByRole('dialog', { name: 'Plan extended' });
    expect(within(receipt).getByText('30 Jun 2027')).toBeInTheDocument();
    expect(within(receipt).getByText('1 month')).toBeInTheDocument();
    await userEvent.click(within(receipt).getByRole('button', { name: 'Back to My Learning Plans' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('competitive: a receipt without dates or months, plural months, and cancel', async () => {
    let reply: Record<string, unknown> = {};
    server.use(neetExtend(() => HttpResponse.json({ success: true, data: reply })));
    const onClose = vi.fn();
    const { unmount } = renderWithProviders(<CompetitiveExtendDialog plan={learning} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(2);
    await userEvent.type(screen.getByRole('textbox', { name: 'Coupon code' }), 'X{Enter}');
    await screen.findByText('Plan Extended Successfully!');
    expect(screen.queryByText('New Expiry Date')).toBeNull();
    expect(screen.queryByText('Extended By')).toBeNull();
    unmount();

    reply = { months: 3 };
    renderWithProviders(<CompetitiveExtendDialog plan={learning} onClose={onClose} />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Coupon code' }), 'Y{Enter}');
    expect(await screen.findByText('3 months')).toBeInTheDocument();
  });

  it('board: an error state, then a success without a new date', async () => {
    let calls = 0;
    server.use(
      http.post(`${API}/api/v1/purchase/apply-custom-duration-coupon`, async ({ request }) => {
        calls += 1;
        expect(await request.json()).toMatchObject({ plan_id: 5 });
        return calls === 1
          ? HttpResponse.json({ success: false, message: 'Invalid coupon code' }, { status: 400 })
          : HttpResponse.json({ success: true, data: { months: 2 } });
      }),
    );
    const onClose = vi.fn();
    renderWithProviders(<BoardExtendDialog plan={board} onClose={onClose} />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Coupon code' }), 'BAD');
    await userEvent.click(screen.getByRole('button', { name: 'Extend' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid coupon code');
    await userEvent.click(screen.getByRole('button', { name: 'Extend' }));
    expect(await screen.findByText('2 months added')).toBeInTheDocument();
    expect(screen.getByText('BAD')).toBeInTheDocument();
    expect(screen.queryByText(/Your plan now runs till/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('BoardManagePlans', () => {
  const activePlans = (plans: Record<string, unknown>[]) =>
    http.get(`${API}/api/subscriptions/get-active-student-plans`, () => HttpResponse.json({ plans }));

  it('invites a student without plans to browse', async () => {
    server.use(activePlans([]));
    renderWithProviders(<BoardManagePlans exam={cbse} />, { exam: cbse });
    expect(await screen.findByText('No Active Plans Yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse Plans' })).toHaveAttribute('href', '/cbse/plans/purchase');
    expect(screen.queryByRole('link', { name: 'View All Plans' })).toBeNull();
  });

  it('shows a cancellation error from an HTTP-200 body', async () => {
    server.use(
      activePlans([{ plan_id: 5, class_id: 12, class_name: 'CLASS 12', duration_months: 12, purchase_start_date: '2026-01-01', expiry_date: '2027-03-31', status: 'active' }]),
      http.post(`${API}/api/v1/purchase/cancel-active-plan`, () => HttpResponse.json({ success: false, message: 'Plan is locked' })),
    );
    renderWithProviders(<BoardManagePlans exam={cbse} />, { exam: cbse });
    expect((await screen.findAllByText('Topper Academic Year')).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Renew Plan' })[0]).toHaveAttribute('href', '/cbse/plans/purchase?CLASSID=12');
    await userEvent.click(screen.getAllByRole('button', { name: 'Cancel Plan' })[1]!);
    await userEvent.click(screen.getByRole('button', { name: 'Yes, cancel it!' }));
    expect(await screen.findByText('Error!')).toBeInTheDocument();
    expect(screen.getByText('Plan is locked')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(screen.queryByText('Error!')).toBeNull();
  });

  it('blocks renewal while a renewal is pending and shows when it starts', async () => {
    server.use(
      activePlans([
        {
          plan_id: 6,
          class_id: 0,
          class_name: 'CLASS 11',
          duration_months: 1,
          purchase_start_date: '2026-06-01',
          expiry_date: '2026-07-01',
          status: 'active',
          has_pending_plan: 1,
          pending_start_date: '2026-07-02',
          pending_purchase_date: '2026-06-20',
        },
      ]),
      http.get(`${API}/api/subscriptions/get-purchase-payment-history`, () => HttpResponse.json({ data: [{ amount: 1, status: 'pending', invoice: null, created_at: '2026-06-20' }] })),
    );
    renderWithProviders(<BoardManagePlans exam={cbse} />, { exam: cbse });
    expect((await screen.findAllByText(/Plan will be renewed on/)).length).toBe(2);
    expect(screen.getAllByText('2 Jul 2026').length).toBeGreaterThan(0);
    // The mobile renew link is inert.
    const mobileRenew = screen.getByRole('link', { name: 'Renew Plan' });
    expect(mobileRenew).toHaveAttribute('aria-disabled', 'true');
    expect(fireEvent.click(mobileRenew)).toBe(false);
    // The row toggles its billing history; pending payments are hidden.
    await userEvent.click(screen.getAllByText('Topper Monthly')[0]!);
    expect(await screen.findByText('No billing history available for this plan')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Hide billing history' })[1]!);
    expect(screen.queryByText('Billing History for this Plan')).toBeNull();
  });

  it('pages the billing history of a free expired plan', async () => {
    const pages: string[] = [];
    server.use(
      activePlans([{ plan_id: 7, class_id: 12, class_name: 'CLASS 12', duration_months: 0, purchase_start_date: '2026-01-01', status: 'expired' }]),
      http.get(`${API}/api/subscriptions/get-purchase-payment-history`, ({ request }) => {
        const page = new URL(request.url).searchParams.get('page')!;
        pages.push(page);
        return HttpResponse.json({
          data: [{ amount: '0', status: 'Failed', invoice: '', created_at: '2026-01-02', duration: null }],
          pagination: { page: Number(page), totalPages: 2 },
        });
      }),
    );
    renderWithProviders(<BoardManagePlans exam={cbse} />, { exam: cbse });
    expect((await screen.findAllByText('______')).length).toBe(2);
    expect(screen.queryByRole('button', { name: 'Extend plan' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel Plan' })).toBeNull();
    expect(screen.getAllByText('Expired').length).toBeGreaterThan(0);
    await userEvent.click(screen.getAllByRole('button', { name: 'Show billing history' })[0]!);
    expect((await screen.findAllByText('Payment Months Plan')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Failed').length).toBeGreaterThan(0);
    expect(screen.getAllByText('No invoice').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Prev' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Page 2 of 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Prev' }));
    expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument();
    expect(pages.slice(0, 2)).toEqual(['1', '2']);
  });

  it('opens and closes the extend dialog', async () => {
    let loads = 0;
    server.use(
      http.get(`${API}/api/subscriptions/get-active-student-plans`, () => {
        loads += 1;
        return HttpResponse.json({ plans: [{ plan_id: 5, class_name: 'CLASS 12', stream_name: 'PCM', duration_months: 1, expiry_date: '2026-07-01', status: 'active' }] });
      }),
    );
    renderWithProviders(<BoardManagePlans exam={cbse} />, { exam: cbse });
    await userEvent.click((await screen.findAllByRole('button', { name: 'Extend plan' }))[1]!);
    expect(screen.getByRole('dialog', { name: 'Extend your plan' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'Extend your plan' })).toBeNull();
    await waitFor(() => expect(loads).toBe(2));
  });
});

describe('BillingPage and PlansChrome', () => {
  it('shows the invoice list for competitive exams', async () => {
    server.use(http.get(`${API}/api/neet/v1/purchase/billing-history`, () => HttpResponse.json({ success: true, data: [] })));
    renderWithProviders(<BillingPage />, { exam: neet });
    expect(await screen.findByText('No invoices yet')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Billing & Invoices' })).toBeInTheDocument();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('keeps the navigation rail for competitive exams and the header only for boards', () => {
    const { unmount } = render(
      <ExamProvider value={neet}>
        <PlansChrome>
          <p>plans</p>
        </PlansChrome>
      </ExamProvider>,
    );
    expect(screen.getByTestId('app-chrome')).toHaveTextContent('plans');
    unmount();
    render(
      <ExamProvider value={cbse}>
        <PlansChrome>
          <p>plans</p>
        </PlansChrome>
      </ExamProvider>,
    );
    expect(screen.queryByTestId('app-chrome')).toBeNull();
    expect(screen.getByText('header:board')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('plans');
  });
});
