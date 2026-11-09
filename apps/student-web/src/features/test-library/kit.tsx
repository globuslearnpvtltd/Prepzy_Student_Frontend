'use client';

import { Alert, Skeleton, cx } from '@prepzy/design-system';
import { ArrowLeft, ChevronRight, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { routes } from '@/shared/config/routes';
import { useExam } from '@/shared/hooks/use-exam';
import { userMessage } from '@/shared/lib/errors';
import type { LibraryStatus } from './api';

export const panel = 'bg-surface rounded-[20px] border border-neutral-100 shadow-sm';

/** "Back · Dashboard > Page" bar used on the competitive hubs. */
export function HubBreadcrumb({ label }: { label: string }) {
  const exam = useExam();
  const router = useRouter();
  const box = 'bg-surface flex h-12 items-center rounded-xl px-4 shadow-sm';
  return (
    <div className="flex gap-2">
      <button type="button" onClick={() => router.back()} className={cx(box, 'gap-2 text-sm font-medium')}>
        <ArrowLeft aria-hidden className="size-4" />
        Back
      </button>
      <nav aria-label="Breadcrumb" className={cx(box, 'gap-2 text-sm font-semibold')}>
        <Link href={routes.dashboard(exam.slug)} className="text-brand">
          Dashboard
        </Link>
        <ChevronRight aria-hidden className="text-foreground-subtle size-4" />
        <span aria-current="page" className="text-foreground-subtle">
          {label}
        </span>
      </nav>
    </div>
  );
}

export function StatTile({
  icon: Icon,
  value,
  label,
  tone = 'brand',
}: {
  icon: LucideIcon;
  value: string | number;
  label: string;
  tone?: 'brand' | 'accent';
}) {
  return (
    <div className={cx(panel, 'flex items-center gap-4 p-4')}>
      <span
        className={cx(
          'text-on-brand flex size-10 shrink-0 items-center justify-center rounded-lg',
          tone === 'brand' ? 'bg-brand' : 'bg-accent-400',
        )}
      >
        <Icon aria-hidden className="size-5" />
      </span>
      <span className="flex flex-col">
        <span className="text-brand-950 text-xl font-bold">{value}</span>
        <span className="text-foreground-soft text-sm">{label}</span>
      </span>
    </div>
  );
}

const STATUS_PILL: Record<LibraryStatus, { label: string; className: string }> = {
  pending: { label: 'PENDING', className: 'bg-accent-50 text-accent-600' },
  completed: { label: 'COMPLETED', className: 'bg-success-50 text-success-700' },
  'in-progress': { label: 'IN PROGRESS', className: 'bg-brand-75 text-brand' },
};

export function StatusPill({ status }: { status: LibraryStatus }) {
  const pill = STATUS_PILL[status];
  return (
    <span className={cx('shrink-0 rounded-[10px] px-3 py-1 text-[11px] font-bold tracking-wide', pill.className)}>
      {pill.label}
    </span>
  );
}

export function GridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-48 rounded-[20px]" />
      ))}
    </div>
  );
}

export function LoadError({ error }: { error: unknown }) {
  return <Alert tone="danger">{userMessage(error)}</Alert>;
}

export function EmptyState({ title, text }: { title: string; text?: string }) {
  return (
    <div className={cx(panel, 'flex flex-col items-center gap-2 p-10 text-center')}>
      <p className="text-lg font-semibold">{title}</p>
      {text && <p className="text-foreground-muted text-sm">{text}</p>}
    </div>
  );
}

export const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

export const formatHours = (minutes: number) => {
  const hrs = minutes / 60;
  if (Number.isInteger(hrs)) return `${hrs} Hr${hrs === 1 ? '' : 's'}`;
  return minutes < 60 ? `${minutes} Min` : `${hrs.toFixed(1)} Hrs`;
};

export const pad2 = (n: number) => String(n).padStart(2, '0');
