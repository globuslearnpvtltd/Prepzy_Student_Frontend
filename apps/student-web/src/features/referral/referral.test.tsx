import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { navigation } from '@/test/setup';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import {
  buildPlanOptions,
  capClause,
  describeEntry,
  findFeaturedPurchase,
  maskPhone,
  pickExamplePlan,
  rateFor,
  rewardFor,
  shareLabel,
  shareMessage,
  shareOf,
  shortDate,
  shortLink,
  toFriends,
  toggleNote,
  topperGainNote,
  toRates,
  toStatement,
  toSummary,
} from './api';
import { estimate } from './components/calculator';
import { buildFaqs } from './components/info';
import { ReferAndEarn } from './components/refer-and-earn';
import { testExam } from '@/test/exams';
import { billingOk, billingUrl } from '@/test/billing';

const cbse = testExam('cbse');
const neet = testExam('neet');

const rawRates = [
  { exam_id: null, conversion_type: 'percent', signup_credit_free: '25', signup_credit_paid: '50', conversion_rate_free: '10', conversion_rate_paid: '20', conversion_floor: '50', conversion_cap: '500', conversion_flat_amount: null },
  { exam_id: 2, conversion_type: 'flat', signup_credit_free: '30', signup_credit_paid: '60', conversion_rate_free: null, conversion_rate_paid: null, conversion_floor: null, conversion_cap: null, conversion_flat_amount: '300' },
];
const plan = (priceId: number, price: number, extra: Record<string, unknown> = {}) => ({
  price_id: priceId,
  plan_id: priceId,
  plan_title: 'Plan',
  duration_months: 12,
  price,
  cost_price: 0,
  exam_date: null,
  is_combo: false,
  is_active_plan: 0 as const,
  display_name: null as string | null,
  tier: 'yearly' as const,
  bundled: [],
  ...extra,
});
const cbseVariants = [
  {
    variant_id: 'class-12',
    class_id: 12,
    class_title: 'CLASS 12',
    stream_id: null,
    stream_name: 'PCB',
    target_year: null,
    has_combo: false,
    variant_label: 'Class 12 PCB',
    group_key: 'class' as const,
    bundle_options: [],
    plans: [plan(11, 4999, { display_name: 'Topper CBSE Academic' }), plan(12, 0, { duration_months: 0, display_name: 'Basic CBSE' })],
  },
];
const neetVariants = [
  {
    variant_id: 'neet-ug-2028',
    class_id: 20,
    class_title: 'NEET',
    stream_id: null,
    stream_name: null,
    target_year: 2028,
    has_combo: true,
    variant_label: 'NEET-UG 2028',
    group_key: 'target_year' as const,
    bundle_options: [],
    plans: [plan(21, 9999, { is_combo: true, display_name: 'Topper NEET-UG 2028 + CBSE' }), plan(11, 4999)],
  },
];
/** What useCatalogs hands the calculator. */
const catalogs = [
  { examId: cbse.examId, examKey: 'cbse', title: 'CBSE', category: 'board' as const, slug: 'cbse', variants: cbseVariants },
  { examId: neet.examId, examKey: 'neet-ug', title: 'NEET-UG', category: 'competitive' as const, slug: 'neet', variants: neetVariants },
];
const friendsRaw = [
  { id: 1, status: 'paid', paid_at: '2025-03-02', friend_name: 'Riya', friend_phone: '+91 98••• ••210', exam_name: 'CBSE', signup_credit_amount: '25', conversion_credit_amount: '500' },
  { id: 2, status: 'joined', paid_at: null, friend_name: null, friend_phone: '91••• ••789', exam_name: null, signup_credit_amount: '25', conversion_credit_amount: null },
];
const statementRaw = [
  { id: 10, entry_type: 'grant_conversion', amount: '500', balance_after: '550', reason: null, referral_id: 1, exam_id: 1, tier_snapshot: 'free', basis_snapshot: '{"paidAmount":4999}', created_at: '2025-09-05T00:00:00Z' },
  { id: 9, entry_type: 'grant_signup', amount: '25', balance_after: '50', reason: null, referral_id: 2, exam_id: null, tier_snapshot: null, basis_snapshot: null, created_at: '2025-03-01T00:00:00Z' },
  { id: 8, entry_type: 'payout', amount: '0', balance_after: '25', reason: null, referral_id: null, exam_id: null, tier_snapshot: null, basis_snapshot: null, created_at: '2025-02-01T00:00:00Z' },
];

