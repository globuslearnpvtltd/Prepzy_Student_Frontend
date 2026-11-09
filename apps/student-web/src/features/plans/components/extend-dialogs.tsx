'use client';

import { cx } from '@prepzy/design-system';
import { AlertCircle, CalendarDays, Check, Ticket, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { userMessage } from '@/shared/lib/errors';
import { plansApi, type BoardPlan, type LearningPlan, type PlanCategory } from '../api';
import { formatShortDate } from '../money';
import { CloseButton, Modal } from './modal';
import { CourseStatusPill, ReceiptRow } from './plan-bits';

/** Coupon-only extension: a valid code moves the expiry date and nothing is charged. */
export function useExtend(category: PlanCategory, planId: number | null) {
  const [code, setCode] = useState('');
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ months: number | null; expiryDate: string | null } | null>(null);
  const apply = async () => {
    if (!code.trim() || applying) return;
    setApplying(true);
    setError('');
    try {
      setResult(await plansApi.extend(category, code.trim(), planId));
    } catch (failure) {
      setError(userMessage(failure, 'Invalid coupon code'));
    } finally {
      setApplying(false);
    }
  };
  return {
    code,
    applying,
    error,
    result,
    apply,
    setCode: (value: string) => {
      setCode(value);
      setError('');
    },
  };
}

/** Board manage page: one dialog that turns into its own success state. */
export function BoardExtendDialog({ plan, onClose }: { plan: BoardPlan; onClose: () => void }) {
  const extend = useExtend('board', plan.planId);
  const applied = extend.result !== null;
  return (
    <Modal label="Extend your plan" onClose={onClose} className="max-w-[420px] rounded-lg p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className={cx(
              'flex size-[38px] shrink-0 items-center justify-center rounded-full',
              applied ? 'bg-plan-extend-soft text-plan-extend' : extend.error ? 'bg-plan-alert-soft text-plan-alert' : 'bg-plan-chip text-plan-violet',
            )}
          >
            {applied ? <Check aria-hidden className="size-[18px]" strokeWidth={2.2} /> : extend.error ? <AlertCircle aria-hidden className="size-[18px]" /> : <Ticket aria-hidden className="size-[18px]" />}
          </span>
          <div>
            <p className="m-0 text-md font-bold text-neutral-950 sm:text-lg">{applied ? 'Plan extended' : 'Extend your plan'}</p>
            <p className="text-neutral-500 m-0 mt-0.5 text-[13px]">
              {applied ? `${extend.result?.months ?? ''} months added` : 'Use a coupon code to add more days'}
            </p>
          </div>
        </div>
        <CloseButton onClick={onClose} className="bg-neutral-100 size-7 border-0" />
      </div>
      <div className="bg-canvas mt-3 flex items-center gap-2 rounded-md px-4 py-3">
        <CalendarDays aria-hidden className="text-neutral-350 size-4 shrink-0" />
        <p className="text-neutral-500 m-0 text-[13.5px]">
          Ends{' '}
          {applied && extend.result?.expiryDate ? (
            <>
              <span className="text-neutral-350 font-semibold line-through">{formatShortDate(plan.expiryDate)}</span>
              {' → '}
              <span className="text-plan-extend font-bold">{formatShortDate(extend.result.expiryDate)}</span>
            </>
          ) : (
            <span className="font-bold text-neutral-950">{formatShortDate(plan.expiryDate)}</span>
          )}
        </p>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        {applied ? (
          <div className="border-plan-extend-line bg-plan-extend-soft text-plan-extend flex w-full items-center justify-between rounded-md border px-4 py-2.5 sm:flex-1">
            <span className="text-[14px] font-bold">{extend.code}</span>
            <Check aria-hidden className="size-4" strokeWidth={2.2} />
          </div>
        ) : (
          <input
            type="text"
            value={extend.code}
            onChange={(event) => extend.setCode(event.target.value)}
            placeholder="Enter coupon code"
            aria-label="Coupon code"
            className={cx(
              'focus:border-brand w-full rounded-md border px-4 py-2.5 text-[14px] text-neutral-800 outline-none sm:flex-1',
              extend.error ? 'border-plan-alert-line bg-plan-alert-soft' : 'border-border bg-surface',
            )}
          />
        )}
        {applied ? (
          <div className="bg-plan-extend text-on-brand flex items-center justify-center gap-1 rounded-md px-6 py-2.5 text-[14px] font-bold">
            <Check aria-hidden className="size-3.5" strokeWidth={2.5} /> Applied
          </div>
        ) : (
          <button
            type="button"
            onClick={extend.apply}
            disabled={extend.applying || !extend.code.trim()}
            className="bg-brand text-on-brand shrink-0 rounded-md px-6 py-2.5 text-[14px] font-bold disabled:opacity-50"
          >
            {extend.applying ? 'Extending...' : 'Extend'}
          </button>
        )}
      </div>
      {applied && extend.result?.expiryDate && (
        <div className="bg-plan-extend-soft mt-3 flex items-start gap-2 rounded-md px-4 py-3">
          <Check aria-hidden className="text-plan-extend mt-0.5 size-[15px] shrink-0" strokeWidth={2.5} />
          <p className="text-plan-extend m-0 text-[13px] font-semibold">
            Your plan now runs till {formatShortDate(extend.result.expiryDate)}. Nothing was charged.
          </p>
        </div>
      )}
      {extend.error && !applied && (
        <div role="alert" className="bg-plan-alert-soft mt-3 flex items-start gap-2 rounded-md px-4 py-3">
          <AlertCircle aria-hidden className="text-plan-alert mt-0.5 size-[15px] shrink-0" />
          <p className="text-plan-alert m-0 text-[13px] font-semibold">{extend.error}</p>
        </div>
      )}
      {applied ? (
        <button type="button" onClick={onClose} className="bg-plan-extend text-on-brand mt-4 w-full rounded-md py-3 text-[14px] font-bold">
          Done
        </button>
      ) : (
        <p className="text-neutral-350 m-0 mt-3 text-[12px]">No payment needed — a valid code only extends your validity.</p>
      )}
    </Modal>
  );
}

