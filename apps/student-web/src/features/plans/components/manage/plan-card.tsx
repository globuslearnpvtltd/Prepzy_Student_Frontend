import Image from 'next/image';
import type { ReactNode } from 'react';
import { canCancel, canExtend, canUpgrade, isFree, type ActivePlan } from '../../manage-data';

export interface PlanCardProps {
  plan: ActivePlan;
  isCurrent: boolean;
  expanded: boolean;
  /** Extend, buy and cancel need internet. */
  offline: boolean;
  onToggleHistory: () => void;
  onExtend: () => void;
  onCancel: () => void;
  onUpgrade: () => void;
}

function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-[6px] ${className}`}>
      <p className="font-partner m-0 text-[11px] leading-normal font-bold tracking-[0.77px] text-onboarding-label">{label}</p>
      {children}
    </div>
  );
}

const primaryButton =
  'font-partner text-on-brand rounded-[12px] bg-brand-700 px-[26px] py-[14px] text-[15px] font-bold whitespace-nowrap transition-colors hover:bg-account-hover disabled:cursor-not-allowed disabled:bg-account-track disabled:text-account-disabled-text';

const shortDate = (value: string) => new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** Desktop card: one active plan per class (class plans) or exam (target-year plans); ended plans go to the history. */
export function PlanCard({ plan, isCurrent, expanded, offline, onToggleHistory, onExtend, onCancel, onUpgrade }: PlanCardProps) {
  const free = isFree(plan);

  return (
    <div className="bg-surface w-full rounded-[20px] border border-manage-card-line p-[20px] shadow-[0px_6px_18px_0px_rgba(36,29,82,0.05)] lg:p-[24px]">
      <div className="flex flex-col gap-[16px] lg:flex-row lg:items-center lg:gap-[30px]">
        <div className="flex min-w-0 shrink-0 flex-col gap-[4px] lg:w-[290px]">
          <p className="font-display m-0 text-[21px] leading-tight font-bold text-onboarding-ink">{plan.name}</p>
          <div className="flex flex-wrap items-center gap-[6px]">
            <span className="font-partner rounded-[8px] bg-account-info-soft px-[10px] py-[3px] text-[12.5px] font-bold text-brand-700">{plan.chip}</span>
            {free && (
              <span className="font-partner rounded-[8px] bg-account-ok-soft px-[10px] py-[3px] text-[12.5px] font-bold text-account-ok-text">Free</span>
            )}
            {isCurrent && (
              <span className="rounded-full bg-account-gold-soft px-[8px] py-[3px] text-[11px] font-semibold text-account-gold">Current</span>
            )}
          </div>
        </div>

        <div className="grid min-w-0 flex-1 grid-cols-2 gap-[16px] sm:flex sm:items-center sm:gap-[30px]">
          <Field label="START DATE" className="shrink-0 sm:w-[130px]">
            <p className="font-display m-0 text-[19px] leading-normal font-bold text-onboarding-ink">{plan.startDate || '—'}</p>
          </Field>
          <Field label="END DATE" className="shrink-0 sm:w-[264px]">
            <div className="flex flex-wrap items-center gap-[12px]">
              <p className="font-display m-0 text-[19px] leading-normal font-bold text-onboarding-ink">{plan.endDate || '—'}</p>
              {canExtend(plan) && (
                <button
                  type="button"
                  onClick={onExtend}
                  disabled={offline}
                  className="font-partner flex items-center gap-[7px] rounded-[11px] border-[1.3px] border-manage-chip-line bg-account-info-soft py-[8px] pr-[15px] pl-[13px] text-[14.5px] font-bold text-brand-700 transition-colors hover:bg-manage-chip-hover disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Image src="/illustrations/plans/extend.svg" alt="" width={16} height={16} />
                  Extend plan
                </button>
              )}
            </div>
          </Field>
          <Field label="STATUS" className="shrink-0 sm:w-[110px]">
            <span className="font-partner inline-flex w-fit items-center gap-[7px] rounded-full border border-manage-active-line bg-account-ok-soft px-[14px] py-[6px] text-[14px] font-bold text-manage-active">
              <Image src="/illustrations/plans/dot-active.svg" alt="" width={8} height={8} />
              Active
            </span>
          </Field>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-[12px]">
          {canCancel(plan) && (
            <button
              type="button"
              onClick={onCancel}
              disabled={offline}
              className="text-[14px] font-semibold whitespace-nowrap text-danger-600 hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-45"
            >
              Cancel plan
            </button>
          )}
          {canUpgrade(plan) && (
            <button type="button" onClick={onUpgrade} disabled={offline} className={primaryButton}>
              Upgrade
            </button>
          )}
          {!free && (
            <button
              type="button"
              onClick={onToggleHistory}
              aria-label={expanded ? 'Hide billing history' : 'Show billing history'}
              aria-expanded={expanded}
              className="flex size-[40px] shrink-0 items-center justify-center rounded-full bg-manage-icon transition-colors hover:bg-account-info-soft"
            >
              <Image
                src="/illustrations/plans/chevron-down.svg"
                alt=""
                width={19}
                height={19}
                className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
              />
            </button>
          )}
        </div>
      </div>

      {plan.hasPendingPlan && plan.pendingStartDate && plan.pendingPurchaseDate && (
        <div className="mt-[16px] rounded-[12px] border border-account-ok-line bg-success-50 px-[14px] py-[10px]">
          <p className="m-0 text-[12px] leading-normal font-medium text-account-ok-text">
            ✓&nbsp; Plan will be renewed on {shortDate(plan.pendingStartDate)} as per the purchase made on{' '}
            {shortDate(plan.pendingPurchaseDate)}.
          </p>
        </div>
      )}
    </div>
  );
}