function hub({ friends = friendsRaw, statement = statementRaw, balance = 550, fail = false } = {}) {
  return [
    http.get(`${API}/api/v4/referral/me`, () =>
      fail
        ? HttpResponse.json({ message: 'down' }, { status: 500 })
        : HttpResponse.json({ success: true, message: 'OK', data: { code: 'MEERA1', shareLink: 'https://prepzy.ai/join?ref=MEERA1', tier: 'free', balance, friendCount: friends.length, friendJoinCredit: 100 } }),
    ),
    http.get(`${API}/api/v4/referral/friends`, () => HttpResponse.json({ success: true, message: 'OK', data: friends })),
    http.get(`${API}/api/v4/referral/statement`, () => HttpResponse.json({ success: true, message: 'OK', data: statement })),
    http.get(`${API}/api/v4/referral/earn-rates`, () => HttpResponse.json({ success: true, message: 'OK', data: rawRates })),
    http.get(billingUrl(cbse, '/catalog'), () => billingOk({ exam: { exam_key: 'cbse', title: 'CBSE', category: 'board' }, variants: cbseVariants })),
    http.get(billingUrl(neet, '/catalog'), () => billingOk({ exam: { exam_key: 'neet-ug', title: 'NEET-UG', category: 'competitive' }, variants: neetVariants })),
    http.get(`${API}/api/v4/student/plans/active`, () =>
      HttpResponse.json({ success: true, data: { plans: [{ plan_id: 1, class_id: 12, class_name: 'CLASS 12', duration_months: 0, status: 'active' }] } }),
    ),
  ];
}

