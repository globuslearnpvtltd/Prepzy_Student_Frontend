import { env } from '@/shared/config/env';
import { PORTALS } from '@/shared/config/portals';
import { createApiClient } from '@/shared/lib/api-client';
import { assertOk, unwrapData } from '@/shared/lib/unwrap';

/**
 * The partner API may live on its own host (NEXT_PUBLIC_PARTNER_API_URL, defaulting to the main API). On plain
 * `localhost` the main API is used, as in the previous app: the partner host (api.prepzy.local) only resolves with
 * a hosts-file entry, which partners.localhost setups have and plain localhost ones usually don't.
 */
export function partnerBaseUrl(hostname: string | null | undefined): string {
  return hostname === 'localhost' ? env.apiUrl : env.partnerApiUrl;
}

export const partnerClient = createApiClient(
  partnerBaseUrl(typeof window === 'undefined' ? null : window.location.hostname),
);

const portal = PORTALS.partners;
/** Partner pages always carry the base path, so links work on partners.prepzy.ai and on the main host. */
export const partnerRoutes = {
  login: portal.login,
  signup: `${portal.basePath}/signup`,
  dashboard: portal.home,
  payouts: `${portal.basePath}/payouts`,
  bankDetails: `${portal.basePath}/bank-details`,
} as const;

type Envelope<T> = { success?: boolean; message?: string; error?: string; data?: T };

export type KycStatus = 'pending' | 'submitted' | 'verified' | 'rejected';
export type FriendStatus = 'joined' | 'paid' | 'blocked';
export type PayoutStatus = 'requested' | 'approved' | 'rejected' | 'settled';

export interface PartnerProfile {
  name: string;
  typeName: string | null;
  kycStatus: KycStatus;
  commissionType: 'percent' | 'fixed' | null;
  commissionRate: string | null;
  commissionFloor: string | null;
  commissionCap: string | null;
  commissionFixed: string | null;
}

export interface PartnerSummary {
  code: string;
  shareLink: string;
  balance: number;
  lifetimeEarned: number;
  lifetimePaidOut: number;
  pendingUnsettled: number;
  friendCount: number;
}

export interface PartnerFriend {
  id: number;
  status: FriendStatus;
  attributedAt: string | null;
  name: string | null;
  phone: string | null;
  examName: string | null;
  earned: number;
}

export interface PartnerStatementRow {
  id: number;
  entryType: string;
  amount: number;
  balanceAfter: number;
  reason: string | null;
  createdAt: string | null;
}

export interface Payout {
  id: number;
  amount: number;
  status: PayoutStatus;
  rejectionReason: string | null;
  requestedAt: string | null;
}

export interface PayoutsData {
  payouts: Payout[];
  minPayoutAmount: number;
}

/** Masked values only: the API never returns the full account number or PAN. */
export interface BankDetails {
  accountHolderName: string;
  accountNumberMasked: string | null;
  ifscCode: string;
  panMasked: string | null;
}

export interface PartnerType {
  id: number;
  name: string;
}

export interface SignupInput {
  firstName: string;
  lastName: string;
  phone: string;
}

export interface SignupDetailsInput {
  partnerTypeId: number;
  email: string;
  city: string;
}

export interface BankDetailsInput {
  accountHolderName: string;
  bankAccountNumber: string;
  ifscCode: string;
  pan: string;
}

type Row = Record<string, unknown>;
const asRow = (value: unknown): Row => (value && typeof value === 'object' ? (value as Row) : {});
const rows = (value: unknown): Row[] =>
  Array.isArray(value) ? value.filter((row): row is Row => !!row && typeof row === 'object') : [];
const num = (value: unknown): number => {
  const parsed = Number(value);
  return value === null || value === undefined || value === '' || !Number.isFinite(parsed) ? 0 : parsed;
};
const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : typeof value === 'number' ? String(value) : null;
const oneOf = <T extends string>(value: unknown, options: readonly T[], fallback: T): T =>
  options.includes(value as T) ? (value as T) : fallback;

const KYC: readonly KycStatus[] = ['pending', 'submitted', 'verified', 'rejected'];

export function toProfile(raw: unknown): PartnerProfile {
  const row = asRow(raw);
  return {
    name: text(row.partner_name) ?? 'Partner',
    typeName: text(row.partner_type_name),
    kycStatus: oneOf(row.kyc_status, KYC, 'pending'),
    commissionType: row.commission_type === 'percent' || row.commission_type === 'fixed' ? row.commission_type : null,
    commissionRate: text(row.commission_rate),
    commissionFloor: text(row.commission_floor),
    commissionCap: text(row.commission_cap),
    commissionFixed: text(row.commission_fixed_amount),
  };
}

