import type { CatalogExam } from '@/features/plans';
import type { ExamConfig } from '@/shared/config/exams';
import { apiClient } from '@/shared/lib/api-client';
import { ApiError } from '@/shared/lib/errors';
import { composePlanName } from '@/shared/lib/plan-name';
import { assertOk } from '@/shared/lib/unwrap';

type Envelope<T> = { success?: boolean; message?: string; error?: string; data?: T };

export type Tier = 'free' | 'paid';
export type FriendStatus = 'joined' | 'paid' | 'blocked';

export interface ReferralSummary {
  code: string;
  shareLink: string;
  tier: Tier;
  balance: number;
  friendCount: number;
  friendJoinCredit: number;
}

export interface Friend {
  id: number;
  status: FriendStatus;
  paidAt: string | null;
  name: string | null;
  phone: string | null;
  examName: string | null;
  signupCredit: number;
  conversionCredit: number | null;
}

export interface StatementRow {
  id: number;
  entryType: string;
  amount: number;
  balanceAfter: number;
  reason: string | null;
  referralId: number | null;
  examId: number | null;
  tier: Tier | null;
  basis: { paidAmount?: number; tier?: Tier; examId?: number } | null;
  createdAt: string;
}

export interface EarnRate {
  examId: number | null;
  flat: boolean;
  signupFree: number;
  signupPaid: number;
  rateFree: number | null;
  ratePaid: number | null;
  floor: number | null;
  cap: number | null;
  flatAmount: number | null;
}

export interface PlanOption {
  priceId: number;
  examId: number;
  classId: number;
  group: string;
  label: string;
  phrase: string;
  price: number;
  durationMonths: number;
  isCombo: boolean;
}

export interface Reward {
  join: number;
  percent: number;
  floor: number | null;
  cap: number | null;
  flat: number | null;
}

export interface Hub {
  summary: ReferralSummary;
  friends: Friend[];
  statement: StatementRow[];
  rates: EarnRate[];
}

export const TIER_LABEL: Record<Tier, string> = { free: 'Basic', paid: 'Topper' };

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
const rows = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object') : [];

export const inr = (value: number) => `₹${Math.round(value).toLocaleString('en-IN')}`;
const trimNumber = (value: number) => (Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2))));

export function toSummary(raw: unknown): ReferralSummary {
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    code: text(row.code) ?? '',
    shareLink: text(row.shareLink) ?? '',
    tier: row.tier === 'paid' ? 'paid' : 'free',
    balance: toNumber(row.balance) ?? 0,
    friendCount: toNumber(row.friendCount) ?? 0,
    friendJoinCredit: toNumber(row.friendJoinCredit) ?? 0,
  };
}

export const toFriends = (raw: unknown): Friend[] =>
  rows(raw).map((row) => ({
    id: toNumber(row.id) ?? 0,
    status: row.status === 'paid' || row.status === 'blocked' ? row.status : 'joined',
    paidAt: text(row.paid_at),
    name: text(row.friend_name),
    phone: text(row.friend_phone),
    examName: text(row.exam_name),
    signupCredit: toNumber(row.signup_credit_amount) ?? 0,
    conversionCredit: toNumber(row.conversion_credit_amount),
  }));

/** mysql2 returns JSON columns parsed or as text. */
function readBasis(value: unknown): StatementRow['basis'] {
  if (!value) return null;
  if (typeof value === 'object') return value as StatementRow['basis'];
  try {
    return JSON.parse(String(value)) as StatementRow['basis'];
  } catch {
    return null;
  }
}

export const toStatement = (raw: unknown): StatementRow[] =>
  rows(raw).map((row) => ({
    id: toNumber(row.id) ?? 0,
    entryType: text(row.entry_type) ?? '',
    amount: toNumber(row.amount) ?? 0,
    balanceAfter: toNumber(row.balance_after) ?? 0,
    reason: text(row.reason),
    referralId: toNumber(row.referral_id),
    examId: toNumber(row.exam_id),
    tier: row.tier_snapshot === 'paid' || row.tier_snapshot === 'free' ? row.tier_snapshot : null,
    basis: readBasis(row.basis_snapshot),
    createdAt: text(row.created_at) ?? '',
  }));

export const toRates = (raw: unknown): EarnRate[] =>
  rows(raw).map((row) => ({
    examId: toNumber(row.exam_id),
    flat: row.conversion_type === 'flat',
    signupFree: toNumber(row.signup_credit_free) ?? 0,
    signupPaid: toNumber(row.signup_credit_paid) ?? 0,
    rateFree: toNumber(row.conversion_rate_free),
    ratePaid: toNumber(row.conversion_rate_paid),
    floor: toNumber(row.conversion_floor),
    cap: toNumber(row.conversion_cap),
    flatAmount: toNumber(row.conversion_flat_amount),
  }));

/** The exam's rate, falling back to the global row (same as the backend). */
export const rateFor = (rates: EarnRate[], examId?: number | null): EarnRate | null =>
  (examId !== null && examId !== undefined ? rates.find((rate) => rate.examId === examId) : undefined) ??
  rates.find((rate) => rate.examId === null) ??
  rates[0] ??
  null;

