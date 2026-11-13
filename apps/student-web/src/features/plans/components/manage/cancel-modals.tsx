import { Loader2 } from 'lucide-react';
import Image from 'next/image';
import {
  formatDate,
  formatRupees,
  refundDestination,
  refundUnit,
  type ActivePlan,
  type RefundDetails,
  type RefundPreview,
} from '../../manage-data';
import { DetailRows, modalTitle, outlineButton, primaryButton, Sheet, StatusBadge } from './sheet';

const REASONS = ['Too expensive', 'Not using it enough', 'Bought by mistake', 'Something else'];
const PRIVACY_POLICY_URL = 'https://prepzy.ai/policy';

const subText = 'm-0 text-[12px] leading-normal text-neutral-550 lg:text-[13px]';
const bodyText = 'm-0 text-[13px] leading-normal lg:text-[14px]';
const stackedButton = 'w-full lg:w-auto lg:flex-1';

/** Step 1 of cancelling (the refund preview allowed it): what happens, the refund, an optional reason. */
export function CancelConfirmModal({
  plan,
  refundAmount,
  reason,
  busy,
  onReasonChange,
  onKeep,
  onConfirm,
}: {
  plan: ActivePlan;
  refundAmount: number;
  reason: string;
  busy: boolean;
  onReasonChange: (reason: string) => void;
  onKeep: () => void;
  onConfirm: () => void;
}) {
  const unit = refundUnit(plan);
  return (
    <Sheet label={`Cancel ${plan.name}`} width={620} compact onClose={() => !busy && onKeep()}>
      <h2 className={modalTitle}>Cancel {plan.name}?</h2>
      <p className={subText}>
        {plan.chip} · bought on {plan.startDate}
      </p>

      {/* An order with no payment behind it (e.g. a coupon grant) has nothing to refund */}
      {refundAmount > 0 && (
        <div className="flex flex-col gap-[4px] rounded-[14px] border border-account-ok-line bg-success-50 p-[14px]">
          <p className="m-0 text-[15px] leading-normal font-semibold text-account-ok-text lg:text-[16px]">You get {formatRupees(refundAmount)} back</p>
          <p className="m-0 text-[12px] leading-normal text-account-ink lg:text-[13px]">
            Full refund, because this is your first purchase for this {unit} and cancellation is within 15 days. The refund goes back to the
            source you paid from, in 5–7 working days.
          </p>
        </div>
      )}

      <p className="m-0 hidden text-[11px] leading-normal font-semibold text-neutral-550 lg:block">WHAT HAPPENS</p>
      <ul className="m-0 flex list-none flex-col gap-[8px] p-0 lg:gap-[6px]">
        {[
          plan.fallsBackToBasic ? 'Topper access ends right away. You move to the free Basic plan.' : 'Topper access ends right away.',
          'Your progress, notes and saved contents stay.',
          `A refund is one-time for each ${unit}. Plans you buy for this ${unit} later can’t be refunded.`,
        ].map((item) => (
          <li key={item} className="flex items-start gap-[10px] text-[13px] leading-normal text-account-ink">
            <Image src="/illustrations/plans/list-dot.svg" alt="" width={6} height={14} className="mt-[3px] shrink-0" />
            {item}
          </li>
        ))}
      </ul>

      <p id="cancel-reason-label" className="m-0 text-[11px] leading-normal font-semibold text-neutral-550">
        WHY ARE YOU CANCELLING? (OPTIONAL)
      </p>
      <div role="group" aria-labelledby="cancel-reason-label" className="flex flex-wrap gap-[8px] lg:flex-nowrap">
        {REASONS.map((option) => {
          const selected = reason === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => onReasonChange(selected ? '' : option)}
              className={`rounded-full border px-[12px] py-[7px] text-[12px] font-medium whitespace-nowrap transition-colors lg:py-[6px] ${selected ? 'border-brand-700 bg-brand-75 text-brand-700' : 'border-account-outline text-account-body hover:bg-account-soft'}`}
            >
              {option}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-[10px] pt-[6px] lg:flex-row lg:gap-[12px] lg:pt-[4px]">
        <button type="button" onClick={onKeep} disabled={busy} className={`${outlineButton} ${stackedButton}`}>
          Keep my plan
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={`${stackedButton} text-on-brand flex min-w-0 items-center justify-center rounded-full bg-danger-600 px-[22px] py-[13px] text-[14px] font-semibold hover:bg-account-error-text disabled:opacity-70`}
        >
          {busy ? <Loader2 aria-label="Cancelling" className="animate-spin" size={18} /> : refundAmount > 0 ? 'Cancel and refund' : 'Cancel plan'}
        </button>
      </div>

      <p className="m-0 text-center text-[12px] leading-normal text-neutral-550">
        See how refunds work in our{' '}
        <a href={PRIVACY_POLICY_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-700 underline">
          Privacy policy
        </a>
      </p>
    </Sheet>
  );
}

/** Done: shows only what the server stored for the refund. */
export function CancelledModal({
  plan,
  refundAmount,
  details,
  onViewPlans,
  onDone,
}: {
  plan: ActivePlan;
  refundAmount: number;
  details: RefundDetails | null;
  onViewPlans: (() => void) | null;
  onDone: () => void;
}) {
  const amount = details?.refundAmount ?? refundAmount;
  const destination = refundDestination(details);
  const rows = [
    ...(details?.refundId ? [{ label: 'Refund ID', value: String(details.refundId) }] : []),
    ...(amount > 0 ? [{ label: 'Amount', value: formatRupees(amount) }] : []),
    ...(destination ? [{ label: 'Goes to', value: destination }] : []),
  ];
  return (
    <Sheet label="Plan cancelled" width={520} onClose={onDone}>
      <StatusBadge kind="ok" />
      <h2 className={modalTitle}>Plan cancelled</h2>
      <p className={`${bodyText} text-neutral-550`}>
        {amount > 0
          ? `Your ${formatRupees(amount)} refund is on its way. It reaches the way you paid in 5–7 working days.`
          : `${plan.name} · ${plan.chip} has been cancelled.`}
      </p>
      {rows.length > 0 && <DetailRows rows={rows} />}
      <p className={subText}>{plan.fallsBackToBasic ? 'You are on the free Basic plan now. Your progress is safe.' : 'Your progress is safe.'}</p>
      <div className="flex flex-col-reverse gap-[10px] pt-[6px] lg:flex-row lg:gap-[12px] lg:pt-[8px]">
        {onViewPlans && (
          <button type="button" onClick={onViewPlans} className={`${outlineButton} ${stackedButton}`}>
            View plans
          </button>
        )}
        <button type="button" onClick={onDone} className={`${primaryButton} ${stackedButton}`}>
          Done
        </button>
      </div>
    </Sheet>
  );
}

/** The refund preview said no: why, until when the plan runs, and support. */
export function NotRefundableModal({
  plan,
  reason,
  onSupport,
  onClose,
}: {
  plan: ActivePlan;
  reason: RefundPreview['reason'];
  onSupport: () => void;
  onClose: () => void;
}) {
  const unit = refundUnit(plan);
  return (
    <Sheet label="This plan can’t be refunded" width={520} onClose={onClose}>
      <StatusBadge kind="warn" />
      <h2 className={modalTitle}>This plan can’t be refunded</h2>
      <p className={subText}>
        {plan.name} · {plan.chip}
      </p>
      <div className="rounded-[14px] border border-account-offline-line bg-warning-50 p-[15px] lg:p-[16px]">
        <p className="m-0 text-[12px] leading-normal text-account-ink lg:text-[13px]">
          {reason === 'refund_already_used'
            ? `A refund is one-time for each ${unit}, and it has already been used for this ${unit}.`
            : `Refunds are only for your first paid purchase on Prepzy for each ${unit}, within 15 days of buying. This plan was bought on ${plan.startDate}.`}
        </p>
      </div>
      {plan.rawExpiry && (
        <p className={`${bodyText} text-account-ink`}>
          Your plan stays active till {formatDate(plan.rawExpiry)}. Nothing renews, so you will not be charged again.
        </p>
      )}
      <div className="flex pt-[6px] lg:pt-[8px]">
        <button type="button" onClick={onSupport} className={primaryButton}>
          Talk to support
        </button>
      </div>
    </Sheet>
  );
}
