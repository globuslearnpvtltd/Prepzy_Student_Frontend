import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { env } from '@/shared/config/env';
import { navigation } from '@/test/setup';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import {
  partnerBaseUrl,
  partnerRoutes,
  toBankDetails,
  toFriends,
  toPartnerTypes,
  toPayouts,
  toProfile,
  toStatement,
  toSummary,
} from './api';
import { formatCity, suggestCities } from './cities';
import { PartnerBankDetails } from './components/bank-details';
import { PartnerDashboard } from './components/dashboard';
import { PartnerLogin } from './components/login-screen';
import { PartnerPayouts } from './components/payouts';
import { PartnerSignup } from './components/signup-screen';
import { arrangement, describeEntry, displayLink, formatDate, formatPhone, inr, initials, toNameChars, toTenDigits } from './format';
import { bankDetailsSchema, payoutSchema, signupDetailsSchema } from './schemas';

const V1 = `${API}/api/partner/v1`;

const rawProfile = {
  partner_name: 'Anita Sharma',
  partner_type_name: 'Teacher',
  kyc_status: 'verified',
  commission_type: 'percent',
  commission_rate: '10.00',
  commission_floor: '50.00',
  commission_cap: '500.00',
  commission_fixed_amount: null,
};
const rawSummary = {
  code: 'ANITA50',
  shareLink: 'https://prepzy.ai/r/ANITA50',
  balance: 1250,
  lifetimeEarned: 2650,
  lifetimePaidOut: 1000,
  pendingUnsettled: 400,
  friendCount: 2,
};
const rawFriends = [
  { id: 1, status: 'paid', attributed_at: '2026-10-04T10:00:00Z', friend_name: 'Riya Verma', friend_phone: '+91 98XXXXXX10', exam_name: 'CBSE', signup_credit_amount: '50.00', conversion_credit_amount: '450.00' },
  { id: 2, status: 'weird', attributed_at: null, friend_name: '', friend_phone: null, exam_name: null, signup_credit_amount: null, conversion_credit_amount: null },
];
const rawStatement = [
  { id: 2, entry_type: 'payout_reserve', amount: '-400.00', balance_after: '1250.00', reason: null, created_at: '2026-10-05T10:00:00Z' },
  { id: 1, entry_type: 'grant_signup', amount: '50.00', balance_after: '1650.00', reason: 'Signup: Kabir', created_at: '2026-09-18T10:00:00Z' },
];
const rawPayouts = (payouts: unknown[], minPayoutAmount = 500) => ({ success: true, data: { payouts, minPayoutAmount, kycStatus: 'verified' } });

function partnerHandlers(overrides: { profile?: unknown; summary?: unknown; payouts?: unknown } = {}) {
  return [
    http.get(`${V1}/kyc/me`, () => HttpResponse.json({ success: true, data: overrides.profile ?? rawProfile })),
    http.get(`${V1}/dashboard/me`, () => HttpResponse.json({ success: true, data: overrides.summary ?? rawSummary })),
    http.get(`${V1}/dashboard/friends`, () => HttpResponse.json({ success: true, data: rawFriends })),
    http.get(`${V1}/dashboard/statement`, () => HttpResponse.json({ success: true, data: rawStatement })),
    http.get(`${V1}/payouts`, () => HttpResponse.json(overrides.payouts ?? rawPayouts([]))),
  ];
}

async function typeOtp(user: ReturnType<typeof userEvent.setup>, code: string) {
  for (const [i, digit] of [...code].entries()) await user.type(screen.getByLabelText(`Digit ${i + 1}`), digit);
}

