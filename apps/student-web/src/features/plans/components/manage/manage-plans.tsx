'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { authApi, authKeys, pickActivePlan, useCurrentUser, usePlanSelection } from '@/features/auth';
import { routes } from '@/shared/config/routes';
import { useOptionalExam } from '@/shared/hooks/use-exam';
import { isApiError } from '@/shared/lib/errors';
import { billingMessage, plansApi } from '../../api';
import {
  daysSinceStart,
  formatDate,
  inRefundWindow,
  isFree,
  purchaseHrefFor,
  refundDeadline,
  type ActivePlan,
  type HistoryRow,
  type Overview,
  type RefundDetails,
  type RefundPreview,
} from '../../manage-data';
import { planKeys } from '../../hooks';
import { CancelConfirmModal, CancelledModal, NotRefundableModal } from './cancel-modals';
import { ExtendModal } from './extend-modal';
import { HistoryTable } from './history-table';
import { MobileExpiredHistory, MobilePlanCard } from './mobile-plan-card';
import { InvoiceToast, OfflineBanner, PlansErrorState, PlansSkeleton, type InvoiceToastState } from './page-states';
import { PlanCard } from './plan-card';

type CancelStep = 'checking' | 'confirm' | 'cancelled' | 'notRefundable';

interface Snapshot {
  savedAt: number;
  data: Overview;
}

const DEFAULT_REFUND_NOTE = 'Refunds are only for your first purchase, within 15 days of buying.';
const ALL = 'all';

/** No response at all: the request never reached the server. */
const isNetworkError = (error: unknown) => isApiError(error) && error.status === 0;

const snapshotKey = (accountId: number | undefined) => `prepzy-manage-plans:${accountId ?? 'me'}`;

function readSnapshot(key: string): Snapshot | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Snapshot) : null;
  } catch {
    // A broken or blocked cache just means there's nothing saved to show.
    return null;
  }
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`shrink-0 rounded-full px-[14px] py-[7px] text-[12px] whitespace-nowrap transition-colors ${selected ? 'text-on-brand bg-brand-700 font-semibold' : 'border border-account-outline font-medium text-account-body hover:bg-account-soft'}`}
    >
      {children}
    </button>
  );
}

/** First-purchase note under a plan's invoices (desktop). */
function refundNote(plan: ActivePlan) {
  if (!inRefundWindow(plan)) return DEFAULT_REFUND_NOTE;
  const days = (daysSinceStart(plan) ?? 1) - 1;
  const ago = days === 0 ? 'today' : `${days} day${days > 1 ? 's' : ''} ago`;
  // Only "first purchase" when this plan's history has a single paid invoice.
  const lead = plan.history.length === 1 ? `First purchase, bought ${ago}` : `Bought ${ago}`;
  return `${lead}. Cancel by ${formatDate(refundDeadline(plan))} for a full refund.`;
}

/** Shorter mobile copy, e.g. "First purchase. Cancel by 20 Oct for a full refund." */
function mobileRefundNote(plan: ActivePlan) {
  if (!inRefundWindow(plan)) return 'Refund only on a first purchase, within 15 days';
  const deadline = formatDate(refundDeadline(plan)).replace(/\s\d{4}$/, '');
  return `${plan.history.length === 1 ? 'First purchase. ' : ''}Cancel by ${deadline} for a full refund.`;
}

/**
 * /manage-plans — every plan of the student across exams (GET /api/v4/billing/overview): active plans with their
 * invoices, extend with a coupon, cancel (with the refund preview), upgrade on the exam's purchase page, and the
 * invoices of ended plans. The last good copy is kept per browser for offline viewing.
 */
