'use client';

import { cx } from '@prepzy/design-system';
import { Check, ChevronDown, Sparkles, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { routes } from '@/shared/config/routes';
import { formatShortDate } from '../money';
import { CloseButton, Modal } from './modal';

export const CANCEL_REASONS = [
  'Too expensive',
  'Not using it enough',
  'Found a better alternative',
  'Preparing for a different exam',
  'Technical issues',
  'Other',
];

/** The plan a cancellation acts on. */
export interface CancelTarget {
  purchaseId: number;
  name: string;
  remainingDays: number | null;
  expiryDate: string | null;
}

export function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-[5px]">
      <dt className="text-neutral-550 text-[12px]">{label}</dt>
      <dd className="text-plan-ink text-[12px] font-bold">{value}</dd>
    </div>
  );
}

/** Asks for a reason, then POST /purchases/:id/cancel. */
export function CancelDialog({
  plan,
  busy,
  onKeep,
  onConfirm,
}: {
  plan: CancelTarget;
  busy: boolean;
  onKeep: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const expiry = plan.expiryDate ? formatShortDate(plan.expiryDate) : null;
  return (
    <Modal label="Cancel plan" onClose={busy ? undefined : onKeep} className="max-w-[430px] p-5 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-plan-ink m-0 text-lg font-bold">Cancel plan</h3>
          <p className="text-neutral-550 m-0 mt-1.5 text-[13px]">Are you sure you want to end your plan access?</p>
        </div>
        <CloseButton onClick={onKeep} />
      </div>
      <div className="border-plan-rose-line bg-plan-rose-soft mt-4 rounded-[10px] border px-3.5 py-3">
        <p className="text-plan-red m-0 flex items-center gap-[7px] text-[13px] font-bold">
          <TriangleAlert aria-hidden className="size-[15px] shrink-0" />
          You will lose Topper access
        </p>
        <p className="text-plan-rose-text m-0 mt-[7px] text-[12px] leading-[17px]">
          Your <span className="text-plan-rose-deep font-semibold">{plan.name}</span>
          {plan.remainingDays ? (
            <>
              {' '}
              still has <span className="text-plan-rose-deep font-semibold">{plan.remainingDays} days remaining</span>
            </>
          ) : null}
          . If you cancel now, you lose its premium tests, higher limits and full AI support
          {expiry ? ` (it would have run until ${expiry})` : ''}.
        </p>
      </div>
      <label htmlFor="cancel-reason" className="text-plan-ink mt-4 block text-[13px] font-semibold">
        Please tell us why you are leaving
      </label>
      <div className="relative mt-2">
        <select
          id="cancel-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="border-plan-input-line bg-surface focus:border-brand w-full appearance-none rounded-sm border px-3 py-2.5 pr-[34px] text-[13px] text-neutral-700 outline-none"
        >
          <option value="">Select cancellation reason</option>
          {CANCEL_REASONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden className="text-neutral-350 pointer-events-none absolute top-1/2 right-3 size-[15px] -translate-y-1/2" />
      </div>
      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={onKeep}
          disabled={busy}
          className="border-plan-input-line bg-surface hover:bg-canvas flex-1 rounded-sm border py-[11px] text-[13px] font-semibold text-neutral-700 disabled:opacity-50"
        >
          Keep my plan
        </button>
        <button
          type="button"
          onClick={() => onConfirm(reason)}
          disabled={busy}
          className="bg-plan-rose text-on-brand flex-1 rounded-sm py-[11px] text-[13px] font-semibold disabled:opacity-60"
        >
          {busy ? 'Cancelling…' : 'Yes, cancel plan'}
        </button>
      </div>
    </Modal>
  );
}

export function CancelledDialog({ plan, slug, onClose }: { plan: CancelTarget; slug: string; onClose: () => void }) {
  return (
    <Modal label="Cancellation confirmed" onClose={onClose} className="max-w-[400px] p-6 text-center">
      <span className="bg-brand text-on-brand mx-auto flex size-[46px] items-center justify-center rounded-full">
        <Check aria-hidden className="size-[19px]" strokeWidth={2.6} />
      </span>
      <h3 className="text-plan-ink m-0 mt-4 text-lg font-bold">Cancellation confirmed</h3>
      <p className="text-neutral-550 m-0 mt-2 text-[13px] leading-[19px]">Your {plan.name} cancellation has been processed.</p>
      <dl className="bg-plan-receipt mt-[18px] rounded-[10px] px-4 py-3 text-left">
        <ReceiptRow label="Cancelled plan" value={plan.name} />
      </dl>
      <p className="text-neutral-350 m-0 mt-3.5 text-[11px] leading-4">
        No further charges will be made. Any refund due goes back to your original payment method.
      </p>
      <Link
        href={routes.plansPurchase(slug)}
        className={cx('bg-brand text-on-brand hover:bg-brand-800 mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-sm text-[13px] font-semibold')}
      >
        <Sparkles aria-hidden className="size-3.5" />
        Explore plans
      </Link>
      <button type="button" onClick={onClose} className="text-brand mt-3.5 inline-block text-[12px] font-semibold underline underline-offset-2">
        Back to my plans
      </button>
    </Modal>
  );
}
