'use client';

import { cx } from '@prepzy/design-system';
import { ArrowLeft, ArrowRight, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import type { BadgeTone, Plan } from '../../catalog';
import { formatAmount, formatInr } from '../../money';
import { perDayLabel } from '../../catalog';

export const PRIMARY_BUTTON =
  'bg-linear-115 from-brand-700 to-brand-450 text-on-brand shadow-[0_14px_28px_-16px_rgba(59,44,143,0.9)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60';

const CARD_BASE = 'rounded-[14px] border text-left transition disabled:cursor-not-allowed';

const cardSkin = (active: boolean, disabled = false) =>
  disabled
    ? 'border-plan-line bg-surface opacity-55'
    : active
      ? 'border-plan-line-strong bg-plan-tile-active'
      : 'border-plan-line bg-surface hover:border-plan-line-strong hover:shadow-[0_12px_28px_-22px_rgba(37,28,81,0.7)]';

const iconTile = (active: boolean) =>
  cx(
    'flex shrink-0 items-center justify-center rounded-[10px]',
    active ? 'bg-surface text-plan-violet shadow-[0_0_0_1px_var(--color-plan-line-strong)]' : 'bg-plan-tile text-plan-muted',
  );

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Go back"
      className="border-plan-line bg-surface text-plan-deep hover:bg-brand-soft flex size-9 items-center justify-center rounded-full border"
    >
      <ArrowLeft aria-hidden size={16} strokeWidth={2.4} />
    </button>
  );
}

export const Eyebrow = ({ children }: { children: ReactNode }) => (
  <p className="text-plan-label text-[11px] font-bold tracking-[0.14em] uppercase">{children}</p>
);

export function ExamCard({
  icon,
  label,
  description,
  active,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  description: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cx(CARD_BASE, cardSkin(active, disabled), 'flex h-full flex-col gap-2.5 p-3.5')}
    >
      <span className={cx(iconTile(active), 'size-[38px]')}>{icon}</span>
      <span className={cx('text-md font-bold', active ? 'text-plan-ink' : 'text-plan-violet')}>{label}</span>
      <span className="text-plan-muted text-[12px] leading-[17px]">{description}</span>
    </button>
  );
}

export function OptionCard({
  icon,
  title,
  subtitle,
  active,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(CARD_BASE, cardSkin(active), 'flex w-full items-center gap-2.5 px-3 py-[11px]')}
    >
      <span className={cx(iconTile(active), 'size-[30px]')}>{icon}</span>
      <span className="min-w-0">
        <span className="text-plan-ink block truncate text-[14px] font-bold">{title}</span>
        {subtitle ? <span className="text-plan-muted mt-0.5 block truncate text-[11px]">{subtitle}</span> : null}
      </span>
    </button>
  );
}

export function Switch({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={cx('relative h-[22px] w-10 shrink-0 rounded-full transition', checked ? 'bg-plan-violet' : 'bg-plan-divider')}
    >
      <span
        className={cx(
          'bg-surface absolute top-[3px] size-4 rounded-full shadow-sm transition-all',
          checked ? 'left-[21px]' : 'left-[3px]',
        )}
      />
    </button>
  );
}

export const PlanSkeleton = () => (
  <div className="flex flex-col gap-2.5" aria-label="Loading plans">
    {[0, 1, 2].map((row) => (
      <div key={row} className="border-plan-line bg-plan-section h-[104px] animate-pulse rounded-[14px] border" />
    ))}
  </div>
);

/** Shown in the plans panel before an option is picked. */
export function EmptyPlans({ hint }: { hint: string }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center px-6 py-10 text-center">
      <svg width="168" height="112" viewBox="0 0 168 112" fill="none" aria-hidden className="text-plan-divider">
        <path
          d="M30 62c-8-22 6-44 30-48 26-4 50 6 62 22 10 14 10 32-4 42"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="4 5"
          strokeLinecap="round"
        />
        <rect x="36" y="30" width="34" height="46" rx="6" className="fill-plan-tile" transform="rotate(-10 36 30)" />
        <rect x="100" y="26" width="34" height="46" rx="6" className="fill-plan-tile" transform="rotate(10 100 26)" />
        <rect x="62" y="20" width="44" height="58" rx="8" className="fill-surface stroke-plan-line-strong" />
        <circle cx="84" cy="38" r="9" className="fill-plan-chip" />
        <rect x="70" y="53" width="28" height="3.4" rx="1.7" className="fill-plan-chip" />
        <rect x="70" y="60" width="20" height="3.4" rx="1.7" className="fill-plan-chip" />
      </svg>
      <p className="text-plan-deep mt-[18px] text-[17px]">
        Your plans <span className="text-plan-ink font-bold">will appear here</span>
      </p>
      <p className="text-plan-muted mt-1.5 max-w-[300px] text-[12px] leading-[18px]">{hint}</p>
    </div>
  );
}

