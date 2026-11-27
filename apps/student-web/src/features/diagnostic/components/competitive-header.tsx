'use client';

import { cx } from '@prepzy/design-system';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

// Competitive (NEET) desktop header of the diagnostic screens (previous app's NEETDiagnosticHeader / report bar):
// a "Back" card + a card with the "Dashboard > …" breadcrumb and, on the setup flow, the 3-step stepper.
// Board exams keep the shared Stepper / Breadcrumb.

const STEPS = ['Select Topics', 'Review Blueprint', 'Take Test'];

const card = 'border-brand-75 bg-surface flex h-[62px] items-center rounded-[20px] border';

export function CompetitiveDiagnosticHeader({
  current,
  crumb = 'Diagnostic Test',
  dashboardHref,
  onBack,
  backHref,
  className,
}: {
  /** Omit to hide the stepper. */
  current?: 1 | 2 | 3;
  crumb?: string;
  dashboardHref: string;
  onBack?: () => void;
  backHref?: string;
  className?: string;
}) {
  const backClass = cx(
    card,
    'hover:bg-neutral-50 shrink-0 gap-4 px-[21px] text-[14px] font-semibold text-neutral-900/70 transition-colors',
  );
  const back = (
    <>
      <ArrowLeft aria-hidden className="size-4" />
      Back
    </>
  );
  return (
    <div className={cx('flex w-full items-center gap-4', className)}>
      {onBack || !backHref ? (
        <button type="button" onClick={onBack} className={backClass}>
          {back}
        </button>
      ) : (
        <Link href={backHref} className={backClass}>
          {back}
        </Link>
      )}
      <div className={cx(card, 'min-w-0 flex-1 justify-between gap-4 px-[21px]')}>
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-[10px]">
          <Link href={dashboardHref} className="text-brand text-[14px] font-bold whitespace-nowrap hover:opacity-70">
            Dashboard
          </Link>
          <ChevronRight aria-hidden className="size-4 shrink-0 text-neutral-550" />
          <span className="truncate text-[14px] font-semibold text-neutral-550">{crumb}</span>
        </nav>
        {current !== undefined && (
          <ol aria-label="Steps" className="flex shrink-0 items-center gap-4">
            {STEPS.map((label, i) => {
              const n = i + 1;
              const lit = current >= n;
              return (
                  <li key={label} className="flex shrink-0 items-center gap-2" aria-current={current === n ? 'step' : undefined}>
                    <span
                      className={cx(
                        'flex size-7 items-center justify-center rounded-[14px] text-[13px] font-bold tabular-nums',
                        lit ? 'bg-brand text-on-brand' : 'bg-brand-125 text-neutral-550',
                      )}
                    >
                      {n}
                    </span>
                    <span
                      className={cx(
                        'hidden text-[14px] font-semibold whitespace-nowrap lg:inline',
                        lit ? 'text-brand' : 'text-neutral-550',
                      )}
                    >
                      {label}
                    </span>
                    {n < STEPS.length && (
                      <span aria-hidden className={cx('ml-2 h-1 w-8 shrink-0 rounded-full', lit ? 'bg-brand' : 'bg-neutral-200')} />
                    )}
                  </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