describe('partner api normalisers and formatting', () => {
  it('normalises backend rows', () => {
    expect(toProfile(rawProfile)).toMatchObject({ name: 'Anita Sharma', typeName: 'Teacher', kycStatus: 'verified', commissionType: 'percent' });
    expect(toProfile({ kyc_status: 'odd' })).toMatchObject({ name: 'Partner', kycStatus: 'pending', commissionType: null });
    expect(toSummary(null)).toEqual({ code: '', shareLink: '', balance: 0, lifetimeEarned: 0, lifetimePaidOut: 0, pendingUnsettled: 0, friendCount: 0 });
    const friends = toFriends(rawFriends);
    expect(friends[0]).toMatchObject({ status: 'paid', earned: 500, name: 'Riya Verma' });
    expect(friends[1]).toMatchObject({ status: 'joined', earned: 0, name: null });
    expect(toFriends('nope')).toEqual([]);
    expect(toStatement(rawStatement)[0]).toMatchObject({ amount: -400, balanceAfter: 1250, entryType: 'payout_reserve' });
    expect(toPayouts({ payouts: [{ id: 1, amount: '600.00', status: 'bad' }], minPayoutAmount: '500' })).toEqual({
      minPayoutAmount: 500,
      payouts: [{ id: 1, amount: 600, status: 'requested', rejectionReason: null, requestedAt: null }],
    });
    expect(toBankDetails({ bankDetails: null })).toBeNull();
    expect(toBankDetails({ bankDetails: { accountHolderName: 'A', bankAccountNumberMasked: 'XX12', ifscCode: 'HDFC0000123', panMasked: null } })).toEqual({
      accountHolderName: 'A',
      accountNumberMasked: 'XX12',
      ifscCode: 'HDFC0000123',
      panMasked: null,
    });
    expect(toPartnerTypes([{ id: 1, name: 'Parent' }, { id: 0, name: 'x' }, { id: 2 }])).toEqual([{ id: 1, name: 'Parent' }]);
  });

  it('formats money in INR, dates, phones and names', () => {
    expect(inr(1250)).toBe('₹1,250');
    expect(inr('50.5')).toBe('₹50.5');
    expect(inr(null)).toBe('₹0');
    expect(formatDate(null)).toBe('—');
    expect(formatDate('not a date')).toBe('—');
    expect(formatDate('2026-10-05T10:00:00Z')).toMatch(/05 Oct 2026/);
    expect(formatPhone('9876543210')).toBe('+91 98765 43210');
    expect(toTenDigits('+91 98765 43210')).toBe('9876543210');
    expect(toTenDigits('098765 43210')).toBe('9876543210');
    expect(toTenDigits('12345678901234')).toBe('1234567890');
    expect(toNameChars(' Mary  Ann3')).toBe('Mary Ann');
    expect(initials('anita sharma')).toBe('AS');
    expect(initials('  ')).toBe('P');
    expect(displayLink('https://prepzy.ai/r/X')).toBe('prepzy.ai/r/X');
    expect(describeEntry({ reason: null, entryType: 'grant_conversion' })).toBe('Friend converted');
    expect(describeEntry({ reason: null, entryType: 'custom' })).toBe('custom');
    const profile = toProfile(rawProfile);
    expect(arrangement(profile)).toBe('Commission 10.00%');
    expect(arrangement({ ...profile, commissionType: 'fixed', commissionFixed: '300' })).toBe('₹300 fixed');
    expect(arrangement({ ...profile, commissionType: null })).toBe('No arrangement set');
  });

  it('suggests cities, narrowing by state after a comma', () => {
    expect(suggestCities('')).toEqual([]);
    expect(formatCity(suggestCities('hyd')[0]!)).toBe('Hyderabad, Telangana');
    expect(suggestCities('aurangabad, bih').map(formatCity)).toEqual(['Aurangabad, Bihar']);
    expect(suggestCities('a').length).toBeLessThanOrEqual(8);
  });

  it('uses the partner API host, and the main API on plain localhost like the previous app', () => {
    expect(partnerBaseUrl('partners.prepzy.ai')).toBe(env.partnerApiUrl);
    expect(partnerBaseUrl(null)).toBe(env.partnerApiUrl);
    expect(partnerBaseUrl('localhost')).toBe(env.apiUrl);
    expect(partnerRoutes).toEqual({
      login: '/partners/login',
      signup: '/partners/signup',
      dashboard: '/partners/dashboard',
      payouts: '/partners/payouts',
      bankDetails: '/partners/bank-details',
    });
  });
});

