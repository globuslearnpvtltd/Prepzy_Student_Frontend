/**
 * Sample backend responses for plans, checkout, billing and the welcome screen (v4 billing API, exam ids 1 = CBSE and
 * 2 = NEET as in MOCKS['/api/v4/exams']). Spread into MOCKS in mocks.ts.
 */
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

const bundled = [
  { exam_id: 1, exam_title: 'CBSE', class_id: 11, class_title: 'Class 11 PCB' },
  { exam_id: 1, exam_title: 'CBSE', class_id: 12, class_title: 'Class 12 PCB' },
];

// Display fields as the backend composes them (addendum: display_name, tier, bundled, variant_label, group_key).
const neetPlans = (year: number, i: number) => [
  plan(20 + i * 6, 0, 0, 0, { plan_title: `NEET ${year}`, display_name: 'Basic NEET-UG', tier: 'basic', bundled: [] }),
  plan(21 + i * 6, 1, 699, 1499, { plan_title: `NEET ${year}`, display_name: 'Topper NEET-UG Monthly', tier: 'monthly', bundled: [] }),
  plan(22 + i * 6, 12, 6999, 17988, { plan_title: `NEET ${year}`, exam_date: `${year}-05-03`, display_name: `Topper NEET-UG ${year}`, tier: 'yearly', bundled: [] }),
  plan(23 + i * 6, 1, 999, 1999, { plan_title: `NEET ${year}`, is_combo: true, display_name: 'Topper NEET-UG + CBSE Monthly', tier: 'monthly', bundled }),
  plan(24 + i * 6, 12, 9999, 23988, { plan_title: `NEET ${year}`, is_combo: true, exam_date: `${year}-05-03`, display_name: `Topper NEET-UG ${year} + CBSE`, tier: 'yearly', bundled }),
];

const cbseVariant = (classId: number, title: string, stream: [number, string] | null) => {
  const label = `Class ${classId}${stream ? ` ${stream[1]}` : ''}`;
  return {
    variant_id: `${classId}-${stream?.[0] ?? 0}`,
    class_id: classId,
    class_title: title,
    stream_id: stream?.[0] ?? null,
    stream_name: stream?.[1] ?? null,
    target_year: null,
    has_combo: false,
    variant_label: label,
    group_key: 'class',
    bundle_options: [],
    plans: [
      plan(classId * 10 + 1, 0, 0, 0, { display_name: 'Basic CBSE', tier: 'basic', bundled: [] }),
      plan(classId * 10 + 2, 1, 499, 999, { display_name: 'Topper CBSE Monthly', tier: 'monthly', bundled: [] }),
      plan(classId * 10 + 3, 12, 3999, 9999, { display_name: 'Topper CBSE Academic', tier: 'yearly', bundled: [] }),
    ],
  };
};

const limit = (feature_name: string, free_limit: number | null, premium_limit: number | null) => ({ id: feature_name.length, feature_name, free_limit, premium_limit });

const cbseVariants = [
  cbseVariant(9, 'CLASS 9', null),
  cbseVariant(10, 'CLASS 10', null),
  cbseVariant(11, 'CLASS 11', [1, 'PCM']),
  cbseVariant(11, 'CLASS 11', [2, 'PCB']),
  cbseVariant(12, 'CLASS 12', [1, 'PCM']),
  cbseVariant(12, 'CLASS 12', [2, 'PCB']),
];
const neetVariants = [2027, 2028].map((year, i) => ({
  variant_id: `neet-${year}`,
  class_id: 20,
  class_title: 'NEET',
  stream_id: null,
  stream_name: null,
  target_year: year,
  has_combo: true,
  variant_label: `NEET-UG ${year}`,
  group_key: 'target_year',
  bundle_options: [{ exam_id: 1, title: 'CBSE' }],
  plans: neetPlans(year, i),
}));

const ok = (data: unknown) => ({ success: true, message: 'OK', data });
const BOARD = '/api/v4/billing/board/1';
const NEET = '/api/v4/billing/competitive/2';

const purchase = (extra: Record<string, unknown>) => ({
  purchase_id: 1,
  plan_id: 3,
  plan_title: 'CLASS 12',
  exam_id: 1,
  class_id: 12,
  class_name: 'CLASS 12',
  stream_name: 'PCB',
  duration_months: 12,
  status: 'active',
  purchase_date: '2026-04-01T10:00:00Z',
  purchase_start_date: '2026-04-01T10:00:00Z',
  expiry_date: '2027-03-31T00:00:00Z',
  remaining_days: 210,
  price: 3999,
  paid_amount: 4718.82,
  order_id: 'order_1',
  invoice_number: null,
  invoice_url: null,
  has_pending_plan: false,
  pending_start_date: null,
  courses: [],
  display_name: 'Topper CBSE Academic',
  exam_title: 'CBSE',
  category: 'board',
  tier: 'yearly',
  is_free: false,
  ...extra,
});

const payment = (extra: Record<string, unknown>) => ({
  id: 1,
  display_name: 'Topper CBSE Academic',
  order_id: 'order_1',
  invoice_number: 'INV-2026-0042',
  invoice_url: 'https://example.com/inv.pdf',
  description: 'Topper CBSE Academic',
  plan_id: 3,
  class_name: 'CLASS 12',
  duration_months: 12,
  amount: 4718.82,
  currency: 'INR',
  status: 'paid',
  payment_method: 'upi',
  created_at: '2026-04-01T10:00:00Z',
  updated_at: '2026-04-01T10:00:00Z',
  ...extra,
});

