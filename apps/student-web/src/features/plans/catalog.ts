import { findExam, type ExamCategory } from '@/shared/config/exams';
import { formatInr, formatPlanDate } from './money';

/** /api/v2/purchase/purchase-plans, as the backend sends it. */
export interface ApiPlan {
  price_id: number;
  plan_id: number;
  plan_title: string;
  duration_months: number;
  price: number;
  cost_price: number;
  exam_date: string | null;
  is_combo: boolean;
  is_active_plan: 0 | 1 | boolean;
}

export interface ApiVariant {
  variant_id: string;
  class_id: number;
  class_title: string;
  stream_id: number | null;
  stream_name: string | null;
  target_year: number | null;
  has_combo: boolean;
  plans: ApiPlan[];
}

export interface CatalogExam {
  examId: number;
  /** exam_table.exam_slice ('cbse', 'neet-ug', 'jee'). */
  examKey: string;
  title: string;
  /** Category from the exam registry; null for exams the app doesn't run yet (JEE). */
  category: ExamCategory | null;
  variants: ApiVariant[];
}

export interface FeatureLimit {
  name: string;
  /** null = unlimited */
  free: number | null;
  premium: number | null;
}

export type BadgeTone = 'current' | 'popular' | 'value';

/** One purchasable plan card. */
export interface Plan {
  priceId: number;
  planId: number;
  name: string;
  durationName: string;
  badge: { label: string; tone: BadgeTone } | null;
  price: number;
  mrp: number | null;
  saved: number;
  validTill: Date | null;
  validityLabel: string;
  perDay: number | null;
  durationMonths: number;
  isCombo: boolean;
  isFree: boolean;
  isCurrent: boolean;
}

export type Cell = string | boolean;
export interface CompareSection {
  title: string;
  rows: { label: string; values: Cell[] }[];
}

export const GST_RATE = 0.18;
export const withGst = (amount: number) => Math.round(amount * (1 + GST_RATE));

/** Adds months without rolling over: 31 Jan + 1 month → 28 Feb. */
export function addMonths(months: number, now: Date = new Date()): Date {
  const day = now.getDate();
  const date = new Date(now);
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDay));
  return date;
}

/** The exam's month and year as they land in IST, so an exam date never slips a day. */
function istMonthYear(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'numeric' })
    .formatToParts(date);
  const part = (type: 'year' | 'month') => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: part('year'), month: part('month') };
}

/** Whole months left to the exam, counting the current month. Never below 1. */
export function monthsUntilExam(targetYear: number, examMonth: number, now: Date = new Date()): number {
  return Math.max((targetYear - now.getFullYear()) * 12 + (examMonth - (now.getMonth() + 1)) + 1, 1);
}

/** The academic-year plan bills against the months left to the exam; others against their own length. */
function billingMonths(plan: ApiPlan, targetYear: number | null, now: Date): number {
  if (plan.duration_months !== 12 || !plan.exam_date) return plan.duration_months;
  const exam = new Date(plan.exam_date);
  if (Number.isNaN(exam.getTime())) return plan.duration_months;
  const { year, month } = istMonthYear(exam);
  return monthsUntilExam(targetYear ?? year, month, now);
}

/** Flat 30-day months, matching the plan sheet. */
export const perDayRate = (price: number, months: number) =>
  price > 0 && months > 0 ? Math.max(1, Math.floor(price / (months * 30))) : null;

const pluralize = (count: number, unit: string) => `${count} ${unit}${count > 1 ? 's' : ''}`;

/** 1 → "1 Month", 12 → "1 Year", 18 → "1 Year 6 Months". */
export function durationLabel(months: number): string {
  if (months <= 0) return '';
  const parts: string[] = [];
  if (months >= 12) parts.push(pluralize(Math.floor(months / 12), 'Year'));
  if (months % 12) parts.push(pluralize(months % 12, 'Month'));
  return parts.join(' ');
}

export const yearFromTitle = (title: string): number | null => {
  const match = /(20\d{2})/.exec(title ?? '');
  return match ? Number(match[1]) : null;
};

/** "CLASS 9" → "Class 9"; mixed case stays. */
export const titleCase = (value: string) =>
  /^[A-Z\s]+\d*$/.test(value) ? value.charAt(0) + value.slice(1).toLowerCase() : value;

