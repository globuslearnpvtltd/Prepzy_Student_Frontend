'use client';

import { cx } from '@prepzy/design-system';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, ChevronDown, Package } from 'lucide-react';
import Link from 'next/link';
import { Fragment, useState } from 'react';
import { authKeys } from '@/features/auth';
import type { ExamConfig } from '@/shared/config/exams';
import { routes } from '@/shared/config/routes';
import { PageSpinner } from '@/shared/layout/status-screens';
import { userMessage } from '@/shared/lib/errors';
import { boardPlanName, plansApi, withoutClassWord, type BoardPlan } from '../api';
import { planKeys, useBoardPayments, useBoardPlans } from '../hooks';
import { formatGbDate } from '../money';
import { BoardExtendDialog } from './extend-dialogs';
import { Modal } from './modal';

const LABEL = 'text-neutral-550 text-[11px] font-semibold tracking-wider uppercase';
const VALUE = 'text-plan-cbse m-0 text-[14px] leading-5 font-bold';

function StatusPill({ status, className }: { status: string; className?: string }) {
  if (status !== 'active' && status !== 'expired') return null;
  return (
    <span
      className={cx(
        'text-on-brand inline-block rounded-full px-3 font-semibold whitespace-nowrap',
        status === 'active' ? 'bg-success-500' : 'bg-plan-expired',
        className,
      )}
    >
      {status === 'active' ? 'Active' : 'Expired'}
    </span>
  );
}

function ExtendButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="border-plan-line-strong bg-brand-soft text-brand hover:bg-brand-75 mt-2 flex items-center gap-1 rounded-full border px-3 py-1.5 text-[12px] font-semibold"
    >
      <CalendarPlus aria-hidden className="size-[13px]" />
      Extend plan
    </button>
  );
}

function Chevron({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={open ? 'Hide billing history' : 'Show billing history'}
      aria-expanded={open}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="text-neutral-550 hover:bg-neutral-100 flex size-8 items-center justify-center rounded-full"
    >
      <ChevronDown aria-hidden className={cx('size-4 transition-transform duration-200', open && 'rotate-180')} strokeWidth={2.4} />
    </button>
  );
}

