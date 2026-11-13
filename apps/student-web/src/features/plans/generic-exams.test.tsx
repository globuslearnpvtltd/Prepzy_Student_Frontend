import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { ExamConfig } from '@/shared/config/exams';
import { billingOk, billingUrl, overviewHistoryDto, overviewPlanDto, overviewUrl, quoteData } from '@/test/billing';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import { navigation } from '@/test/setup';
import { Checkout } from './components/checkout/checkout';
import { ManagePlans } from './components/manage/manage-plans';
import type { RazorpayOptions } from './razorpay';

/**
 * Exams the code has never heard of: only DB rows (GET /api/v4/exams and the billing API) describe them. The plans
 * pages must name everything from the API, and never show another exam's name.
 */
vi.mock('@/shared/config/env', async (importOriginal) => {
  const actual = await importOriginal<{ env: Record<string, unknown> }>();
  return { env: { ...actual.env, razorpayKeyId: 'rzp_test_key' } };
});

const page = (slug: string, examId: number, category: 'board' | 'competitive'): ExamConfig =>
  ({ slug, examSlice: slug, label: slug.toUpperCase(), category, testTypes: [], theme: category, onboarding: { kind: 'choose-class' }, examId }) as ExamConfig;
const icse = page('icse', 7, 'board');
const jee = page('jee', 9, 'competitive');

const plan = (price_id: number, duration_months: number, price: number, display_name: string, extra: Record<string, unknown> = {}) => ({
  price_id,
  plan_id: 100 + price_id,
  plan_title: 'ignored',
  duration_months,
  price,
  cost_price: price * 2,
  exam_date: null,
  is_combo: false,
  is_active_plan: 0,
  display_name,
  tier: duration_months === 0 ? 'basic' : duration_months === 1 ? 'monthly' : 'yearly',
  bundled: [],
  ...extra,
});

const pcmBundle = [{ exam_id: 7, exam_title: 'ICSE', class_id: 11, class_title: 'Class 11 PCM' }];

const icseCatalog = {
  exam: { exam_id: 7, exam_key: 'icse', title: 'ICSE', category: 'board', exam_date: null },
  variants: [10, 11].map((n) => ({
    variant_id: `c${n}`,
    class_id: n,
    class_title: `CLASS ${n}`,
    stream_id: n === 11 ? 3 : null,
    stream_name: n === 11 ? 'PCM' : null,
    target_year: null,
    has_combo: false,
    variant_label: n === 11 ? 'Class 11 PCM' : 'Class 10',
    group_key: 'class',
    bundle_options: [],
    plans: [plan(n * 10, 0, 0, 'Basic ICSE'), plan(n * 10 + 1, 12, 2999, 'Topper ICSE Academic')],
  })),
};

const jeeCatalog = {
  exam: { exam_id: 9, exam_key: 'jee', title: 'JEE', category: 'competitive', exam_date: null },
  variants: [
    {
      variant_id: 'j27',
      class_id: 30,
      class_title: 'JEE',
      stream_id: 3,
      stream_name: null,
      target_year: 2027,
      has_combo: true,
      variant_label: 'JEE 2027',
      group_key: 'target_year',
      bundle_options: [{ exam_id: 7, title: 'ICSE' }],
      plans: [
        plan(91, 1, 799, 'Topper JEE Monthly'),
        plan(92, 1, 999, 'Topper JEE + ICSE Monthly', { is_combo: true, bundled: pcmBundle }),
      ],
    },
  ],
};

const limits = { features: [{ id: 1, feature_name: 'Mock Exam', free_limit: 1, premium_limit: null }] };

