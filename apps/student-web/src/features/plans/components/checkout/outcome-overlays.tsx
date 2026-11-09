'use client';

import { cx } from '@prepzy/design-system';
import { Check, Hourglass, Loader2, RefreshCw, X } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { longDate } from '../../money';
import { useModalBehaviour } from '../modal';
import { Confetti } from '../confetti';

const LABEL = 'text-plan-night-label m-0 text-[11px] font-semibold tracking-[0.14em] uppercase';
const SECONDARY =
  'border-surface/10 bg-surface/5 text-on-brand hover:bg-surface/10 flex w-full items-center justify-center gap-2.5 rounded-[14px] border px-5 py-[15px] text-[15px] font-semibold disabled:cursor-not-allowed disabled:opacity-60';
const PRIMARY =
  'bg-plan-violet text-on-brand hover:bg-brand-450 flex w-full items-center justify-center gap-2.5 rounded-[14px] px-5 py-4 text-[15px] font-semibold disabled:cursor-not-allowed disabled:opacity-60';

/** Dark full-screen sheet behind the pending and failed states. */
function NightSheet({ titleId, children, onEscape }: { titleId: string; children: ReactNode; onEscape?: () => void }) {
  useModalBehaviour(onEscape);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="bg-plan-night fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto px-5 py-10"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(122,106,201,0.28),transparent_62%)]" />
      <div className="relative w-full max-w-[640px] text-center">{children}</div>
    </div>
  );
}

function Receipt({
  label,
  planName,
  pill,
  transactionId,
  planDetails,
  dateLine,
}: {
  label: string;
  planName: string;
  pill: ReactNode;
  transactionId: string;
  planDetails: string;
  dateLine: ReactNode;
}) {
  return (
    <div className="border-surface/10 bg-plan-night-panel mt-7 overflow-hidden rounded-[18px] border text-left">
      <div className="border-surface/10 bg-plan-night-head flex items-center justify-between gap-4 border-b px-[22px] py-[18px]">
        <div className="min-w-0">
          <p className={LABEL}>{label}</p>
          <p className="text-on-brand m-0 mt-1.5 truncate text-lg font-bold">{planName}</p>
        </div>
        {pill}
      </div>
      <div className="flex flex-col gap-4 px-[22px] py-[18px] sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className={LABEL}>Transaction id</p>
          <p className="text-on-brand m-0 mt-1.5 text-[15px] font-semibold break-all">{transactionId || '—'}</p>
        </div>
        <div className="min-w-0 sm:text-right">
          <p className={LABEL}>Plan details</p>
          <p className="text-on-brand m-0 mt-1.5 text-[15px] font-semibold">{planDetails}</p>
          {dateLine}
        </div>
      </div>
    </div>
  );
}

/** Razorpay took the money but our confirmation hasn't landed: never reads as a failure. */
export function PaymentPending({
  planName,
  transactionId,
  planDetails,
  date,
  refreshing,
  onRefresh,
  onBackToDashboard,
}: {
  planName: string;
  transactionId: string;
  planDetails: string;
  date: Date;
  refreshing: boolean;
  onRefresh: () => void;
  onBackToDashboard: () => void;
}) {
  return (
    <NightSheet titleId="payment-pending-title">
      <span className="bg-plan-pending mx-auto flex size-[72px] items-center justify-center rounded-full">
        <Hourglass aria-hidden size={30} strokeWidth={2.2} className="text-on-brand" />
      </span>
      <h2 id="payment-pending-title" className="text-on-brand mt-6 text-[28px] leading-[1.15] font-bold md:text-[34px]">
        Payment is being processed
      </h2>
      <p className="text-plan-night-text mx-auto mt-3 max-w-[480px] text-[14px] leading-[22px] md:text-[15px]">
        Please don&apos;t close this window or hit refresh in your browser. We&apos;re confirming the payment with your bank
        to finish your enrolment.
      </p>
      <Receipt
        label="Enrolled plan"
        planName={planName}
        pill={
          <span className="border-plan-pending/60 text-plan-pending shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] font-semibold">
            Pending
          </span>
        }
        transactionId={transactionId}
        planDetails={planDetails}
        dateLine={<p className="text-plan-pending m-0 mt-1 text-[13px]">Initiated on {longDate(date)}</p>}
      />
      <button type="button" onClick={onBackToDashboard} className={cx(PRIMARY, 'mt-6')}>
        Go back to dashboard
      </button>
      <button type="button" onClick={onRefresh} disabled={refreshing} className={cx(SECONDARY, 'mt-3')}>
        {refreshing ? (
          <>
            <Loader2 aria-hidden size={17} className="animate-spin" /> Checking
          </>
        ) : (
          <>
            <RefreshCw aria-hidden size={17} /> Refresh
          </>
        )}
      </button>
      <p className="text-plan-night-label mt-4 text-[12px] leading-[18px]">
        Don&apos;t pay again. If the plan doesn&apos;t activate, the amount returns to the same account within 5–7 working
        days.
      </p>
    </NightSheet>
  );
}