describe('referral maths and normalisers', () => {
  const rates = toRates(rawRates);

  it('normalises the hub', () => {
    expect(toSummary({ tier: 'paid', balance: '12.5' })).toMatchObject({ tier: 'paid', balance: 12.5, shareLink: '' });
    expect(toSummary(null).tier).toBe('free');
    const friends = toFriends(friendsRaw);
    expect(friends[0]).toMatchObject({ status: 'paid', name: 'Riya', conversionCredit: 500 });
    expect(friends[1]).toMatchObject({ status: 'joined', name: null, conversionCredit: null });
    expect(toFriends('nope')).toEqual([]);
    expect(toStatement(statementRaw)[0]!.basis).toEqual({ paidAmount: 4999 });
    expect(toStatement([{ basis_snapshot: '{bad' }])[0]!.basis).toBeNull();
  });

  it('picks rates and computes shares', () => {
    expect(rateFor(rates, 2)!.flat).toBe(true);
    expect(rateFor(rates, 1)!.examId).toBeNull();
    expect(rateFor([], 1)).toBeNull();
    const free = rewardFor(rates[0]!, 'free');
    const paid = rewardFor(rates[0]!, 'paid');
    expect(free).toEqual({ join: 25, percent: 10, floor: 50, cap: 500, flat: null });
    expect(shareOf(free, 4999)).toBe(500);
    expect(shareOf(free, 100)).toBe(50);
    expect(shareOf(paid, 1000)).toBe(200);
    expect(shareLabel(free)).toBe('10%');
    expect(capClause(free)).toBe('never less than ₹50 or more than ₹500');
    expect(capClause({ ...free, floor: null })).toBe('never more than ₹500');
    expect(capClause({ ...free, cap: null })).toBe('never less than ₹50');
    const flat = rewardFor(rates[1]!, 'free');
    expect(shareOf(flat, 9999)).toBe(300);
    expect(shareLabel(flat)).toBe('₹300');
    expect(capClause(flat)).toBe('');
    expect(rewardFor(null, 'free').join).toBe(0);
    expect(topperGainNote(free, paid)).toBe('Earns twice as much');
    expect(topperGainNote(free, free)).toBe('Earns more');
    expect(toggleNote('free', 'free', 'x')).toEqual({ text: 'You are on Basic', tone: 'muted' });
    expect(toggleNote('paid', 'free', 'gain')).toEqual({ text: 'gain', tone: 'amber' });
    expect(toggleNote('free', 'paid', 'gain').text).toBeNull();
    expect(estimate(free, 3, 2, null)).toEqual({ share: 0, joinTotal: 75, buyTotal: 0, total: 75 });
  });

  it('builds plan options and picks an example plan', () => {
    const options = buildPlanOptions(catalogs);
    // Paid plans only, each price once; names straight from the catalog.
    expect(options).toHaveLength(2);
    expect(options[0]).toMatchObject({ priceId: 11, examId: cbse.examId, group: 'CBSE Class 12 PCB', label: 'Topper CBSE Academic', phrase: 'Topper CBSE Academic' });
    expect(options[1]).toMatchObject({ priceId: 21, examId: neet.examId, group: 'NEET-UG 2028', label: 'Topper NEET-UG 2028 + CBSE', isCombo: true });
    // An older catalog without labels or display_name: named by the same rule as the server.
    const bare = buildPlanOptions([
      { ...catalogs[0]!, variants: [{ ...cbseVariants[0]!, variant_label: null, plans: [plan(31, 99, { plan_title: 'Monthly' })] }] },
      { ...catalogs[1]!, variants: [{ ...neetVariants[0]!, variant_label: null, plans: [plan(32, 199, { plan_title: '' })] }] },
    ]);
    expect(bare.map((option) => [option.group, option.label])).toEqual([
      ['CBSE Class 12 PCB', 'Topper CBSE Academic'],
      ['NEET-UG 2028', 'Topper NEET-UG 2028'],
    ]);
    expect(pickExamplePlan(options, 12, cbse.examId)!.priceId).toBe(11);
    expect(pickExamplePlan(options, null, neet.examId)!.priceId).toBe(21);
    expect(pickExamplePlan([], null, 1)).toBeNull();
    expect(buildPlanOptions([])).toEqual([]);
  });

  it('formats friends and the statement', () => {
    expect(maskPhone('+919876543210')).toBe('+91 98••• ••210');
    expect(maskPhone('123')).toBe('123');
    expect(maskPhone('+91 98••• ••210')).toBe('+91 98••• ••210');
    expect(maskPhone(null)).toBeNull();
    expect(shortDate('2025-09-05T00:00:00Z')).toBe('05 Sep 2025');
    expect(shortDate('bad')).toBe('');
    const friends = toFriends(friendsRaw);
    const byId = new Map(friends.map((f) => [f.id, f]));
    const rows = toStatement(statementRaw);
    expect(describeEntry(rows[0]!, byId)).toBe('Riya bought a CBSE plan');
    expect(describeEntry(rows[1]!, byId)).toBe('91••• ••789 joined');
    const base = rows[2]!;
    expect(describeEntry({ ...base, entryType: 'grant_signup', reason: 'Referral joining credit' }, byId)).toBe("You joined with a friend's link");
    expect(describeEntry({ ...base, entryType: 'grant_signup' }, byId)).toBe('A friend joined');
    for (const [type, text] of [
      ['transfer_in', 'Received from a friend'],
      ['transfer_out', 'Sent to a friend'],
      ['redeem', 'Used on a plan'],
      ['grant_manual', 'Added by Prepzy'],
      ['reversal', 'Corrected by Prepzy'],
      ['other', 'Credit update'],
    ] as const) {
      expect(describeEntry({ ...base, entryType: type }, byId)).toBe(text);
    }
    expect(findFeaturedPurchase(friends, rows)).toMatchObject({ paid: 4999, share: 500, join: 25, tier: 'free' });
    expect(findFeaturedPurchase(friends, [])).toBeNull();
    expect(shortLink('https://prepzy.ai/join?ref=AB')).toBe('prepzy.ai/…?ref=AB');
    expect(shortLink('https://prepzy.ai/x')).toBe('prepzy.ai/x');
    expect(shortLink('not a url')).toBe('not a url');
    expect(buildFaqs('paid', rewardFor(rateFor(toRates(rawRates))!, 'free'), rewardFor(rateFor(toRates(rawRates))!, 'paid'))[0]!.a).toContain('₹50');
  });

  it('uses the exam from the registry in the share message', () => {
    expect(shareMessage(cbse, 'L', 100)).toContain('Prepzy for CBSE');
    const message = shareMessage(neet, 'L', 100);
    expect(message).toContain('NEET UG prep');
    expect(message).toContain('1 month free + ₹100');
  });
});