function BillingHistory({ planId }: { planId: number }) {
  const [page, setPage] = useState(1);
  const history = useBoardPayments(planId, page);
  const payments = (history.data?.payments ?? []).filter((p) => p.status.toLowerCase() !== 'pending');
  const totalPages = history.data?.totalPages ?? 1;
  return (
    <div className="bg-plan-history border-plan-history-line flex flex-col rounded-b-lg border-2 p-6">
      <h3 className="mb-4 text-lg leading-6 font-semibold text-neutral-900 md:text-xl">Billing History for this Plan</h3>
      <div className="flex w-full flex-col gap-3">
        {history.isPending ? (
          <p className="text-neutral-550 py-8 text-center">Loading billing history…</p>
        ) : payments.length === 0 ? (
          <div className="text-neutral-550 bg-surface border-border rounded-md border py-8 text-center">
            No billing history available for this plan
          </div>
        ) : (
          payments.map((payment, index) => {
            const status = payment.status.toLowerCase();
            const refunded = status === 'refunded';
            const label = status === 'success' ? 'Paid' : status.charAt(0).toUpperCase() + status.slice(1);
            const amount = `${refunded ? '-' : ''}₹${payment.amount}`;
            const pill = cx(
              'text-on-brand inline-block rounded-full px-3 text-[12px] font-semibold whitespace-nowrap',
              status === 'success' || status === 'paid' ? 'bg-success-500' : refunded ? 'bg-plan-expired' : 'bg-accent-400',
            );
            const invoice = payment.invoiceUrl ? (
              <a
                href={payment.invoiceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="border-brand-600 text-brand-600 hover:bg-brand-600 hover:text-on-brand block w-full rounded-[18px] border-2 px-4 py-1 text-center text-[13px] font-bold whitespace-nowrap"
              >
                View Invoice
              </a>
            ) : (
              <span className="text-neutral-350 border-border block rounded-[18px] border-2 px-2 py-1 text-center text-[11px] font-medium whitespace-nowrap">
                No invoice
              </span>
            );
            return (
              <div key={`${payment.createdAt}-${index}`} className="bg-surface border-plan-history-line h-fit w-full rounded-lg border-2 p-6">
                <div className="hidden w-full grid-cols-5 gap-6 md:grid">
                  <div>
                    <p className={cx(LABEL, 'mb-2 text-[12px]')}>Date</p>
                    <p className={VALUE}>{formatGbDate(payment.createdAt)}</p>
                  </div>
                  <div>
                    <p className={cx(LABEL, 'mb-2 text-[12px]')}>Description</p>
                    <p className={VALUE}>{payment.durationMonths || 'Payment'} Months Plan</p>
                  </div>
                  <div>
                    <p className={cx(LABEL, 'mb-2 text-[12px]')}>Amount</p>
                    <p className={cx('m-0 text-md font-bold', refunded ? 'text-plan-expired' : 'text-brand')}>{amount}</p>
                  </div>
                  <div>
                    <p className={cx(LABEL, 'mb-2')}>Status</p>
                    <span className={pill}>{label}</span>
                  </div>
                  <div className="mt-2">{invoice}</div>
                </div>
                <div className="space-y-3 md:hidden">
                  <div>
                    <p className={cx(LABEL, 'mb-1 text-[12px] font-medium')}>Date</p>
                    <p className={VALUE}>{formatGbDate(payment.createdAt)}</p>
                  </div>
                  <div>
                    <p className={cx(LABEL, 'mb-1 text-[12px] font-medium')}>Description</p>
                    <p className={VALUE}>{payment.durationMonths || 'Payment'} Months Plan</p>
                  </div>
                  <div>
                    <p className={cx(LABEL, 'mb-1 text-[12px] font-medium')}>Amount</p>
                    <p className={cx('m-0 text-md font-bold', refunded ? 'text-plan-expired' : 'text-brand')}>{amount}</p>
                  </div>
                  <span className={pill}>{label}</span>
                  <div className="pt-2">{invoice}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
      {payments.length > 0 && (
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 1}
            className="bg-border hover:bg-neutral-300 w-full rounded-sm px-4 py-2 font-medium text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            Prev
          </button>
          <span className="text-[14px] font-medium text-neutral-700">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages}
            className="bg-border hover:bg-neutral-300 w-full rounded-sm px-4 py-2 font-medium text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function RenewalNotice({ plan, className }: { plan: BoardPlan; className: string }) {
  if (!plan.pendingRenewal) return null;
  return (
    <div className={cx('border-plan-renew-line bg-plan-renew-soft text-plan-renew-text rounded-md border px-5 py-4 text-[14px]', className)}>
      ✓ Plan will be renewed on <span className="font-bold">{formatGbDate(plan.pendingRenewal.startDate)}</span> as per the
      purchase made on <span className="font-bold">{formatGbDate(plan.pendingRenewal.purchaseDate)}</span>.
    </div>
  );
}

function CancelConfirm({
  busy,
  error,
  done,
  onKeep,
  onConfirm,
}: {
  busy: boolean;
  error: string | null;
  done: boolean;
  onKeep: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal label={done ? 'Cancelled' : 'Cancel plan'} onClose={busy ? undefined : onKeep} className="max-w-[420px] p-7 text-center">
      <h2 className="text-2xl font-semibold text-neutral-900">{done ? 'Cancelled!' : error ? 'Error!' : 'Are you sure?'}</h2>
      <p className="text-foreground-muted mt-3 text-sm">
        {done ? 'Subscription has been cancelled.' : (error ?? 'Do you really want to cancel this Class Plan?')}
      </p>
      <div className="mt-6 flex justify-center gap-3">
        {done || error ? (
          <button type="button" onClick={onKeep} className="bg-brand text-on-brand rounded-sm px-6 py-2.5 text-sm font-semibold">
            OK
          </button>
        ) : (
          <>
            <button type="button" onClick={onConfirm} disabled={busy} className="bg-danger text-on-brand rounded-sm px-5 py-2.5 text-sm font-semibold disabled:opacity-60">
              {busy ? 'Cancelling…' : 'Yes, cancel it!'}
            </button>
            <button type="button" onClick={onKeep} disabled={busy} className="bg-info text-on-brand rounded-sm px-5 py-2.5 text-sm font-semibold">
              No, keep it
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}

/** /cbse/plans: every class plan with renew, cancel, coupon extension and per-plan billing history. */
export function BoardManagePlans({ exam }: { exam: ExamConfig }) {
  const queryClient = useQueryClient();
  const plans = useBoardPlans(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [extending, setExtending] = useState<BoardPlan | null>(null);
  const [cancelling, setCancelling] = useState<{ planId: number; busy: boolean; error: string | null; done: boolean } | null>(null);
  const list = plans.data ?? [];
  const browse = routes.plansPurchase(exam.slug);

  const confirmCancel = async () => {
    if (!cancelling) return;
    setCancelling({ ...cancelling, busy: true });
    try {
      await plansApi.cancel('board', cancelling.planId);
      try {
        localStorage.removeItem('selectedPlanId');
      } catch {
        // Private mode: nothing stored.
      }
      setCancelling({ ...cancelling, busy: false, done: true });
    } catch (error) {
      setCancelling({ ...cancelling, busy: false, error: userMessage(error, 'Something went wrong while cancelling.') });
    }
    await queryClient.invalidateQueries({ queryKey: planKeys.boardPlans });
    await queryClient.invalidateQueries({ queryKey: authKeys.plans(exam.examId) });
  };

  if (plans.isPending) return <PageSpinner />;

  const renewHref = (plan: BoardPlan) => routes.plansPurchase(exam.slug, plan.classId ? { CLASSID: plan.classId } : undefined);
  const toggle = (planId: number) => setExpanded((current) => (current === planId ? null : planId));

  return (
    <div className="bg-surface w-full overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div className="mt-4">
          <h1 className="mb-6 text-[32px] leading-8 font-bold text-neutral-900">Manage Plans</h1>
          <p className="mb-6 text-[14px] leading-[22px] text-neutral-600">
            Easily manage, renew or cancel your plan and view the billing history with invoices.
          </p>
        </div>
        {list.length > 0 && (
          <Link href={browse} className="bg-brand-600 text-on-brand hover:bg-brand mt-4 hidden items-center gap-2 rounded-md px-4 py-2 text-[14px] font-semibold lg:inline-flex">
            View All Plans
          </Link>
        )}
      </div>

      {list.length === 0 ? (
        <section
          aria-label="Subscription details"
          className="border-info-soft bg-surface mt-4 flex min-h-[300px] flex-col items-center justify-center gap-5 rounded-[14px] border-[1.5px] p-8 md:p-16"
        >
          <span className="bg-brand-600 flex size-16 items-center justify-center rounded-md">
            <Package aria-hidden className="text-on-brand size-8" />
          </span>
          <h2 className="m-0 text-center text-2xl leading-8 font-bold text-neutral-900 md:text-[28px]">No Active Plans Yet</h2>
          <p className="m-0 max-w-[600px] text-center text-[14px] leading-6 text-neutral-600 md:text-md">
            You haven&apos;t purchased any plans yet. Explore our premium plans to unlock unlimited access to AI-powered tutoring,
            complete CBSE curriculum, practice tests, and personalized learning paths.
          </p>
          <Link href={browse} className="bg-brand-600 text-on-brand hover:bg-brand mt-4 flex items-center gap-2 rounded-md px-4 py-2 text-[14px] font-semibold">
            Browse Plans
          </Link>
        </section>
      ) : (
        <div className="mt-2 flex flex-col gap-3">
          {list.map((plan) => {
            const open = expanded === plan.planId;
            const expired = plan.status === 'expired';
            const classLabel = `${withoutClassWord(plan.className)}${plan.streamName ? ` ${plan.streamName}` : ''}`;
            const endDate = plan.durationMonths === 0 ? '______' : formatGbDate(plan.expiryDate);
            const renewDisabled = !!plan.pendingRenewal;
            return (
              <Fragment key={plan.planId}>
                <div
                  onClick={() => toggle(plan.planId)}
                  className={cx(
                    'mb-3 cursor-pointer border-2 pb-2 transition-all hover:shadow-sm sm:pb-3',
                    expired ? 'border-plan-expired-line bg-plan-expired-soft' : 'border-border bg-surface',
                    open ? 'rounded-t-md' : 'rounded-md',
                  )}
                >
                  <div className="hidden items-center gap-4 px-6 pt-4 md:flex">
                    {['Plan name', 'Class', 'Start date'].map((label) => (
                      <div key={label} className={cx(LABEL, 'w-[140px] min-w-[140px]')}>
                        {label}
                      </div>
                    ))}
                    <div className={cx(LABEL, 'w-[240px] min-w-[140px]')}>End date</div>
                    <div className={cx(LABEL, 'w-[140px] min-w-[140px]')}>Status</div>
                    <div className="flex-1" />
                  </div>
                  <div className="hidden flex-col gap-4 px-6 py-2 md:flex">
                    <div className="flex items-center justify-evenly gap-4">
                      <p className={cx(VALUE, 'w-[140px] min-w-[140px] leading-3')}>{boardPlanName(plan.durationMonths)}</p>
                      <p className={cx(VALUE, 'w-[140px] min-w-[140px]')}>{classLabel}</p>
                      <p className={cx(VALUE, 'w-[140px] min-w-[140px]')}>{formatGbDate(plan.startDate)}</p>
                      <div className="flex w-[240px] min-w-[140px] items-center gap-2.5">
                        <p className={VALUE}>{endDate}</p>
                        {plan.durationMonths !== 0 && <ExtendButton onClick={() => setExtending(plan)} />}
                      </div>
                      <div className="w-[140px] min-w-[140px]">
                        <StatusPill status={plan.status} className="text-[14px] leading-5" />
                      </div>
                      <div className="flex flex-1 items-center justify-end gap-3">
                        {!expired && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setCancelling({ planId: plan.planId, busy: false, error: null, done: false });
                            }}
                            className="border-brand-600 bg-surface text-brand-600 hover:bg-brand-soft rounded-[18px] border-2 px-8 py-1 text-[13px] font-bold whitespace-nowrap"
                          >
                            Cancel Plan
                          </button>
                        )}
                        {renewDisabled ? (
                          <span className="bg-neutral-300 border-neutral-300 cursor-not-allowed rounded-[18px] border-2 px-8 py-1 text-[13px] font-bold whitespace-nowrap text-neutral-500 opacity-50">
                            Renew Plan
                          </span>
                        ) : (
                          <Link
                            href={renewHref(plan)}
                            onClick={(event) => event.stopPropagation()}
                            className="border-brand-600 bg-brand-600 text-on-brand hover:bg-brand rounded-[18px] border-2 px-8 py-1 text-[13px] font-bold whitespace-nowrap"
                          >
                            Renew Plan
                          </Link>
                        )}
                        <Chevron open={open} onClick={() => toggle(plan.planId)} />
                      </div>
                    </div>
                    <RenewalNotice plan={plan} className="hidden md:block" />
                  </div>

                  <div className="flex flex-col gap-4 p-5 md:hidden">
                    <div className="flex flex-col gap-6">
                      <div className="flex items-center">
                        <div className="w-[160px]">
                          <p className="text-neutral-550 m-0 mb-1 text-[12px] uppercase">Plan name</p>
                          <p className="text-plan-cbse m-0 text-md font-bold">{plan.durationMonths} Months</p>
                        </div>
                        <div className="w-[160px]">
                          <p className="text-neutral-550 m-0 mb-1 text-[12px] uppercase">Class</p>
                          <p className="text-plan-cbse m-0 text-md font-bold">{classLabel}</p>
                        </div>
                        <Chevron open={open} onClick={() => toggle(plan.planId)} />
                      </div>
                      <div>
                        <p className="text-neutral-550 text-[12px]">START DATE</p>
                        <p className="text-md font-bold text-neutral-800">{formatGbDate(plan.startDate)}</p>
                      </div>
                      <div>
                        <p className="text-neutral-550 text-[12px]">END DATE</p>
                        <p className={VALUE}>{endDate}</p>
                        {plan.durationMonths !== 0 && <ExtendButton onClick={() => setExtending(plan)} />}
                      </div>
                      <div>
                        <p className="text-neutral-550 text-[12px]">STATUS</p>
                        <StatusPill status={plan.status} className="py-0.5 text-[12px]" />
                      </div>
                    </div>
                    <div className="mt-2 flex h-10 gap-3">
                      {!expired && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setCancelling({ planId: plan.planId, busy: false, error: null, done: false });
                          }}
                          className="border-brand bg-surface text-brand flex flex-1 items-center justify-center rounded-lg border-2 px-4 text-[14px] font-semibold"
                        >
                          Cancel Plan
                        </button>
                      )}
                      <Link
                        href={renewDisabled ? '#' : renewHref(plan)}
                        aria-disabled={renewDisabled}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (renewDisabled) event.preventDefault();
                        }}
                        className={cx(
                          'flex flex-1 items-center justify-center rounded-lg border-2 px-4 text-[14px] font-semibold',
                          renewDisabled ? 'bg-neutral-300 border-neutral-300 text-neutral-500 opacity-50' : 'border-brand bg-brand text-on-brand',
                        )}
                      >
                        Renew Plan
                      </Link>
                    </div>
                    <RenewalNotice plan={plan} className="text-center" />
                  </div>
                </div>
                {open && <BillingHistory planId={plan.planId} />}
              </Fragment>
            );
          })}
        </div>
      )}

      {list.length > 0 && (
        <div className="border-info-soft bg-surface mt-4 border-t py-2 md:hidden">
          <Link href={browse} className="bg-brand-600 text-on-brand block w-full rounded-md py-2.5 text-center text-[14px] font-semibold shadow-card">
            View all plans
          </Link>
        </div>
      )}

      {extending && (
        <BoardExtendDialog
          plan={extending}
          onClose={() => {
            setExtending(null);
            void queryClient.invalidateQueries({ queryKey: planKeys.boardPlans });
          }}
        />
      )}
      {cancelling && (
        <CancelConfirm
          busy={cancelling.busy}
          error={cancelling.error}
          done={cancelling.done}
          onKeep={() => setCancelling(null)}
          onConfirm={confirmCancel}
        />
      )}
    </div>
  );
}