const classNumber = (title: string) => {
  const match = /\d+/.exec(title);
  return match ? Number(match[0]) : Number.POSITIVE_INFINITY;
};

/** Card names follow the plan sheet: "Topper NEET 2027 + CBSE", "Topper Monthly". */
export function planNameFor(plan: ApiPlan, category: ExamCategory | null, targetYear: number | null): string {
  const suffix = plan.is_combo ? ' + CBSE' : '';
  if (category === 'competitive') {
    if (plan.duration_months === 0) return `Basic NEET${suffix}`;
    if (plan.duration_months === 1) return `Topper NEET${suffix} Monthly`;
    if (plan.duration_months === 12) {
      return `Topper NEET ${yearFromTitle(plan.plan_title) ?? targetYear ?? 'Target Year'}${suffix}`;
    }
    return `Topper NEET ${durationLabel(plan.duration_months)}${suffix}`;
  }
  if (plan.duration_months === 0) return `Basic${suffix}`;
  if (plan.duration_months === 1) return `Topper Monthly${suffix}`;
  if (plan.duration_months === 12) return `Topper Academic${suffix}`;
  return `Topper ${durationLabel(plan.duration_months)}${suffix}`;
}

/** 0 → no end (free forever); 12 → the exam date when still ahead; n → n months from today. */
export function planEndDate(plan: ApiPlan, now: Date = new Date()): Date | null {
  if (plan.duration_months === 0) return null;
  if (plan.duration_months === 12 && plan.exam_date) {
    const exam = new Date(plan.exam_date);
    if (!Number.isNaN(exam.getTime()) && exam.getTime() > now.getTime()) return exam;
  }
  return addMonths(plan.duration_months, now);
}

/** Academic plan: monthly × months-left − price; everything else: cost_price − price. */
function planSaving(plan: ApiPlan, months: number, monthly: ApiPlan | undefined): number {
  if (plan.duration_months === 12 && monthly) return Math.max(0, monthly.price * months - plan.price);
  return Math.max(0, plan.cost_price - plan.price);
}

export function toPlans(
  apiPlans: ApiPlan[],
  category: ExamCategory | null,
  targetYear: number | null,
  now: Date = new Date(),
): Plan[] {
  const paid = apiPlans.filter((plan) => plan.price > 0);
  const longest = paid.length ? Math.max(...paid.map((plan) => plan.duration_months)) : 0;
  return apiPlans.map((plan) => {
    const isFree = plan.price === 0;
    const isCurrent = Number(plan.is_active_plan) === 1;
    const validTill = planEndDate(plan, now);
    const months = billingMonths(plan, targetYear, now);
    const monthly = paid.find((p) => p.duration_months === 1 && p.is_combo === plan.is_combo);
    const badge: Plan['badge'] = isCurrent
      ? { label: 'Current plan', tone: 'current' }
      : plan.duration_months === 1
        ? { label: 'Most popular', tone: 'popular' }
        : plan.duration_months === longest && longest > 1
          ? { label: 'Best value', tone: 'value' }
          : null;
    return {
      priceId: plan.price_id,
      planId: plan.plan_id,
      name: planNameFor(plan, category, targetYear),
      durationName: plan.duration_months === 0 ? 'Free' : durationLabel(plan.duration_months),
      badge,
      price: plan.price,
      mrp: plan.cost_price > plan.price ? plan.cost_price : null,
      saved: isFree ? 0 : planSaving(plan, months, monthly),
      validTill,
      validityLabel: validTill ? `Till ${formatPlanDate(validTill)}` : 'Free forever',
      perDay: perDayRate(plan.price, months),
      durationMonths: plan.duration_months,
      isCombo: plan.is_combo,
      isFree,
      isCurrent,
    };
  });
}

/** Class titles in order 6 → 12. */
export const sortedClassTitles = (variants: ApiVariant[]) =>
  [...new Set(variants.map((v) => v.class_title))].sort((a, b) => classNumber(a) - classNumber(b) || a.localeCompare(b));

