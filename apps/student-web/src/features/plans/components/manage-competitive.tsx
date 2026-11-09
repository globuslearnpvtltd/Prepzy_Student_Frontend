'use client';

import { cx } from '@prepzy/design-system';
import { useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, Sparkles, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { authKeys } from '@/features/auth';
import type { ExamConfig } from '@/shared/config/exams';
import { routes } from '@/shared/config/routes';
import { shellKeys } from '@/shared/layout/shell-api';
import { userMessage } from '@/shared/lib/errors';
import { plansApi, type LearningPlan } from '../api';
import { planKeys, useLearningPlans } from '../hooks';
import { CompetitiveExtendDialog } from './extend-dialogs';
import { CloseButton, Modal, WarningDialog } from './modal';
import { CourseCard, PlanStatusPill, ReceiptRow } from './plan-bits';

const ACTION = 'inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-sm px-[18px] text-[14px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60';
const OUTLINE = cx(ACTION, 'border-brand bg-surface text-brand hover:bg-brand-soft border');
const SOLID = cx(ACTION, 'bg-brand text-on-brand hover:bg-brand-800');
const DANGER = cx(ACTION, 'border-plan-rose bg-surface text-plan-rose hover:bg-plan-rose-soft border');
const TH = 'text-plan-navy text-[11px] font-bold tracking-[0.08em] uppercase';

export const CANCEL_REASONS = [
  'Too expensive',
  'Not using it enough',
  'Found a better alternative',
  'Preparing for a different exam',
  'Technical issues',
  'Other',
];

const remaining = (plan: LearningPlan) => (plan.remainingDays ? `${plan.remainingDays}d left` : '—');

function DetailsButton({ open, onClick, className }: { open: boolean; onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} aria-expanded={open} className={cx(OUTLINE, className)}>
      Plan details
      <ChevronDown aria-hidden className={cx('size-4 transition-transform duration-200', open && 'rotate-180')} strokeWidth={2.2} />
    </button>
  );
}