function handlers() {
  return [
    http.get(`${API}/api/v4/exams`, () =>
      HttpResponse.json({
        success: true,
        data: [
          { exam_id: 7, exam_name: 'ICSE', exam_slice: 'icse', category: 'board' },
          { exam_id: 9, exam_name: 'JEE', exam_slice: 'jee', category: 'competitive' },
          { exam_id: 11, exam_name: 'Reference', exam_slice: 'ref', category: 'reference' },
        ],
      }),
    ),
    http.get(billingUrl(icse, '/catalog'), () => billingOk(icseCatalog)),
    http.get(billingUrl(jee, '/catalog'), () => billingOk(jeeCatalog)),
    http.get(billingUrl(icse, '/feature-limits'), () => billingOk(limits)),
    http.get(billingUrl(jee, '/feature-limits'), () => billingOk(limits)),
    http.get(billingUrl(icse, '/coupons'), () => billingOk({ coupons: [] })),
    http.get(billingUrl(jee, '/coupons'), () => billingOk({ coupons: [] })),
    http.post(billingUrl(jee, '/quote'), async ({ request }) => {
      const { price_id } = (await request.json()) as { price_id: number };
      return billingOk(quoteData(price_id, price_id === 92 ? 999 : 799));
    }),
    http.get(`${API}/api/v4/student/account`, () => HttpResponse.json({ success: true, data: { account_id: 1, class: 10 } })),
  ];
}

const noOtherExam = () => expect(document.body.textContent).not.toMatch(/NEET|CBSE/i);