/** The backend returns a competitive exam as one variant; split it by the year in each plan title. */
export function yearVariants(variants: ApiVariant[]): ApiVariant[] {
  const byYear = new Map<number, ApiVariant>();
  for (const variant of variants) {
    for (const plan of variant.plans) {
      const year = yearFromTitle(plan.plan_title);
      if (!year) continue;
      const entry = byYear.get(year) ?? {
        ...variant,
        variant_id: `year-${year}`,
        class_title: `NEET ${year}`,
        target_year: year,
        has_combo: false,
        plans: [],
      };
      entry.plans.push(plan);
      if (plan.is_combo) entry.has_combo = true;
      byYear.set(year, entry);
    }
  }
  return [...byYear.values()].sort((a, b) => (a.target_year ?? 0) - (b.target_year ?? 0));
}

/** Subtitle under a target-year card: the academic plan's end date, else June of the target year. */
export function variantValidityLabel(variant: ApiVariant, now: Date = new Date()): string {
  const annual = variant.plans.find((plan) => plan.duration_months === 12);
  const end = annual ? planEndDate(annual, now) : null;
  if (end) return `Till ${formatPlanDate(end)}`;
  return variant.target_year ? `Till June ${variant.target_year}` : '';
}

/* ---- comparison table ---- */

const LIMIT_SECTIONS: Record<'board' | 'competitive', { title: string; rows: { label: string; feature: string; unit?: string }[] }[]> = {
  competitive: [
    {
      title: 'AI & doubt support',
      rows: [
        { label: 'Doubt Solver', feature: 'Step by Step Doubt Solver' },
        { label: 'Atlas Dashboard Chatbot', feature: 'Atlas Dashboard Chat (No. of messages)' },
        { label: 'Lecture Chatbot', feature: 'Video Lecture Chats (No. of messages)' },
      ],
    },
    {
      title: 'Learning & study',
      rows: [
        { label: 'Video Lectures', feature: 'Video Lecture' },
        { label: 'Chapter Notes & Summaries', feature: 'Notes' },
        { label: 'Post Assessment Analysis', feature: 'Post Assessment Analysis' },
      ],
    },
    {
      title: 'Practice & assessments',
      rows: [
        { label: 'Daily Practice DPPs', feature: 'Practice DPPs' },
        { label: 'Chapter Assessment', feature: 'Chapter Assessment' },
        { label: 'Chapter PYQ', feature: 'Chapter PYQ' },
        { label: 'Final Mock Exam', feature: 'Mock Exam' },
        { label: 'PYQ Exam', feature: 'PYQ Exam' },
      ],
    },
  ],
  board: [
    {
      title: 'AI & doubt support',
      rows: [
        { label: 'Atlas Dashboard Chatbot', feature: 'Atlas Dashboard Chatbot' },
        { label: 'Lecture Chatbot', feature: 'Lecture Chatbot' },
        { label: 'Post Assessment Chatbot', feature: 'Post Assessment Chatbot' },
      ],
    },
    {
      title: 'Learning & study',
      rows: [
        { label: 'Video Lectures', feature: 'Video Lecture' },
        { label: 'Chapter Notes & Summaries', feature: 'Notes' },
        { label: 'Summary Videos', feature: 'Summary Videos' },
        { label: 'Post Assessment Analysis', feature: 'Post Assessment Analysis' },
        { label: 'PYQ Trends Viewer', feature: 'PYQ Trends Viewer' },
      ],
    },
    {
      title: 'Practice & assessments',
      rows: [
        { label: 'Quiz', feature: 'Quiz' },
        { label: 'Unit Test', feature: 'Unit Test' },
        { label: 'Mid Term', feature: 'Mid Term' },
        { label: 'Final Exam', feature: 'Final Exam' },
        { label: 'Final Mock Exam', feature: 'Mock Exam' },
        { label: 'PYQ Exam', feature: 'PYQ Exam' },
        { label: 'Custom Exam', feature: 'Custom Exam' },
        { label: 'Diagnostic Test', feature: 'Diagnostic Test', unit: 'total' },
      ],
    },
  ],
};

/** Competitive plans also unlock the board classes — not a counted limit. */
const BOARD_ACCESS: CompareSection = {
  title: 'CBSE access',
  rows: [
    { label: 'CBSE Class 11 & 12', values: ['Starter limits', 'Topper caps'] },
    { label: 'CBSE Board Preparation', values: ['Starter tier', 'Topper tier'] },
  ],
};

export const formatLimit = (limit: number | null, unit = '/ day') => (limit == null ? 'Unlimited' : `${limit} ${unit}`);

