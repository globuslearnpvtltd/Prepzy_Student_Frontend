import { http, HttpResponse } from 'msw';
import { API, server } from '@/test/server';
import { describeEntry, findFeaturedPurchase, maskPhone, referralApi, shortDate, shortLink, toFriends, toStatement } from './api';

const ok = (data: unknown) => HttpResponse.json({ success: true, data });

describe('referral mapping edge cases', () => {
  it('reads the basis snapshot as JSON text, an object or junk', () => {
    const [a, b, c] = toStatement([
      { id: 1, basis_snapshot: '{"paidAmount":999,"tier":"paid","examId":2}' },
      { id: 2, basis_snapshot: '{bad' },
      { id: 3, basis_snapshot: { paidAmount: 1 }, tier_snapshot: 'gold' },
    ]);
    expect(a!.basis).toEqual({ paidAmount: 999, tier: 'paid', examId: 2 });
    expect(b!.basis).toBeNull();
    expect(c).toMatchObject({ basis: { paidAmount: 1 }, tier: null, createdAt: '' });
  });

  it('features the latest buyer, falling back to the basis for tier and exam', () => {
    const friends = toFriends([
      { id: 1, status: 'paid', paid_at: '2026-01-01', signup_credit_amount: 25 },
      { id: 2, status: 'paid', paid_at: '2026-03-01', signup_credit_amount: 25, conversion_credit_amount: null },
      { id: 3, status: 'joined' },
    ]);
    const statement = toStatement([
      { id: 9, entry_type: 'grant_conversion', referral_id: 2, amount: 120, basis_snapshot: { paidAmount: '1200', tier: 'paid', examId: 2 } },
      { id: 8, entry_type: 'grant_conversion', referral_id: 1, amount: 50, basis_snapshot: null },
    ]);
    expect(findFeaturedPurchase(friends, statement)).toMatchObject({ paid: 1200, tier: 'paid', examId: 2, share: 120, join: 25 });
    expect(findFeaturedPurchase(friends.slice(0, 1), statement)).toBeNull();
  });

  it('describes every statement entry type', () => {
    const friend = toFriends([{ id: 1, friend_phone: '+919876543210' }])[0]!;
    const friends = new Map([[1, friend]]);
    const row = (entryType: string, extra: Record<string, unknown> = {}) => toStatement([{ entry_type: entryType, ...extra }])[0]!;
    expect(describeEntry(row('grant_signup', { referral_id: 1 }), friends)).toBe('+91 98••• ••210 joined');
    expect(describeEntry(row('grant_signup', { reason: 'Referral joining credit' }), friends)).toBe("You joined with a friend's link");
    expect(describeEntry(row('grant_signup'), friends)).toBe('A friend joined');
    expect(describeEntry(row('grant_conversion'), friends)).toBe('A friend bought a plan');
    expect(describeEntry(row('transfer_in'), friends)).toBe('Received from a friend');
    expect(describeEntry(row('transfer_out'), friends)).toBe('Sent to a friend');
    expect(describeEntry(row('redeem'), friends)).toBe('Used on a plan');
    expect(describeEntry(row('grant_manual'), friends)).toBe('Added by Prepzy');
    expect(describeEntry(row('reversal'), friends)).toBe('Corrected by Prepzy');
    expect(describeEntry(row('other'), friends)).toBe('Credit update');
  });

  it('formats phones, dates and links defensively', () => {
    expect(maskPhone(null)).toBeNull();
    expect(maskPhone('12345')).toBe('12345');
    expect(maskPhone('98••• ••210')).toBe('98••• ••210');
    expect(maskPhone('9876543210')).toBe('98••• ••210');
    expect(shortDate('not a date')).toBe('');
    expect(shortLink('prepzy.ai/r/abc')).toBe('prepzy.ai/r/abc');
    expect(shortLink('https://prepzy.ai/join')).toBe('prepzy.ai/join');
  });
});

describe('referralApi requests', () => {
  it('loads the hub from four endpoints', async () => {
    server.use(
      http.get(`${API}/api/v4/referral/me`, () => ok({ code: 'RAVI', tier: 'paid', balance: '75' })),
      http.get(`${API}/api/v4/referral/friends`, () => ok([{ id: 1 }])),
      http.get(`${API}/api/v4/referral/statement`, () => ok(null)),
      http.get(`${API}/api/v4/referral/earn-rates`, () => ok([{ exam_id: null, conversion_type: 'flat', conversion_flat_amount: 300 }])),
    );
    const hub = await referralApi.hub();
    expect(hub.summary).toMatchObject({ code: 'RAVI', tier: 'paid', balance: 75 });
    expect(hub.friends).toHaveLength(1);
    expect(hub.statement).toEqual([]);
    expect(hub.rates[0]).toMatchObject({ flat: true, flatAmount: 300 });
  });

  it('fails the hub when the summary is missing', async () => {
    server.use(
      http.get(`${API}/api/v4/referral/me`, () => HttpResponse.json({ success: true, data: null })),
      http.get(`${API}/api/v4/referral/friends`, () => ok([])),
      http.get(`${API}/api/v4/referral/statement`, () => ok([])),
      http.get(`${API}/api/v4/referral/earn-rates`, () => ok([])),
    );
    await expect(referralApi.hub()).rejects.toMatchObject({ code: 'EMPTY_RESPONSE' });
  });

  it('looks up a recipient by trimmed phone and 404s an unknown one', async () => {
    const phones: (string | null)[] = [];
    server.use(
      http.get(`${API}/api/v4/referral/transfer/lookup`, ({ request }) => {
        const phone = new URL(request.url).searchParams.get('phone');
        phones.push(phone);
        return ok(phone === '9876543210' ? { accountId: '7', name: 'Asha' } : null);
      }),
    );
    expect(await referralApi.lookup(' 9876543210 ')).toEqual({ accountId: 7, name: 'Asha' });
    await expect(referralApi.lookup('1111111111')).rejects.toMatchObject({ status: 404 });
    expect(phones).toEqual(['9876543210', '1111111111']);
  });

  it('posts a transfer', async () => {
    let body: unknown;
    server.use(
      http.post(`${API}/api/v4/referral/transfer`, async ({ request }) => {
        body = await request.json();
        return ok(null);
      }),
    );
    await referralApi.transfer({ recipientAccountId: 7, amount: 50, note: 'Thanks' });
    expect(body).toEqual({ recipientAccountId: 7, amount: 50, note: 'Thanks' });
  });
});
