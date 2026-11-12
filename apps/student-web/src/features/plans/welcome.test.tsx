import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { navigation } from '@/test/setup';
import { billingError, billingOk, billingUrl } from '@/test/billing';
import { testExam } from '@/test/exams';
import { FIRST_VISIT_KEY, REFERRAL_CODE_KEY, Welcome } from './components/welcome';

type Handlers = Parameters<typeof server.use>;

function base({
  account = { account_id: 1 } as Record<string, unknown>,
  plans = [] as Record<string, unknown>[],
  referred = false,
} = {}): Handlers {
  return [
    http.get(`${API}/api/v4/student/account`, () => HttpResponse.json({ success: true, data: account })),
    http.get(`${API}/api/v4/student/plans/active`, () => HttpResponse.json({ success: true, data: { plans } })),
    http.get(`${API}/api/v4/referral/status`, () => HttpResponse.json({ success: true, data: { alreadyReferred: referred } })),
  ];
}

const cbse = testExam('cbse');
const neet = testExam('neet');

const limitsHandler = http.get(billingUrl(cbse, '/feature-limits'), async () => {
  await delay(30);
  return billingOk({
    features: [
      { id: 1, feature_name: 'Quiz', free_limit: 2, premium_limit: null },
      { id: 2, feature_name: 'Atlas', free_limit: 5, premium_limit: 50 },
    ],
  });
});

type Row = { price_id?: number; plan_id: number; plan_title: string; duration_months: number; price: number; cost_price: number | null; is_combo?: boolean; is_active_plan?: boolean };
/** GET /catalog?class_id= with one variant holding `plans`; asserts the class filter. */
const catalogFor = (exam: typeof cbse, classId: number, plans: () => Row[] | Response, targetYear: number | null = null) =>
  http.get(billingUrl(exam, '/catalog'), async ({ request }) => {
    expect(new URL(request.url).searchParams.get('class_id')).toBe(String(classId));
    await delay(30);
    const rows = plans();
    if (rows instanceof Response) return rows;
    return billingOk({
      exam: { exam_id: exam.examId, exam_key: exam.examSlice, title: exam.label, exam_date: null },
      variants: [
        {
          variant_id: 'v',
          class_id: classId,
          class_title: 'CLASS',
          stream_id: null,
          stream_name: null,
          target_year: targetYear,
          has_combo: false,
          plans: rows.map((row, i) => ({ price_id: i + 1, exam_date: null, is_combo: false, is_active_plan: false, ...row })),
        },
      ],
    });
  });

