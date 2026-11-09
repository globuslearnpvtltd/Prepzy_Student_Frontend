'use client';

import { cx } from '@prepzy/design-system';
import { ArrowLeft, ChevronRight, House } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { userMessage } from '@/shared/lib/errors';

export const COURSE_FALLBACK = '/illustrations/tests/course.jpg';

/** Remote image (course covers come from several CDNs) with a local fallback when missing or broken. */
export function CoverImage({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={!src || failed ? COURSE_FALLBACK : src}
      alt={alt}
      onError={() => setFailed(true)}
      className={cx('h-full w-full object-cover', className)}
    />
  );
}

/** Bar with a track and fill, as on the previous course cards. */
export function ProgressBar({ percent, label }: { percent: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="border-line bg-surface h-2.5 w-full overflow-hidden rounded-full border-2"
      >
        <div
          className="from-info to-info-400 h-full rounded-full bg-linear-to-r"
          style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
        />
      </div>
      <span className="text-foreground-muted text-xs font-medium">{percent}%</span>
    </div>
  );
}

/** Inline failure message for one section; the rest of the page keeps working. */
export function SectionError({ title, error }: { title: string; error?: unknown }) {
  return (
    <div role="alert" className="border-danger/30 bg-danger-soft w-full rounded-xl border-2 p-6 text-sm">
      <p className="text-danger font-semibold">{title}</p>
      {error !== undefined && <p className="text-foreground-muted mt-1">{userMessage(error)}</p>}
    </div>
  );
}

export interface Crumb {
  label: string;
  href?: string;
}

/** Back button + crumb trail (the previous app's BreadCrumb). */
export function Breadcrumb({
  crumbs,
  backHref,
  className,
  children,
}: {
  crumbs: Crumb[];
  backHref: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cx('flex min-w-0 items-center gap-2 sm:gap-4', className)}>
      <Link
        href={backHref}
        className="bg-surface text-neutral-700 hover:bg-neutral-50 flex shrink-0 items-center gap-2 rounded-xl px-3 py-[11px] text-sm font-semibold shadow-sm sm:px-4 lg:px-3.5 lg:py-3.5"
      >
        <ArrowLeft aria-hidden className="size-4" />
        <span className="hidden whitespace-nowrap sm:inline">Back</span>
      </Link>
      <nav
        aria-label="Breadcrumb"
        className="bg-surface flex min-w-0 items-center gap-2 overflow-x-auto rounded-xl px-3 py-2.5 shadow-sm lg:px-4 lg:py-3.5"
      >
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          const label =
            index === 0 ? (
              <>
                <House aria-hidden className="size-4 sm:hidden" />
                <span className="hidden sm:inline">{crumb.label}</span>
              </>
            ) : (
              <span className="whitespace-nowrap">{crumb.label}</span>
            );
          return (
            <span key={`${crumb.label}-${index}`} className="flex items-center gap-2">
              {crumb.href && !last ? (
                <Link href={crumb.href} aria-label={crumb.label} className="text-brand flex items-center text-sm font-bold hover:underline">
                  {label}
                </Link>
              ) : (
                <span
                  aria-current={last ? 'page' : undefined}
                  className={cx('flex items-center text-sm font-semibold', last ? 'text-neutral-350' : 'text-brand')}
                >
                  {label}
                </span>
              )}
              {!last && <ChevronRight aria-hidden className="size-4 shrink-0 text-neutral-300" />}
            </span>
          );
        })}
      </nav>
      {children}
    </div>
  );
}

/** "Did you know?" card on the Learn and Notes pages. */
export function DidYouKnow() {
  return (
    <aside
      aria-label="Did you know?"
      className="border-accent-400 bg-accent-50 flex items-center gap-4 rounded-xl border-2 p-2.5 md:p-5"
    >
      <span className="bg-surface text-accent-400 flex shrink-0 rounded-full p-2.5">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path
            d="M12.5 11.66c.17-.83.58-1.41 1.25-2.08A4.1 4.1 0 0 0 15 6.66a5 5 0 1 0-10 0c0 .84.17 1.84 1.25 2.92.58.58 1.08 1.25 1.25 2.08M7.5 15h5M8.33 18.34h3.34"
            stroke="currentColor"
            strokeWidth="1.67"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-neutral-800 text-[16px] leading-6 font-bold">Did you know?</p>
        <p className="text-neutral-700 text-[14px] leading-6 italic md:text-[16px]">
          &quot;The speed of light can actually slow down when passing through water or glass!&quot;
        </p>
      </div>
    </aside>
  );
}