describe('a new board and competitive exam (DB rows only)', () => {
  let options: RazorpayOptions | null;
  beforeEach(() => {
    options = null;
    window.Razorpay = class {
      constructor(opts: RazorpayOptions) {
        options = opts;
      }
      open() {}
      on() {}
    } as unknown as typeof window.Razorpay;
    window.scrollTo = vi.fn();
  });
  afterEach(() => {
    Reflect.deleteProperty(window, 'Razorpay');
  });

  it('sells both on the common purchase page, named by the API, with the bundle by stream', async () => {
    let order: unknown = null;
    server.use(
      ...handlers(),
      http.post(billingUrl(jee, '/orders'), async ({ request }) => {
        order = await request.json();
        return billingOk({ order_id: 'order_j', status: 'created', amount_paise: 117882, currency: 'INR', key_id: 'k' }, 201);
      }),
      http.post(billingUrl(jee, '/orders/order_j/verify'), () => billingOk({ order_id: 'order_j', status: 'paid', purchase: {} })),
    );
    renderWithProviders(<Checkout />);

    // The student's class 10 of the page's exam is preselected; the reference exam has no card.
    expect(await screen.findByRole('button', { name: /^Topper ICSE Academic$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^ICSE ?Prepare for your board exams/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: /Reference/ })).toBeNull();
    expect(await screen.findByRole('row', { name: /Final Mock Exam/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Class 11' }));
    expect(screen.getByRole('button', { name: 'Class 11' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^Basic ICSE$/ })).toBeInTheDocument();
    noOtherExam();

    await userEvent.click(screen.getByRole('button', { name: /^JEE ?Prepare for your entrance exam/ }));
    // The exam is named in the URL by its slice (the app has no route for it), replacing the history entry.
    expect(navigation.replace).toHaveBeenCalledWith('/purchase?exam=jee', { scroll: false });
    expect(screen.getByText('Target year')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^JEE 2027/ })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('switch', { name: 'Add ICSE' }));
    expect(within(screen.getByRole('list', { name: 'Your plan includes' })).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'JEE 2027',
      'ICSE · Class 11 PCM',
    ]);
    await userEvent.click(screen.getByRole('button', { name: /^Topper JEE \+ ICSE Monthly$/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Includes ICSE')).toBeInTheDocument();
    noOtherExam();

    await userEvent.click((await screen.findAllByRole('button', { name: /Pay ₹1,178.82/ }))[0]!);
    await waitFor(() => expect(options).not.toBeNull());
    expect(order).toEqual({ price_id: 92 });
    expect(options!.description).toBe('Topper JEE + ICSE Monthly · 1 Month · JEE 2027 + ICSE');
    options!.handler({ razorpay_payment_id: 'p', razorpay_order_id: 'order_j', razorpay_signature: 's' });
    expect(await screen.findByText('Payment Successful')).toBeInTheDocument();
    // The app has no pages for this exam yet (and nothing is remembered), so the student lands on Manage Plans.
    await userEvent.click(screen.getByRole('button', { name: 'Start learning' }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/manage-plans'));
  });

  it('opens a new exam named by its slice in ?exam= on the common /purchase page', async () => {
    navigation.searchParams = new URLSearchParams('exam=jee');
    server.use(...handlers());
    renderWithProviders(<Checkout />);
    expect(await screen.findByText('Target year')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^JEE ?Prepare for your entrance exam/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^ICSE ?Prepare/ })).toHaveAttribute('aria-pressed', 'false');
    navigation.searchParams = new URLSearchParams();
  });

  it('manages the new exams\' plans on the common page, named by the API, acting on each plan\'s own exam', async () => {
    let extended: unknown = null;
    server.use(
      http.get(overviewUrl, () =>
        billingOk({
          active: [
            overviewPlanDto({
              exam_id: 9, exam_name: 'JEE', exam_slice: 'jee', category: 'competitive', group_key: 'target_year',
              class_id: 30, class_title: 'JEE', target_year: 2027, scope_label: 'JEE 2027', purchase_id: 5, plan_id: 92,
              plan_name: 'Topper JEE + ICSE Monthly', cancel_falls_back_to_basic: true,
              history: [overviewHistoryDto({ plan_id: 92, invoice_number: 'J-1', plan_name: 'Topper JEE + ICSE Monthly' })],
            }),
            overviewPlanDto({
              exam_id: 7, exam_name: 'ICSE', exam_slice: 'icse', class_id: 10, class_title: 'Class 10', scope_label: 'Class 10',
              purchase_id: 6, plan_id: 70, plan_name: 'Basic ICSE', tier: 'basic', duration_months: 0, paid_amount: 0,
              is_free: true, expiry_date: null, history: [],
            }),
          ],
          expired: [
            {
              ...overviewHistoryDto({ payment_history_id: 400, plan_id: 71, invoice_number: 'I-400', plan_name: 'Topper ICSE Monthly', purchase_status: 'expired', ended_on: '2026-05-01T00:00:00.000Z' }),
              exam_id: 7, exam_name: 'ICSE', exam_slice: 'icse', category: 'board', group_key: 'class', class_title: 'Class 11', scope_label: 'Class 11 PCM',
            },
          ],
        }),
      ),
      http.post(billingUrl(jee, '/extensions'), async ({ request }) => {
        extended = await request.json();
        return billingOk({ months: 1, expiry_date: '2026-08-10T06:00:00.000Z' });
      }),
    );
    renderWithProviders(<ManagePlans />, { exam: icse });
    expect((await screen.findAllByText('Topper JEE + ICSE Monthly')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('JEE 2027').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ICSE · Class 10').length).toBeGreaterThan(0);
    // One filter chip per exam, from the API.
    expect(screen.getByRole('button', { name: 'JEE' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'ICSE' }));
    expect(screen.queryByText('Topper JEE + ICSE Monthly')).toBeNull();
    expect(screen.getAllByText('Topper ICSE Monthly · Class 11 PCM · ended 1 May 2026').length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'All courses' }));
    // The extension goes to the plan's own exam (category + id from the API).
    await userEvent.click(screen.getAllByRole('button', { name: 'Extend plan' })[0]!);
    await userEvent.type(screen.getByRole('textbox', { name: 'Coupon code' }), 'more');
    await userEvent.click(screen.getByRole('button', { name: 'Extend' }));
    expect(await screen.findByRole('heading', { name: 'Plan extended' })).toBeInTheDocument();
    expect(extended).toEqual({ coupon_code: 'more', purchase_id: 5 });
    noOtherExam();
  });
});