export function rewardFor(rate: EarnRate | null, tier: Tier): Reward {
  if (!rate) return { join: 0, percent: 0, floor: null, cap: null, flat: null };
  const paid = tier === 'paid';
  return {
    join: paid ? rate.signupPaid : rate.signupFree,
    percent: (paid ? rate.ratePaid : rate.rateFree) ?? 0,
    floor: rate.floor,
    cap: rate.cap,
    flat: rate.flat ? (rate.flatAmount ?? 0) : null,
  };
}

/** Same maths as the backend's processReferralConversion. */
export function shareOf(reward: Reward, price: number): number {
  if (reward.flat !== null) return reward.flat;
  let share = (price * reward.percent) / 100;
  if (reward.floor !== null) share = Math.max(share, reward.floor);
  if (reward.cap !== null) share = Math.min(share, reward.cap);
  return Math.round(share);
}

export const shareLabel = (reward: Reward) => (reward.flat !== null ? inr(reward.flat) : `${trimNumber(reward.percent)}%`);

export function capClause(reward: Reward): string {
  if (reward.flat !== null) return '';
  if (reward.floor !== null && reward.cap !== null) return `never less than ${inr(reward.floor)} or more than ${inr(reward.cap)}`;
  if (reward.floor !== null) return `never less than ${inr(reward.floor)}`;
  if (reward.cap !== null) return `never more than ${inr(reward.cap)}`;
  return '';
}

export function topperGainNote(free: Reward, paid: Reward): string {
  const doubles = paid.join === free.join * 2 && (paid.flat ?? paid.percent) === (free.flat ?? free.percent) * 2;
  return doubles ? 'Earns twice as much' : 'Earns more';
}

export function toggleNote(view: Tier, own: Tier, gain: string): { text: string | null; tone: 'muted' | 'amber' } {
  if (view === own) return { text: `You are on ${TIER_LABEL[own]}`, tone: 'muted' };
  if (view === 'paid') return { text: gain, tone: 'amber' };
  return { text: null, tone: 'muted' };
}

/** "Class 12" for an all-caps class title; other names stay as sent. */
const titleCase = (value: string) => (/^[A-Z\s]+\d*$/.test(value) ? value.charAt(0) + value.slice(1).toLowerCase() : value);

/**
 * Paid plans of every purchasable exam's v4 catalog, labelled for the calculator's picker. Every name comes from
 * the catalog (exam title, variant_label, display_name), so a new exam needs no code change.
 */
export function buildPlanOptions(catalogs: readonly CatalogExam[]): PlanOption[] {
  const options: PlanOption[] = [];
  const seen = new Set<number>();
  for (const exam of catalogs) {
    for (const variant of exam.variants) {
      const byYear = variant.group_key === 'target_year';
      const fallback = byYear
        ? [exam.title, variant.target_year].filter(Boolean).join(' ')
        : [titleCase(variant.class_title), variant.stream_name].filter(Boolean).join(' ');
      const variantName = variant.variant_label || fallback;
      // Target-year labels already carry the exam name ("{exam} 2027"); class labels don't ("Class 12 PCB").
      const group = (byYear ? variantName : `${exam.title} ${variantName}`).trim();
      for (const plan of variant.plans) {
        if (!(plan.price > 0) || seen.has(plan.price_id)) continue;
        seen.add(plan.price_id);
        const name =
          plan.display_name ||
          composePlanName({
            durationMonths: plan.duration_months,
            exam: exam.title,
            groupKey: byYear ? 'target_year' : 'class',
            targetYear: variant.target_year,
            bundles: plan.is_combo ? [...new Set((plan.bundled ?? []).map((course) => course.exam_title))] : [],
          });
        options.push({
          priceId: plan.price_id,
          examId: exam.examId,
          classId: variant.class_id,
          group,
          label: name,
          phrase: name,
          price: plan.price,
          durationMonths: plan.duration_months,
          isCombo: plan.is_combo,
        });
      }
    }
  }
  return options;
}

/** This exam's plans first, then the student's class, then any yearly plan. */
export function pickExamplePlan(options: PlanOption[], classId?: number | null, examId?: number | null): PlanOption | null {
  const sameExam = examId !== null && examId !== undefined ? options.filter((plan) => plan.examId === examId) : [];
  const pool = sameExam.length > 0 ? sameExam : options;
  return (
    pool.find((plan) => plan.classId === classId && plan.durationMonths === 12 && !plan.isCombo) ??
    pool.find((plan) => plan.durationMonths === 12 && !plan.isCombo) ??
    pool[0] ??
    null
  );
}

export function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  // The v4 API already masks friends' numbers.
  if (phone.includes('•')) return phone;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 6) return phone;
  const local = digits.slice(-10);
  const country = digits.length > 10 ? `+${digits.slice(0, digits.length - 10)} ` : '';
  return `${country}${local.slice(0, 2)}••• ••${local.slice(-3)}`;
}

export const friendCredit = (friend: Friend) => friend.signupCredit + (friend.conversionCredit ?? 0);

