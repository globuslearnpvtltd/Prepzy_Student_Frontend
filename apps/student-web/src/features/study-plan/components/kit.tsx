import { cx, Spinner } from '@prepzy/design-system';
import { AlertTriangle, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

/** Centred notice (no class / no plan / errors), as on the previous study plan and diagnostic pages. */
export function Notice({
  title,
  body,
  action,
  tone = 'muted',
}: {
  title: string;
  body: string;
  action?: { label: string; href?: string; onClick?: () => void };
  tone?: 'muted' | 'danger';
}) {
  const button = 'bg-brand text-on-brand hover:bg-brand-hover rounded-md px-6 py-2.5 text-sm font-semibold';
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <span className={cx('flex size-16 items-center justify-center rounded-full', tone === 'danger' ? 'bg-danger-soft' : 'bg-neutral-100')}>
        <AlertTriangle aria-hidden className={cx('size-7', tone === 'danger' ? 'text-danger' : 'text-neutral-350')} />
      </span>
      <h1 className="text-lg font-bold text-neutral-950">{title}</h1>
      <p className="text-sm text-neutral-500">{body}</p>
      {action &&
        (action.href ? (
          <Link href={action.href} className={button}>
            {action.label}
          </Link>
        ) : (
          <button type="button" onClick={action.onClick} className={button}>
            {action.label}
          </button>
        ))}
    </div>
  );
}

/** Full-area loader with the previous ScreenLoader's message and sub-message. */
export function ScreenLoader({ message, sub }: { message: string; sub: string }) {
  return (
    <div role="status" className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <Spinner size="lg" label={message} />
      <p className="text-ink text-lg font-bold">{message}</p>
      <p className="text-sm text-neutral-500">{sub}</p>
    </div>
  );
}

/** Round back button: outlined chevron on phones, soft purple arrow on desktop. */
export function BackButton({ onClick, href, label = 'Go back' }: { onClick?: () => void; href?: string; label?: string }) {
  const mobile = 'border-info-50 bg-surface text-neutral-850 flex size-10 shrink-0 items-center justify-center rounded-full border-2 hover:opacity-80 md:hidden';
  const desktop =
    'border-brand-175 bg-brand-125 text-brand hidden size-10 shrink-0 items-center justify-center rounded-full border shadow-[0px_8px_20px_rgba(61,52,139,0.06)] hover:opacity-80 md:flex';
  const content = (
    <>
      <ChevronLeft aria-hidden className="size-5 md:hidden" />
      <ArrowLeft aria-hidden className="hidden size-[18px] md:block" />
    </>
  );
  if (href)
    return (
      <>
        <Link href={href} aria-label={label} className={mobile}>
          <ChevronLeft aria-hidden className="size-5" />
        </Link>
        <Link href={href} aria-label={label} className={desktop}>
          <ArrowLeft aria-hidden className="size-[18px]" />
        </Link>
      </>
    );
  return (
    <>
      <button type="button" onClick={onClick} aria-label={label} className={mobile}>
        {content}
      </button>
      <button type="button" onClick={onClick} aria-label={label} className={desktop}>
        <ArrowLeft aria-hidden className="size-[18px]" />
      </button>
    </>
  );
}

export function Breadcrumb({ dashboardHref, current, className }: { dashboardHref: string; current: string; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cx('border-neutral-150 bg-surface flex w-full items-center gap-[10px] rounded-md border px-[21px] py-[18px]', className)}>
      <Link href={dashboardHref} className="text-brand text-[14px] font-bold hover:opacity-70">
        Dashboard
      </Link>
      <ChevronRight aria-hidden className="size-4 text-neutral-400" />
      <span className="text-[14px] font-semibold text-neutral-400">{current}</span>
    </nav>
  );
}

/** Count inside a ring that fills with progress (0–1). */
export function ProgressRing({ value, progress, size, stroke }: { value: number; progress: number; size: number; stroke: number }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <span className="relative flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg aria-hidden className="absolute inset-0 -rotate-90" width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-brand-175" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className="stroke-brand transition-[stroke-dashoffset]"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - Math.max(0, Math.min(1, progress)))}
        />
      </svg>
      <span className="text-brand relative text-[16px] leading-none font-bold md:text-[13px]">{value}</span>
    </span>
  );
}

/** Sticky footer bar that bleeds to the page edges (selection count + primary action). */
export const stickyFooter =
  'bg-brand-50 border-neutral-150 sticky bottom-[72px] z-30 -mx-2.5 md:bottom-0 mt-6 flex items-center justify-between gap-4 border-t-2 p-6 md:-mx-5 md:px-10 md:py-3';
