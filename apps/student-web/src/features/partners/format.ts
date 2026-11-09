import type { PartnerProfile } from './api';

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** ₹1,250 · ₹50.5 */
export const inr = (value: number | string | null | undefined) => currency.format(Number(value ?? 0) || 0);

/** 05 Oct 2026, or — when missing. */
export const formatDate = (value: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

/** +91 98765 43210 */
export const formatPhone = (phone: string) => `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`;

/** Keeps the 10-digit local number, so a pasted "+91 98765 43210" or "098765 43210" still fits. */
export function toTenDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits.slice(0, 10);
}

/** Names take letters only; single spaces are kept so "Mary Ann" still fits. */
export const toNameChars = (raw: string) =>
  raw.replace(/[^A-Za-z ]/g, '').replace(/ {2,}/g, ' ').replace(/^ /, '');

/** Drops the protocol for display; the copied value keeps it. */
export const displayLink = (link: string) => link.replace(/^https?:\/\//, '');

export function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .map((word) => word[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return letters || 'P';
}

/** "Commission 10.00%", "₹300 fixed" or "No arrangement set". */
export function arrangement(profile: PartnerProfile): string {
  if (profile.commissionType === 'fixed') return `₹${profile.commissionFixed ?? 0} fixed`;
  if (profile.commissionType === 'percent') return `Commission ${profile.commissionRate ?? 0}%`;
  return 'No arrangement set';
}

const ENTRY_LABELS: Record<string, string> = {
  grant_signup: 'Signup credit',
  grant_conversion: 'Friend converted',
  grant_manual: 'Manual adjustment',
  payout_reserve: 'Payout requested',
  payout_settle: 'Payout settled',
  payout_return: 'Payout returned',
  reversal: 'Reversal',
  expiry: 'Expired',
};

export const describeEntry = (row: { reason: string | null; entryType: string }) =>
  row.reason || ENTRY_LABELS[row.entryType] || row.entryType;

export const shareMessage = (link: string) =>
  `Hey! I've been using Prepzy for CBSE and it's basically a 24x7 tutor. Video lessons for every chapter, and its AI tutor Atlas solves any doubt step by step, even from a photo of your question, all straight from the NCERT book.\n\nJoin with my link and you get 1 month free + ₹25 credit to start:\n${link}`;

export async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}
