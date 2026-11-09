/** Sample backend responses for plans, checkout, billing and the welcome screen. Spread into MOCKS in mocks.ts. */
const plan = (price_id: number, duration_months: number, price: number, cost_price: number, extra: Record<string, unknown> = {}) => ({
  price_id,
  plan_id: 10 + price_id,
  plan_title: 'CLASS 12',
  duration_months,
  month: null,
  price,
  cost_price,
  exam_date: duration_months === 12 ? '2027-03-15' : null,
  is_combo: false,
  related_exam: [],
  features: [],
  is_active_plan: 0,
  ...extra,
});

const neetPlans = [2027, 2028].flatMap((year, i) => [
  plan(20 + i * 6, 0, 0, 0, { plan_title: `NEET ${year}` }),
  plan(21 + i * 6, 1, 699, 1499, { plan_title: `NEET ${year}` }),
  plan(22 + i * 6, 12, 6999, 17988, { plan_title: `NEET ${year}`, exam_date: `${year}-05-03` }),
  plan(23 + i * 6, 1, 999, 1999, { plan_title: `NEET ${year}`, is_combo: true }),
  plan(24 + i * 6, 12, 9999, 23988, { plan_title: `NEET ${year}`, is_combo: true, exam_date: `${year}-05-03` }),
]);

const cbseVariant = (classId: number, title: string, stream: [number, string] | null) => ({
  variant_id: `${classId}-${stream?.[0] ?? 0}`,
  class_id: classId,
  class_title: title,
  stream_id: stream?.[0] ?? null,
  stream_name: stream?.[1] ?? null,
  target_year: null,
  has_combo: false,
  plans: [plan(classId * 10 + 1, 0, 0, 0), plan(classId * 10 + 2, 1, 499, 999), plan(classId * 10 + 3, 12, 3999, 9999)],
});

const limit = (feature_name: string, free_limit: number | null, premium_limit: number | null) => ({ id: feature_name.length, feature_name, free_limit, premium_limit });

export const PLAN_MOCKS: Record<string, unknown> = {
  '/api/v2/purchase/purchase-plans': {
    success: true,
    data: {
      exams: [
        {
          exam_id: 1,
          exam_key: 'cbse',
          title: 'CBSE',
          is_active: 1,
          variants: [
            cbseVariant(9, 'CLASS 9', null),
            cbseVariant(10, 'CLASS 10', null),
            cbseVariant(11, 'CLASS 11', [1, 'PCM']),
            cbseVariant(11, 'CLASS 11', [2, 'PCB']),
            cbseVariant(12, 'CLASS 12', [1, 'PCM']),
            cbseVariant(12, 'CLASS 12', [2, 'PCB']),
          ],
        },
        {
          exam_id: 2,
          exam_key: 'neet-ug',
          title: 'NEET UG',
          is_active: 1,
          variants: [{ variant_id: 'neet', class_id: 20, class_title: 'NEET', stream_id: null, stream_name: null, target_year: null, has_combo: true, plans: neetPlans }],
        },
      ],
    },
  },
  '/api/v2/purchase/feature-limits': {
    success: true,
    data: {
      exams: [
        { exam_id: 1, exam_key: 'cbse', features: [limit('Atlas Dashboard Chatbot', 20, 200), limit('Lecture Chatbot', 15, 150), limit('Post Assessment Chatbot', 10, 100), limit('Quiz', 2, null), limit('Mock Exam', 1, null)] },
        { exam_id: 2, exam_key: 'neet-ug', features: [limit('Step by Step Doubt Solver', 5, 50), limit('Atlas Dashboard Chat (No. of messages)', 20, 200), limit('Video Lecture Chats (No. of messages)', 15, 150), limit('Mock Exam', 1, null)] },
      ],
    },
  },
  '/api/subscriptions/active-coupons': {
    coupons: [
      { id: 1, coupon_code: 'PREPZY10', description: '10% off on any Topper plan', expiry: '2099-12-31', discount: 10, coupon_type: 'percent' },
      { id: 2, coupon_code: 'DIWALI25', description: '25% off — festival offer', expiry: '2025-11-01', discount: 25, coupon_type: 'percent' },
    ],
  },
  '/api/subscriptions/get-active-student-plans': {
    plans: [
      { purchase_id: 1, plan_id: 3, class_id: 12, class_name: 'CLASS 12', stream_name: 'PCB', duration_months: 12, purchase_start_date: '2026-04-01', expiry_date: '2027-03-31', status: 'active', has_pending_plan: 0 },
      { purchase_id: 2, plan_id: 4, class_id: 11, class_name: 'CLASS 11', stream_name: 'PCB', duration_months: 1, purchase_start_date: '2025-04-01', expiry_date: '2025-05-01', status: 'expired', has_pending_plan: 0 },
    ],
  },
  '/api/subscriptions/get-purchase-payment-history': {
    data: [{ class_name: 'CLASS 12', plan_id: 3, duration: 12, amount: '4719', status: 'success', invoice: null, created_at: '2026-04-01T10:00:00Z' }],
    pagination: { page: 1, totalPages: 1 },
  },
  '/api/neet/v1/purchase/purchase-history': {
    success: true,
    data: [
      {
        id: 1,
        planId: 3,
        name: 'Topper NEET 2027',
        billingCycle: 'Target Year',
        status: 'ACTIVE',
        startDate: '01 Apr, 2026',
        expiryDate: '03 May, 2027',
        remainingDays: 210,
        durationMonths: 12,
        courses: [
          { id: 1, label: 'MAIN PLAN', title: 'NEET 2027', status: 'ACTIVE' },
          { id: 2, label: 'COMBO PLAN', title: 'CBSE Class 11 PCB', status: 'ACTIVE' },
          { id: 3, label: 'COMBO PLAN', title: 'CBSE Class 12 PCB', status: 'ACTIVE' },
        ],
      },
      { id: 2, planId: 4, name: 'Basic NEET', billingCycle: 'Free', status: 'EXPIRED', startDate: '01 Jan, 2026', expiryDate: '31 Mar, 2026', remainingDays: 0, durationMonths: 0, courses: [] },
    ],
  },
  '/api/neet/v1/purchase/billing-history': {
    success: true,
    data: [
      { id: 1, invoice_no: 'INV-2026-0042', description: 'Topper NEET 2027 + CBSE', transaction_date: '2026-04-01T10:00:00Z', amount: 11798.82, currency_symbol: '₹', status: 'paid', invoice_url: 'https://example.com/inv.pdf' },
      { id: 2, invoice_no: '#17', description: 'Topper NEET Monthly', transaction_date: '2026-03-01T10:00:00Z', amount: 824.82, currency_symbol: '₹', status: 'refunded', invoice_url: null },
    ],
  },
  '/api/referral/status': { success: true, data: { alreadyReferred: false } },
  '/api/v1/student/plans/active-for-signup': { success: true, data: { plans: [{ plan_id: 3 }] } },
  '/api/v1/purchase/feature-limits': {
    success: true,
    data: [
      { id: 1, feature_name: 'Atlas Dashboard Chatbot', free_limits: 20, premium_limits: 200 },
      { id: 2, feature_name: 'Mock Exam', free_limits: 1, premium_limits: -1 },
    ],
  },
};