const pagination = (total: number) => ({ page: 1, limit: 10, total, total_pages: 1 });

export const PLAN_MOCKS: Record<string, unknown> = {
  // The referral calculator still reads the old catalog (separate port).
  '/api/v2/purchase/purchase-plans': {
    success: true,
    data: {
      exams: [
        { exam_id: 1, exam_key: 'cbse', title: 'CBSE', is_active: 1, variants: cbseVariants },
        { exam_id: 2, exam_key: 'neet-ug', title: 'NEET UG', is_active: 1, variants: neetVariants },
      ],
    },
  },
  [`${BOARD}/catalog`]: ok({ exam: { exam_id: 1, exam_key: 'cbse', title: 'CBSE', category: 'board', exam_date: '2027-03-15' }, variants: cbseVariants }),
  [`${NEET}/catalog`]: ok({ exam: { exam_id: 2, exam_key: 'neet-ug', title: 'NEET-UG', category: 'competitive', exam_date: '2027-05-03' }, variants: neetVariants }),
  [`${BOARD}/feature-limits`]: ok({
    features: [limit('Atlas Dashboard Chatbot', 20, 200), limit('Lecture Chatbot', 15, 150), limit('Post Assessment Chatbot', 10, 100), limit('Quiz', 2, null), limit('Mock Exam', 1, null)],
  }),
  [`${NEET}/feature-limits`]: ok({
    features: [limit('Step by Step Doubt Solver', 5, 50), limit('Atlas Dashboard Chat (No. of messages)', 20, 200), limit('Video Lecture Chats (No. of messages)', 15, 150), limit('Mock Exam', 1, null)],
  }),
  [`${BOARD}/coupons`]: ok({
    coupons: [
      { coupon_code: 'PREPZY10', description: '10% off on any Topper plan', discount: 10, expiry: '2099-12-31' },
      { coupon_code: 'DIWALI25', description: '25% off — festival offer', discount: 25, expiry: '2025-11-01' },
    ],
  }),
  [`${NEET}/coupons`]: ok({ coupons: [] }),
  // Any quote: the monthly plan without a coupon (₹499 + 18% GST).
  [`${BOARD}/quote`]: ok({
    price_id: 122, plan_id: 132, duration_months: 1, base_price: 499, discount_percentage: 0, discount_amount: 0, discounted_price: 499,
    gst_amount: 89.82, total_amount: 588.82, amount_paise: 58882, currency: 'INR', coupon: null,
  }),
  [`${NEET}/quote`]: ok({
    price_id: 21, plan_id: 31, duration_months: 1, base_price: 699, discount_percentage: 0, discount_amount: 0, discounted_price: 699,
    gst_amount: 125.82, total_amount: 824.82, amount_paise: 82482, currency: 'INR', coupon: null,
  }),
  [`${BOARD}/purchases`]: ok({
    purchases: [
      purchase({}),
      purchase({ purchase_id: 2, plan_id: 4, class_id: 11, class_name: 'CLASS 11', duration_months: 1, display_name: 'Topper CBSE Monthly', tier: 'monthly', purchase_start_date: '2025-04-01T00:00:00Z', expiry_date: '2025-05-01T00:00:00Z', status: 'expired', remaining_days: 0 }),
    ],
  }),
  [`${BOARD}/purchases/3/payments`]: ok({ payments: [payment({ invoice_url: null })], pagination: pagination(1) }),
  [`${BOARD}/payments`]: ok({ payments: [payment({})], pagination: pagination(1) }),
  [`${NEET}/purchases`]: ok({
    purchases: [
      purchase({
        plan_title: 'NEET 2027', exam_id: 2, class_id: 20, class_name: 'NEET', stream_name: null, expiry_date: '2027-05-03T00:00:00Z',
        display_name: 'Topper NEET-UG 2027 + CBSE', exam_title: 'NEET-UG', category: 'competitive',
        courses: [{ class_id: 11, class_name: 'CLASS 11 PCB', exam_title: 'CBSE' }, { class_id: 12, class_name: 'CLASS 12 PCB', exam_title: 'CBSE' }],
      }),
      purchase({ purchase_id: 2, plan_id: 4, plan_title: 'NEET', exam_id: 2, class_id: 20, class_name: 'NEET', stream_name: null, duration_months: 0, price: 0, paid_amount: 0, display_name: 'Basic NEET-UG', exam_title: 'NEET-UG', category: 'competitive', tier: 'basic', is_free: true, status: 'expired', purchase_start_date: '2026-01-01T00:00:00Z', expiry_date: '2026-03-31T00:00:00Z', remaining_days: 0 }),
    ],
  }),
  [`${NEET}/payments`]: ok({
    payments: [
      payment({ description: 'Topper NEET-UG 2027 + CBSE', display_name: 'Topper NEET-UG 2027 + CBSE', amount: 11798.82 }),
      payment({ id: 2, invoice_number: '#17', description: 'Topper NEET-UG Monthly', display_name: 'Topper NEET-UG Monthly', amount: 824.82, status: 'refunded', invoice_url: null, created_at: '2026-03-01T10:00:00Z' }),
      payment({ id: 3, invoice_number: null, description: 'Topper NEET-UG Monthly', display_name: 'Topper NEET-UG Monthly', amount: 824.82, status: 'failed', invoice_url: null, created_at: '2026-02-01T10:00:00Z' }),
    ],
    pagination: pagination(3),
  }),
  '/api/referral/status': { success: true, data: { alreadyReferred: false } },
};