describe('partner schemas', () => {
  it('validates IFSC, PAN and account number like the previous app', () => {
    const ok = bankDetailsSchema.safeParse({ accountHolderName: 'Anita', bankAccountNumber: '123456789', ifscCode: 'hdfc0000123', pan: 'abcpv1234x' });
    expect(ok.success && ok.data).toMatchObject({ ifscCode: 'HDFC0000123', pan: 'ABCPV1234X' });
    const bad = bankDetailsSchema.safeParse({ accountHolderName: ' ', bankAccountNumber: '12', ifscCode: 'HDFC1000123', pan: 'ABC' });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues.map((issue) => issue.message)).toEqual([
      'Full legal name is required',
      'Enter a valid account number (9-18 digits)',
      'Enter a valid IFSC code',
      'Enter a valid PAN (e.g. ABCPV1234X)',
    ]);
  });

  it('checks the payout amount against the minimum and the balance', () => {
    const schema = payoutSchema(500, 1250);
    expect(schema.safeParse({ amount: '600' }).success).toBe(true);
    expect(schema.safeParse({ amount: '100' }).error?.issues[0]?.message).toBe('The minimum payout is ₹500');
    expect(schema.safeParse({ amount: '5000' }).error?.issues[0]?.message).toBe('That is more than your available balance');
    expect(schema.safeParse({ amount: 'abc' }).success).toBe(false);
  });

  it('requires a partner type, a valid email and a city', () => {
    const result = signupDetailsSchema.safeParse({ partnerTypeId: 0, email: 'x', city: '' });
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      'Please choose what describes you best.',
      'Please enter a valid email address.',
      'Please enter your city and state.',
    ]);
  });
});