describe('Welcome', () => {
  beforeEach(() => {
    localStorage.clear();
    navigation.searchParams = new URLSearchParams('exam=cbse&class_id=12');
  });
  afterEach(() => {
    navigation.searchParams = new URLSearchParams();
    vi.restoreAllMocks();
  });

  it('remembers the first visit and leaves for the dashboard on Back', async () => {
    server.use(...base());
    renderWithProviders(<Welcome />);
    expect(await screen.findByText('Topper plan active')).toBeInTheDocument();
    expect(localStorage.getItem(FIRST_VISIT_KEY)).toBe('true');
    expect(navigation.replace).not.toHaveBeenCalled();
    fireEvent(window, new PopStateEvent('popstate'));
    expect(navigation.replace).toHaveBeenCalledWith('/cbse/dashboard');
  });

  it('shows the plan end date from the active plan', async () => {
    server.use(
      ...base({ plans: [{ plan_id: 9, class_id: 12, class_name: 'CLASS 12', duration_months: 1, expiry_date: '2026-07-01', status: 'active' }] }),
    );
    renderWithProviders(<Welcome />);
    expect((await screen.findAllByText('Ends 01 Jul 2026')).length).toBe(2);
  });

  it('falls back to the stored expiry date', async () => {
    localStorage.setItem('prepzy-plan-expiry-date', '2026-08-15');
    server.use(...base());
    renderWithProviders(<Welcome />);
    expect((await screen.findAllByText('Ends 15 Aug 2026')).length).toBe(2);
  });

  it('works when storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    server.use(...base());
    renderWithProviders(<Welcome />);
    expect(await screen.findByText('Topper plan active')).toBeInTheDocument();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('uses the student’s exam when the link has none, and sends board coupons without a plan id', async () => {
    navigation.searchParams = new URLSearchParams();
    let body: unknown = null;
    server.use(
      ...base({ account: { account_id: 1, target_exam: 'cbse' } }),
      http.post(billingUrl(cbse, '/extensions'), async ({ request }) => {
        body = await request.json();
        await delay(30);
        return billingOk({ months: 1, purchase: {} });
      }),
    );
    renderWithProviders(<Welcome />);
    await userEvent.type(await screen.findByRole('textbox', { name: 'Enter coupon code' }), ' EXTRA ');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(await screen.findByRole('button', { name: 'Applying...' })).toBeDisabled();
    expect(await screen.findByRole('button', { name: 'Applied' })).toBeDisabled();
    expect(body).toEqual({ coupon_code: 'EXTRA' });
    // Without an expiry date there is nothing to announce.
    expect(screen.queryByText(/extra months added/)).toBeNull();
    // Without a class the pricing sheet can't load.
    expect(screen.getByRole('button', { name: 'See pricing' })).toBeDisabled();
  });

  it('shows usage limits, loading first, and closes in every way', async () => {
    server.use(...base(), limitsHandler);
    renderWithProviders(<Welcome />);
    await userEvent.click(await screen.findByRole('button', { name: 'See Usage limits' }));
    const dialog = screen.getByRole('dialog', { name: 'View usage limits' });
    expect(within(dialog).queryByText('Quiz')).toBeNull();
    expect(await within(dialog).findByText('Quiz')).toBeInTheDocument();
    expect(within(dialog).getByText('Unlimited')).toBeInTheDocument();
    expect(within(dialog).getByText('50')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'See Usage limits' }));
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'See Usage limits' }));
    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement!);
    expect(screen.queryByRole('dialog')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'See Usage limits' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('prices the active board plan after the free month from the class catalog', async () => {
    server.use(
      ...base(),
      catalogFor(cbse, 12, () => [
        { plan_id: 43, plan_title: 'CLASS 12 PCM', duration_months: 1, price: 1, cost_price: 1 },
        { plan_id: 44, plan_title: 'CLASS 12', duration_months: 12, price: 3999, cost_price: 9999, display_name: 'Topper CBSE Academic' },
        { plan_id: 44, plan_title: 'CLASS 12', duration_months: 0, price: 0, cost_price: 0, display_name: 'Basic CBSE' },
        { plan_id: 44, plan_title: 'CLASS 12', duration_months: 1, price: 499, cost_price: 499, is_active_plan: true, display_name: 'Topper CBSE Monthly' },
      ]),
    );
    renderWithProviders(<Welcome />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'See pricing' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'See pricing' }));
    const dialog = screen.getByRole('dialog', { name: 'Pricing' });
    expect(within(dialog).getByText('Loading prices…')).toBeInTheDocument();
    // Names are the server's display_name.
    expect(await within(dialog).findByText('Topper CBSE Academic')).toBeInTheDocument();
    expect(within(dialog).getByText('Basic CBSE')).toBeInTheDocument();
    expect(within(dialog).getByText('Topper CBSE Monthly')).toBeInTheDocument();
    expect(within(dialog).getByText('₹9,999')).toBeInTheDocument();
    // No strike-through when the monthly plan isn't discounted; the other plan's ₹1 isn't shown.
    expect(within(dialog).getAllByText('₹499')).toHaveLength(1);
    expect(within(dialog).queryByText('₹1')).toBeNull();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('prices a NEET bundle by target year, with retry and an empty list', async () => {
    navigation.searchParams = new URLSearchParams('exam=neet&class_id=20');
    let calls = 0;
    server.use(
      ...base({ plans: [{ plan_id: 44, class_id: 20, class_name: 'NEET', duration_months: 1, expiry_date: '2026-07-01', status: 'active' }] }),
      catalogFor(
        neet,
        20,
        () => {
          calls += 1;
          if (calls === 1) return billingError(404, 'PURCHASE_NOT_AVAILABLE', 'down');
          return [
            { plan_id: 45, plan_title: 'NEET', duration_months: 1, price: 1, cost_price: null },
            {
              plan_id: 44,
              plan_title: 'NEET',
              is_combo: true,
              duration_months: 12,
              price: 3999,
              cost_price: null,
              bundled: [{ exam_id: 1, exam_title: 'CBSE', class_id: 11, class_title: 'Class 11 PCB' }],
            },
          ];
        },
        2027,
      ),
    );
    renderWithProviders(<Welcome />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'See pricing' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'See pricing' }));
    expect(await screen.findByText('Couldn’t load plans')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    // An older backend: the name is composed from the exam title, the variant's target_year and the bundle.
    expect(await screen.findByText(`Topper ${neet.label} 2027 + CBSE`)).toBeInTheDocument();
    expect(screen.getByText(`Basic ${neet.label}`)).toBeInTheDocument();
    expect(screen.queryByText(/Monthly/)).toBeNull();
    fireEvent.mouseDown(screen.getByRole('dialog', { name: 'Pricing' }).parentElement!);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('names target-year plans by exam, year and bundle, and says when nothing is priced', async () => {
    navigation.searchParams = new URLSearchParams('exam=neet&class_id=20');
    let empty = false;
    server.use(
      ...base(),
      catalogFor(neet, 20, () =>
        empty
          ? []
          : [
              { plan_id: 44, plan_title: 'NEET', duration_months: 1, price: 499, cost_price: 999 },
              { plan_id: 44, plan_title: 'NEET', duration_months: 3, price: 1299, cost_price: null },
            ],
      ),
    );
    const { queryClient } = renderWithProviders(<Welcome />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'See pricing' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'See pricing' }));
    expect(await screen.findByText(`Topper ${neet.label} Monthly`)).toBeInTheDocument();
    expect(screen.getByText(`Topper ${neet.label} 3 Months`)).toBeInTheDocument();
    expect(screen.getByText('₹999')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    empty = true;
    queryClient.removeQueries({ queryKey: ['plans', 'catalog'] });
    await userEvent.click(screen.getByRole('button', { name: 'See pricing' }));
    expect(await screen.findByText('No plans available for this class yet.')).toBeInTheDocument();
  });

  it('applies a referral code typed by hand, showing invalid codes', async () => {
    server.use(
      ...base(),
      http.post(`${API}/api/v4/referral/apply`, async ({ request }) => {
        const { code } = (await request.json()) as { code: string };
        return code === 'FRIEND'
          ? HttpResponse.json({ success: true, data: { joiningCredit: 75 } })
          : HttpResponse.json({ success: false, message: 'Referral code not found' }, { status: 400 });
      }),
    );
    renderWithProviders(<Welcome />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Referral code' }));
    expect(screen.getByText(/you'll both earn Prepzy coins/)).toBeInTheDocument();
    const input = screen.getByRole('textbox', { name: 'Enter referral code' });
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
    await userEvent.type(input, 'NOPE');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Referral code not found');
    await userEvent.clear(input);
    expect(screen.queryByRole('alert')).toBeNull();
    await userEvent.type(input, 'FRIEND');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(await screen.findByText('₹75 credited to your wallet!')).toBeInTheDocument();
    // The banners belong to their tab.
    await userEvent.click(screen.getByRole('tab', { name: 'Coupon code' }));
    expect(screen.queryByText('₹75 credited to your wallet!')).toBeNull();
  });

  it('marks an already referred student as applied and forgets the stored code', async () => {
    localStorage.setItem(REFERRAL_CODE_KEY, 'OLD');
    server.use(...base({ referred: true }));
    renderWithProviders(<Welcome />);
    await waitFor(() => expect(localStorage.getItem(REFERRAL_CODE_KEY)).toBeNull());
    await userEvent.click(screen.getByRole('tab', { name: 'Referral code' }));
    expect(screen.getByRole('textbox', { name: 'Enter referral code' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Applied' })).toBeDisabled();
  });

  it('prefills an invalid stored code without applying it', async () => {
    localStorage.setItem(REFERRAL_CODE_KEY, 'STALE');
    let applied = false;
    server.use(
      ...base(),
      http.post(`${API}/api/v4/referral/validate`, () => HttpResponse.json({ success: true, data: { valid: false } })),
      http.post(`${API}/api/v4/referral/apply`, () => {
        applied = true;
        return HttpResponse.json({ success: true, data: {} });
      }),
    );
    renderWithProviders(<Welcome />);
    expect(await screen.findByDisplayValue('STALE')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Referral code' })).toHaveAttribute('aria-selected', 'true');
    expect(applied).toBe(false);
  });

  it('shows the referrer’s offer when the automatic apply fails', async () => {
    localStorage.setItem(REFERRAL_CODE_KEY, 'ASHA1');
    server.use(
      ...base(),
      http.post(`${API}/api/v4/referral/validate`, () => HttpResponse.json({ success: true, data: { valid: true, referrerName: 'Asha', joiningCredit: 50 } })),
      http.post(`${API}/api/v4/referral/apply`, () => HttpResponse.json({ success: false, message: 'Referral window closed' })),
    );
    renderWithProviders(<Welcome />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Referral window closed');
    expect(screen.getByText(/You have a referral code from/)).toHaveTextContent('Asha');
    expect(screen.getByText(/₹\s*50 in credits/)).toBeInTheDocument();
    expect(localStorage.getItem(REFERRAL_CODE_KEY)).toBe('ASHA1');
    await userEvent.click(screen.getByRole('tab', { name: 'Coupon code' }));
    expect(screen.queryByText(/You have a referral code from/)).toBeNull();
  });
});
