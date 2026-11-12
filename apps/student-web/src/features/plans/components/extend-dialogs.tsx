'use client';

import { cx } from '@prepzy/design-system';
import { AlertCircle, CalendarDays, Check, Ticket } from 'lucide-react';
import { useState } from 'react';
import type { ExamRef } from '@/shared/config/exams';
import { billingMessage, plansApi } from '../api';
import { formatShortDate } from '../money';
import { CloseButton, Modal } from './modal';

/** Coupon-only extension (POST /extensions): a valid code moves the purchase's expiry date and nothing is charged. */
export function useExtend(exam: ExamRef, purchaseId: number | null) {
  const [code, setCode] = useState('');
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ months: number | null; expiryDate: string | null } | null>(null);
  const apply = async () => {
    if (!code.trim() || applying) return;
    setApplying(true);
    setError('');
    try {
      setResult(await plansApi.extend(exam, code.trim(), purchaseId));
    } catch (failure) {
      setError(billingMessage(failure, 'Invalid coupon code'));
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

/** The plan an extension acts on. */
export interface ExtendTarget {
  purchaseId: number;
  name: string;
  expiryDate: string | null;
}

/** Coupon extension of one purchase: a single dialog that turns into its own success state. */
export function ExtendDialog({ exam, plan, onClose }: { exam: ExamRef; plan: ExtendTarget; onClose: () => void }) {
  const extend = useExtend(exam, plan.purchaseId);
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
              {applied ? `${extend.result?.months ?? ''} months added to ${plan.name}` : `Use a coupon code to add more days to ${plan.name}`}
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
