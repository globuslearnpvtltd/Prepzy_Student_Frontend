'use client';

import { Badge, Button, Card, Progress, Skeleton, cx } from '@prepzy/design-system';
import { CalendarDays, ChevronDown, Crown, Download, Layers, Leaf, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import type { ExamRef } from '@/shared/config/exams';
import { routes } from '@/shared/config/routes';
import { userMessage } from '@/shared/lib/errors';
import { classLabel, type Purchase, type PurchaseStatus } from '../api';
import { usePlanPayments } from '../hooks';
import { formatGbDate, formatInrExact } from '../money';
import { Pager, PaymentRows } from './billing-history';

const STATUS: Record<PurchaseStatus, { label: string; tone: 'success' | 'warning' | 'neutral' | 'danger' | 'info' }> = {
  active: { label: 'Active', tone: 'success' },
  pending: { label: 'Pending', tone: 'warning' },
  expired: { label: 'Expired', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
  refunded: { label: 'Refunded', tone: 'info' },
};

const DAY = 86_400_000;

/** Share of the plan still to run, 0–100; null when the dates don't allow it. */
function remainingShare(purchase: Purchase): number | null {
  if (!purchase.startDate || !purchase.expiryDate || purchase.remainingDays == null) return null;
  const total = Math.round((new Date(purchase.expiryDate).getTime() - new Date(purchase.startDate).getTime()) / DAY);
  if (!Number.isFinite(total) || total <= 0) return null;
  return Math.min(100, Math.max(0, (purchase.remainingDays / total) * 100));
}

/** What the card can do with the plan. Renewal is blocked while a paid plan is active, so there's no "Renew". */
export function planActions(purchase: Purchase) {
  const live = purchase.status === 'active' || purchase.status === 'pending';
  return {
    canExtend: purchase.tier !== 'basic' && (purchase.status === 'active' || purchase.status === 'expired'),
    canCancel: !purchase.isFree && purchase.status === 'active',
    buyLabel: live ? 'Upgrade' : 'Buy plan',
  };
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-plan-label text-[11px] font-bold tracking-[0.08em] uppercase">{label}</dt>
      <dd className="text-plan-ink mt-1 text-[14px] font-semibold">{children}</dd>
    </div>
  );
}

function PlanPayments({ exam, planId }: { exam: ExamRef; planId: number }) {
  const [page, setPage] = useState(1);
  const payments = usePlanPayments(exam, planId, page);
  const rows = payments.data?.payments ?? [];
  return (
    <div className="border-plan-line bg-plan-panel border-t">
      {payments.isPending ? (
        <div className="flex flex-col gap-2 p-4" aria-label="Loading plan payments">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : payments.isError ? (
        <p className="text-danger m-0 px-4 py-5 text-center text-[13px]">{userMessage(payments.error, "Couldn't load this plan's payments.")}</p>
      ) : rows.length === 0 ? (
        <p className="m-0 px-4 py-5 text-center text-[13px] text-neutral-500">No payments for this plan yet.</p>
      ) : (
        <>
          <PaymentRows rows={rows} label="Plan payments" />
          <Pager page={payments.data?.page ?? page} totalPages={payments.data?.totalPages ?? 1} onPage={setPage} />
        </>
      )}
    </div>
  );
}

/** One purchase on the Manage Plans page; the same card for every exam and category. */
export function PlanCard({
  exam,
  purchase,
  onExtend,
  onCancel,
}: {
  exam: ExamRef & { slug: string };
  purchase: Purchase;
  onExtend: () => void;
  onCancel: () => void;
}) {
  const [open, setOpen] = useState(false);
  const status = STATUS[purchase.status];
  const actions = planActions(purchase);
  const share = purchase.status === 'active' ? remainingShare(purchase) : null;
  const where = [purchase.examTitle, classLabel(purchase.className, purchase.streamName)]
    .filter((part, index, all) => part && all.findIndex((other) => other.toLowerCase() === part.toLowerCase()) === index)
    .join(' · ');
  const forever = purchase.tier === 'basic' || !purchase.expiryDate;
  const courses = purchase.courses.map((course) =>
    [course.examTitle, classLabel(course.className)].filter(Boolean).join(' · '),
  );
  const buyHref = routes.plansPurchase(exam.slug, purchase.classId ? { CLASSID: purchase.classId } : undefined);

  return (
    <Card appearance="outline" padding="none" className="flex flex-col overflow-hidden" aria-label={purchase.displayName}>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start gap-3">
          <span
            className={cx(
              'flex size-10 shrink-0 items-center justify-center rounded-[12px]',
              purchase.tier === 'basic' ? 'bg-plan-tile text-plan-muted' : 'bg-plan-chip text-plan-violet',
            )}
          >
            {purchase.tier === 'basic' ? <Leaf aria-hidden size={18} /> : <Crown aria-hidden size={18} />}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-plan-ink m-0 text-[17px] leading-snug font-bold">{purchase.displayName}</h3>
            {where && <p className="text-plan-muted m-0 mt-0.5 text-[13px]">{where}</p>}
          </div>
          <Badge tone={status.tone} className="shrink-0">
            {status.label}
          </Badge>
        </div>

        <div className="flex flex-col gap-2">
          <p className="m-0 flex items-center gap-2 text-[13px] text-neutral-600">
            <CalendarDays aria-hidden size={15} className="text-plan-label shrink-0" />
            {forever ? (
              <>Free forever{purchase.startDate ? ` · since ${formatGbDate(purchase.startDate)}` : ''}</>
            ) : (
              <>
                {formatGbDate(purchase.startDate)} – {formatGbDate(purchase.expiryDate)}
              </>
            )}
          </p>
          {share !== null && (
            <div>
              <div className="flex items-center justify-between text-[12px]">
                <span className={cx('font-semibold', (purchase.remainingDays ?? 0) <= 10 ? 'text-danger' : 'text-plan-ink')}>
                  {purchase.remainingDays} {purchase.remainingDays === 1 ? 'day' : 'days'} left
                </span>
                <span className="text-plan-muted">{Math.round(share)}% remaining</span>
              </div>
              <Progress
                value={share}
                tone={(purchase.remainingDays ?? 0) <= 10 ? 'danger' : 'brand'}
                className="mt-1.5"
                aria-label="Time remaining"
              />
            </div>
          )}
          {purchase.hasPendingPlan && purchase.pendingStartDate && (
            <p className="border-plan-renew-line bg-plan-renew-soft text-plan-renew-text m-0 flex items-center gap-2 rounded-md border px-3 py-2 text-[12px]">
              <RefreshCw aria-hidden size={13} />
              Renews on <span className="font-bold">{formatGbDate(purchase.pendingStartDate)}</span>
            </p>
          )}
        </div>

        {courses.length > 0 && (
          <div>
            <p className="text-plan-label m-0 flex items-center gap-1.5 text-[11px] font-bold tracking-[0.08em] uppercase">
              <Layers aria-hidden size={12} /> Included courses
            </p>
            <ul className="mt-2 flex flex-wrap gap-2" aria-label="Included courses">
              {courses.map((course) => (
                <li key={course} className="border-plan-line-strong bg-plan-tile text-plan-deep rounded-full border px-3 py-1 text-[12px] font-semibold">
                  {course}
                </li>
              ))}
            </ul>
          </div>
        )}

        <dl className="border-plan-line mt-auto grid grid-cols-2 gap-3 border-t pt-4">
          <Meta label="Amount paid">{purchase.isFree ? 'Free' : formatInrExact(purchase.paidAmount)}</Meta>
          <Meta label="Invoice">
            {purchase.invoiceUrl ? (
              <a
                href={purchase.invoiceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand inline-flex items-center gap-1.5 hover:underline"
              >
                <Download aria-hidden size={14} />
                {purchase.invoiceNumber || 'Download'}
              </a>
            ) : (
              <span className="text-neutral-350 font-medium">—</span>
            )}
          </Meta>
        </dl>
      </div>

      <div className="border-plan-line flex flex-wrap items-center gap-2 border-t px-5 py-3">
        <Button intent="ghost" size="sm" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          View payments
          <ChevronDown aria-hidden size={14} className={cx('transition-transform', open && 'rotate-180')} />
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {actions.canExtend && (
            <Button intent="outline" size="sm" onClick={onExtend} disabled={!purchase.purchaseId}>
              Extend with coupon
            </Button>
          )}
          {actions.canCancel && (
            <Button intent="outline" size="sm" className="text-danger" onClick={onCancel} disabled={!purchase.purchaseId}>
              Cancel
            </Button>
          )}
          <Button asChild size="sm">
            <Link href={buyHref}>{actions.buyLabel}</Link>
          </Button>
        </div>
      </div>
      {open && <PlanPayments exam={exam} planId={purchase.planId} />}
    </Card>
  );
}