function CancelDialog({
  plan,
  busy,
  onKeep,
  onConfirm,
}: {
  plan: LearningPlan;
  busy: boolean;
  onKeep: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <Modal label="Cancel Subscription" onClose={busy ? undefined : onKeep} className="max-w-[430px] p-5 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-plan-ink m-0 text-lg font-bold">Cancel Subscription</h3>
          <p className="text-neutral-550 m-0 mt-1.5 text-[13px]">Are you sure you want to end your plan access?</p>
        </div>
        <CloseButton onClick={onKeep} />
      </div>
      <div className="border-plan-rose-line bg-plan-rose-soft mt-4 rounded-[10px] border px-3.5 py-3">
        <p className="text-plan-red m-0 flex items-center gap-[7px] text-[13px] font-bold">
          <TriangleAlert aria-hidden className="size-[15px] shrink-0" />
          You will lose active topper access
        </p>
        <p className="text-plan-rose-text m-0 mt-[7px] text-[12px] leading-[17px]">
          Your <span className="text-plan-rose-deep font-semibold">{plan.name}</span> still has{' '}
          <span className="text-plan-rose-deep font-semibold">{plan.remainingDays} days remaining</span>. If you cancel now, you
          will lose access to premium test banks, progress metrics, and live mentor hours upon period expiry
          {plan.expiryDate ? ` on ${plan.expiryDate}` : ''}.
        </p>
      </div>
      <label htmlFor="cancel-reason" className="text-plan-ink mt-4 block text-[13px] font-semibold">
        Please tell us why you are leaving
      </label>
      <div className="relative mt-2">
        <select
          id="cancel-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="border-plan-input-line bg-surface focus:border-brand w-full appearance-none rounded-sm border px-3 py-2.5 pr-[34px] text-[13px] text-neutral-700 outline-none"
        >
          <option value="">Select cancellation reason</option>
          {CANCEL_REASONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden className="text-neutral-350 pointer-events-none absolute top-1/2 right-3 size-[15px] -translate-y-1/2" />
      </div>
      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={onKeep}
          disabled={busy}
          className="border-plan-input-line bg-surface hover:bg-canvas flex-1 rounded-sm border py-[11px] text-[13px] font-semibold text-neutral-700 disabled:opacity-50"
        >
          Keep My Plan
        </button>
        <button
          type="button"
          onClick={() => onConfirm(reason)}
          disabled={busy}
          className="bg-plan-rose text-on-brand flex-1 rounded-sm py-[11px] text-[13px] font-semibold disabled:opacity-60"
        >
          {busy ? 'Cancelling…' : 'Yes, Cancel Plan'}
        </button>
      </div>
    </Modal>
  );
}

function CancelledDialog({ plan, exam, onClose }: { plan: LearningPlan; exam: ExamConfig; onClose: () => void }) {
  return (
    <Modal label="Cancellation Confirmed" onClose={onClose} className="max-w-[400px] p-6 text-center">
      <span className="bg-brand text-on-brand mx-auto flex size-[46px] items-center justify-center rounded-full">
        <Check aria-hidden className="size-[19px]" strokeWidth={2.6} />
      </span>
      <h3 className="text-plan-ink m-0 mt-4 text-lg font-bold">Cancellation Confirmed</h3>
      <p className="text-neutral-550 m-0 mt-2 text-[13px] leading-[19px]">Your {plan.name} cancellation has been processed successfully.</p>
      <dl className="bg-plan-receipt mt-[18px] rounded-[10px] px-4 py-3 text-left">
        <ReceiptRow label="Cancelled Plan" value={plan.name} />
        <ReceiptRow label="Access Continues Until" value={plan.expiryDate || '—'} />
      </dl>
      <p className="text-neutral-350 m-0 mt-3.5 text-[11px] leading-4">
        No further billing charges will be made. You can reactivate your plan at any time before the end date to preserve your
        study history.
      </p>
      <Link href={routes.plansPurchase(exam.slug)} className={cx(SOLID, 'mt-4 flex w-full text-[13px]')}>
        <Sparkles aria-hidden className="size-3.5" />
        Reactivate Plan
      </Link>
      <Link href={routes.dashboard(exam.slug)} className="text-brand mt-3.5 inline-block text-[12px] font-semibold underline underline-offset-2">
        Back to Dashboard
      </Link>
    </Modal>
  );
}

function PlanActions({
  plan,
  open,
  onToggle,
  onExtend,
  onCancel,
  stacked,
}: {
  plan: LearningPlan;
  open: boolean;
  onToggle: () => void;
  onExtend: () => void;
  onCancel: () => void;
  stacked?: boolean;
}) {
  return (
    <>
      {plan.courses.length > 0 && <DetailsButton open={open} onClick={onToggle} className={stacked ? 'w-full' : undefined} />}
      <button type="button" onClick={onExtend} disabled={plan.planId == null} className={cx(SOLID, stacked && 'w-full')}>
        Extend Plan
      </button>
      <button type="button" onClick={onCancel} disabled={plan.planId == null} className={cx(DANGER, stacked && 'w-full')}>
        Cancel Plan
      </button>
    </>
  );
}

/** /neet/plans: "My Learning Plans" with included courses, coupon extension and cancellation. */
export function CompetitiveManagePlans({ exam }: { exam: ExamConfig }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const plans = useLearningPlans(true);
  const list = plans.data ?? [];
  const [expanded, setExpanded] = useState<number | null>(null);
  const [extending, setExtending] = useState<LearningPlan | null>(null);
  const [cancelTarget, setCancelTarget] = useState<LearningPlan | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState<LearningPlan | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  // A single plan opens with its courses showing.
  useEffect(() => {
    if (plans.data?.length === 1) setExpanded(plans.data[0]!.id);
  }, [plans.data]);

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: planKeys.learningPlans }),
      queryClient.invalidateQueries({ queryKey: authKeys.plans(exam.examId) }),
      queryClient.invalidateQueries({ queryKey: shellKeys.planSummary(exam.slug) }),
    ]);

  const confirmCancel = async (reason: string) => {
    const target = cancelTarget;
    if (!target?.planId) return;
    setCancelling(true);
    try {
      await plansApi.cancel('competitive', target.planId, reason || undefined);
      setCancelled(target);
      void refresh();
    } catch (error) {
      setWarning(userMessage(error, 'Unable to cancel this plan'));
    } finally {
      setCancelTarget(null);
      setCancelling(false);
    }
  };

  const toggle = (id: number) => setExpanded((current) => (current === id ? null : id));
  const explore = routes.plansPurchase(exam.slug);

  return (
    <div className="min-h-full px-1.5 py-3.5 md:px-4 md:py-0">
      <div className="mx-auto w-full max-w-[1320px]">
        <header className="flex flex-col gap-[18px] md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-plan-ink text-[26px] leading-tight font-extrabold tracking-[-0.01em] md:text-[34px]">My Learning Plans</h1>
            <p className="text-neutral-550 mt-1.5 max-w-[640px] text-[13px] md:text-[14px]">
              Manage your active access, explore included courses, and keep track of your plan validity.
            </p>
          </div>
          <div className="flex w-full items-center gap-2.5 md:w-auto md:shrink-0">
            <Link href={routes.plansBilling(exam.slug)} className={cx(OUTLINE, 'text-plan-deep min-w-0 flex-1 basis-0 md:flex-none md:basis-auto')}>
              Billing History
            </Link>
            <Link href={explore} className={cx(SOLID, 'min-w-0 flex-1 basis-0 md:flex-none md:basis-auto')}>
              Explore Plans
            </Link>
          </div>
        </header>

        {plans.isPending && (
          <div className="mt-6 flex flex-col gap-3.5" aria-label="Loading plans">
            {[0, 1].map((i) => (
              <div key={i} className="border-plan-panel-line bg-surface animate-pulse rounded-lg border p-5">
                <div className="bg-plan-receipt h-4 w-[220px] rounded-sm" />
                <div className="bg-plan-panel mt-2.5 h-3 w-[120px] rounded-sm" />
                <div className="bg-plan-panel mt-5 h-[38px] w-full rounded-sm" />
              </div>
            ))}
          </div>
        )}

        {plans.isError && (
          <div className="border-plan-rose-line bg-surface mt-6 rounded-lg border px-6 py-8 text-center">
            <p className="text-plan-ink text-[15px] font-semibold">We couldn&apos;t load your plans</p>
            <p className="text-neutral-550 mx-auto mt-1.5 max-w-[420px] text-[13px]">{userMessage(plans.error)}</p>
            <button type="button" onClick={() => plans.refetch()} className={cx(SOLID, 'mt-[18px]')}>
              Try again
            </button>
          </div>
        )}

        {plans.isSuccess && list.length === 0 && (
          <div className="border-plan-panel-line bg-surface mt-6 rounded-lg border px-6 py-10 text-center">
            <p className="text-plan-ink text-md font-bold">No active plans yet</p>
            <p className="text-neutral-550 mx-auto mt-1.5 max-w-[420px] text-[13px]">
              Pick a plan to unlock video lectures, mock tests and the AI assistant.
            </p>
            <button type="button" onClick={() => router.push(explore)} className={cx(SOLID, 'mt-[18px]')}>
              <Sparkles aria-hidden className="size-4" />
              Explore Plans
            </button>
          </div>
        )}

        {list.length > 0 && (
          <>
            <section className="border-plan-panel-line bg-surface mt-6 hidden overflow-hidden rounded-lg border md:block">
              <table className="w-full table-fixed border-collapse">
                <colgroup>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <col key={i} className="w-[12.5%]" />
                  ))}
                  <col className="w-[37.5%]" />
                </colgroup>
                <thead>
                  <tr className="border-plan-panel-line bg-plan-panel border-b">
                    {['Plan Name', 'Status', 'Start Date', 'Expires', 'Remaining Days', 'Actions'].map((label, i) => (
                      <th key={label} scope="col" className={cx(TH, 'px-1.5 py-4 first:pl-5 last:pr-5', i < 2 ? 'text-left' : 'text-center')}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                {list.map((plan) => {
                  const open = expanded === plan.id;
                  return (
                    <tbody key={plan.id} className="border-plan-panel-line border-b last:border-b-0">
                      <tr>
                        <td className="px-1.5 py-5 pl-5 text-left align-middle">
                          <p className="text-plan-ink text-[15px] font-bold">{plan.name}</p>
                          {plan.billingCycle && <p className="text-neutral-350 mt-0.5 text-[13px]">{plan.billingCycle}</p>}
                        </td>
                        <td className="px-1.5 py-5 text-left align-middle">
                          <PlanStatusPill status={plan.status} />
                        </td>
                        <td className="px-1.5 py-5 text-center align-middle text-[14px] text-neutral-700">{plan.startDate || '—'}</td>
                        <td className="px-1.5 py-5 text-center align-middle text-[14px] text-neutral-700">{plan.expiryDate || '—'}</td>
                        <td className={cx('px-1.5 py-5 text-center align-middle text-[14px] font-semibold', plan.remainingDays <= 10 ? 'text-plan-rose' : 'text-neutral-700')}>
                          {remaining(plan)}
                        </td>
                        <td className="px-1.5 py-5 pr-5 align-middle">
                          <div className="flex items-center justify-center gap-2.5">
                            <PlanActions plan={plan} open={open} onToggle={() => toggle(plan.id)} onExtend={() => setExtending(plan)} onCancel={() => setCancelTarget(plan)} />
                          </div>
                        </td>
                      </tr>
                      {open && (
                        <tr>
                          <td colSpan={6} className="px-6 pb-6">
                            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                              {plan.courses.map((course) => (
                                <CourseCard key={course.id} course={course} />
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  );
                })}
              </table>
            </section>

            <section className="mt-5 flex flex-col gap-3.5 md:hidden">
              {list.map((plan) => {
                const open = expanded === plan.id;
                return (
                  <article key={plan.id} className="border-plan-panel-line bg-surface overflow-hidden rounded-lg border">
                    <div className="px-[18px] pt-[18px] pb-1">
                      <p className="text-plan-ink text-md leading-snug font-bold">{plan.name}</p>
                      <p className="text-neutral-350 mt-0.5 text-[13px]">{plan.billingCycle}</p>
                    </div>
                    <dl className="px-[18px] py-1.5">
                      {(
                        [
                          ['Status', <PlanStatusPill key="s" status={plan.status} />],
                          ['Start Date', plan.startDate || '—'],
                          ['Expires', plan.expiryDate || '—'],
                          ['Remaining Days', remaining(plan)],
                        ] as const
                      ).map(([label, value]) => (
                        <div key={label} className="flex items-center justify-between py-[11px]">
                          <dt className={TH}>{label}</dt>
                          <dd
                            className={cx(
                              'text-[14px] text-neutral-700',
                              label === 'Remaining Days' && 'font-semibold',
                              label === 'Remaining Days' && plan.remainingDays <= 10 && 'text-plan-rose',
                            )}
                          >
                            {value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <div className="border-plan-panel-line flex flex-col gap-2.5 border-t px-[18px] py-4">
                      <PlanActions plan={plan} open={open} onToggle={() => toggle(plan.id)} onExtend={() => setExtending(plan)} onCancel={() => setCancelTarget(plan)} stacked />
                    </div>
                    {open && plan.courses.length > 0 && (
                      <div className="border-plan-panel-line border-t px-[18px] py-[18px]">
                        <p className={cx(TH, 'text-[12px]')}>Included Combo Plans</p>
                        <div className="mt-3 flex flex-col gap-3">
                          {plan.courses.map((course) => (
                            <CourseCard key={course.id} course={course} />
                          ))}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </section>
          </>
        )}

        <div className="md:border-plan-panel-line md:bg-surface mt-2 rounded-lg px-5 py-3 md:mt-4 md:border md:px-6 md:py-4">
          <div className="flex justify-center md:justify-end">
            <Link href={routes.plansBilling(exam.slug)} className="text-brand text-[14px] font-semibold underline-offset-4 hover:underline">
              View Billing History
            </Link>
          </div>
        </div>
      </div>

      {cancelTarget && <CancelDialog plan={cancelTarget} busy={cancelling} onKeep={() => !cancelling && setCancelTarget(null)} onConfirm={confirmCancel} />}
      {cancelled && <CancelledDialog plan={cancelled} exam={exam} onClose={() => setCancelled(null)} />}
      {warning && <WarningDialog title="Cancellation not allowed" message={warning} onClose={() => setWarning(null)} />}
      {extending && (
        <CompetitiveExtendDialog
          plan={extending}
          onClose={() => {
            setExtending(null);
            void refresh();
          }}
        />
      )}
    </div>
  );
}
