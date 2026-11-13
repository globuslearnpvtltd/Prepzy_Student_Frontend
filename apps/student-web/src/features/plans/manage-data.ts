import type { ExamCategory, ExamRef } from '@/shared/config/exams';
import { findExam } from '@/shared/config/exams';
import { routes } from '@/shared/config/routes';

/**
 * Manage Plans model. Everything comes from GET /api/v4/billing/overview (every exam in one call): active plans,
 * each with its own invoices, plus one list of invoices of ended plans. Labels come from the API (exam name,
 * display name, class or target year); behaviour differs only by the category's group key ('class' / 'target_year').
 */

export type GroupKey = 'class' | 'target_year';

/** The exam a plan belongs to: its name, and the category + id its billing actions use. */
export interface PlanExamInfo {
  /** Filter key: the exam id ('' when the API has none). */
  key: string;
  name: string;
  /** For the exam-scoped actions (extend, cancel); null when the exam isn't a known category. */
  ref: ExamRef | null;
  /** The app's route segment for the exam (purchase links); null when the app has no pages for it. */
  slug: string | null;
}

export interface ActivePlan {
  key: string;
  exam: PlanExamInfo;
  groupKey: GroupKey;
  purchaseId: number;
  planId: number;
  name: string;
  /** "{exam} · Class 12 PCB", or "{exam} 2027" when the scope already names the exam. */
  chip: string;
  /** "Class 12 PCB" / "{exam} 2027", used in titles. */
  scopeLabel: string;
  startDate: string;
  endDate: string;
  rawStart: string | null;
  rawExpiry: string | null;
  durationMonths: number;
  paidAmount: number;
  classId: number | null;
  hasPendingPlan: boolean;
  pendingStartDate: string | null;
  pendingPurchaseDate: string | null;
  /** Cancelling moves the student to the free Basic plan. */
  fallsBackToBasic: boolean;
  history: HistoryRow[];
}

export interface HistoryRow {
  key: string;
  examKey: string;
  invoiceNo: string | null;
  date: string;
  plan: string;
  amount: string;
  /** "Refunded" when the purchase was refunded. */
  note: string;
  invoiceUrl: string | null;
}

export interface Overview {
  active: ActivePlan[];
  expired: HistoryRow[];
  /** Exams present, in order of appearance (filter chips). */
  exams: { key: string; name: string }[];
}

export interface RefundPreview {
  canCancel: boolean;
  reason: 'free_plan' | 'refund_already_used' | 'refund_window_over' | null;
  refundAmount: number;
  refundDeadline: string | null;
}

export interface RefundDetails {
  refundId: number;
  refundAmount: number;
  paymentMethod: string | null;
  vpa: string | null;
  bank: string | null;
  wallet: string | null;
}

type Raw = Record<string, unknown>;

const text = (value: unknown) => (typeof value === 'string' ? value : value == null ? '' : String(value));
const num = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const numOrNull = (value: unknown) => (value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value));
const textOrNull = (value: unknown) => text(value) || null;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const toDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** "4 Nov 2026" */
export const formatDate = (value?: string | Date | null) => {
  const date = value instanceof Date ? value : toDate(value);
  if (!date) return '';
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
};

/** "₹1,499" / "₹588.82" */
export const formatRupees = (amount: number | string, symbol = '₹') => {
  const n = Number(amount);
  return Number.isFinite(n) ? `${symbol}${n.toLocaleString('en-IN')}` : `${symbol}${amount}`;
};

const CATEGORIES: readonly ExamCategory[] = ['board', 'competitive', 'reference'];

function examInfo(raw: Raw): PlanExamInfo {
  const examId = numOrNull(raw.exam_id);
  const category = text(raw.category).toLowerCase() as ExamCategory;
  const design = findExam(text(raw.exam_slice));
  return {
    key: examId === null ? '' : String(examId),
    name: text(raw.exam_name) || design?.label || '',
    ref: examId !== null && CATEGORIES.includes(category) ? { category, examId } : null,
    slug: design && design.category === category ? design.slug : null,
  };
}

const groupKeyOf = (value: unknown): GroupKey => (value === 'target_year' ? 'target_year' : 'class');

