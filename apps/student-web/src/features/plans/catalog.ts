import type { ExamCategory } from '@/shared/config/exams';
import { composePlanName, type PlanGroupKey } from '@/shared/lib/plan-name';
import { formatInr, formatPlanDate } from './money';

export { composePlanName } from '@/shared/lib/plan-name';

/** How long a plan runs: Basic (free, no end), Topper Monthly, the academic or target year, or any other length. */
export type PlanTier = 'basic' | 'monthly' | 'yearly' | 'custom';

/** How an exam's variants are picked: by class (with streams), or by target year. From the catalog's `group_key`. */
export type GroupKey = PlanGroupKey;

/** A course a combo plan unlocks (catalog `bundled`). */
export interface BundledCourse {
  exam_id: number;
  exam_title: string;
  class_id: number;
  class_title: string;
}

/** One price row of GET /api/v4/billing/:category/:examId/catalog. */
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
  /** Server-composed name ("Topper {exam} 2027 + {bundle}", "Topper {exam} Academic"); null on an older backend. */
  display_name?: string | null;
  tier?: PlanTier | null;
  /** Courses a combo unlocks; empty unless combo. */
  bundled?: BundledCourse[];
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
  /** "Class 11 PCB" or "{exam title} {target year}"; null on an older backend. */
  variant_label?: string | null;
  group_key?: GroupKey | null;
  /** Exams that can be added to this variant as a bundle. */
  bundle_options?: { exam_id: number; title: string }[];
}

export interface CatalogExam {
  examId: number;
  /** exam_table.exam_slice. */
  examKey: string;
  /** Exam name from the API. */
  title: string;
  category: ExamCategory | null;
  /** The app route of the exam (its dashboard), when the app has pages for it. */
  slug: string | null;
  variants: ApiVariant[];
}

