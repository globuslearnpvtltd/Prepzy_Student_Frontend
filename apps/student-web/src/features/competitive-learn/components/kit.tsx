'use client';

import { cx, Skeleton } from '@prepzy/design-system';
import { ArrowLeft, ArrowRight, ChevronRight, Home, Zap } from 'lucide-react';
import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import { routes } from '@/shared/config/routes';
import { useExam } from '@/shared/hooks/use-exam';
import { userMessage } from '@/shared/lib/errors';
import type { ChapterStatus } from '../api';
import { adjacentSteps, type ChapterStep } from '../steps';

/** Badge, dot and label for a chapter's status (notes library and course chapter rows). */
export const STATUS_META: Record<ChapterStatus, { label: string; dot: string; badge: string }> = {
  completed: { label: 'Completed', dot: 'bg-success-500', badge: 'bg-success-100 text-success-700' },
  in_progress: { label: 'In Progress', dot: 'bg-accent-400', badge: 'bg-brand-75 text-brand' },
  not_started: { label: 'Not Started', dot: 'bg-neutral-300', badge: 'bg-neutral-100 text-neutral-550' },
};

export interface Crumb {
  label: string;
  href?: string;
}

/** Back button + breadcrumb trail, with optional actions on the right (desktop). */
export function Breadcrumb({
  crumbs,
  backHref,
  right,
  className,
}: {
  crumbs: Crumb[];
  backHref: string;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('flex min-w-0 items-center gap-2 pb-3 sm:gap-4', right && 'lg:items-stretch', className)}>
      <Link
        href={backHref}
        aria-label="Back"
        className="bg-surface hover:bg-neutral-50 flex shrink-0 items-center gap-2 rounded-md px-3 py-[11px] text-sm font-semibold text-neutral-700 shadow-sm sm:px-4 lg:px-3.5 lg:py-3.5"
      >
        <ArrowLeft aria-hidden className="size-4" />
        <span className="hidden whitespace-nowrap sm:inline">Back</span>
      </Link>
      <nav
        aria-label="Breadcrumb"
        className={cx(
          'bg-surface flex min-w-0 items-center gap-2 overflow-x-auto rounded-md px-3 py-2.5 shadow-sm [scrollbar-width:none] lg:px-4 lg:py-3.5',
          right && 'flex-1',
        )}
      >
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          const label =
            index === 0 ? (
              <>
                <Home aria-hidden className="size-4 sm:hidden" />
                <span className="max-sm:sr-only">{crumb.label}</span>
              </>
            ) : (
              <span className="whitespace-nowrap">{crumb.label}</span>
            );
          return (
            <Fragment key={index}>
              {crumb.href && !last ? (
                <Link href={crumb.href} className="text-brand flex items-center text-sm leading-5 font-bold hover:underline">
                  {label}
                </Link>
              ) : (
                <span
                  aria-current={last ? 'page' : undefined}
                  className={cx('flex items-center text-sm leading-5 font-semibold', last ? 'text-neutral-350' : 'text-brand')}
                >
                  {label}
                </span>
              )}
              {!last && <ChevronRight aria-hidden className="size-4 shrink-0 text-neutral-300" />}
            </Fragment>
          );
        })}
        {right && <div className="ml-auto shrink-0">{right}</div>}
      </nav>
    </div>
  );
}

/** Prev / Next between the chapter's steps. */
export function StepNav({
  courseId,
  moduleId,
  step,
  stretch = false,
}: {
  courseId: string;
  moduleId: string;
  step: ChapterStep;
  stretch?: boolean;
}) {
  const exam = useExam();
  const { prev, next } = adjacentSteps(step);
  const base = 'flex items-center rounded-md py-2.5 text-sm leading-5 font-semibold transition-colors';
  const prevClass = cx(base, 'border-brand-150 bg-surface text-brand gap-1.5 border px-3', stretch && 'flex-1 justify-center');
  const nextClass = cx(base, 'bg-brand text-on-brand gap-2 px-6 shadow-sm', stretch && 'flex-1 justify-center');
  const link = (target: ChapterStep | null, className: string, children: ReactNode, label: string) =>
    target ? (
      <Link href={routes.learnModule(exam.slug, courseId, moduleId, target)} aria-label={label} className={cx(className, 'hover:opacity-90')}>
        {children}
      </Link>
    ) : (
      <span aria-disabled="true" aria-label={label} className={cx(className, 'cursor-not-allowed opacity-40')}>
        {children}
      </span>
    );
  return (
    <div className={cx('flex items-center gap-3', stretch && 'w-full')}>
      {link(
        prev,
        prevClass,
        <>
          <ArrowLeft aria-hidden className="size-4" />
          Prev
        </>,
        'Previous step',
      )}
      {link(
        next,
        nextClass,
        <>
          Next
          <ArrowRight aria-hidden className="size-4" />
        </>,
        'Next step',
      )}
    </div>
  );
}

