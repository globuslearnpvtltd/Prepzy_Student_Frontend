/** Sample backend responses for the partners (affiliate) portal. Spread into MOCKS in mocks.ts. */
const profile = {
  partner_profile_id: 7,
  commission_type: 'percent',
  commission_rate: '10.00',
  commission_floor: '50.00',
  commission_cap: '500.00',
  commission_fixed_amount: null,
  kyc_status: 'verified',
  status: 'active',
  account_id: 42,
  partner_name: 'Anita Sharma',
  email: 'anita@example.com',
  phone: '+919876543210',
  partner_type_id: 2,
  partner_type_name: 'Teacher',
};

export const PARTNER_MOCKS: Record<string, unknown> = {
  '/api/v4/partners/profile': { success: true, data: profile },
  '/api/v4/partners/partner-types': {
    success: true,
    data: [
      { id: 1, name: 'Parent' },
      { id: 2, name: 'Teacher' },
      { id: 3, name: 'Tuition centre' },
      { id: 4, name: 'Influencer' },
      { id: 5, name: 'Student' },
    ],
  },
  '/api/v4/partners/bank-details': {
    success: true,
    data: {
      kycStatus: 'verified',
      bankDetails: {
        accountHolderName: 'Anita Sharma',
        bankAccountNumberMasked: 'XXXXXX4321',
        ifscCode: 'HDFC0000123',
        panMasked: 'XXXXX1234X',
        updatedAt: '2026-10-02T10:00:00.000Z',
      },
    },
  },
  '/api/v4/partners/summary': {
    success: true,
    data: {
      code: 'ANITA50',
      shareLink: 'https://prepzy.ai/r/ANITA50',
      balance: 1250,
      lifetimeEarned: 2650,
      lifetimePaidOut: 1000,
      pendingUnsettled: 400,
      friendCount: 3,
    },
  },
  '/api/v4/partners/friends': {
    success: true,
    data: [
      { id: 1, status: 'paid', attributed_at: '2026-09-04T10:00:00.000Z', paid_at: '2026-09-10T10:00:00.000Z', friend_name: 'Riya Verma', friend_phone: '+91 98XXXXXX10', exam_name: 'CBSE', signup_credit_amount: '50.00', conversion_credit_amount: '450.00' },
      { id: 2, status: 'joined', attributed_at: '2026-09-18T10:00:00.000Z', paid_at: null, friend_name: 'Kabir Singh', friend_phone: '+91 91XXXXXX89', exam_name: 'NEET', signup_credit_amount: '50.00', conversion_credit_amount: null },
      { id: 3, status: 'blocked', attributed_at: '2026-10-01T10:00:00.000Z', paid_at: null, friend_name: '', friend_phone: null, exam_name: null, signup_credit_amount: null, conversion_credit_amount: null },
    ],
  },
  '/api/v4/partners/statement': {
    success: true,
    data: [
      { id: 11, entry_type: 'payout_reserve', amount: '-400.00', balance_after: '1250.00', reason: null, created_at: '2026-10-05T10:00:00.000Z' },
      { id: 10, entry_type: 'grant_conversion', amount: '450.00', balance_after: '1650.00', reason: null, created_at: '2026-09-10T10:00:00.000Z' },
      { id: 9, entry_type: 'grant_signup', amount: '50.00', balance_after: '1200.00', reason: 'Signup: Kabir Singh', created_at: '2026-09-18T10:00:00.000Z' },
    ],
  },
  '/api/v4/partners/payouts': {
    success: true,
    data: {
      kycStatus: 'verified',
      minPayoutAmount: 500,
      payouts: [
        { id: 3, amount: '400.00', status: 'approved', rejection_reason: null, bank_reference: null, requested_at: '2026-10-05T10:00:00.000Z', reviewed_at: '2026-10-06T10:00:00.000Z' },
        { id: 2, amount: '1000.00', status: 'settled', rejection_reason: null, bank_reference: 'UTR123', requested_at: '2026-08-01T10:00:00.000Z', reviewed_at: '2026-08-03T10:00:00.000Z' },
        { id: 1, amount: '600.00', status: 'rejected', rejection_reason: 'Bank name mismatch', bank_reference: null, requested_at: '2026-07-01T10:00:00.000Z', reviewed_at: '2026-07-02T10:00:00.000Z' },
      ],
    },
  },
};