export function MobileActionBar({
  label,
  amount,
  strikeAmount,
  cta,
  disabled,
  onClick,
}: {
  label: string;
  /** Rupees incl. GST; 0 = free, null = still being priced. */
  amount: number | null;
  strikeAmount?: number | null;
  cta: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <div className="border-plan-line bg-surface/95 fixed inset-x-0 bottom-0 z-40 border-t px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] shadow-[0_-10px_30px_-20px_rgba(37,28,81,0.45)] backdrop-blur-sm lg:hidden">
      <div className="mx-auto flex w-full max-w-[520px] items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-plan-muted truncate text-[12px]">
            {label}
            {amount !== 0 ? ' · incl. GST' : ''}
          </p>
          <p className="mt-0.5 flex items-baseline gap-2">
            <span className="text-plan-deep text-[22px] leading-none font-bold">{amount === null ? '…' : amount > 0 ? formatAmount(amount) : 'Free'}</span>
            {strikeAmount ? <span className="text-plan-strike text-[13px] line-through">{formatInr(strikeAmount)}</span> : null}
          </p>
        </div>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className={cx('shrink-0 rounded-md px-[22px] py-3.5 text-[15px] font-semibold', PRIMARY_BUTTON)}
        >
          {cta}
        </button>
      </div>
    </div>
  );
}

const BADGE: Record<BadgeTone, string> = {
  current: 'bg-success-soft text-plan-save',
  popular: 'bg-plan-chip text-brand-600',
  value: 'bg-plan-chip text-plan-violet',
};

/** One plan in the right-hand panel. The selected card goes dark and grows the continue button. */
export function PlanCard({
  plan,
  active,
  onSelect,
  onContinue,
}: {
  plan: Plan;
  active: boolean;
  onSelect: () => void;
  onContinue: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={active}
      aria-label={plan.name}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cx(
        'cursor-pointer rounded-[14px] border p-4 transition',
        active
          ? 'from-plan-card-from via-plan-violet-deep to-plan-card-to border-transparent bg-linear-135 shadow-[0_20px_44px_-24px_rgba(37,28,81,0.85)]'
          : 'border-plan-line bg-surface hover:border-plan-line-strong',
      )}
    >
      <div className="flex items-start justify-between gap-3.5">
        <div className="min-w-0">
          {plan.badge ? (
            <span
              className={cx(
                'inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold',
                active ? 'bg-surface/15 text-on-brand' : BADGE[plan.badge.tone],
                plan.badge.tone === 'current' && active && 'text-plan-ok-text',
                plan.badge.tone === 'popular' && !active && 'tracking-[0.08em] uppercase',
              )}
            >
              {plan.badge.label}
            </span>
          ) : (
            plan.isFree && (
              <span
                className={cx(
                  'inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold',
                  active ? 'bg-surface/15 text-on-brand' : 'bg-plan-tile text-plan-muted',
                )}
              >
                Free Plan
              </span>
            )
          )}
          <h3 className={cx('mt-2.5 text-[17px] leading-tight font-bold md:text-lg', active ? 'text-on-brand' : 'text-plan-ink')}>
            {plan.name}
          </h3>
          <p className={cx('mt-1.5 text-[12px]', active ? 'text-on-brand/70' : 'text-plan-muted')}>
            {plan.isFree ? 'Free Forever' : plan.validityLabel}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className={cx('text-[24px] leading-none font-extrabold md:text-[26px]', active ? 'text-plan-gold' : 'text-plan-violet-deep')}>
            {formatInr(plan.price)}
          </p>
          {plan.mrp ? (
            <p className={cx('mt-1.5 text-[11px] line-through', active ? 'text-on-brand/45' : 'text-plan-strike')}>
              {formatInr(plan.mrp)} / month
            </p>
          ) : null}
          {plan.saved > 0 ? (
            <p className={cx('mt-[3px] text-[11px] font-semibold', active ? 'text-plan-save-light' : 'text-plan-save')}>
              You save {formatInr(plan.saved)}*
            </p>
          ) : null}
          {plan.perDay ? (
            <span
              className={cx(
                'mt-2 inline-flex items-center gap-1 rounded-full px-[9px] py-1 text-[11px] font-bold',
                active ? 'bg-neutral-950/25 text-plan-gold' : 'bg-plan-chip text-plan-violet',
              )}
            >
              <Zap aria-hidden size={11} strokeWidth={2.6} className="shrink-0" />
              {perDayLabel(plan)}
              <span className="font-medium opacity-80">/day</span>
            </span>
          ) : null}
        </div>
      </div>
      {active &&
        (plan.isCurrent ? (
          // Renewal is blocked while the plan is active (the server answers 409 PLAN_ALREADY_ACTIVE).
          <p className="bg-surface/15 text-on-brand mt-4 hidden w-full items-center justify-center gap-2 rounded-[10px] px-[18px] py-3 text-[14px] font-bold lg:flex">
            Your current active plan
          </p>
        ) : (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onContinue();
            }}
            className="bg-surface text-plan-violet-deep hover:bg-brand-soft mt-4 hidden w-full items-center justify-center gap-2 rounded-[10px] px-[18px] py-3 text-[14px] font-bold lg:flex"
          >
            Continue with this plan
            <ArrowRight aria-hidden size={15} strokeWidth={2.4} />
          </button>
        ))}
    </div>
  );
}