/** One value per plan column: the free plan reads the free limit, paid plans the premium one. */
export function buildSections(category: ExamCategory | null, plans: Plan[], limits: FeatureLimit[]): CompareSection[] {
  if (category !== 'board' && category !== 'competitive') return [];
  const byName = new Map(limits.map((limit) => [limit.name.trim().toLowerCase(), limit]));
  const sections: CompareSection[] = LIMIT_SECTIONS[category].map((section) => ({
    title: section.title,
    rows: section.rows.flatMap((spec) => {
      const limit = byName.get(spec.feature.toLowerCase());
      if (!limit) return [];
      return [
        {
          label: spec.label,
          values: plans.map((plan) => formatLimit(plan.durationMonths === 0 ? limit.free : limit.premium, spec.unit)),
        },
      ];
    }),
  }));
  if (category === 'competitive') {
    sections.push({
      title: BOARD_ACCESS.title,
      rows: BOARD_ACCESS.rows.map((row) => ({
        label: row.label,
        values: plans.map((plan) => (plan.durationMonths === 0 ? row.values[0]! : row.values[1]!)),
      })),
    });
  }
  return sections.filter((section) => section.rows.length > 0);
}

/** "Pricing" and "Validity" rows that close the comparison table. */
export function priceSection(plans: Plan[]): CompareSection {
  return {
    title: 'Price',
    rows: [
      {
        label: 'Pricing',
        values: plans.map((plan) =>
          plan.isFree
            ? 'Free'
            : plan.durationMonths === 1
              ? `${formatInr(plan.price)} / 30 days`
              : plan.durationMonths === 12
                ? `${formatInr(plan.price)} / year`
                : `${formatInr(plan.price)} / ${plan.durationName.toLowerCase()}`,
        ),
      },
      { label: 'Validity', values: plans.map((plan) => (plan.isFree ? 'Forever' : plan.validityLabel)) },
    ],
  };
}

export const columnName = (plan: Plan) =>
  plan.durationMonths === 0
    ? 'Basic'
    : plan.durationMonths === 1
      ? 'Topper Monthly'
      : plan.durationMonths === 12
        ? 'Topper Annual'
        : `Topper ${plan.durationName}`;

export const columnEyebrow = (plan: Plan) => plan.badge?.label ?? (plan.isFree ? 'Essential' : 'Topper');

export const tierPill = (plan: Plan) =>
  plan.durationMonths === 0
    ? 'Free plan'
    : plan.durationMonths === 1
      ? 'Monthly plan'
      : plan.durationMonths === 12
        ? 'Annual plan'
        : `${plan.durationName} plan`;

export const priceCadence = (plan: Plan) => (plan.isFree ? 'no payment' : plan.durationMonths === 1 ? 'per month' : 'one-time');

/** Per-day rates are exact only for the monthly plan. */
export const perDayLabel = (plan: Plan) => `${plan.durationMonths === 1 ? '' : '≈'}${formatInr(plan.perDay ?? 0)}`;

/** Plan-details line for the outcome overlays. */
export const accessLabel = (plan: Plan) =>
  plan.durationMonths === 0 ? 'Free forever' : plan.durationMonths === 1 ? '30-day access' : '';

export const planHighlights = (plan: Plan, scope: string): string[] =>
  plan.isFree
    ? [`Core ${scope} lessons and notes`, 'Daily practice with starter limits', 'Atlas AI support, 10 chats a day', 'Upgrade anytime to unlock Topper']
    : [`Topper access for ${scope}`, 'Full Mock Tests, PYQs & Custom Exams', 'Step-by-step Atlas AI support', '10× higher daily limits'];

/** Display-only bill; the charge itself comes from the backend order. */
export function bill(price: number, discountPercent: number) {
  const discount = Math.round((price * discountPercent) / 100);
  const subtotal = Math.max(0, price - discount);
  const gst = Math.round(subtotal * GST_RATE);
  return { price, discount, subtotal, gst, total: subtotal + gst };
}

/** Normalises the catalog response; drops inactive exams. */
export function toCatalog(exams: { exam_id: number; exam_key: string; title: string; is_active?: number; variants?: ApiVariant[] }[]): CatalogExam[] {
  return exams
    .filter((exam) => exam.is_active !== 0)
    .map((exam) => ({
      examId: exam.exam_id,
      examKey: exam.exam_key,
      title: exam.title,
      category: findExam(exam.exam_key)?.category ?? null,
      variants: exam.variants ?? [],
    }));
}
