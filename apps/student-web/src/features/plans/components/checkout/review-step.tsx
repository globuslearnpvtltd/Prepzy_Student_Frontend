'use client';

import { cx } from '@prepzy/design-system';
import { ArrowLeft, ArrowRight, Check, ChevronDown, PiggyBank, Ticket, X, Zap } from 'lucide-react';
import { useState } from 'react';
import type { Coupon } from '../../api';
import { bill, planHighlights, priceCadence, tierPill, type Plan } from '../../catalog';
import { formatInr, formatPlanDate } from '../../money';
import { MobileActionBar } from './primitives';

export interface CouponState {
  input: string;
  applied: string | null;
  discount: number;
  error: string;
  checking: boolean;
}

function CheckoutSteps({ onBack }: { onBack: () => void }) {
  const dot = (label: string, index: number, state: 'done' | 'current' | 'todo') => (
    <span className="flex items-center gap-[7px]">
      <span
        className={cx(
          'flex size-[18px] items-center justify-center rounded-full text-[9px] font-bold',
          state === 'current' ? 'bg-brand text-on-brand' : state === 'done' ? 'border-brand bg-surface border-4' : 'bg-plan-tile text-plan-label',
        )}
      >
        {state === 'done' ? '' : index}
      </span>
      <span className={cx('text-[11px]', state === 'todo' ? 'text-plan-label' : 'text-plan-deep font-semibold')}>{label}</span>
    </span>
  );
  return (
    <div className="flex items-center gap-2.5" aria-label="Checkout progress">
      <button type="button" onClick={onBack} className="hover:opacity-80">
        {dot('Select Plan', 1, 'done')}
      </button>
      <span className="bg-plan-divider h-px w-[26px] sm:w-9" />
      {dot('Review & Pay', 2, 'current')}
      <span className="bg-plan-line h-px w-[26px] sm:w-9" />
      {dot('Access Unlock', 3, 'todo')}
    </div>
  );
}

const SummaryRow = ({ label, value, credit }: { label: string; value: string; credit?: boolean }) => (
  <div className="flex items-center justify-between gap-3">
    <dt className="text-brand-600">{label}</dt>
    <dd className={cx('font-semibold', credit ? 'text-plan-save' : 'text-plan-deep')}>{value}</dd>
  </div>
);

function couponExpiry(coupon: Coupon): { expired: boolean; label: string } {
  const expiry = coupon.expiry ? new Date(coupon.expiry) : null;
  if (!expiry || Number.isNaN(expiry.getTime())) return { expired: false, label: '' };
  return { expired: expiry.getTime() < Date.now(), label: formatPlanDate(expiry) };
}

