'use client';

import { Button, Card, Skeleton } from '@prepzy/design-system';
import { useQueryClient } from '@tanstack/react-query';
import { Package, ReceiptText, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { authKeys } from '@/features/auth';
import { routes } from '@/shared/config/routes';
import { useExam } from '@/shared/hooks/use-exam';
import { shellKeys } from '@/shared/layout/shell-api';
import { userMessage } from '@/shared/lib/errors';
import { billingMessage, plansApi, type Purchase } from '../api';
import { planKeys, usePurchases } from '../hooks';
import { BillingHistory } from './billing-history';
import { CancelDialog, CancelledDialog, type CancelTarget } from './cancel-dialogs';
import { ExtendDialog } from './extend-dialogs';
import { WarningDialog } from './modal';
import { PlanCard } from './plan-card';

const toTarget = (purchase: Purchase): CancelTarget => ({
  purchaseId: purchase.purchaseId,
  name: purchase.displayName,
  remainingDays: purchase.remainingDays,
  expiryDate: purchase.expiryDate,
});

/**
 * /[exam]/plans — one page for every exam and category: the student's plans as cards (from GET /purchases) with
 * extend, cancel, per-plan payments and a link to buy, then the exam's billing history.
 */
export function ManagePlans() {
  const exam = useExam();
  const queryClient = useQueryClient();
  const purchases = usePurchases(exam);
  const list = purchases.data ?? [];
  const [extending, setExtending] = useState<Purchase | null>(null);
  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState<CancelTarget | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const explore = routes.plansPurchase(exam.slug);

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: planKeys.purchases(exam) }),
      queryClient.invalidateQueries({ queryKey: planKeys.billing(exam) }),
      queryClient.invalidateQueries({ queryKey: authKeys.plans(exam.examId) }),
      queryClient.invalidateQueries({ queryKey: shellKeys.planSummary(exam.slug) }),
    ]);

  const confirmCancel = async (reason: string) => {
    const target = cancelTarget;
    if (!target?.purchaseId) return;
    setCancelling(true);
    try {
      await plansApi.cancel(exam, target.purchaseId, reason || undefined);
      try {
        localStorage.removeItem('selectedPlanId');
      } catch {
        // Private mode: nothing stored.
      }
      setCancelled(target);
      void refresh();
    } catch (error) {
      setWarning(billingMessage(error, 'Unable to cancel this plan'));
    } finally {
      setCancelTarget(null);
      setCancelling(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-1 py-2 md:px-2">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-plan-ink text-[26px] leading-tight font-extrabold tracking-[-0.01em] md:text-[32px]">My plans</h1>
          <p className="mt-1.5 max-w-[620px] text-[13px] text-neutral-500 md:text-[14px]">
            Your plans, their validity and payments in one place. Extend with a coupon, cancel, or pick a new plan.
          </p>
        </div>
        <div className="flex w-full gap-2.5 md:w-auto">
          <Button asChild intent="outline" className="flex-1 md:flex-none">
            <a href="#billing">
              <ReceiptText aria-hidden size={16} />
              Billing history
            </a>
          </Button>
          <Button asChild className="flex-1 md:flex-none">
            <Link href={explore}>
              <Sparkles aria-hidden size={16} />
              Explore plans
            </Link>
          </Button>
        </div>
      </header>

      <section aria-label="My plans">
        {purchases.isPending && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" aria-label="Loading plans">
            {[0, 1].map((i) => (
              <Card key={i} appearance="outline" className="flex flex-col gap-3">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-2 w-full" />
                <Skeleton className="h-9 w-full" />
              </Card>
            ))}
          </div>
        )}

        {purchases.isError && (
          <Card appearance="outline" className="flex flex-col items-center px-6 py-8 text-center">
            <p className="text-plan-ink text-[15px] font-semibold">We couldn&apos;t load your plans</p>
            <p className="mx-auto mt-1.5 max-w-[420px] text-[13px] text-neutral-500">{userMessage(purchases.error)}</p>
            <Button className="mt-4" onClick={() => purchases.refetch()}>
              Try again
            </Button>
          </Card>
        )}

        {purchases.isSuccess && list.length === 0 && (
          <Card appearance="outline" className="flex flex-col items-center px-6 py-12 text-center">
            <span className="bg-plan-chip text-plan-violet flex size-14 items-center justify-center rounded-[14px]">
              <Package aria-hidden size={26} />
            </span>
            <h2 className="text-plan-ink mt-4 text-xl font-bold">No plans yet</h2>
            <p className="mx-auto mt-1.5 max-w-[460px] text-[13px] text-neutral-500 md:text-[14px]">
              Pick a plan to unlock video lectures, full mock tests, higher daily limits and the AI tutor.
            </p>
            <Button asChild className="mt-5">
              <Link href={explore}>
                <Sparkles aria-hidden size={16} />
                Explore plans
              </Link>
            </Button>
          </Card>
        )}

        {list.length > 0 && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {list.map((purchase) => (
              <PlanCard
                key={`${purchase.planId}-${purchase.purchaseId}`}
                exam={exam}
                purchase={purchase}
                onExtend={() => setExtending(purchase)}
                onCancel={() => setCancelTarget(toTarget(purchase))}
              />
            ))}
          </div>
        )}
      </section>

      <BillingHistory exam={exam} />

      {cancelTarget && (
        <CancelDialog plan={cancelTarget} busy={cancelling} onKeep={() => !cancelling && setCancelTarget(null)} onConfirm={confirmCancel} />
      )}
      {cancelled && <CancelledDialog plan={cancelled} slug={exam.slug} onClose={() => setCancelled(null)} />}
      {warning && <WarningDialog title="Cancellation not allowed" message={warning} onClose={() => setWarning(null)} />}
      {extending && (
        <ExtendDialog
          exam={exam}
          plan={{ purchaseId: extending.purchaseId, name: extending.displayName, expiryDate: extending.expiryDate }}
          onClose={() => {
            setExtending(null);
            void refresh();
          }}
        />
      )}
    </div>
  );
}

/** /[exam]/plans/billing — the same billing history for every exam, on its own page. */
export function BillingPage() {
  const exam = useExam();
  return (
    <div className="mx-auto w-full max-w-[1200px] px-1 py-2 md:px-2">
      <BillingHistory exam={exam} standalone />
    </div>
  );
}