/** Competitive manage page: coupon form, then a separate success receipt. */
export function CompetitiveExtendDialog({ plan, onClose }: { plan: LearningPlan; onClose: () => void }) {
  const extend = useExtend('competitive', plan.planId);
  if (extend.result) {
    const months = extend.result.months;
    return (
      <Modal label="Plan extended" onClose={onClose} className="max-w-[400px] p-6 text-center">
        <span className="border-plan-ok-line bg-plan-ok-soft text-plan-extend mx-auto flex size-[52px] items-center justify-center rounded-full border-2">
          <Check aria-hidden className="size-[21px]" strokeWidth={2.6} />
        </span>
        <h3 className="text-plan-ink m-0 mt-4 text-[19px] font-bold">Plan Extended Successfully!</h3>
        <p className="text-neutral-550 m-0 mt-2 text-[13px] leading-[19px]">
          Your validity has been updated. Pick up right where you left off — nothing was charged.
        </p>
        <dl className="bg-plan-receipt mt-[18px] rounded-[10px] px-4 py-3 text-left">
          <ReceiptRow label="Learning Plan" value={plan.name} />
          {extend.result.expiryDate && <ReceiptRow label="New Expiry Date" value={formatShortDate(extend.result.expiryDate)} success />}
          {months ? <ReceiptRow label="Extended By" value={`${months} month${months > 1 ? 's' : ''}`} /> : null}
        </dl>
        <button type="button" onClick={onClose} className="bg-brand text-on-brand hover:bg-brand-800 mt-[18px] w-full rounded-sm py-3 text-[13px] font-semibold">
          Back to My Learning Plans
        </button>
      </Modal>
    );
  }
  return (
    <Modal label="Extend Learning Plan" onClose={extend.applying ? undefined : onClose} className="max-w-[430px] p-5 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-plan-ink m-0 text-lg font-bold">Extend Learning Plan</h3>
          <p className="text-neutral-550 m-0 mt-1.5 text-[13px]">Secure continuous access to expert learning modules.</p>
        </div>
        <CloseButton onClick={onClose} />
      </div>
      <div className="bg-plan-receipt mt-4 flex items-center justify-between gap-3 rounded-[10px] px-3.5 py-3">
        <div className="min-w-0">
          <p className="text-plan-ink m-0 truncate text-[13px] font-bold">{plan.name}</p>
          <p className="text-neutral-550 m-0 mt-[3px] text-[11px]">Currently Expires: {formatShortDate(plan.expiryDate)}</p>
        </div>
        <CourseStatusPill status={plan.status} />
      </div>
      <p className="text-plan-navy mt-[18px] text-[11px] font-bold tracking-[0.08em] uppercase">Apply coupon code</p>
      <input
        type="text"
        value={extend.code}
        onChange={(event) => extend.setCode(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') void extend.apply();
        }}
        placeholder="Enter coupon code"
        aria-label="Coupon code"
        className={cx(
          'text-plan-ink placeholder:text-neutral-350 focus:border-brand mt-2 w-full rounded-sm border px-3 py-2.5 text-[13px] font-medium tracking-[0.04em] uppercase outline-none placeholder:tracking-normal placeholder:normal-case',
          extend.error ? 'border-plan-alert-line bg-plan-alert-soft' : 'border-plan-input-line bg-surface',
        )}
      />
      {extend.error && (
        <div role="alert" className="bg-plan-alert-soft mt-2.5 flex items-start gap-2 rounded-sm px-3 py-2.5">
          <TriangleAlert aria-hidden className="text-plan-alert mt-px size-3.5 shrink-0" />
          <p className="text-plan-alert m-0 text-[12px] font-semibold">{extend.error}</p>
        </div>
      )}
      <p className="text-neutral-350 m-0 mt-2.5 text-[11px]">No payment needed — a valid code only extends your validity.</p>
      <div className="mt-[18px] flex gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={extend.applying}
          className="border-plan-input-line bg-surface hover:bg-canvas flex-1 rounded-sm border py-[11px] text-[13px] font-semibold text-neutral-700 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={extend.apply}
          disabled={extend.applying || !extend.code.trim()}
          className="bg-brand text-on-brand hover:bg-brand-800 flex-1 rounded-sm py-[11px] text-[13px] font-semibold disabled:opacity-50"
        >
          {extend.applying ? 'Extending…' : 'Confirm'}
        </button>
      </div>
    </Modal>
  );
}
