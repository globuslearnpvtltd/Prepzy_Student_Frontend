import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { billingError, billingOk, billingUrl, overviewHistoryDto, overviewPlanDto, overviewUrl } from '@/test/billing';
import { testExam } from '@/test/exams';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { navigation } from '@/test/setup';
import { redirect } from 'next/navigation';
import PlansBillingPage from '@/app/(student)/[exam]/(account)/plans/billing/page';
import PlansPage from '@/app/(student)/[exam]/(account)/plans/page';
import { ManagePlans } from './components/manage/manage-plans';
import { chipFor, refundDestination, toOverview } from './manage-data';

const cbse = testExam('cbse');
const neet = testExam('neet');
// 15 Jun 2026; the default plan started on 10 Jun (day 6 of the 15-day refund window).
const NOW = new Date('2026-06-15T06:00:00.000Z');

const neetPlan = (extra: Record<string, unknown> = {}) =>
  overviewPlanDto({
    exam_id: neet.examId,
    exam_name: 'NEET-UG',
    exam_slice: 'neet-ug',
    category: 'competitive',
    group_key: 'target_year',
    class_id: 20,
    class_title: 'NEET',
    target_year: 2027,
    scope_label: 'NEET-UG 2027',
    purchase_id: 300,
    plan_id: 30,
    plan_name: 'Topper NEET-UG 2027 + CBSE',
    tier: 'yearly',
    duration_months: 12,
    paid_amount: 11799,
    expiry_date: '2027-05-03T00:00:00.000Z',
    cancel_falls_back_to_basic: true,
    history: [overviewHistoryDto({ payment_history_id: 600, plan_id: 30, invoice_number: 'INV-600', amount: 11799, plan_name: 'Topper NEET-UG 2027 + CBSE' })],
    ...extra,
  });