describe('partner login', () => {
  it('sends the OTP, verifies it and opens the dashboard', async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    server.use(
      http.post(`${V1}/auth/generate-login-otp`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ success: true });
      }),
      http.post(`${V1}/auth/verify-login-otp`, async ({ request }) => {
        const body = (await request.json()) as { otp: string };
        return body.otp === '123456'
          ? HttpResponse.json({ success: true })
          : HttpResponse.json({ success: false, error: 'Incorrect OTP' }, { status: 400 });
      }),
    );
    renderWithProviders(<PartnerLogin />);

    await user.click(screen.getByRole('button', { name: 'Get OTP on WhatsApp' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Please enter a valid 10-digit mobile number.');

    await user.click(screen.getByLabelText('Mobile number'));
    await user.paste('+91 98765 43210');
    await user.click(screen.getByRole('button', { name: 'Get OTP on WhatsApp' }));
    expect(await screen.findAllByText('Verify your number')).not.toHaveLength(0);
    expect(bodies).toEqual([{ phone: '+919876543210' }]);
    expect(screen.getByText('Resend in 30s')).toBeInTheDocument();

    await typeOtp(user, '111111');
    await user.click(screen.getByRole('button', { name: 'Verify & sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect OTP');
    expect(screen.getByLabelText('Digit 1')).toHaveValue('');

    await typeOtp(user, '123456');
    await user.click(screen.getByRole('button', { name: 'Verify & sign in' }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/partners/dashboard'));
  });

  it('shows the server error when the number has no partner account', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${V1}/auth/generate-login-otp`, () =>
        HttpResponse.json({ success: false, error: 'No partner account found for this phone number' }, { status: 404 }),
      ),
    );
    renderWithProviders(<PartnerLogin />);
    await user.type(screen.getByLabelText('Mobile number'), '9876543210');
    await user.click(screen.getByRole('button', { name: 'Get OTP on WhatsApp' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No partner account found for this phone number');
    expect(screen.getByRole('link', { name: 'Become a partner' })).toHaveAttribute('href', '/partners/signup');
  });
});

describe('partner sign-up', () => {
  it('runs name + phone → OTP → details (validated) → success', async () => {
    const user = userEvent.setup();
    const sent: unknown[] = [];
    server.use(
      http.post(`${V1}/auth/generate-signup-otp`, async ({ request }) => {
        sent.push(await request.json());
        return HttpResponse.json({ success: true, accountId: 9 });
      }),
      http.post(`${V1}/auth/verify-signup-otp`, () => HttpResponse.json({ success: true })),
      http.get(`${V1}/kyc/partner-types`, () => HttpResponse.json({ success: true, data: [{ id: 1, name: 'Parent' }, { id: 2, name: 'Teacher' }] })),
      http.post(`${V1}/kyc/signup-details`, async ({ request }) => {
        sent.push(await request.json());
        return HttpResponse.json({ success: true, message: 'Details submitted for review' });
      }),
      http.get(`${V1}/dashboard/me`, () => HttpResponse.json({ success: true, data: rawSummary })),
    );
    renderWithProviders(<PartnerSignup />);

    await user.click(screen.getByRole('button', { name: 'Get OTP on WhatsApp' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Please enter your first name.');

    await user.type(screen.getByLabelText('First name'), 'Anita9');
    expect(screen.getByLabelText('First name')).toHaveValue('Anita');
    await user.type(screen.getByLabelText('Last name'), 'Sharma');
    await user.type(screen.getByLabelText('Mobile number'), '9876543210');
    await user.click(screen.getByRole('button', { name: 'Get OTP on WhatsApp' }));

    await typeOtp(user, '123456');
    await user.click(screen.getByRole('button', { name: 'Verify & continue' }));
    expect(sent[0]).toEqual({ firstName: 'Anita', lastName: 'Sharma', phone: '+919876543210' });

    const submit = await screen.findByRole('button', { name: 'Submit details' });
    await screen.findByRole('radio', { name: 'Teacher' });
    await user.click(submit);
    expect(await screen.findByRole('alert')).toHaveTextContent('Please choose what describes you best.');

    await user.click(screen.getByRole('radio', { name: 'Teacher' }));
    await user.type(screen.getByLabelText(/^Email/), 'bad');
    await user.click(submit);
    expect(await screen.findByRole('alert')).toHaveTextContent('Please enter a valid email address.');

    await user.clear(screen.getByLabelText(/^Email/));
    await user.type(screen.getByLabelText(/^Email/), 'anita@example.com');
    const city = screen.getByRole('combobox');
    await user.type(city, 'hyd');
    await user.click(await screen.findByRole('option', { name: /Hyderabad/ }));
    expect(city).toHaveValue('Hyderabad, Telangana');
    await user.click(submit);

    expect(await screen.findAllByText('prepzy.ai/r/ANITA50')).not.toHaveLength(0);
    expect(sent[1]).toEqual({ partnerTypeId: 2, email: 'anita@example.com', city: 'Hyderabad, Telangana' });
    await user.click(screen.getAllByRole('button', { name: 'Go to my dashboard' })[0]!);
    expect(navigation.push).toHaveBeenCalledWith('/partners/dashboard');
  });

  it('city input supports the keyboard and free text', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${V1}/auth/generate-signup-otp`, () => HttpResponse.json({ success: true })),
      http.post(`${V1}/auth/verify-signup-otp`, () => HttpResponse.json({ success: true })),
      http.get(`${V1}/kyc/partner-types`, () => HttpResponse.json({ success: false, error: 'boom' }, { status: 500 })),
      http.post(`${V1}/auth/logout`, () => HttpResponse.json({ success: true })),
    );
    renderWithProviders(<PartnerSignup />);
    await user.type(screen.getByLabelText('First name'), 'Anita');
    await user.type(screen.getByLabelText('Mobile number'), '9876543210');
    await user.click(screen.getByRole('button', { name: 'Get OTP on WhatsApp' }));
    await typeOtp(user, '123456');
    await user.click(screen.getByRole('button', { name: 'Verify & continue' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('boom');
    const city = screen.getByRole('combobox');
    await user.type(city, 'pun');
    await user.keyboard('{ArrowDown}{ArrowUp}{Enter}');
    expect(city).not.toHaveValue('pun');
    await user.clear(city);
    await user.type(city, 'Smalltown{Escape}');
    expect(city).toHaveValue('Smalltown');

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('heading', { name: 'Become a partner' })).toBeInTheDocument();
  });
});

describe('partner dashboard', () => {
  it('shows balance, invite, friends and statement', async () => {
    const user = userEvent.setup();
    server.use(...partnerHandlers());
    renderWithProviders(<PartnerDashboard />);
    expect(await screen.findByRole('heading', { name: 'Welcome, Anita Sharma' })).toBeInTheDocument();
    expect(screen.getAllByText('₹1,250')).not.toHaveLength(0);
    expect(screen.getByText('Awaiting payout approval')).toBeInTheDocument();
    expect(screen.getByText('Across 2 friends')).toBeInTheDocument();
    expect(screen.getByText('Commission 10.00%')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request payout' })).toHaveAttribute('href', '/partners/payouts');
    expect(await screen.findByText('Riya Verma')).toBeInTheDocument();
    expect(screen.getByText('₹500')).toBeInTheDocument();
    expect(await screen.findByText('Payout requested')).toBeInTheDocument();
    expect(screen.getByText('−₹400')).toBeInTheDocument();
    expect(screen.getByText('Signup: Kabir')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(await screen.findByText('Copied!')).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe('https://prepzy.ai/r/ANITA50');

    await user.click(screen.getByRole('button', { name: 'Share link' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('link', { name: 'Share on WhatsApp' }).getAttribute('href')).toContain('wa.me');
    await user.click(within(dialog).getByRole('button', { name: 'Copy code · ANITA50' }));
    expect(await within(dialog).findByText('Code copied!')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the first-steps state for a new partner', async () => {
    server.use(...partnerHandlers({ summary: { ...rawSummary, balance: 0, lifetimeEarned: 0, friendCount: 0 } }));
    renderWithProviders(<PartnerDashboard />);
    expect(await screen.findByRole('heading', { name: 'No referrals yet' })).toBeInTheDocument();
    expect(screen.getByText('Share your link and start earning.')).toBeInTheDocument();
    expect(screen.getByText('Balance ₹0')).toBeInTheDocument();
  });

  it('offers a retry when the account cannot be loaded', async () => {
    const user = userEvent.setup();
    let fail = true;
    server.use(
      http.get(`${V1}/dashboard/me`, () =>
        fail ? HttpResponse.json({ message: 'down' }, { status: 500 }) : HttpResponse.json({ success: true, data: rawSummary }),
      ),
      ...partnerHandlers(),
    );
    renderWithProviders(<PartnerDashboard />);
    expect(await screen.findByText("We couldn't load your partner account.")).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Welcome, Anita Sharma' })).toBeInTheDocument();
  });

  it('sends an unfinished sign-up (no profile) back to sign-up', async () => {
    let loggedOut = false;
    server.use(
      http.get(`${V1}/kyc/me`, () => HttpResponse.json({ success: false, error: 'Partner profile not found' }, { status: 404 })),
      ...partnerHandlers(),
      http.post(`${V1}/auth/logout`, () => {
        loggedOut = true;
        return HttpResponse.json({ success: true });
      }),
    );
    renderWithProviders(<PartnerDashboard />);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/partners/signup'));
    expect(loggedOut).toBe(true);
  });

  it('logs out, clears the cache and returns to the partner login', async () => {
    const user = userEvent.setup();
    server.use(...partnerHandlers(), http.post(`${V1}/auth/logout`, () => HttpResponse.json({ success: true })));
    const { queryClient } = renderWithProviders(<PartnerDashboard />);
    await user.click(await screen.findByRole('button', { name: 'Logout' }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/partners/login'));
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });
});

describe('partner payouts', () => {
  const payouts = [
    { id: 2, amount: '400.00', status: 'rejected', rejection_reason: 'Bank name mismatch', requested_at: '2026-10-05T10:00:00Z' },
    { id: 1, amount: '1000.00', status: 'settled', rejection_reason: null, requested_at: '2026-08-01T10:00:00Z' },
  ];

  it('lists payouts and requests a new one', async () => {
    const user = userEvent.setup();
    let requested: unknown;
    server.use(
      ...partnerHandlers({ payouts: rawPayouts(payouts) }),
      http.post(`${V1}/payouts`, async ({ request }) => {
        requested = await request.json();
        return HttpResponse.json({ success: true, message: 'Payout requested', data: { payoutId: 3, newBalance: 650 } });
      }),
    );
    renderWithProviders(<PartnerPayouts />);
    expect(await screen.findByText('Reason: Bank name mismatch')).toBeInTheDocument();
    expect(screen.getByText(/This request was rejected/)).toBeInTheDocument();
    expect(screen.getByText('₹1,000')).toBeInTheDocument();
    expect(screen.getByText('settled')).toBeInTheDocument();

    const button = screen.getByRole('button', { name: 'Request payout' });
    expect(button).toBeDisabled();
    const amount = screen.getByLabelText('Amount to withdraw');
    await user.type(amount, '100');
    expect(await screen.findByText('The minimum payout is ₹500')).toBeInTheDocument();
    expect(button).toBeDisabled();
    await user.clear(amount);
    await user.type(amount, '600');
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    expect(await screen.findByText('Payout requested.')).toBeInTheDocument();
    expect(requested).toEqual({ amount: 600 });
  });

  it('shows the stepper for an open request, blocks new ones and explains KYC', async () => {
    server.use(
      ...partnerHandlers({
        profile: { ...rawProfile, kyc_status: 'submitted' },
        payouts: rawPayouts([{ id: 3, amount: '600', status: 'approved', requested_at: '2026-10-05T10:00:00Z' }]),
      }),
    );
    renderWithProviders(<PartnerPayouts />);
    expect(await screen.findByText(/already have a request in progress/)).toBeInTheDocument();
    expect(screen.getByText('Complete KYC verification before you can request a payout.')).toBeInTheDocument();
    expect(screen.getByText('Not verified')).toBeInTheDocument();
    expect(screen.getByText('Approved', { selector: 'div' })).toBeInTheDocument();
  });

  it('shows the API error when the request is refused', async () => {
    const user = userEvent.setup();
    server.use(
      ...partnerHandlers(),
      http.post(`${V1}/payouts`, () => HttpResponse.json({ success: false, message: 'Insufficient balance' }, { status: 400 })),
    );
    renderWithProviders(<PartnerPayouts />);
    expect(await screen.findByText('No payout requests yet.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Amount to withdraw'), '700');
    await user.click(screen.getByRole('button', { name: 'Request payout' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Insufficient balance');
  });
});

describe('partner bank details', () => {
  const bank = {
    success: true,
    data: {
      kycStatus: 'rejected',
      bankDetails: { accountHolderName: 'Anita Sharma', bankAccountNumberMasked: 'XXXXXX4321', ifscCode: 'HDFC0000123', panMasked: 'XXXXX1234X' },
    },
  };

  it('validates the form and submits upper-cased values', async () => {
    const user = userEvent.setup();
    let saved: unknown;
    server.use(
      ...partnerHandlers({ profile: { ...rawProfile, kyc_status: 'rejected' } }),
      http.get(`${V1}/kyc/bank-details`, () => HttpResponse.json(bank)),
      http.post(`${V1}/kyc/bank-details`, async ({ request }) => {
        saved = await request.json();
        return HttpResponse.json({ success: true, message: 'Bank details submitted for review' });
      }),
    );
    renderWithProviders(<PartnerBankDetails />);
    expect(await screen.findByText('Resubmission needed')).toBeInTheDocument();
    expect(screen.getByLabelText('Full legal name')).toHaveValue('Anita Sharma');
    expect(screen.getByText(/On file: XXXXX1234X/)).toBeInTheDocument();

    await user.clear(screen.getByLabelText('IFSC'));
    await user.type(screen.getByLabelText('IFSC'), 'hdfc1');
    await user.type(screen.getByLabelText('Bank account number'), '12ab');
    expect(screen.getByLabelText('Bank account number')).toHaveValue('12');
    await user.click(screen.getByRole('button', { name: 'Save details' }));
    expect(await screen.findByText('Enter a valid account number (9-18 digits)')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid IFSC code')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid PAN (e.g. ABCPV1234X)')).toBeInTheDocument();
    expect(saved).toBeUndefined();

    await user.clear(screen.getByLabelText('IFSC'));
    await user.type(screen.getByLabelText('IFSC'), 'sbin0001234');
    await user.type(screen.getByLabelText('Bank account number'), '3456789012');
    await user.type(screen.getByLabelText('PAN'), 'abcpv1234x');
    expect(screen.getByLabelText('PAN')).toHaveValue('ABCPV1234X');
    await user.click(screen.getByRole('button', { name: 'Save details' }));
    expect(await screen.findByText('Bank details saved and sent for review.')).toBeInTheDocument();
    expect(saved).toEqual({ accountHolderName: 'Anita Sharma', bankAccountNumber: '123456789012', ifscCode: 'SBIN0001234', pan: 'ABCPV1234X' });
    expect(screen.getByLabelText('PAN')).toHaveValue('');
  });

  it('shows the pending state and the save error', async () => {
    const user = userEvent.setup();
    server.use(
      ...partnerHandlers({ profile: { ...rawProfile, kyc_status: 'pending' } }),
      http.get(`${V1}/kyc/bank-details`, () => HttpResponse.json({ success: true, data: { kycStatus: 'pending', bankDetails: null } })),
      http.post(`${V1}/kyc/bank-details`, () => HttpResponse.json({ success: false, message: 'IFSC not recognised' }, { status: 400 })),
    );
    renderWithProviders(<PartnerBankDetails />);
    expect(await screen.findByText('Add your bank details')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Full legal name'), 'Anita');
    await user.type(screen.getByLabelText('Bank account number'), '123456789');
    await user.type(screen.getByLabelText('IFSC'), 'HDFC0000123');
    await user.type(screen.getByLabelText('PAN'), 'ABCPV1234X');
    await user.click(screen.getByRole('button', { name: 'Save details' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('IFSC not recognised');
  });
});