export interface FeatureLimit {
  name: string;
  /** Display label from the API, when it sends one. */
  label: string | null;
  /** Unit from the API ('day', 'total' …), when it sends one. */
  unit: string | null;
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
  tier: PlanTier;
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
  /** What a combo unlocks besides the plan's own course. */
  bundled: BundledCourse[];
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

/** "CLASS 9" → "Class 9"; mixed case stays. */
export const titleCase = (value: string) =>
  /^[A-Z\s]+\d*$/.test(value) ? value.charAt(0) + value.slice(1).toLowerCase() : value;

const classNumber = (title: string) => {
  const match = /\d+/.exec(title);
  return match ? Number(match[0]) : Number.POSITIVE_INFINITY;
};

/** The catalog's tier, else the one its length implies (an older backend). */
export const tierOf = (tier: PlanTier | null | undefined, durationMonths: number): PlanTier =>
  tier ?? (durationMonths === 0 ? 'basic' : durationMonths === 1 ? 'monthly' : durationMonths === 12 ? 'yearly' : 'custom');

/** The tier word(s) of a plan name: "Basic", "Topper Monthly", "Topper", "Topper n Months". */
export function tierName(tier: PlanTier, durationMonths: number): string {
  if (tier === 'basic') return 'Basic';
  if (tier === 'monthly') return 'Topper Monthly';
  if (tier === 'yearly') return 'Topper';
  return `Topper ${durationMonths} Months`;
}

/** Unique exam titles of a combo's courses, in order. */
export const bundledTitles = (bundled: BundledCourse[]) => [...new Set(bundled.map((course) => course.exam_title).filter(Boolean))];

/** How the exam's variants are picked: the catalog's `group_key`, else its category's default (an older backend). */
export function groupKeyOf(exam: Pick<CatalogExam, 'category' | 'variants'> | null): GroupKey {
  const fromApi = exam?.variants.find((variant) => variant.group_key)?.group_key;
  if (fromApi) return fromApi;
  return exam?.category === 'competitive' ? 'target_year' : 'class';
}

/** "Class 11 PCB" or "{exam} 2027": the catalog's `variant_label`, else composed from the variant's own fields. */
export function variantLabel(variant: ApiVariant, examTitle: string): string {
  if (variant.variant_label) return variant.variant_label;
  if (variant.target_year != null && (variant.group_key ?? 'target_year') === 'target_year' && !variant.stream_name) {
    return [examTitle, variant.target_year].filter(Boolean).join(' ');
  }
  return `${titleCase(variant.class_title)}${variant.stream_name ? ` ${variant.stream_name}` : ''}`;
}

/** Exams that can be added to a variant: `bundle_options`, else the exams its combo plans unlock. */
export function bundleOptionTitles(variant: ApiVariant): string[] {
  const options = (variant.bundle_options ?? []).map((option) => option.title).filter(Boolean);
  if (options.length) return [...new Set(options)];
  return bundledTitles(variant.plans.flatMap((plan) => plan.bundled ?? []));
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

export interface PlanContext {
  /** Exam name from the API and how its variants are picked: name the plan when the server sends no display_name. */
  exam?: string;
  groupKey?: GroupKey;
  /** Bundle titles of the variant, for a combo without `bundled`. */
  bundles?: string[];
  targetYear?: number | null;
}

export function toPlans(apiPlans: ApiPlan[], context: PlanContext = {}, now: Date = new Date()): Plan[] {
  const paid = apiPlans.filter((plan) => plan.price > 0);
  const longest = paid.length ? Math.max(...paid.map((plan) => plan.duration_months)) : 0;
  return apiPlans.map((plan) => {
    const isFree = plan.price === 0;
    const isCurrent = Number(plan.is_active_plan) === 1;
    const validTill = planEndDate(plan, now);
    const months = billingMonths(plan, context.targetYear ?? null, now);
    const monthly = paid.find((p) => p.duration_months === 1 && p.is_combo === plan.is_combo);
    const tier = tierOf(plan.tier, plan.duration_months);
    const bundled = plan.bundled ?? [];
    const bundles = plan.is_combo ? (bundled.length ? bundledTitles(bundled) : (context.bundles ?? [])) : [];
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
      name:
        plan.display_name ||
        composePlanName({
          durationMonths: plan.duration_months,
          exam: context.exam,
          groupKey: context.groupKey ?? 'class',
          targetYear: context.targetYear,
          bundles,
        }),
      tier,
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
      bundled,
      isFree,
      isCurrent,
    };
  });
}

/** Class titles in order 6 → 12. */
export const sortedClassTitles = (variants: ApiVariant[]) =>
  [...new Set(variants.map((v) => v.class_title))].sort((a, b) => classNumber(a) - classNumber(b) || a.localeCompare(b));

/**
 * One card per target year: variants of the same `target_year` are merged (their plans, combo flag and bundle
 * options). Variants without a year keep a card of their own.
 */
export function yearVariants(variants: ApiVariant[], examTitle = ''): ApiVariant[] {
  const byYear = new Map<string, ApiVariant>();
  for (const variant of variants) {
    const key = variant.target_year != null ? `year-${variant.target_year}` : variant.variant_id;
    const entry = byYear.get(key);
    if (!entry) {
      byYear.set(key, {
        ...variant,
        variant_id: key,
        variant_label: variantLabel(variant, examTitle),
        plans: [...variant.plans],
        bundle_options: [...(variant.bundle_options ?? [])],
      });
      continue;
    }
    entry.plans.push(...variant.plans);
    entry.has_combo = entry.has_combo || variant.has_combo;
    for (const option of variant.bundle_options ?? []) {
      if (!entry.bundle_options!.some((known) => known.exam_id === option.exam_id)) entry.bundle_options!.push(option);
    }
  }
  return [...byYear.values()].sort((a, b) => (a.target_year ?? Infinity) - (b.target_year ?? Infinity));
}

/** Subtitle under a target-year card: the academic plan's end date, else June of the target year. */
export function variantValidityLabel(variant: ApiVariant, now: Date = new Date()): string {
  const annual = variant.plans.find((plan) => plan.duration_months === 12);
  const end = annual ? planEndDate(annual, now) : null;
  if (end) return `Till ${formatPlanDate(end)}`;
  return variant.target_year ? `Till June ${variant.target_year}` : '';
}

/* ---- comparison table ---- */

const GROUPS = ['AI & doubt support', 'Learning & study', 'Practice & assessments', 'More features'] as const;
type Group = (typeof GROUPS)[number];

/**
 * Nicer labels and a table group for known feature names (feature_limits.feature_name). Keyed by feature, never by
 * exam: an unknown feature still shows, under "More features", with the API's label or its own name.
 */
const FEATURES: Record<string, { label?: string; group: Group; unit?: string }> = {
  'step by step doubt solver': { label: 'Doubt Solver', group: 'AI & doubt support' },
  'atlas dashboard chat (no. of messages)': { label: 'Atlas Dashboard Chatbot', group: 'AI & doubt support' },
  'video lecture chats (no. of messages)': { label: 'Lecture Chatbot', group: 'AI & doubt support' },
  'atlas dashboard chatbot': { group: 'AI & doubt support' },
  'lecture chatbot': { group: 'AI & doubt support' },
  'post assessment chatbot': { group: 'AI & doubt support' },
  'video lecture': { label: 'Video Lectures', group: 'Learning & study' },
  notes: { label: 'Chapter Notes & Summaries', group: 'Learning & study' },
  'summary videos': { group: 'Learning & study' },
  'post assessment analysis': { group: 'Learning & study' },
  'pyq trends viewer': { group: 'Learning & study' },
  'practice dpps': { label: 'Daily Practice DPPs', group: 'Practice & assessments' },
  'chapter assessment': { group: 'Practice & assessments' },
  'chapter pyq': { group: 'Practice & assessments' },
  quiz: { group: 'Practice & assessments' },
  'unit test': { group: 'Practice & assessments' },
  'mid term': { group: 'Practice & assessments' },
  'final exam': { group: 'Practice & assessments' },
  'mock exam': { label: 'Final Mock Exam', group: 'Practice & assessments' },
  'pyq exam': { group: 'Practice & assessments' },
  'custom exam': { group: 'Practice & assessments' },
  'diagnostic test': { group: 'Practice & assessments', unit: 'total' },
};

/** "/ day" by default; the API's unit ("day", "total", "/ week") otherwise. */
const unitLabel = (unit: string | null | undefined) => {
  const value = unit?.trim();
  if (!value) return '/ day';
  if (value === 'total' || value.startsWith('/')) return value;
  return `/ ${value}`;
};

export const formatLimit = (limit: number | null, unit = '/ day') => (limit == null ? 'Unlimited' : `${limit} ${unit}`);

/** One row per /feature-limits row, grouped; the free plan reads the free limit, paid plans the premium one. */
export function buildSections(plans: Plan[], limits: FeatureLimit[]): CompareSection[] {
  const sections = new Map<Group, CompareSection>(GROUPS.map((title) => [title, { title, rows: [] }]));
  for (const limit of limits) {
    const known = FEATURES[limit.name.trim().toLowerCase()];
    const unit = unitLabel(limit.unit ?? known?.unit);
    sections.get(known?.group ?? 'More features')!.rows.push({
      label: limit.label || known?.label || limit.name.trim(),
      values: plans.map((plan) => formatLimit(plan.tier === 'basic' ? limit.free : limit.premium, unit)),
    });
  }
  return [...sections.values()].filter((section) => section.rows.length > 0);
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

export const columnEyebrow = (plan: Plan) => plan.badge?.label ?? (plan.isFree ? 'Essential' : 'Topper');

export const tierPill = (plan: Plan) =>
  plan.tier === 'basic'
    ? 'Free plan'
    : plan.tier === 'monthly'
      ? 'Monthly plan'
      : plan.tier === 'yearly'
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