/** Razorpay reported a failure, so nothing was charged. */
export function PaymentFailed({
  planName,
  transactionId,
  planDetails,
  date,
  reason,
  retrying,
  onRetry,
  onExplorePlans,
}: {
  planName: string;
  transactionId: string;
  planDetails: string;
  date: Date;
  reason: string | null;
  retrying: boolean;
  onRetry: () => void;
  onExplorePlans: () => void;
}) {
  return (
    <NightSheet titleId="payment-failed-title" onEscape={onExplorePlans}>
      <span className="bg-plan-fail mx-auto flex size-[72px] items-center justify-center rounded-full">
        <X aria-hidden size={32} strokeWidth={2.6} className="text-on-brand" />
      </span>
      <h2 id="payment-failed-title" className="text-on-brand mt-6 text-[28px] leading-[1.15] font-bold md:text-[34px]">
        Payment didn&apos;t go through
      </h2>
      <p className="text-plan-night-text mx-auto mt-3 max-w-[480px] text-[14px] leading-[22px] md:text-[15px]">
        {reason || 'Nothing was charged. Check your payment details and try again, or use a different method.'}
      </p>
      <Receipt
        label="Selected plan"
        planName={planName}
        pill={
          <span className="border-plan-fail/60 text-plan-fail-text shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] font-semibold">
            Failed
          </span>
        }
        transactionId={transactionId}
        planDetails={planDetails}
        dateLine={<p className="text-plan-fail-text m-0 mt-1 text-[13px]">Attempted on {longDate(date)}</p>}
      />
      <button type="button" onClick={onRetry} disabled={retrying} className={cx(PRIMARY, 'mt-6')}>
        {retrying ? (
          <>
            <Loader2 aria-hidden size={17} className="animate-spin" /> Opening payment
          </>
        ) : (
          'Retry payment'
        )}
      </button>
      <button type="button" onClick={onExplorePlans} className={cx(SECONDARY, 'mt-3')}>
        Explore plans
      </button>
    </NightSheet>
  );
}

/** Confetti, a green check and the enrolled plan. */
export function PaymentSuccess({
  planName,
  courseAccess,
  planDetails,
  validUntil,
  onStartLearning,
  onBackHome,
}: {
  planName: string;
  courseAccess: string;
  planDetails: string;
  validUntil: string | null;
  onStartLearning: () => void;
  onBackHome: () => void;
}) {
  useModalBehaviour(undefined);
  const confetti = useMemo(() => <Confetti pieces={70} durationMs={7000} />, []);
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto overscroll-contain bg-[radial-gradient(120%_90%_at_50%_0%,var(--color-plan-violet-deep)_0%,var(--color-plan-night)_45%,var(--color-plan-night-head)_100%)]">
      {confetti}
      <div className="flex min-h-full items-center justify-center px-4 pt-7 pb-[calc(28px+env(safe-area-inset-bottom))] sm:px-5 sm:py-10">
        <div role="dialog" aria-modal="true" aria-labelledby="payment-success-title" className="relative w-full max-w-[520px] text-center">
          <div className="relative mx-auto mb-5 size-[76px] sm:mb-[26px] sm:size-[104px]">
            <span aria-hidden className="bg-plan-ok absolute -inset-3 rounded-full opacity-60 blur-[20px] sm:-inset-[18px] sm:blur-[26px]" />
            <span className="bg-plan-ok relative flex size-full items-center justify-center rounded-full shadow-[0_18px_40px_-18px_rgba(62,164,85,0.9)]">
              <Check aria-hidden strokeWidth={3} className="text-on-brand size-[34px] sm:size-[46px]" />
            </span>
          </div>
          <h2 id="payment-success-title" className="text-on-brand text-[26px] leading-[1.2] font-bold sm:text-[32px] md:text-[38px]">
            Payment Successful
          </h2>
          <p className="text-plan-night-text mx-auto mt-2.5 max-w-[420px] text-[14px] leading-[1.6] sm:mt-3.5 sm:text-[15px]">
            Your Prepzy plan is now active. Your learning access is ready — start where you left off, or dive straight in.
          </p>
          <div className="border-surface/10 bg-plan-night-panel/80 mt-6 overflow-hidden rounded-lg border text-left backdrop-blur-sm sm:mt-[34px] sm:rounded-[18px]">
            <div className="border-surface/10 bg-plan-night-head/70 flex flex-col gap-3 border-b px-[18px] py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-5">
              <div className="min-w-0">
                <p className={LABEL}>Enrolled plan</p>
                <p className="text-on-brand mt-1.5 text-lg font-semibold break-words sm:text-xl">{planName}</p>
              </div>
              <span className="border-plan-ok/60 bg-plan-ok/10 text-plan-ok-text w-fit shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] font-medium sm:text-[13px]">
                Active
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 px-[18px] py-4 sm:grid-cols-2 sm:px-6 sm:py-5">
              <div className="min-w-0">
                <p className={LABEL}>Course access</p>
                <p className="text-on-brand mt-1.5 text-[15px] break-words sm:text-md">{courseAccess}</p>
              </div>
              <div className="min-w-0 sm:text-right">
                <p className={LABEL}>Plan details</p>
                <p className="text-on-brand mt-1.5 text-[15px] break-words sm:text-md">{planDetails || 'Access activated'}</p>
                {validUntil && <p className="text-plan-ok-text mt-1 text-[13px]">Valid until {validUntil}</p>}
              </div>
            </div>
          </div>
          <div className="mt-[22px] space-y-2.5 sm:mt-[26px] sm:space-y-3">
            <button type="button" onClick={onStartLearning} className={PRIMARY}>
              Start learning
            </button>
            <button type="button" onClick={onBackHome} className={SECONDARY}>
              Back to home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