/** The API's scope label; class titles stored upper-case ("CLASS 12 PCM") read "Class 12 PCM", as before. */
const scopeOf = (raw: Raw) => text(raw.scope_label).replace(/^class\b/i, 'Class');

/** The scope with its exam: "{exam} · Class 12 PCB"; a scope that already starts with the exam name stays as is. */
export const chipFor = (examName: string, scope: string) =>
  !examName ? scope : !scope ? examName : scope.toLowerCase().startsWith(examName.toLowerCase()) ? scope : `${examName} · ${scope}`;

function toHistoryRow(raw: Raw, examKey: string, groupKey: GroupKey, scope: string): HistoryRow {
  const ended = text(raw.ended_on);
  return {
    key: `pay-${num(raw.payment_history_id)}`,
    examKey,
    invoiceNo: textOrNull(raw.invoice_number),
    date: formatDate(text(raw.paid_on)),
    // Class plans' names don't carry the class, so it's added; target-year names already carry the year.
    plan: [text(raw.plan_name), groupKey === 'class' ? scope : '', ended ? `ended ${formatDate(ended)}` : '']
      .filter(Boolean)
      .join(' · '),
    amount: formatRupees(num(raw.amount)),
    note: text(raw.purchase_status) === 'refunded' ? 'Refunded' : '',
    invoiceUrl: textOrNull(raw.invoice_url),
  };
}

export function toActivePlan(raw: Raw): ActivePlan {
  const exam = examInfo(raw);
  const groupKey = groupKeyOf(raw.group_key);
  const scope = scopeOf(raw);
  const months = num(raw.duration_months);
  const free = months === 0;
  const expiry = textOrNull(raw.expiry_date);
  const history = Array.isArray(raw.history) ? (raw.history as Raw[]) : [];
  return {
    key: `plan-${num(raw.plan_id)}`,
    exam,
    groupKey,
    purchaseId: num(raw.purchase_id),
    planId: num(raw.plan_id),
    name: text(raw.plan_name),
    chip: chipFor(exam.name, scope),
    scopeLabel: scope,
    startDate: formatDate(text(raw.purchase_start_date)),
    endDate: free || !expiry ? 'No end date' : formatDate(expiry),
    rawStart: textOrNull(raw.purchase_start_date),
    rawExpiry: free ? null : expiry,
    durationMonths: months,
    paidAmount: num(raw.paid_amount),
    classId: numOrNull(raw.class_id),
    hasPendingPlan: raw.has_pending_plan === true || num(raw.has_pending_plan) === 1,
    pendingStartDate: textOrNull(raw.pending_start_date),
    pendingPurchaseDate: textOrNull(raw.pending_purchase_date),
    fallsBackToBasic: raw.cancel_falls_back_to_basic === true,
    history: history.map((row) => toHistoryRow(row, exam.key, groupKey, scope)),
  };
}

export function toExpiredRow(raw: Raw): HistoryRow {
  return toHistoryRow(raw, examInfo(raw).key, groupKeyOf(raw.group_key), scopeOf(raw));
}

export function toOverview(raw: { active?: Raw[]; expired?: Raw[] }): Overview {
  const active = (raw.active ?? []).map(toActivePlan);
  const exams = new Map<string, string>();
  const addExam = (exam: PlanExamInfo) => exam.key && !exams.has(exam.key) && exams.set(exam.key, exam.name);
  active.forEach((plan) => addExam(plan.exam));
  (raw.expired ?? []).forEach((row) => addExam(examInfo(row)));
  return {
    active,
    expired: (raw.expired ?? []).map(toExpiredRow),
    exams: [...exams].map(([key, name]) => ({ key, name })),
  };
}

export function toRefundPreview(raw: Raw): RefundPreview {
  const reason = text(raw.reason);
  return {
    canCancel: raw.can_cancel === true,
    reason: reason === 'free_plan' || reason === 'refund_already_used' || reason === 'refund_window_over' ? reason : null,
    refundAmount: num(raw.refund_amount),
    refundDeadline: textOrNull(raw.refund_deadline),
  };
}