export function ManagePlans() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const home = useOptionalExam();
  const user = useCurrentUser();
  const cacheKey = snapshotKey(user.data?.accountId);

  const overview = useQuery({ queryKey: planKeys.overview(), queryFn: plansApi.overview, retry: false });
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [offline, setOffline] = useState(false);

  const [examFilter, setExamFilter] = useState(ALL);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const [extendTarget, setExtendTarget] = useState<ActivePlan | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [extendResult, setExtendResult] = useState<{ months: number | null; expiry: string | null } | null>(null);

  const [cancelTarget, setCancelTarget] = useState<ActivePlan | null>(null);
  const [cancelStep, setCancelStep] = useState<CancelStep>('checking');
  const [preview, setPreview] = useState<RefundPreview | null>(null);
  const [refundDetails, setRefundDetails] = useState<RefundDetails | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [toast, setToast] = useState<InvoiceToastState | null>(null);
  const lastDownload = useRef<{ row: HistoryRow | null; blobUrl: string | null }>({ row: null, blobUrl: null });

  // The current plan of the exam the header shows ("Current" badge).
  const selectedId = usePlanSelection((state) => state.planId);
  const homePlans = useQuery({
    queryKey: authKeys.plans(home?.examId ?? 0),
    queryFn: () => authApi.activePlans(home!.examId),
    enabled: !!home,
    staleTime: 5 * 60_000,
  });
  const currentPlan = pickActivePlan(homePlans.data ?? [], selectedId);

  // A good answer is saved for offline use; a network failure (or no connection) shows the saved copy.
  useEffect(() => {
    if (!overview.data) return;
    setOffline(false);
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), data: overview.data } satisfies Snapshot));
    } catch {
      // Storage full or blocked: the page still works, just without an offline copy.
    }
  }, [overview.data, cacheKey]);

  useEffect(() => {
    if (overview.isError && isNetworkError(overview.error)) {
      setSnapshot(readSnapshot(cacheKey));
      setOffline(true);
    }
  }, [overview.isError, overview.error, cacheKey]);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    window.addEventListener('offline', goOffline);
    return () => window.removeEventListener('offline', goOffline);
  }, []);

  const load = useCallback(() => {
    setExpandedKey(null);
    void overview.refetch();
  }, [overview]);

  const data = overview.data ?? (offline ? snapshot?.data : undefined);
  const status = data ? 'ready' : overview.isPending || overview.isFetching ? 'loading' : 'error';
  const savedAt = overview.data ? null : (snapshot?.savedAt ?? null);
  const savedTime = savedAt ? new Date(savedAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }).toUpperCase() : null;

  const active = data?.active ?? [];
  const expired = data?.expired ?? [];
  const exams = data?.exams ?? [];
  const shownActive = active.filter((plan) => examFilter === ALL || plan.exam.key === examFilter);
  const shownExpired = expired.filter((row) => examFilter === ALL || row.examKey === examFilter);
  const onlyFree = active.length > 0 && active.every(isFree) && expired.length === 0;
  const dashboardHref = home ? routes.dashboard(home.slug) : '/';
  const viewPlansHref = home ? routes.plansPurchase(home.slug) : null;
  const supportHref = home ? routes.profileHelp(home.slug) : null;

  const refresh = useCallback(
    () =>
      // Overview, purchases and catalogs of every exam, and the plans the header and navigation show.
      Promise.all([
        queryClient.invalidateQueries({ queryKey: planKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['auth', 'plans'] }),
      ]),
    [queryClient],
  );

  const download = async (row: HistoryRow) => {
    if (!row.invoiceUrl) return;
    if (lastDownload.current.blobUrl) URL.revokeObjectURL(lastDownload.current.blobUrl);
    lastDownload.current = { row, blobUrl: null };
    setToast({ kind: 'loading', invoiceNo: row.invoiceNo });
    try {
      const res = await fetch(row.invoiceUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blobUrl = URL.createObjectURL(await res.blob());
      lastDownload.current = { row, blobUrl };
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = `${row.invoiceNo || 'Prepzy-invoice'}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setToast({ kind: 'done', invoiceNo: row.invoiceNo });
    } catch {
      setToast({ kind: 'error', invoiceNo: row.invoiceNo });
    }
  };

  useEffect(() => {
    if (!toast || toast.kind === 'loading') return;
    const timer = setTimeout(() => setToast(null), toast.kind === 'done' ? 5000 : 8000);
    return () => clearTimeout(timer);
  }, [toast]);

  const openExtend = (plan: ActivePlan) => {
    setExtendTarget(plan);
    setCouponCode('');
    setCouponError('');
    setExtendResult(null);
  };

  const closeExtend = () => {
    const extended = !!extendResult;
    setExtendTarget(null);
    setExtendResult(null);
    if (extended) void refresh();
  };

  const applyCoupon = async () => {
    const target = extendTarget;
    if (!target?.exam.ref || !couponCode.trim()) return;
    setChecking(true);
    try {
      const result = await plansApi.extend(target.exam.ref, couponCode.trim(), target.purchaseId);
      setCouponError('');
      setExtendResult({ months: result.months, expiry: result.expiryDate });
    } catch (error) {
      setCouponError(billingMessage(error, `This coupon isn’t valid for ${target.name}.`));
    } finally {
      setChecking(false);
    }
  };

  // The refund preview decides: within 15 days with no refund used → cancel and refund, otherwise talk to support.
  const openCancel = async (plan: ActivePlan) => {
    setCancelTarget(plan);
    setCancelReason('');
    setRefundDetails(null);
    setPreview(null);
    setCancelStep('checking');
    try {
      const next = await plansApi.refundPreview(plan.purchaseId);
      setPreview(next);
      setCancelStep(next.canCancel ? 'confirm' : 'notRefundable');
    } catch (error) {
      setCancelTarget(null);
      setActionError(billingMessage(error, 'Couldn’t check this plan. Please try again.'));
    }
  };

  const closeCancel = (reload: boolean) => {
    setCancelTarget(null);
    if (reload) void refresh();
  };

  const confirmCancel = async () => {
    const target = cancelTarget;
    if (!target?.exam.ref) return;
    setCancelling(true);
    try {
      await plansApi.cancel(target.exam.ref, target.purchaseId, cancelReason || undefined);
      try {
        localStorage.removeItem('selectedPlanId');
      } catch {
        // Private mode: nothing stored.
      }
      // Show only what was stored for the refund.
      setRefundDetails(await plansApi.refundDetails(target.purchaseId).catch(() => null));
      setCancelStep('cancelled');
    } catch (error) {
      if (isApiError(error) && error.code === 'REFUND_LIMIT_REACHED') {
        setPreview((prev) => (prev ? { ...prev, reason: 'refund_already_used' } : prev));
        setCancelStep('notRefundable');
      } else {
        setCancelTarget(null);
        setActionError(billingMessage(error, 'Something went wrong while cancelling.'));
      }
    } finally {
      setCancelling(false);
    }
  };

  const isCurrent = (plan: ActivePlan) => !!home && plan.exam.ref?.examId === home.examId && currentPlan?.planId === plan.planId;

  const cardHandlers = (plan: ActivePlan) => ({
    plan,
    isCurrent: isCurrent(plan),
    expanded: expandedKey === plan.key,
    offline,
    onToggleHistory: () => setExpandedKey((key) => (key === plan.key ? null : plan.key)),
    onExtend: () => openExtend(plan),
    onCancel: () => void openCancel(plan),
    onUpgrade: () => {
      const href = purchaseHrefFor(plan);
      if (href) router.push(href);
    },
  });

  const renderCard = (plan: ActivePlan) => (
    <Fragment key={plan.key}>
      <div className="hidden lg:contents">
        <PlanCard {...cardHandlers(plan)} />
        {expandedKey === plan.key && (
          <HistoryTable
            title={plan.scopeLabel}
            rows={plan.history}
            footer={refundNote(plan)}
            emptyText="No invoices for this plan yet."
            onDownload={download}
          />
        )}
      </div>
      <div className="contents lg:hidden">
        <MobilePlanCard {...cardHandlers(plan)} refundNote={mobileRefundNote(plan)} onDownload={download} />
      </div>
    </Fragment>
  );

  const viewPlansButton = (className: string) =>
    viewPlansHref && (
      <button
        type="button"
        onClick={() => router.push(viewPlansHref)}
        disabled={offline}
        className={`text-on-brand rounded-full bg-brand-700 font-semibold transition-colors hover:bg-account-hover disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      >
        View plans
      </button>
    );

  return (
    <div className="w-full leading-normal">
      {offline && status === 'ready' && <OfflineBanner savedAt={savedTime} onRetry={load} />}

      <div className="flex w-full flex-col gap-[16px] px-[20px] pt-[16px] pb-[40px] md:px-[40px] lg:gap-[24px] lg:px-[60px] lg:pt-[28px]">
        <div className="flex flex-col gap-[16px] lg:hidden">
          <div className="flex items-center justify-between gap-[12px]">
            <div className="flex min-w-0 items-center gap-[10px]">
              <Link href={dashboardHref} aria-label="Back to Dashboard" className="flex shrink-0">
                <Image src="/illustrations/plans/back-mobile.svg" alt="" width={22} height={22} />
              </Link>
              <h1 className="m-0 text-[22px] leading-normal font-bold text-account-ink">Manage plans</h1>
            </div>
            {status === 'ready' && viewPlansButton('shrink-0 px-[14px] py-[8px] text-[12px]')}
          </div>
          <p className="m-0 text-[12px] leading-normal text-neutral-550">All your plans in one place. Extend a plan and download invoices.</p>
        </div>

        <div className="hidden flex-col gap-[4px] lg:flex">
          <Link href={dashboardHref} className="flex w-fit items-center gap-[6px] no-underline">
            <Image src="/illustrations/plans/back.svg" alt="" width={16} height={16} />
            <span className="text-[13px] font-semibold text-brand-700">Back to Dashboard</span>
          </Link>
          <h1 className="m-0 mt-[8px] text-[24px] leading-normal font-bold text-brand-700">Manage plans</h1>
          <p className="m-0 text-[13px] leading-normal text-neutral-550">All your plans in one place. Extend a plan and download invoices.</p>
        </div>

        {status === 'loading' && <PlansSkeleton />}

        {status === 'error' && <PlansErrorState onRetry={load} onSupport={() => router.push(supportHref ?? dashboardHref)} />}

        {status === 'ready' && active.length === 0 && expired.length === 0 && (
          <div className="bg-surface flex flex-col justify-between gap-[12px] rounded-[20px] border border-manage-card-line p-[24px] sm:flex-row sm:items-center">
            <p className="m-0 text-[14px] leading-normal text-neutral-550">You don’t have any plans yet.</p>
            {viewPlansHref && (
              <Link
                href={viewPlansHref}
                className="text-on-brand w-fit rounded-full bg-brand-700 px-[18px] py-[8px] text-[13px] font-semibold no-underline hover:bg-account-hover"
              >
                View plans
              </Link>
            )}
          </div>
        )}

        {status === 'ready' && onlyFree && (
          <>
            <p className="m-0 text-[11px] leading-normal font-semibold text-neutral-550 lg:hidden">ACTIVE PLANS · {active.length}</p>
            {active.map(renderCard)}
            <div className="hidden rounded-[12px] bg-account-soft px-[20px] py-[16px] lg:block">
              <p className="m-0 text-[12px] leading-normal text-neutral-550">No invoices yet. {active[0]!.name} is free.</p>
            </div>
          </>
        )}

        {status === 'ready' && !onlyFree && (active.length > 0 || expired.length > 0) && (
          <>
            <div
              className={`${exams.length > 1 ? 'flex' : 'hidden lg:flex'} w-full items-center gap-[8px] overflow-x-auto lg:flex-wrap lg:overflow-visible`}
            >
              {exams.length > 1 && (
                <>
                  <Chip selected={examFilter === ALL} onClick={() => setExamFilter(ALL)}>
                    All courses
                  </Chip>
                  {exams.map((exam) => (
                    <Chip key={exam.key} selected={examFilter === exam.key} onClick={() => setExamFilter(exam.key)}>
                      {exam.name}
                    </Chip>
                  ))}
                </>
              )}
              <span className="hidden flex-1 lg:block" />
              {viewPlansButton('hidden lg:block px-[18px] py-[8px] text-[13px]')}
            </div>

            <p className="m-0 text-[11px] leading-normal font-semibold text-neutral-550">ACTIVE PLANS · {shownActive.length}</p>
            {shownActive.map(renderCard)}

            {shownExpired.length > 0 && (
              <>
                <div className="hidden lg:block">
                  <HistoryTable
                    title="expired plans"
                    rows={shownExpired}
                    footer="Plans that have ended stay here with their invoices. Buy again from View plans."
                    onDownload={download}
                  />
                </div>
                <div className="lg:hidden">
                  <MobileExpiredHistory rows={shownExpired} onDownload={download} />
                </div>
              </>
            )}
          </>
        )}
      </div>

      {extendTarget && (
        <ExtendModal
          plan={extendTarget}
          code={couponCode}
          checking={checking}
          error={couponError}
          result={extendResult}
          onCodeChange={(code) => {
            setCouponCode(code);
            setCouponError('');
          }}
          onApply={applyCoupon}
          onClose={closeExtend}
        />
      )}

      {cancelTarget && cancelStep === 'confirm' && (
        <CancelConfirmModal
          plan={cancelTarget}
          refundAmount={preview?.refundAmount ?? 0}
          reason={cancelReason}
          busy={cancelling}
          onReasonChange={setCancelReason}
          onKeep={() => closeCancel(false)}
          onConfirm={confirmCancel}
        />
      )}
      {cancelTarget && cancelStep === 'cancelled' && (
        <CancelledModal
          plan={cancelTarget}
          refundAmount={preview?.refundAmount ?? 0}
          details={refundDetails}
          onViewPlans={
            purchaseHrefFor(cancelTarget)
              ? () => {
                  const href = purchaseHrefFor(cancelTarget)!;
                  closeCancel(true);
                  router.push(href);
                }
              : null
          }
          onDone={() => closeCancel(true)}
        />
      )}
      {cancelTarget && cancelStep === 'notRefundable' && (
        <NotRefundableModal
          plan={cancelTarget}
          reason={preview?.reason ?? 'refund_window_over'}
          onSupport={() => {
            closeCancel(false);
            router.push(supportHref ?? dashboardHref);
          }}
          onClose={() => closeCancel(false)}
        />
      )}

      {actionError && (
        <div role="alert" className="fixed bottom-[24px] left-1/2 z-[1200] w-[calc(100%-40px)] max-w-[468px] -translate-x-1/2">
          <div className="flex items-center gap-[10px] rounded-[14px] bg-account-ink py-[14px] pr-[18px] pl-[16px] shadow-[0px_16px_44px_0px_rgba(31,26,56,0.18)]">
            <p className="text-on-brand m-0 min-w-0 flex-1 text-[13px] leading-[1.5] font-medium">{actionError}</p>
            <button type="button" onClick={() => setActionError(null)} className="shrink-0 text-[13px] font-semibold text-account-toast-action">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {toast && (
        <InvoiceToast
          toast={toast}
          onOpen={() => {
            if (lastDownload.current.blobUrl) window.open(lastDownload.current.blobUrl, '_blank');
          }}
          onRetry={() => {
            if (lastDownload.current.row) void download(lastDownload.current.row);
          }}
        />
      )}
    </div>
  );
}
