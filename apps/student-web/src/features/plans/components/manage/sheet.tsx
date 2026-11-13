'use client';

import Image from 'next/image';
import { useEffect, type ReactNode } from 'react';

/** Bottom sheet on phones, centred dialog from lg. `compact`: tighter desktop spacing (the cancel dialog fits a laptop). */
export function Sheet({
  label,
  width = 480,
  compact = false,
  onClose,
  children,
}: {
  label: string;
  width?: number;
  compact?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-end justify-center bg-[rgba(30,27,57,0.42)] leading-normal lg:items-center lg:bg-account-scrim/40 lg:px-[16px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(event) => event.stopPropagation()}
        style={{ ['--modal-w' as string]: `${width}px` }}
        // Scrolling stays as a last resort on very short screens, without a visible scrollbar.
        className={`bg-surface flex max-h-[calc(100dvh-24px)] w-full flex-col gap-[14px] overflow-y-auto rounded-t-[24px] px-[20px] pt-[12px] pb-[28px] [scrollbar-width:none] lg:max-w-[var(--modal-w)] lg:rounded-[24px] lg:shadow-[0px_16px_44px_0px_rgba(26,23,51,0.18)] [&::-webkit-scrollbar]:hidden ${compact ? 'lg:gap-[12px] lg:p-[24px]' : 'lg:gap-[16px] lg:p-[28px]'}`}
      >
        <div className="flex justify-center lg:hidden" aria-hidden="true">
          <span className="h-[4px] w-[40px] rounded-[4px] bg-account-outline" />
        </div>
        {children}
      </div>
    </div>
  );
}

export const outlineButton =
  'bg-surface min-w-0 flex-1 rounded-full border border-account-outline px-[22px] py-[13px] text-[14px] font-semibold text-account-ink transition-colors hover:bg-account-soft disabled:opacity-45';
/** Without vertical padding, for buttons whose height differs between mobile and desktop. */
export const primaryButtonBase =
  'text-on-brand flex min-w-0 flex-1 items-center justify-center gap-[8px] rounded-full bg-brand-700 px-[22px] text-[14px] font-semibold transition-colors hover:bg-account-hover disabled:opacity-80';
export const primaryButton = `${primaryButtonBase} py-[13px]`;

export const modalTitle = 'm-0 text-[18px] leading-normal font-bold text-account-ink lg:text-[20px]';

export function DetailRows({ rows }: { rows: { label: string; value: string; tone?: 'green' }[] }) {
  return (
    <div className="flex flex-col gap-[10px] rounded-[14px] bg-account-soft p-[14px] text-[13px] lg:gap-[12px] lg:p-[16px] lg:text-[14px]">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-[12px]">
          <span className="text-neutral-550">{row.label}</span>
          <span className={`text-right font-medium ${row.tone === 'green' ? 'text-account-ok-text' : 'text-account-ink'}`}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}

export function StatusBadge({ kind }: { kind: 'ok' | 'warn' }) {
  return (
    <div
      className={`flex size-[48px] shrink-0 items-center justify-center rounded-full lg:size-[52px] ${kind === 'ok' ? 'bg-success-50' : 'bg-warning-50'}`}
    >
      <Image src={`/illustrations/plans/${kind}-sm.svg`} alt="" width={22} height={22} className="lg:hidden" />
      <Image src={`/illustrations/plans/${kind}.svg`} alt="" width={24} height={24} className="hidden lg:block" />
    </div>
  );
}