export interface FeaturedPurchase {
  friend: Friend;
  paid: number;
  tier: Tier;
  examId: number | null;
  join: number;
  share: number;
}

/** The latest friend who bought, with what they paid (for "How X's plan turned into your credits"). */
export function findFeaturedPurchase(friends: Friend[], statement: StatementRow[]): FeaturedPurchase | null {
  const buyers = friends
    .filter((friend) => friend.status === 'paid')
    .sort((a, b) => new Date(b.paidAt ?? 0).getTime() - new Date(a.paidAt ?? 0).getTime());
  for (const friend of buyers) {
    const row = statement.find((entry) => entry.entryType === 'grant_conversion' && entry.referralId === friend.id);
    const paid = toNumber(row?.basis?.paidAmount);
    if (!row || !paid) continue;
    return {
      friend,
      paid,
      tier: row.tier ?? row.basis?.tier ?? 'free',
      examId: row.examId ?? row.basis?.examId ?? null,
      join: friend.signupCredit,
      share: friend.conversionCredit ?? row.amount,
    };
  }
  return null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "05 Sep 2025" (built by hand: en-GB writes September as "Sept"). */
export function shortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getDate()).padStart(2, '0')} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

const OWN_JOINING_REASON = 'Referral joining credit';

export function describeEntry(row: StatementRow, friends: Map<number, Friend>): string {
  const friend = row.referralId !== null ? friends.get(row.referralId) : undefined;
  const who = friend ? (friend.name ?? maskPhone(friend.phone) ?? 'A friend') : null;
  switch (row.entryType) {
    case 'grant_signup':
      if (who) return `${who} joined`;
      return row.reason === OWN_JOINING_REASON ? "You joined with a friend's link" : 'A friend joined';
    case 'grant_conversion':
      return `${who ?? 'A friend'} bought ${friend?.examName ? `a ${friend.examName} plan` : 'a plan'}`;
    case 'transfer_in':
      return 'Received from a friend';
    case 'transfer_out':
      return 'Sent to a friend';
    case 'redeem':
      return 'Used on a plan';
    case 'grant_manual':
      return 'Added by Prepzy';
    case 'reversal':
      return 'Corrected by Prepzy';
    default:
      return 'Credit update';
  }
}

/** WhatsApp message per exam category; the exam name comes from the registry (the old page always said CBSE). */
export function shareMessage(exam: Pick<ExamConfig, 'category' | 'label'>, shareLink: string, friendJoinCredit: number): string {
  const credit = inr(friendJoinCredit);
  const pitch =
    exam.category === 'competitive'
      ? `Hey! I've been using Prepzy for ${exam.label} prep and it's basically a 24x7 tutor. Mock tests and PYQ practice for every chapter, and its AI tutor solves any doubt step by step, even from a photo of your question.`
      : `Hey! I've been using Prepzy for ${exam.label} and it's basically a 24x7 tutor. Video lessons for every chapter, and its AI tutor Atlas solves any doubt step by step, even from a photo of your question, all straight from the NCERT book.`;
  return `${pitch}\n\nJoin with my link and you get 1 month free + ${credit} credit to start:\n${shareLink}`;
}

export const whatsappUrl = (message: string) => `https://wa.me/?text=${encodeURIComponent(message)}`;

/** Keeps the ref code visible when the link chip truncates on phones. */
export function shortLink(link: string): string {
  try {
    const url = new URL(link);
    const code = url.searchParams.get('ref');
    if (code) return `${url.host}/…?ref=${code}`;
  } catch {
    // Not a full URL.
  }
  return link.replace(/^https?:\/\//, '');
}

export const referralApi = {
  async hub(): Promise<Hub> {
    const [summary, friends, statement, rates] = await Promise.all([
      apiClient.get<Envelope<unknown>>('/api/v4/referral/me'),
      apiClient.get<Envelope<unknown>>('/api/v4/referral/friends'),
      apiClient.get<Envelope<unknown>>('/api/v4/referral/statement'),
      apiClient.get<Envelope<unknown>>('/api/v4/referral/earn-rates'),
    ]);
    if (!summary?.success || !summary.data) {
      throw new ApiError({ status: 500, code: 'EMPTY_RESPONSE', message: "We couldn't load Refer & Earn" });
    }
    return {
      summary: toSummary(summary.data),
      friends: toFriends(friends?.data),
      statement: toStatement(statement?.data),
      rates: toRates(rates?.data),
    };
  },

  /** The student who'd receive credits, by mobile number. */
  async lookup(phone: string, signal?: AbortSignal): Promise<{ accountId: number; name: string }> {
    const body = await apiClient.get<Envelope<{ accountId: number; name: string }>>('/api/v4/referral/transfer/lookup', {
      params: { phone: phone.trim() },
      signal,
    });
    const data = assertOk(body).data;
    if (!data) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: "Couldn't find a student with that number" });
    return { accountId: Number(data.accountId), name: String(data.name ?? '') };
  },

  async transfer(input: { recipientAccountId: number; amount: number; note?: string }): Promise<void> {
    assertOk(await apiClient.post<Envelope<unknown>>('/api/v4/referral/transfer', input));
  },
};
