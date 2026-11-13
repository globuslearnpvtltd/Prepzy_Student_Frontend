'use client';

import { cx } from '@prepzy/design-system';
import { ArrowRight, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { userMessage } from '@/shared/lib/errors';

export function Failure({ title, error }: { title: string; error?: unknown }) {
  return (
    <div role="alert" className="border-danger/30 bg-danger-soft w-full rounded-xl border-2 p-6 text-sm">
      <p className="text-danger font-semibold">{title}</p>
      {error !== undefined && <p className="text-foreground-muted mt-1">{userMessage(error)}</p>}
    </div>
  );
}

/** Back button and breadcrumb trail (the trail from sm: on phones the page's own title says where you are). */
export function Crumbs({
  crumbs,
  back,
  className,
  children,
}: {
  crumbs: { label: string; href?: string }[];
  back: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cx('flex items-center justify-between gap-3', className)}>
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <Link
          href={back}
          className="bg-surface border-learn-line flex shrink-0 items-center gap-2 rounded-xl border px-3 py-[10px] text-sm font-semibold text-neutral-700 hover:bg-brand-50 sm:px-4"
        >
          <ArrowRight aria-hidden className="size-4 rotate-180" />
          Back
        </Link>
        <nav aria-label="Breadcrumb" className="bg-surface border-learn-line hidden min-w-0 sm:flex items-center gap-2 overflow-x-auto rounded-xl border px-3 py-2.5 lg:px-4">
          {crumbs.map((crumb, index) => (
            <span key={`${crumb.label}-${index}`} className="flex items-center gap-2 text-sm whitespace-nowrap">
              {crumb.href ? (
                <Link href={crumb.href} className="text-brand font-semibold hover:underline">
                  {crumb.label}
                </Link>
              ) : (
                <span
                  aria-current={index === crumbs.length - 1 ? 'page' : undefined}
                  className={cx('font-medium', index === crumbs.length - 1 ? 'text-neutral-550' : 'text-brand')}
                >
                  {crumb.label}
                </span>
              )}
              {index < crumbs.length - 1 && <span aria-hidden className="text-neutral-300">›</span>}
            </span>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}

/**
 * Bottom sheet on phones, a centred panel from lg: dims the page, locks its scroll, closes on Escape, the backdrop or
 * the close button, and gives focus back to whatever opened it.
 */
export function BottomSheet({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
      opener?.focus?.({ preventScroll: true });
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center lg:items-center lg:p-6">
      <div aria-hidden="true" onClick={onClose} className="bg-night-950/45 absolute inset-0" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="bg-surface relative flex max-h-[80dvh] w-full flex-col rounded-t-[24px] pt-2.5 shadow-[0_-8px_32px_rgba(26,23,51,0.18)] outline-none lg:max-h-[80vh] lg:max-w-[480px] lg:rounded-[24px] lg:pt-0"
      >
        <span aria-hidden="true" className="bg-neutral-200 mx-auto h-1 w-10 shrink-0 rounded-full lg:hidden" />
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 lg:px-6 lg:pt-6">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[18px] leading-6 font-bold text-neutral-950">
              {title}
            </h2>
            {subtitle && <p className="text-neutral-550 mt-1 text-[12px] leading-4">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title.toLowerCase()}`}
            className="hover:bg-neutral-100 -mr-1.5 shrink-0 rounded-full p-1.5 text-neutral-500"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] lg:px-4 lg:pb-5">{children}</div>
      </div>
    </div>
  );
}

/** A numbered row in a sheet (chapter contents, chapter list); the current one has a filled number. */
export function NumberedOption({
  index,
  label,
  current,
  onSelect,
}: {
  index: number;
  label: string;
  current: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={current ? 'true' : undefined}
        className={cx(
          'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
          current ? 'bg-brand-75' : 'hover:bg-neutral-100',
        )}
      >
        <span
          aria-hidden="true"
          className={cx(
            'flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
            current ? 'bg-brand text-on-brand' : 'bg-neutral-100 text-neutral-600',
          )}
        >
          {index}
        </span>
        <span className={cx('min-w-0 text-[13px] leading-5 font-semibold', current ? 'text-brand' : 'text-neutral-900')}>{label}</span>
      </button>
    </li>
  );
}