describe('ReferAndEarn', () => {
  it('shows the empty state and shares on WhatsApp', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    server.use(...hub({ friends: [], statement: [], balance: 0 }));
    renderWithProviders(<ReferAndEarn />, { exam: neet });
    expect(await screen.findByText('No one has joined yet')).toBeInTheDocument();
    expect(screen.getByText(/You get ₹30 when they join and ₹300 of their plan/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Share on WhatsApp' }));
    const url = decodeURIComponent(String(open.mock.calls[0]![0]));
    expect(url).toContain('https://wa.me/?text=');
    expect(url).toContain('NEET UG prep');
    expect(url).toContain('https://prepzy.ai/join?ref=MEERA1');
  });

  it('lists referrals, the statement and the money flow, and uses credits', async () => {
    server.use(...hub());
    renderWithProviders(<ReferAndEarn />, { exam: cbse });
    expect(await screen.findByText('Your credits and referrals')).toBeInTheDocument();
    expect(screen.getAllByText('Riya bought a CBSE plan').length).toBeGreaterThan(0);
    expect(screen.getByText('How Riya’s plan turned into your credits')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Use credits' })[0]!);
    expect(navigation.push).toHaveBeenCalledWith('/manage-plans');
    await userEvent.click(screen.getByRole('button', { name: /How much can I earn/ }));
    await userEvent.click(screen.getByRole('button', { name: /Who can I invite/ }));
    expect(screen.getByText(/One link works for all of them/)).toBeInTheDocument();
  });

  it('estimates earnings', async () => {
    server.use(...hub({ friends: [], statement: [] }));
    renderWithProviders(<ReferAndEarn />, { exam: cbse });
    await screen.findByText('See what you could earn');
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'The plan they buy' })).toBeEnabled());
    await userEvent.click(screen.getAllByRole('button', { name: 'People who join: more' })[0]!);
    await userEvent.click(screen.getAllByRole('button', { name: 'People who buy a plan: more' })[0]!);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'The plan they buy' }), '11');
    expect(screen.getByTestId('estimate-total')).toHaveTextContent('₹550');
    const toggles = screen.getAllByRole('radiogroup', { name: 'Your plan' });
    await userEvent.click(within(toggles[0]!).getByRole('radio', { name: 'Topper' }));
    expect(screen.getAllByText('Earns twice as much').length).toBeGreaterThan(0);
  });

  it('validates the recipient and sends credits', async () => {
    let sent: unknown = null;
    server.use(
      ...hub(),
      http.get(`${API}/api/v4/referral/transfer/lookup`, ({ request }) => {
        const phone = new URL(request.url).searchParams.get('phone');
        return phone === '9000000000'
          ? HttpResponse.json({ message: 'No student found with that number' }, { status: 404 })
          : HttpResponse.json({ success: true, data: { accountId: 44, name: 'Kabir' } });
      }),
      http.post(`${API}/api/v4/referral/transfer`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ success: true, message: 'Credits sent', data: { newBalance: 450, amount: 100 } });
      }),
    );
    renderWithProviders(<ReferAndEarn />, { exam: cbse });
    await userEvent.click((await screen.findAllByRole('button', { name: 'Send credits' }))[0]!);
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Their mobile number'), '9000000000');
    expect(await within(dialog).findByText('No student found with that number', {}, { timeout: 2000 })).toBeInTheDocument();
    await userEvent.clear(within(dialog).getByLabelText('Their mobile number'));
    await userEvent.type(within(dialog).getByLabelText('Their mobile number'), '9876543210');
    expect(await within(dialog).findByText(/Kabir · 9876543210/, {}, { timeout: 2000 })).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText('Amount'), '600');
    expect(within(dialog).getByText('You only have ₹550 to send')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Send credits' })).toBeDisabled();
    await userEvent.clear(within(dialog).getByLabelText('Amount'));
    await userEvent.type(within(dialog).getByLabelText('Amount'), '100');
    expect(within(dialog).getByText('You will have ₹450 left')).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText(/Note/), 'for books');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send credits' }));
    expect(await within(dialog).findByText('Credits sent')).toBeInTheDocument();
    expect(sent).toEqual({ recipientAccountId: 44, amount: 100, note: 'for books' });
  });

  it('shows an error state with retry', async () => {
    server.use(...hub({ fail: true }));
    renderWithProviders(<ReferAndEarn />, { exam: cbse });
    expect(await screen.findByText(/couldn.t load Refer & Earn/)).toBeInTheDocument();
    server.use(...hub());
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Your credits and referrals')).toBeInTheDocument();
  });
});