/** "… Coming Soon!" card with the brand icon, an orange clock badge and an "In progress" pill. */
export function ComingSoon({ icon, title, children, className }: { icon: ReactNode; title: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx('flex flex-col items-center justify-center gap-4 px-4 py-12 text-center', className)}>
      <div className="bg-brand-75 relative flex size-24 items-center justify-center rounded-full">
        {icon}
        <span className="bg-accent-500 border-surface absolute -top-[2px] -right-1 flex size-7 items-center justify-center rounded-full border-[3px]">
          <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" className="stroke-on-brand" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7V12L15 15" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
      <p className="text-brand text-[22px] leading-7 font-bold">{title}</p>
      <p className="max-w-[360px] text-[14px] leading-5 text-neutral-550">{children}</p>
      <span className="bg-accent-100 text-accent-800 mt-1 flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold">
        <Zap aria-hidden className="size-3.5" />
        In progress
      </span>
    </div>
  );
}

export function ErrorCard({ title, error }: { title: string; error: unknown }) {
  return (
    <div role="alert" className="border-danger/30 bg-danger-soft w-full rounded-md border-2 p-6 text-sm">
      <p className="text-danger font-semibold">{title}</p>
      <p className="text-foreground-muted mt-1">{userMessage(error)}</p>
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="flex w-full flex-col gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-[72px] w-full rounded-lg" />
      ))}
    </div>
  );
}

/** Numbered chapter row (notes library and course page). */
export function ChapterRow({
  number,
  title,
  tag,
  status,
  percent,
  href,
  locked = false,
}: {
  number: number;
  title: string;
  tag?: string | null;
  status: ChapterStatus;
  percent: number;
  href: string;
  locked?: boolean;
}) {
  const meta = STATUS_META[status];
  const active = status === 'in_progress';
  const className = cx(
    'bg-surface flex items-center gap-3 rounded-lg p-3 shadow-sm transition-all duration-150 sm:gap-4 lg:p-4',
    active ? 'border-2 border-neutral-200' : 'border border-neutral-100',
    !locked && 'hover:border-brand/30 hover:bg-neutral-50 hover:shadow-card hover:-translate-y-0.5',
  );
  const body = (
    <>
      <span className={cx('flex size-9 shrink-0 items-center justify-center rounded-sm text-sm font-bold', meta.badge)}>
        {String(number).padStart(2, '0')}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[14px] leading-snug font-bold text-neutral-950 sm:text-[16px]">{title}</span>
          {tag && (
            <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium tracking-wide text-neutral-550 uppercase">
              {tag}
            </span>
          )}
        </span>
        <span className="mt-1 flex items-center gap-2">
          <span className={cx('size-2 shrink-0 rounded-full', meta.dot)} />
          <span className="shrink-0 text-[11px] text-neutral-550 sm:text-[12px]">{meta.label}</span>
          <span className="ml-1 hidden h-1.5 max-w-[160px] flex-1 overflow-hidden rounded-full bg-neutral-100 sm:block">
            <span className="bg-brand block h-full rounded-full" style={{ width: `${percent}%` }} />
          </span>
          <span className="hidden shrink-0 text-[11px] text-neutral-350 sm:inline">{percent}%</span>
        </span>
      </span>
      {locked ? (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-350">
          <svg aria-label="Locked" role="img" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </span>
      ) : (
        <span className="flex shrink-0 items-center gap-2">
          {status === 'completed' && (
            <svg aria-label="Completed" role="img" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-success-500 mx-[7px]">
              <circle cx="12" cy="12" r="10" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          )}
          <span
            className={cx(
              'size-7 shrink-0 items-center justify-center rounded-full',
              status === 'completed' ? 'hidden lg:flex' : 'flex',
              active ? 'bg-brand text-on-brand' : 'bg-neutral-100 text-neutral-350',
            )}
          >
            <ChevronRight aria-hidden className="size-[18px]" />
          </span>
        </span>
      )}
    </>
  );
  return locked ? (
    <div className={className} aria-disabled="true">
      {body}
    </div>
  ) : (
    <Link href={href} className={className}>
      {body}
    </Link>
  );
}