function CouponBox({
  state,
  coupons,
  onInput,
  onApply,
  onRemove,
}: {
  state: CouponState;
  coupons: Coupon[];
  onInput: (value: string) => void;
  onApply: (code?: string) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(true);
  const applied = state.applied !== null;
  return (
    <div className="mt-[18px]">
      <p className="text-plan-ink m-0 text-[12px] font-semibold">Have a coupon?</p>
      <div className="mt-2 flex gap-2">
        <input
          type="text"
          value={state.input}
          disabled={applied}
          onChange={(event) => onInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onApply();
          }}
          placeholder="Enter coupon code"
          aria-label="Coupon code"
          className="border-plan-line-strong bg-surface text-plan-ink placeholder:text-plan-strike focus-visible:border-plan-violet disabled:bg-plan-section min-w-0 flex-1 rounded-[9px] border px-3 py-[9px] text-[12px] font-medium tracking-[0.04em] uppercase outline-none placeholder:tracking-normal placeholder:normal-case"
        />
        <button
          type="button"
          onClick={() => onApply()}
          disabled={state.checking || applied || !state.input.trim()}
          className="bg-brand text-on-brand hover:bg-brand-800 shrink-0 rounded-[9px] px-[18px] py-[9px] text-[12px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state.checking ? '…' : 'Apply'}
        </button>
      </div>
      {state.error && (
        <p role="alert" className="text-plan-error mt-[7px] text-[11px]">
          {state.error}
        </p>
      )}
      {applied && (
        <div className="mt-3">
          <p className="text-plan-save m-0 text-[11px] font-semibold">Coupon Code applied!</p>
          <span className="border-plan-save-line bg-plan-save-soft text-plan-save-deep mt-[7px] inline-flex items-center gap-[7px] rounded-[9px] border px-2.5 py-1.5 text-[11px] font-bold tracking-[0.04em] uppercase">
            <Check aria-hidden size={11} strokeWidth={3} />
            {state.applied}
            <button type="button" aria-label="Remove coupon" onClick={onRemove} className="hover:opacity-70">
              <X aria-hidden size={11} strokeWidth={3} />
            </button>
          </span>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="text-plan-violet mt-3 inline-flex items-center gap-1 text-[11px] font-semibold hover:opacity-80"
      >
        View available offers
        <ChevronDown aria-hidden size={12} className={cx('transition-transform duration-300', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="mt-2.5 space-y-2">
          {coupons.length === 0 ? (
            <div className="border-plan-line rounded-[10px] border px-3.5 py-[18px] text-center">
              <span className="bg-plan-tile text-plan-muted mx-auto flex size-[26px] items-center justify-center rounded-sm">
                <Ticket aria-hidden size={13} strokeWidth={2} />
              </span>
              <p className="text-plan-ink m-0 mt-2 text-[12px] font-semibold">No coupon code available</p>
              <p className="text-plan-muted m-0 mt-[3px] text-[10px]">Check your email for exclusive offers.</p>
            </div>
          ) : (
            coupons.map((coupon) => {
              const { expired, label } = couponExpiry(coupon);
              const isApplied = state.applied === coupon.code;
              return (
                <div
                  key={coupon.code}
                  className={cx(
                    'flex items-center justify-between gap-2.5 rounded-[10px] border px-3 py-2.5',
                    expired ? 'border-plan-line bg-plan-panel' : 'border-plan-line bg-surface',
                  )}
                >
                  <div className="min-w-0">
                    <p className={cx('m-0 text-[12px] font-bold', expired ? 'text-plan-label' : 'text-plan-ink')}>{coupon.code}</p>
                    <p className={cx('m-0 mt-0.5 text-[10px] leading-[14px]', expired ? 'text-plan-strike' : 'text-plan-muted')}>
                      {coupon.description}
                    </p>
                    {label && <p className="text-plan-strike m-0 mt-[3px] text-[9px]">{expired ? `Expired ${label}` : `Valid until ${label}`}</p>}
                  </div>
                  {expired ? (
                    <span className="bg-plan-tile text-plan-label shrink-0 rounded-[7px] px-2.5 py-[5px] text-[10px] font-semibold">Expired</span>
                  ) : isApplied ? (
                    <span className="border-plan-save-line bg-plan-save-soft text-plan-save shrink-0 rounded-[7px] border px-2.5 py-[5px] text-[10px] font-semibold">
                      Applied
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={state.checking || applied}
                      onClick={() => onApply(coupon.code)}
                      aria-label={`Apply ${coupon.code}`}
                      className="border-plan-line-strong text-plan-violet hover:bg-brand-soft shrink-0 rounded-[7px] border px-3 py-[5px] text-[10px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Apply
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

/** Step 2: what you're buying, the bill, coupons and the pay button. */
export function ReviewStep({
  chosen,
  plans,
  scope,
  coupon,
  coupons,
  busy,
  onBack,
  onSwitchPlan,
  onCouponInput,
  onApplyCoupon,
  onRemoveCoupon,
  onPay,
}: {
  chosen: Plan;
  plans: Plan[];
  scope: string;
  coupon: CouponState;
  coupons: Coupon[];
  busy: boolean;
  onBack: () => void;
  onSwitchPlan: (priceId: number) => void;
  onCouponInput: (value: string) => void;
  onApplyCoupon: (code?: string) => void;
  onRemoveCoupon: () => void;
  onPay: () => void;
}) {
  const annual = plans.find((plan) => plan.durationMonths === 12 && !plan.isFree);
  const annualSaving = annual && annual.priceId !== chosen.priceId ? annual.saved : 0;
  const amounts = bill(chosen.price, coupon.applied ? coupon.discount : 0);
  const totalSaved = chosen.saved + amounts.discount;
  const payLabel = busy ? 'Working on it…' : chosen.isFree ? 'Activate free plan' : `Pay ${formatInr(amounts.total)}`;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-y-3.5">
        <button type="button" onClick={onBack} className="text-plan-deep hover:text-plan-ink inline-flex items-center gap-1.5 text-[13px] font-semibold">
          <ArrowLeft aria-hidden size={14} strokeWidth={2.4} />
          Back
        </button>
        <CheckoutSteps onBack={onBack} />
      </div>

      <div className="border-plan-line from-plan-tile via-plan-panel to-plan-tile-active mt-5 rounded-lg border bg-linear-100 px-[22px] py-[22px] md:px-7 md:py-[26px]">
        <h1 className="text-plan-ink text-2xl leading-[1.15] font-extrabold tracking-[-0.02em] md:text-[29px]">You&apos;re almost there! 🌟</h1>
        <p className="text-plan-muted mt-2 text-[13px]">Complete your payment to unlock full access and start cracking your exams.</p>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <div>
          <div className="border-plan-line bg-surface rounded-lg border p-5 md:p-[22px]">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <span className="border-plan-line-strong text-plan-violet inline-flex items-center rounded-full border px-2.5 py-1 text-[9px] font-bold tracking-[0.12em] uppercase">
                  {tierPill(chosen)}
                </span>
                <h2 className="text-plan-ink mt-3 text-xl font-bold md:text-[22px]">{chosen.name}</h2>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
                  <span className="text-plan-save font-semibold">Plan selected</span>
                  <span className="text-plan-divider">•</span>
                  <span className="text-plan-muted">{chosen.validityLabel}</span>
                  {chosen.isCombo && (
                    <>
                      <span className="text-plan-divider">•</span>
                      <span className="text-plan-muted">CBSE boards included</span>
                    </>
                  )}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-brand text-[26px] leading-none font-extrabold md:text-[30px]">{formatInr(chosen.price)}</p>
                <p className="text-plan-label mt-1.5 text-[11px]">{priceCadence(chosen)}</p>
              </div>
            </div>
            <div className="border-plan-line mt-[18px] border-t pt-4">
              <p className="text-plan-label text-[10px] font-bold tracking-[0.12em] uppercase">
                What&apos;s included in {chosen.isFree ? 'Basic' : 'Topper'} access:
              </p>
              <ul className="mt-3 grid grid-cols-1 gap-x-5 gap-y-2.5 sm:grid-cols-2">
                {planHighlights(chosen, scope).map((item) => (
                  <li key={item} className="text-plan-deep flex items-start gap-2 text-[12px]">
                    <span className="bg-plan-violet text-on-brand mt-px flex size-[15px] shrink-0 items-center justify-center rounded-full">
                      <Check aria-hidden size={9} strokeWidth={4} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <button type="button" onClick={onBack} className="text-plan-violet mt-4 text-[12px] font-semibold underline underline-offset-2 hover:opacity-80">
                Change plan
              </button>
            </div>
          </div>

          {annual && annualSaving > 0 && (
            <div className="border-plan-ok-line bg-plan-save-soft mt-3.5 flex flex-wrap items-center justify-between gap-3.5 rounded-[14px] border px-4 py-3.5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="bg-plan-ok-soft text-plan-save flex size-[34px] shrink-0 items-center justify-center rounded-full">
                  <PiggyBank aria-hidden size={17} strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <p className="text-plan-save-deep m-0 text-[13px] font-bold">Annual plan saves {formatInr(annualSaving)} till your exam</p>
                  <p className="text-plan-muted m-0 mt-0.5 text-[11px]">Lock in 12 months of unlimited preparation for the lowest rate.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onSwitchPlan(annual.priceId)}
                className="bg-plan-save text-on-brand hover:bg-plan-save-deep shrink-0 rounded-[10px] px-4 py-[9px] text-[12px] font-semibold"
              >
                Switch to annual
              </button>
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-6 lg:h-fit">
          <div className="border-plan-line bg-surface rounded-lg border p-[18px] md:p-5">
            <h3 className="text-plan-ink text-[15px] font-bold">Order summary</h3>
            {chosen.isFree ? (
              <p className="text-plan-muted mt-3.5 text-[13px] leading-[19px]">
                No payment needed. This plan stays free — upgrade whenever you want more.
              </p>
            ) : (
              <>
                <dl className="mt-4 space-y-[11px] text-[12px]">
                  <SummaryRow label="Plan price" value={formatInr(amounts.price)} />
                  {amounts.discount > 0 && <SummaryRow label="Discount" value={`− ${formatInr(amounts.discount)}`} credit />}
                  <SummaryRow label="Subtotal" value={formatInr(amounts.subtotal)} />
                  <SummaryRow label="GST (18%)" value={formatInr(amounts.gst)} />
                </dl>
                <div className="bg-plan-section mt-4 flex items-center justify-between gap-3 rounded-md px-3.5 py-[13px]">
                  <div className="min-w-0">
                    <p className="text-plan-ink m-0 text-[14px] font-bold">Total Amount</p>
                    {totalSaved > 0 && (
                      <p className="text-plan-save m-0 mt-1 flex items-center gap-[3px] text-[9px] font-bold tracking-[0.08em] uppercase">
                        <Zap aria-hidden size={9} strokeWidth={3} /> You save {formatInr(totalSaved)}!
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-brand m-0 text-[22px] leading-none font-extrabold md:text-2xl" data-testid="order-total">
                      {formatInr(amounts.total)}
                    </p>
                    <p className="text-plan-strike m-0 mt-[5px] text-[9px] tracking-[0.1em] uppercase">incl. GST</p>
                  </div>
                </div>
                <CouponBox state={coupon} coupons={coupons} onInput={onCouponInput} onApply={onApplyCoupon} onRemove={onRemoveCoupon} />
              </>
            )}
          </div>
          <div className="bg-plan-tile mt-3.5 hidden rounded-lg p-4 lg:block">
            <button
              type="button"
              onClick={onPay}
              disabled={busy}
              className="bg-brand text-on-brand hover:bg-brand-800 flex w-full items-center justify-center gap-2 rounded-[10px] px-5 py-3.5 text-[14px] font-bold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {payLabel}
              <ArrowRight aria-hidden size={15} strokeWidth={2.4} />
            </button>
            <p className="text-plan-label m-0 mt-2.5 text-center text-[10px]">
              By paying you agree to the <span className="text-plan-violet font-semibold underline underline-offset-2">Terms</span> and{' '}
              <span className="text-plan-violet font-semibold underline underline-offset-2">Refund policy</span>.
            </p>
          </div>
        </div>
      </div>

      <MobileActionBar
        label={chosen.name}
        amount={chosen.isFree ? 0 : amounts.total}
        strikeAmount={chosen.isFree ? null : chosen.mrp}
        cta={busy ? 'Working…' : chosen.isFree ? 'Activate' : `Pay ${formatInr(amounts.total)}`}
        disabled={busy}
        onClick={onPay}
      />
    </>
  );
}