export function toRefundDetails(raw: Raw | null | undefined): RefundDetails | null {
  if (!raw) return null;
  return {
    refundId: num(raw.refund_id),
    refundAmount: num(raw.refund_amount),
    paymentMethod: textOrNull(raw.payment_method),
    vpa: textOrNull(raw.vpa),
    bank: textOrNull(raw.bank),
    wallet: textOrNull(raw.wallet),
  };
}

// Razorpay netbanking codes ("BARB_R" = Bank of Baroda retail) for the banks students use most
const BANK_NAMES: Record<string, string> = {
  SBIN: 'State Bank of India', HDFC: 'HDFC Bank', ICIC: 'ICICI Bank', UTIB: 'Axis Bank', KKBK: 'Kotak Mahindra Bank',
  BARB: 'Bank of Baroda', PUNB: 'Punjab National Bank', CNRB: 'Canara Bank', UBIN: 'Union Bank of India',
  BKID: 'Bank of India', IOBA: 'Indian Overseas Bank', IDIB: 'Indian Bank', YESB: 'Yes Bank', IDFB: 'IDFC FIRST Bank',
  INDB: 'IndusInd Bank', FDRL: 'Federal Bank', MAHB: 'Bank of Maharashtra', UCBA: 'UCO Bank', CBIN: 'Central Bank of India',
};

// Older rows may still carry the text "null" for an unused field
const clean = (value?: string | null) => (value && value.toLowerCase() !== 'null' ? value : null);

const bankName = (code: string) => {
  const base = code.toUpperCase().replace(/_[A-Z]$/, '');
  return BANK_NAMES[base] ?? base;
};

/** "UPI · riya@okaxis", "Netbanking · HDFC Bank", "Wallet · Paytm", or just the method; null when nothing was stored. */
export const refundDestination = (details: RefundDetails | null) => {
  const rawMethod = clean(details?.paymentMethod)?.toLowerCase();
  if (!details || !rawMethod) return null;
  const method = rawMethod === 'upi' ? 'UPI' : rawMethod.charAt(0).toUpperCase() + rawMethod.slice(1);
  let detail: string | null = null;
  if (rawMethod === 'upi') detail = clean(details.vpa);
  else if (rawMethod === 'netbanking') {
    const bank = clean(details.bank);
    detail = bank && bankName(bank);
  } else if (rawMethod === 'wallet') detail = clean(details.wallet);
  return detail ? `${method} · ${detail}` : method;
};

export const REFUND_WINDOW_DAYS = 15;

export const isFree = (plan: ActivePlan) => plan.durationMonths === 0;
/** The extension coupon works on monthly-type plans only (the server skips 0 and 12 months). */
export const canExtend = (plan: ActivePlan) => ![0, 12].includes(plan.durationMonths) && !!plan.exam.ref;
export const canCancel = (plan: ActivePlan) => !isFree(plan) && !!plan.exam.ref;
/** Upgrade sits on free and monthly plans; a full-year plan has nothing to upgrade to. */
export const canUpgrade = (plan: ActivePlan) => plan.durationMonths !== 12 && !!plan.exam.slug;

/** Day 1 is the start day, as on the server. */
export const daysSinceStart = (plan: ActivePlan) => {
  const start = toDate(plan.rawStart);
  if (!start) return null;
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((today - startDay) / 86_400_000) + 1;
};

export const refundDeadline = (plan: ActivePlan) => {
  const start = toDate(plan.rawStart);
  return start ? new Date(start.getFullYear(), start.getMonth(), start.getDate() + REFUND_WINDOW_DAYS - 1) : null;
};

/** For the note under the invoices; the refund preview decides the actual cancel. */
export const inRefundWindow = (plan: ActivePlan) => {
  const days = daysSinceStart(plan);
  return days !== null && days <= REFUND_WINDOW_DAYS;
};

/** The unit a refund is counted per: a class (class plans) or an exam (target-year plans). */
export const refundUnit = (plan: ActivePlan) => (plan.groupKey === 'class' ? 'class' : 'exam');

/** Upgrade / buy target: the common purchase page of the plan's exam, with its class preselected for class plans. */
export const purchaseHrefFor = (plan: ActivePlan): string | null =>
  plan.exam.slug
    ? routes.plansPurchase(plan.exam.slug, plan.groupKey === 'class' && plan.classId ? { CLASSID: plan.classId } : undefined)
    : null;