export function toSummary(raw: unknown): PartnerSummary {
  const row = asRow(raw);
  return {
    code: text(row.code) ?? '',
    shareLink: text(row.shareLink) ?? '',
    balance: num(row.balance),
    lifetimeEarned: num(row.lifetimeEarned),
    lifetimePaidOut: num(row.lifetimePaidOut),
    pendingUnsettled: num(row.pendingUnsettled),
    friendCount: num(row.friendCount),
  };
}

export const toFriends = (raw: unknown): PartnerFriend[] =>
  rows(raw).map((row) => ({
    id: num(row.id),
    status: oneOf(row.status, ['joined', 'paid', 'blocked'] as const, 'joined'),
    attributedAt: text(row.attributed_at),
    name: text(row.friend_name),
    phone: text(row.friend_phone),
    examName: text(row.exam_name),
    earned: num(row.signup_credit_amount) + num(row.conversion_credit_amount),
  }));

export const toStatement = (raw: unknown): PartnerStatementRow[] =>
  rows(raw).map((row) => ({
    id: num(row.id),
    entryType: text(row.entry_type) ?? '',
    amount: num(row.amount),
    balanceAfter: num(row.balance_after),
    reason: text(row.reason),
    createdAt: text(row.created_at),
  }));

export function toPayouts(raw: unknown): PayoutsData {
  const row = asRow(raw);
  return {
    minPayoutAmount: num(row.minPayoutAmount),
    payouts: rows(row.payouts).map((payout) => ({
      id: num(payout.id),
      amount: num(payout.amount),
      status: oneOf(payout.status, ['requested', 'approved', 'rejected', 'settled'] as const, 'requested'),
      rejectionReason: text(payout.rejection_reason),
      requestedAt: text(payout.requested_at),
    })),
  };
}

export function toBankDetails(raw: unknown): BankDetails | null {
  const details = asRow(raw).bankDetails;
  if (!details || typeof details !== 'object') return null;
  const row = asRow(details);
  return {
    accountHolderName: text(row.accountHolderName) ?? '',
    accountNumberMasked: text(row.bankAccountNumberMasked),
    ifscCode: text(row.ifscCode) ?? '',
    panMasked: text(row.panMasked),
  };
}

export const toPartnerTypes = (raw: unknown): PartnerType[] =>
  rows(raw)
    .map((row) => ({ id: num(row.id), name: text(row.name) ?? '' }))
    .filter((type) => type.id > 0 && type.name);

/** The backend wants the number with its country code. */
export const withCountryCode = (phone: string) => `+91${phone}`;

/** v4 partner portal API (`partnerAccessToken` cookie). Same JSON fields as before, in the v4 envelope. */
const V4 = '/api/v4/partners';
const data = async <T>(path: string) => unwrapData(await partnerClient.get<Envelope<T>>(`${V4}${path}`));
const send = async (path: string, body?: unknown) => {
  assertOk(await partnerClient.post<Envelope<unknown>>(`${V4}${path}`, body));
};

export const partnerApi = {
  sendLoginOtp: (phone: string) => send('/auth/login/otp', { phone: withCountryCode(phone) }),
  verifyLoginOtp: (phone: string, otp: string) => send('/auth/login/verify', { phone: withCountryCode(phone), otp }),
  sendSignupOtp: (input: SignupInput) => send('/auth/signup/otp', { ...input, phone: withCountryCode(input.phone) }),
  verifySignupOtp: (input: SignupInput, otp: string) =>
    send('/auth/signup/verify', { ...input, phone: withCountryCode(input.phone), otp }),
  logout: () => send('/auth/logout'),
  partnerTypes: async () => toPartnerTypes(await data('/partner-types')),
  submitSignupDetails: (input: SignupDetailsInput) => send('/signup-details', input),
  profile: async () => toProfile(await data('/profile')),
  summary: async () => toSummary(await data('/summary')),
  friends: async () => toFriends(await data('/friends')),
  statement: async () => toStatement(await data('/statement')),
  payouts: async () => toPayouts(await data('/payouts')),
  requestPayout: (amount: number) => send('/payouts', { amount }),
  bankDetails: async () => toBankDetails(await data('/bank-details')),
  saveBankDetails: (input: BankDetailsInput) => send('/bank-details', input),
};