const overview = (data: { active?: unknown[]; expired?: unknown[] }) => http.get(overviewUrl, () => billingOk({ active: [], expired: [], ...data }));
const activePlans = (rows: unknown[]) =>
  http.get(`${API}/api/v4/student/plans/active`, () => HttpResponse.json({ success: true, data: { plans: rows } }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  localStorage.clear();
  server.use(activePlans([]), http.get(`${API}/api/v4/student/account`, () => HttpResponse.json({ success: true, data: { account_id: 42 } })));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('routes', () => {
  it('sends the exam plans and billing pages to the common /manage-plans', () => {
    PlansPage();
    PlansBillingPage();
    expect(vi.mocked(redirect).mock.calls).toEqual([['/manage-plans'], ['/manage-plans']]);
  });
});

describe('manage-data', () => {
  it('names the scope with its exam unless the scope already starts with it', () => {
    expect(chipFor('CBSE', 'Class 12 PCB')).toBe('CBSE · Class 12 PCB');
    expect(chipFor('NEET-UG', 'NEET-UG 2027')).toBe('NEET-UG 2027');
    expect(chipFor('', 'Class 9')).toBe('Class 9');
    expect(chipFor('JEE', '')).toBe('JEE');
  });

  it('normalises the overview defensively and lists the exams in order of appearance', () => {
    const data = toOverview({
      active: [overviewPlanDto({ has_pending_plan: 1, category: 'unknown', exam_slice: 'zzz' })],
      expired: [{ ...overviewHistoryDto({ purchase_status: 'refunded' }), exam_id: 9, exam_name: 'JEE', group_key: 'target_year', scope_label: 'JEE 2027' }],
    });
    expect(data.active[0]).toMatchObject({ hasPendingPlan: true, exam: { ref: null, slug: null }, chip: 'CBSE · Class 12' });
    expect(data.expired[0]).toMatchObject({ note: 'Refunded', plan: 'Topper CBSE Monthly', examKey: '9' });
    expect(data.exams).toEqual([
      { key: '1', name: 'CBSE' },
      { key: '9', name: 'JEE' },
    ]);
    expect(toOverview({})).toEqual({ active: [], expired: [], exams: [] });
    expect(toOverview({ active: [overviewPlanDto({ scope_label: 'CLASS 12 PCM' })] }).active[0]!.chip).toBe('CBSE · Class 12 PCM');
  });

  it('describes where a refund goes', () => {
    const base = { refundId: 1, refundAmount: 10, vpa: null, bank: null, wallet: null };
    expect(refundDestination(null)).toBeNull();
    expect(refundDestination({ ...base, paymentMethod: 'upi', vpa: 'riya@okaxis' })).toBe('UPI · riya@okaxis');
    expect(refundDestination({ ...base, paymentMethod: 'netbanking', bank: 'BARB_R' })).toBe('Netbanking · Bank of Baroda');
    expect(refundDestination({ ...base, paymentMethod: 'wallet', wallet: 'null' })).toBe('Wallet');
    expect(refundDestination({ ...base, paymentMethod: 'null' })).toBeNull();
  });
});

describe('ManagePlans', () => {
  it('lists every exam\'s plans with their actions, the current plan, invoices and ended plans', async () => {
    server.use(
      activePlans([{ plan_id: 5, class_id: 12, class_name: 'CLASS 12', duration_months: 1, status: 'active' }]),
      overview({
        active: [overviewPlanDto(), neetPlan()],
        expired: [
          {
            ...overviewHistoryDto({ payment_history_id: 400, plan_id: 4, invoice_number: 'INV-400', plan_name: 'Topper CBSE Monthly', purchase_status: 'expired', ended_on: '2026-03-01T00:00:00.000Z' }),
            exam_id: 1, exam_name: 'CBSE', exam_slice: 'cbse', category: 'board', group_key: 'class', scope_label: 'Class 11',
          },
        ],
      }),
    );
    renderWithProviders(<ManagePlans />, { exam: cbse });

    // Mobile and desktop headers (CSS shows one).
    expect(await screen.findAllByRole('heading', { level: 1, name: 'Manage plans' })).toHaveLength(2);
    expect((await screen.findAllByText('Topper CBSE Monthly')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('CBSE · Class 12').length).toBeGreaterThan(0);
    expect(screen.getAllByText('NEET-UG 2027').length).toBeGreaterThan(0);
    // The plan the header's goal shows is "Current".
    expect(screen.getAllByText('Current').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ACTIVE PLANS · 2').length).toBeGreaterThan(0);
    // Monthly plans extend; the year plan doesn't, and has nothing to upgrade to.
    expect(screen.getAllByRole('button', { name: 'Extend plan' })).toHaveLength(2); // desktop + mobile card of the monthly plan
    await userEvent.click(screen.getAllByRole('button', { name: 'Upgrade' })[0]!);
    expect(navigation.push).toHaveBeenCalledWith('/purchase?exam=cbse&CLASSID=12');
    expect(screen.getAllByRole('button', { name: 'Upgrade' })).toHaveLength(1); // the year plan has none

    // Invoices of a plan open under its card.
    await userEvent.click(screen.getAllByRole('button', { name: 'Show billing history' })[0]!);
    const table = screen.getByText('Billing history · Class 12').closest('div')!;
    expect(within(table).getByText('INV-501')).toBeInTheDocument();
    expect(within(table).getByText('Topper CBSE Monthly · Class 12')).toBeInTheDocument();
    expect(within(table).getByText(/First purchase, bought 5 days ago\. Cancel by 24 Jun 2026/)).toBeInTheDocument();

    // Ended plans' invoices, and the exam filter.
    expect(screen.getAllByText('Topper CBSE Monthly · Class 11 · ended 1 Mar 2026').length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'NEET-UG' }));
    expect(screen.getAllByText('ACTIVE PLANS · 1').length).toBeGreaterThan(0);
    expect(screen.queryByText('Topper CBSE Monthly · Class 11 · ended 1 Mar 2026')).toBeNull();

    await userEvent.click(screen.getAllByRole('button', { name: 'View plans' })[0]!);
    expect(navigation.push).toHaveBeenCalledWith('/purchase?exam=cbse');
    expect(screen.getAllByRole('link', { name: /Back to Dashboard/ })[0]).toHaveAttribute('href', '/cbse/dashboard');
  });

  it('shows a free plan alone with its note, and an empty state', async () => {
    server.use(overview({ active: [overviewPlanDto({ plan_name: 'Basic CBSE', duration_months: 0, tier: 'basic', paid_amount: 0, is_free: true, expiry_date: null, history: [] })] }));
    const { unmount } = renderWithProviders(<ManagePlans />, { exam: cbse });
    expect((await screen.findAllByText('No invoices yet. Basic CBSE is free.')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('No end date').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Cancel plan' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Extend plan' })).toBeNull();
    unmount();

    server.use(overview({}));
    renderWithProviders(<ManagePlans />, { exam: cbse });
    expect(await screen.findByText('You don’t have any plans yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View plans' })).toHaveAttribute('href', '/purchase?exam=cbse');
  });

  it('shows an error with retry and support, then the saved copy when offline', async () => {
    let calls = 0;
    server.use(
      http.get(overviewUrl, () => {
        calls += 1;
        return calls === 1 ? billingError(500, 'INTERNAL', 'boom') : billingOk({ active: [overviewPlanDto()], expired: [] });
      }),
    );
    const { unmount } = renderWithProviders(<ManagePlans />, { exam: cbse });
    expect(await screen.findByText('We couldn’t load your plans')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Contact support' }));
    expect(navigation.push).toHaveBeenCalledWith('/cbse/profile/help');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect((await screen.findAllByText('Topper CBSE Monthly')).length).toBeGreaterThan(0);
    await waitFor(() => expect(localStorage.getItem('prepzy-manage-plans:42')).toContain('Topper CBSE Monthly'));
    unmount();

    // No connection: the copy saved above, with the offline banner; actions are disabled.
    server.use(http.get(overviewUrl, () => HttpResponse.error()));
    renderWithProviders(<ManagePlans />, { exam: cbse });
    expect(await screen.findByText(/You’re offline\. Showing plans as saved at/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Extend plan' })[0]).toBeDisabled();
  });

  it('cancels within the refund window: preview, reason, refund details', async () => {
    let cancelled: unknown = null;
    server.use(
      overview({ active: [neetPlan({ duration_months: 1, plan_name: 'Topper NEET-UG Monthly', tier: 'monthly' })] }),
      http.get(`${API}/api/v4/billing/purchases/300/refund-preview`, () =>
        billingOk({ can_cancel: true, reason: null, refund_amount: 588.82, refund_deadline: '2026-06-24' }),
      ),
      http.post(billingUrl(neet, '/purchases/300/cancel'), async ({ request }) => {
        cancelled = await request.json();
        return billingOk({ purchase: {}, refund: { amount: 588.82, status: 'processed' } });
      }),
      http.get(`${API}/api/v4/billing/purchases/300/refund`, () =>
        billingOk({ refund_id: 44, refund_amount: 588.82, payment_method: 'upi', vpa: 'riya@okaxis', bank: null, wallet: null }),
      ),
    );
    renderWithProviders(<ManagePlans />, { exam: neet });
    await userEvent.click((await screen.findAllByRole('button', { name: 'Cancel plan' }))[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'Cancel Topper NEET-UG Monthly' });
    expect(within(dialog).getByText('You get ₹588.82 back')).toBeInTheDocument();
    expect(within(dialog).getByText('Topper access ends right away. You move to the free Basic plan.')).toBeInTheDocument();
    expect(within(dialog).getByText(/A refund is one-time for each exam/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Too expensive' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel and refund' }));
    const done = await screen.findByRole('dialog', { name: 'Plan cancelled' });
    expect(cancelled).toEqual({ reason: 'Too expensive' });
    expect(within(done).getByText('44')).toBeInTheDocument();
    expect(within(done).getByText('UPI · riya@okaxis')).toBeInTheDocument();
    expect(within(done).getByText('You are on the free Basic plan now. Your progress is safe.')).toBeInTheDocument();
    await userEvent.click(within(done).getByRole('button', { name: 'View plans' }));
    expect(navigation.push).toHaveBeenCalledWith('/purchase?exam=neet');
  });

  it('explains why a plan can\'t be refunded (preview, or the server\'s refund limit)', async () => {
    server.use(
      overview({ active: [overviewPlanDto()] }),
      http.get(`${API}/api/v4/billing/purchases/100/refund-preview`, () =>
        billingOk({ can_cancel: false, reason: 'refund_window_over', refund_amount: 0, refund_deadline: '2026-06-24' }),
      ),
    );
    const { unmount } = renderWithProviders(<ManagePlans />, { exam: cbse });
    await userEvent.click((await screen.findAllByRole('button', { name: 'Cancel plan' }))[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'This plan can’t be refunded' });
    expect(within(dialog).getByText(/first paid purchase on Prepzy for each class/)).toBeInTheDocument();
    expect(within(dialog).getByText(/stays active till 10 Jul 2026/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Talk to support' }));
    expect(navigation.push).toHaveBeenCalledWith('/cbse/profile/help');
    unmount();

    server.use(
      http.get(`${API}/api/v4/billing/purchases/100/refund-preview`, () => billingOk({ can_cancel: true, reason: null, refund_amount: 0 })),
      http.post(billingUrl(cbse, '/purchases/100/cancel'), () => billingError(409, 'REFUND_LIMIT_REACHED', 'Already used')),
    );
    renderWithProviders(<ManagePlans />, { exam: cbse });
    await userEvent.click((await screen.findAllByRole('button', { name: 'Cancel plan' }))[0]!);
    const confirm = await screen.findByRole('dialog', { name: 'Cancel Topper CBSE Monthly' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Cancel plan' }));
    expect(await screen.findByText(/it has already been used for this class/)).toBeInTheDocument();
  });

  it('shows the server message when the preview fails', async () => {
    server.use(
      overview({ active: [overviewPlanDto()] }),
      http.get(`${API}/api/v4/billing/purchases/100/refund-preview`, () => billingError(404, 'PURCHASE_NOT_FOUND', 'No active plan found.')),
    );
    renderWithProviders(<ManagePlans />, { exam: cbse });
    await userEvent.click((await screen.findAllByRole('button', { name: 'Cancel plan' }))[0]!);
    expect(await screen.findByRole('alert')).toHaveTextContent('No active plan found.');
  });

  it('extends a monthly plan with a coupon on its own exam, showing errors, then reloads', async () => {
    let body: unknown = null;
    let loads = 0;
    server.use(
      http.get(overviewUrl, () => {
        loads += 1;
        return billingOk({ active: [overviewPlanDto()], expired: [] });
      }),
      http.post(billingUrl(cbse, '/extensions'), async ({ request }) => {
        body = await request.json();
        return (body as { coupon_code: string }).coupon_code === 'BAD'
          ? billingError(400, 'INVALID_COUPON', 'Coupon expired')
          : billingOk({ months: 2, expiry_date: '2026-09-10T06:00:00.000Z' });
      }),
    );
    renderWithProviders(<ManagePlans />, { exam: cbse });
    await userEvent.click((await screen.findAllByRole('button', { name: 'Extend plan' }))[0]!);
    const input = screen.getByRole('textbox', { name: 'Coupon code' });
    await userEvent.type(input, 'BAD{Enter}');
    expect(await screen.findByText('Coupon expired')).toBeInTheDocument();
    await userEvent.clear(input);
    await userEvent.type(input, 'more');
    await userEvent.click(screen.getByRole('button', { name: 'Extend' }));
    const done = await screen.findByRole('dialog', { name: 'Plan extended' });
    expect(body).toEqual({ coupon_code: 'more', purchase_id: 100 });
    expect(within(done).getByText('MORE added 2 months to Topper CBSE Monthly · CBSE · Class 12.')).toBeInTheDocument();
    expect(within(done).getByText('10 Sep 2026')).toBeInTheDocument();
    await userEvent.click(within(done).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(loads).toBe(2));
  });

  it('downloads an invoice and reports a failed download', async () => {
    server.use(overview({ active: [overviewPlanDto()] }));
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    renderWithProviders(<ManagePlans />, { exam: cbse });
    await userEvent.click((await screen.findAllByRole('button', { name: 'Show billing history' }))[0]!);
    fetchMock.mockResolvedValueOnce(new Response('pdf', { status: 200 }));
    await userEvent.click(screen.getByRole('button', { name: 'Invoice' }));
    expect(await screen.findByText('Invoice INV-501 downloaded')).toBeInTheDocument();
    fetchMock.mockResolvedValueOnce(new Response('', { status: 500 }));
    await userEvent.click(screen.getByRole('button', { name: 'INV-501' }));
    expect(await screen.findByText('Couldn’t download the invoice. Check your connection.')).toBeInTheDocument();
    fetchMock.mockRestore();
  });
});
