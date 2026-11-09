import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { navigation } from '@/test/setup';
import { FIRST_VISIT_KEY, REFERRAL_CODE_KEY, Welcome } from './components/welcome';

type Handlers = Parameters<typeof server.use>;

function base({
  account = { account_id: 1 } as Record<string, unknown>,
  plans = [] as Record<string, unknown>[],
  signupPlans = [{ plan_id: 44 }] as { plan_id: number }[],
  referred = false,
} = {}): Handlers {
  return [
    http.get(`${API}/api/v4/student/account`, () => HttpResponse.json({ success: true, data: account })),
    http.get(`${API}/api/v4/student/plans/active`, () => HttpResponse.json({ success: true, data: { plans } })),
    http.get(`${API}/api/v1/student/plans/active-for-signup`, () => HttpResponse.json({ success: true, data: { plans: signupPlans } })),
    http.get(`${API}/api/referral/status`, () => HttpResponse.json({ success: true, data: { alreadyReferred: referred } })),
  ];
}

const limitsHandler = http.get(`${API}/api/v1/purchase/feature-limits`, async () => {
  await delay(30);
  return HttpResponse.json({
    success: true,
    data: [
      { id: 1, feature_name: 'Quiz', free_limits: 2, premium_limits: -1 },
      { id: 2, feature_name: 'Atlas', free_limits: 5, premium_limits: 50 },
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
      http.post(`${API}/api/v1/purchase/apply-custom-duration-coupon`, async ({ request }) => {
        body = await request.json();
        await delay(30);
        return HttpResponse.json({ success: true, data: { months: 1 } });
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

  it('prices board plans after the free month', async () => {
    server.use(
      ...base(),
      http.get(`${API}/api/v1/purchase/signup-plan-prices/12/44`, async () => {
        await delay(30);
        return HttpResponse.json({
          success: true,
          data: {
            plans: [
              { plan_id: 44, title: 'CLASS 12', duration_months: 12, price: 3999, cost_price: 9999 },
              { plan_id: 44, title: 'CLASS 12', duration_months: 1, price: 499, cost_price: 499 },
            ],
          },
        });
      }),
    );
    renderWithProviders(<Welcome />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'See pricing' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'See pricing' }));
    const dialog = screen.getByRole('dialog', { name: 'Pricing' });
    expect(within(dialog).getByText('Loading prices…')).toBeInTheDocument();
    expect(await within(dialog).findByText('CLASS 12 Topper Academic Year')).toBeInTheDocument();
    expect(within(dialog).getByText('CLASS 12 Basic')).toBeInTheDocument();
    expect(within(dialog).getByText('CLASS 12 Topper Monthly')).toBeInTheDocument();
    expect(within(dialog).getByText('₹9,999')).toBeInTheDocument();
    // No strike-through when the monthly plan isn't discounted.
    expect(within(dialog).getAllByText('₹499')).toHaveLength(1);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('prices a NEET bundle by target year, with retry and an empty list', async () => {
    navigation.searchParams = new URLSearchParams('exam=neet&class_id=20');
    let calls = 0;
    server.use(
      ...base(),
      http.get(`${API}/api/v1/purchase/signup-plan-prices/20/44`, () => {
        calls += 1;
        if (calls === 1) return HttpResponse.json({ success: false, message: 'down' });
        return HttpResponse.json({
          success: true,
          data: { plans: [{ plan_id: 44, title: 'NEET 2027', related_exams: [1], year: 2027, duration_months: 12, price: 3999, cost_price: null }] },
        });
      }),
    );
    renderWithProviders(<Welcome />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'See pricing' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'See pricing' }));
    expect(await screen.findByText('Couldn’t load plans')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Topper NEET 2027 + CBSE')).toBeInTheDocument();
    expect(screen.getByText('Basic NEET + CBSE')).toBeInTheDocument();
    expect(screen.queryByText(/Monthly/)).toBeNull();
    fireEvent.mouseDown(screen.getByRole('dialog', { name: 'Pricing' }).parentElement!);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('names NEET plans without a bundle or year, and says when nothing is priced', async () => {
    navigation.searchParams = new URLSearchParams('exam=neet&class_id=20');
    let empty = false;
    server.use(
      ...base(),
      http.get(`${API}/api/v1/purchase/signup-plan-prices/20/44`, () =>
        HttpResponse.json({
          success: true,
          data: {
            plans: empty
              ? []
              : [
                  { plan_id: 44, title: 'NEET', duration_months: 1, price: 499, cost_price: 999 },
                  { plan_id: 44, title: 'NEET', duration_months: 0, price: 0, cost_price: null },
                ],
          },
        }),
      ),
    );
    const { queryClient } = renderWithProviders(<Welcome />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'See pricing' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'See pricing' }));
    expect(await screen.findByText('Topper NEET Monthly')).toBeInTheDocument();
    expect(screen.getByText('Topper NEET')).toBeInTheDocument();
    expect(screen.getByText('₹999')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    empty = true;
    queryClient.removeQueries({ queryKey: ['plans', 'signup-prices'] });
    await userEvent.click(screen.getByRole('button', { name: 'See pricing' }));
    expect(await screen.findByText('No plans available for this class yet.')).toBeInTheDocument();
  });

  it('applies a referral code typed by hand, showing invalid codes', async () => {
    server.use(
      ...base(),
      http.post(`${API}/api/referral/apply`, async ({ request }) => {
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
      http.post(`${API}/api/referral/validate`, () => HttpResponse.json({ success: true, data: { valid: false } })),
      http.post(`${API}/api/referral/apply`, () => {
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
      http.post(`${API}/api/referral/validate`, () => HttpResponse.json({ success: true, data: { valid: true, referrerName: 'Asha', joiningCredit: 50 } })),
      http.post(`${API}/api/referral/apply`, () => HttpResponse.json({ success: false, message: 'Referral window closed' })),
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
