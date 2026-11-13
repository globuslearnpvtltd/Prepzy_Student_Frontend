import { http, HttpResponse } from 'msw';
import { API, server } from '@/test/server';
import { partnerApi, toProfile } from './api';
import { arrangement, describeEntry, initials } from './format';

const V4 = `${API}/api/v4/partners`;
const ok = (data: unknown = null) => HttpResponse.json({ success: true, data });

describe('partner formatting edge cases', () => {
  it('describes the commission arrangement', () => {
    expect(arrangement(toProfile({ commission_type: 'fixed', commission_fixed_amount: 300 }))).toBe('₹300 fixed');
    expect(arrangement(toProfile({ commission_type: 'fixed' }))).toBe('₹0 fixed');
    expect(arrangement(toProfile({ commission_type: 'percent', commission_rate: '10.00' }))).toBe('Commission 10.00%');
    expect(arrangement(toProfile({ commission_type: 'percent' }))).toBe('Commission 0%');
    expect(arrangement(toProfile({ commission_type: 'other' }))).toBe('No arrangement set');
    expect(describeEntry({ reason: null, entryType: 'custom' })).toBe('custom');
    expect(initials('  ')).toBe('P');
  });
});

describe('partnerApi requests', () => {
  it('sends phone numbers with the country code on every auth call', async () => {
    const calls: [string, unknown][] = [];
    const record = (name: string) =>
      http.post(`${V4}${name}`, async ({ request }) => {
        calls.push([name, await request.text().then((t) => (t ? JSON.parse(t) : undefined))]);
        return ok();
      });
    server.use(
      record('/auth/login/otp'),
      record('/auth/login/verify'),
      record('/auth/signup/otp'),
      record('/auth/signup/verify'),
      record('/auth/logout'),
      record('/signup-details'),
      record('/payouts'),
      record('/bank-details'),
    );
    const person = { firstName: 'Asha', lastName: 'Rao', phone: '9876543210' };
    await partnerApi.sendLoginOtp('9876543210');
    await partnerApi.verifyLoginOtp('9876543210', '1234');
    await partnerApi.sendSignupOtp(person);
    await partnerApi.verifySignupOtp(person, '1234');
    await partnerApi.logout();
    await partnerApi.submitSignupDetails({ partnerTypeId: 2, email: 'a@b.in', city: 'Pune' });
    await partnerApi.requestPayout(500);
    await partnerApi.saveBankDetails({ accountHolderName: 'Asha', bankAccountNumber: '123', ifscCode: 'SBIN0001234', pan: 'ABCDE1234F' });
    const phone = '+919876543210';
    expect(calls).toEqual([
      ['/auth/login/otp', { phone }],
      ['/auth/login/verify', { phone, otp: '1234' }],
      ['/auth/signup/otp', { ...person, phone }],
      ['/auth/signup/verify', { ...person, phone, otp: '1234' }],
      ['/auth/logout', undefined],
      ['/signup-details', { partnerTypeId: 2, email: 'a@b.in', city: 'Pune' }],
      ['/payouts', { amount: 500 }],
      ['/bank-details', { accountHolderName: 'Asha', bankAccountNumber: '123', ifscCode: 'SBIN0001234', pan: 'ABCDE1234F' }],
    ]);
  });

  it('reads the portal data from the v4 envelope', async () => {
    server.use(
      http.get(`${V4}/partner-types`, () => ok([{ id: 1, name: 'Teacher' }, { id: 0, name: 'x' }])),
      http.get(`${V4}/profile`, () => ok({ partner_name: 'Asha', kyc_status: 'verified' })),
      http.get(`${V4}/summary`, () => ok({ code: 'ASHA', balance: '120.5' })),
      http.get(`${V4}/friends`, () => ok([{ id: 1, status: 'paid', signup_credit_amount: 25, conversion_credit_amount: '100' }])),
      http.get(`${V4}/statement`, () => ok([{ id: 1, entry_type: 'expiry', amount: -5 }])),
      http.get(`${V4}/payouts`, () => ok({ minPayoutAmount: 100, payouts: [{ id: 1, status: 'settled', amount: 200 }] })),
      http.get(`${V4}/bank-details`, () => ok({ bankDetails: null })),
    );
    expect(await partnerApi.partnerTypes()).toEqual([{ id: 1, name: 'Teacher' }]);
    expect(await partnerApi.profile()).toMatchObject({ name: 'Asha', kycStatus: 'verified' });
    expect(await partnerApi.summary()).toMatchObject({ code: 'ASHA', balance: 120.5 });
    expect((await partnerApi.friends())[0]).toMatchObject({ status: 'paid', earned: 125 });
    expect((await partnerApi.statement())[0]).toMatchObject({ entryType: 'expiry', amount: -5 });
    expect(await partnerApi.payouts()).toMatchObject({ minPayoutAmount: 100, payouts: [{ status: 'settled', amount: 200 }] });
    expect(await partnerApi.bankDetails()).toBeNull();
  });

  it('fails a write the backend rejects', async () => {
    server.use(http.post(`${V4}/payouts`, () => HttpResponse.json({ success: false, message: 'Balance too low' }, { status: 400 })));
    await expect(partnerApi.requestPayout(5)).rejects.toMatchObject({ status: 400, message: 'Balance too low' });
  });
});
