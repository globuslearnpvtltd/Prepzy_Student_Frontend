import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/render';
import { API, EXAM_CATALOG, server } from '@/test/server';
import { navigation } from '@/test/setup';
import type { Plan } from './catalog';
import { PaymentFailed, PaymentPending, PaymentSuccess } from './components/checkout/outcome-overlays';
import { EmptyPlans, ExamCard, MobileActionBar, OptionCard, PlanCard, PlanSkeleton, Switch } from './components/checkout/primitives';
import { Modal, WarningDialog } from './components/modal';
import { CheckoutChrome } from './components/plans-chrome';
import { testExam } from '@/test/exams';

vi.mock('@/shared/layout/app-header', () => ({
  AppHeader: ({ category, exam }: { category: string; exam: { slug: string } | null }) => (
    <header>
      header:{category}:{exam?.slug ?? 'none'}
    </header>
  ),
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
});

describe('plans chrome (/purchase)', () => {
  const purchased = (exams: { exam_id: number; exam_slice: string; exam_name: string }[]) =>
    http.get(`${API}/api/v4/student/exams/purchased`, () => HttpResponse.json({ success: true, data: { exams } }));
  const chrome = () =>
    renderWithProviders(
      <CheckoutChrome>
        <p>checkout</p>
      </CheckoutChrome>,
    );
  afterEach(() => {
    navigation.searchParams = new URLSearchParams();
  });

  it('gives the page the header and theme of the exam in ?exam=, with no navigation rail, for every exam', async () => {
    server.use(purchased([]));
    for (const exam of [cbse, neet]) {
      navigation.searchParams = new URLSearchParams(`exam=${exam.slug}`);
      const { unmount, container } = chrome();
      expect(await screen.findByText(`header:${exam.category}:${exam.slug}`)).toBeInTheDocument();
      expect(container.querySelector(`[data-theme="${exam.theme}"]`)).not.toBeNull();
      expect(screen.queryByTestId('app-chrome')).toBeNull();
      expect(screen.getByRole('main')).toHaveTextContent('checkout');
      unmount();
    }
  });

  it('follows the remembered exam when the URL names none', async () => {
    server.use(purchased([]));
    document.cookie = `prepzy_exam=${neet.slug}; path=/`;
    chrome();
    expect(await screen.findByText(`header:${neet.category}:${neet.slug}`)).toBeInTheDocument();
  });

  it("shows the student's current exam for an exam the app has no pages for, else the plain header", async () => {
    server.use(
      http.get(`${API}/api/v4/exams`, () =>
        HttpResponse.json({ success: true, data: [...EXAM_CATALOG, { exam_id: 7, exam_name: 'ICSE', exam_slice: 'icse', category: 'board' }] }),
      ),
      purchased([{ exam_id: neet.examId, exam_slice: neet.examSlice, exam_name: 'NEET-UG' }]),
    );
    navigation.searchParams = new URLSearchParams('exam=icse');
    const { unmount } = chrome();
    expect(await screen.findByText(`header:${neet.category}:${neet.slug}`)).toBeInTheDocument();
    unmount();

    server.use(purchased([]));
    chrome();
    expect(await screen.findByText('header:reference:none')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('checkout');
  });
});
