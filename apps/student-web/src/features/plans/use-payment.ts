'use client';

import { colorValue } from '@prepzy/design-system';
import { useCallback, useEffect, useRef, useState } from 'react';
import { env } from '@/shared/config/env';
import type { ExamRef } from '@/shared/config/exams';
import { billingMessage, plansApi, type OrderStatus } from './api';
import type { Plan } from './catalog';
import { loadRazorpay } from './razorpay';

/** Gaps between automatic re-checks of a payment we couldn't confirm, in ms. */
export const VERIFY_RETRY_DELAYS = [4000, 8000, 15000];

/** sessionStorage key of a payment waiting for confirmation, so a reload can still re-check it. */
export const PENDING_ORDER_KEY = 'prepzy-pending-order';

export interface PendingPayment {
  plan: Plan;
  /** The exam the order was placed for (re-checks go to its billing routes). */
  exam: ExamRef;
  orderId: string;
  transactionId: string;
  initiatedAt: Date;
}

export interface FailedPayment {
  plan: Plan;
  exam: ExamRef;
  transactionId: string;
  attemptedAt: Date;
  reason: string | null;
}

interface Options {
  /** The exam to sell (null until the student picks one: nothing can be paid then). */
  exam: ExamRef | null;
  coupon: string | null;
  /** Line shown in the Razorpay sheet. */
  describe: (plan: Plan) => string;
  prefill: { name: string; contact: string; email: string };
}

function savePending(payment: PendingPayment) {
  try {
    sessionStorage.setItem(
      PENDING_ORDER_KEY,
      JSON.stringify({
        ...payment,
        initiatedAt: payment.initiatedAt.toISOString(),
        plan: { ...payment.plan, validTill: payment.plan.validTill?.toISOString() ?? null },
      }),
    );
  } catch {
    // Storage blocked: the pending sheet still works until a reload.
  }
}

function forgetPending() {
  try {
    sessionStorage.removeItem(PENDING_ORDER_KEY);
  } catch {
    // Storage blocked: nothing was saved.
  }
}

/** The saved pending payment, or null when there's none (or it's unreadable). */
export function loadPending(): PendingPayment | null {
  try {
    const raw = sessionStorage.getItem(PENDING_ORDER_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Omit<PendingPayment, 'initiatedAt' | 'plan'> & {
      initiatedAt: string;
      plan: Omit<Plan, 'validTill'> & { validTill: string | null };
    };
    if (typeof saved?.orderId !== 'string' || !saved.orderId || !saved.plan || !saved.exam?.category || !saved.exam.examId) return null;
    const initiatedAt = new Date(saved.initiatedAt);
    return {
      ...saved,
      initiatedAt: Number.isNaN(initiatedAt.getTime()) ? new Date() : initiatedAt,
      plan: { ...saved.plan, validTill: saved.plan.validTill ? new Date(saved.plan.validTill) : null },
    };
  } catch {
    return null;
  }
}

/**
 * Free plans activate directly; paid plans create a server order (POST /orders), open Razorpay with the server's
 * amount and verify the signature on the server. A payment the server can't confirm yet stays "pending" (kept in
 * sessionStorage) and is re-checked with GET /orders/:id; a dismissed or failed sheet calls /orders/:id/fail once.
 * Payment details are never logged.
 */
export function usePayment({ exam, coupon, describe, prefill }: Options) {
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [pending, setPending] = useState<PendingPayment | null>(null);
  const [failed, setFailed] = useState<FailedPayment | null>(null);
  const [succeeded, setSucceeded] = useState<Plan | null>(null);
  /** The exam of the plan that succeeded (where "Start learning" goes). */
  const [succeededExam, setSucceededExam] = useState<ExamRef | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  // A payment left pending before a reload: show it again and keep re-checking.
  useEffect(() => {
    const saved = loadPending();
    if (!saved) return;
    setAttempts(0);
    setPending(saved);
  }, []);

  const settle = useCallback((payment: PendingPayment, status: OrderStatus) => {
    if (status === 'pending' || !live.current) return;
    forgetPending();
    setPending(null);
    if (status === 'paid') {
      setSucceeded(payment.plan);
      setSucceededExam(payment.exam);
    } else setFailed({ plan: payment.plan, exam: payment.exam, transactionId: payment.transactionId, attemptedAt: new Date(), reason: null });
  }, []);

  /** Asks the server, which reconciles the order with Razorpay. Errors count as "still pending". */
  const confirm = useCallback(
    async (payment: PendingPayment): Promise<OrderStatus> => {
      const status = await plansApi.orderStatus(payment.exam, payment.orderId).catch((): OrderStatus => 'pending');
      settle(payment, status);
      return status;
    },
    [settle],
  );

  // Automatic re-checks while the pending sheet is up.
  useEffect(() => {
    if (!pending || verifying || attempts >= VERIFY_RETRY_DELAYS.length) return;
    const timer = setTimeout(async () => {
      setVerifying(true);
      setAttempts((count) => count + 1);
      await confirm(pending);
      setVerifying(false);
    }, VERIFY_RETRY_DELAYS[attempts]);
    return () => clearTimeout(timer);
  }, [pending, verifying, attempts, confirm]);

  const recheck = async () => {
    if (!pending || verifying) return;
    setVerifying(true);
    const status = await confirm(pending);
    setVerifying(false);
    // A manual check that is still pending parks the automatic loop.
    if (status === 'pending') setAttempts(VERIFY_RETRY_DELAYS.length);
  };

  const succeed = (plan: Plan, forExam: ExamRef) => {
    setSucceeded(plan);
    setSucceededExam(forExam);
  };

  const pay = async (plan: Plan, forExam: ExamRef | null = exam) => {
    if (busy || !forExam) return;
    setBusy(true);
    setFailed(null);
    setWarning(null);
    let opened = false;
    try {
      if (plan.isFree) {
        await plansApi.activateFree(forExam, plan);
        succeed(plan, forExam);
        return;
      }
      const order = await plansApi.createOrder(forExam, { priceId: plan.priceId, coupon });
      // A 100% coupon: the server fulfilled the order already.
      if (order.status === 'paid') {
        succeed(plan, forExam);
        return;
      }
      const key = order.keyId || env.razorpayKeyId;
      if (!key) {
        setWarning('Online payments are not available right now. Please try again later.');
        return;
      }
      const Razorpay = await loadRazorpay();
      if (!Razorpay) {
        setWarning("Payment gateway didn't load. Check your connection and retry.");
        return;
      }
      let recorded = false;
      const recordFailure = (reason: string | null) => {
        if (recorded) return;
        recorded = true;
        void plansApi.markFailed(forExam, order.orderId, reason);
      };
      const checkout = new Razorpay({
        key,
        // Authoritative amount from the server order, never local maths.
        amount: order.amountPaise,
        currency: order.currency,
        name: 'Prepzy',
        description: describe(plan),
        order_id: order.orderId,
        prefill,
        theme: { color: colorValue('brand') },
        handler: async (payment) => {
          recorded = true;
          const pendingPayment: PendingPayment = {
            plan,
            exam: forExam,
            orderId: order.orderId,
            transactionId: payment.razorpay_payment_id || order.orderId,
            initiatedAt: new Date(),
          };
          setVerifying(true);
          const status = await plansApi
            .verify(forExam, order.orderId, { payment_id: payment.razorpay_payment_id, signature: payment.razorpay_signature })
            // Razorpay has the money; only our confirmation is missing. The server can still reconcile it.
            .catch((): OrderStatus => 'pending');
          setVerifying(false);
          setBusy(false);
          if (!live.current) return;
          if (status === 'paid') {
            succeed(plan, forExam);
          } else {
            savePending(pendingPayment);
            setAttempts(0);
            setPending(pendingPayment);
          }
        },
        modal: {
          ondismiss: () => {
            setBusy(false);
            recordFailure('Payment cancelled by the student');
          },
        },
      });
      checkout.on('payment.failed', (failure) => {
        setBusy(false);
        setFailed({
          plan,
          exam: forExam,
          transactionId: failure.error?.metadata?.payment_id ?? order.orderId,
          attemptedAt: new Date(),
          reason: failure.error?.description ?? null,
        });
        recordFailure(failure.error?.description ?? null);
      });
      checkout.open();
      opened = true;
    } catch (error) {
      setWarning(billingMessage(error, plan.isFree ? "Couldn't activate this plan. Please try again." : "Couldn't start this payment. Please try again."));
    } finally {
      if (!opened) setBusy(false);
    }
  };

  return {
    busy,
    verifying,
    pending,
    failed,
    succeeded,
    succeededExam,
    warning,
    pay,
    recheck,
    retry: () => {
      const last = failed;
      setFailed(null);
      if (last) void pay(last.plan, last.exam);
    },
    clearFailed: () => setFailed(null),
    clearPending: () => {
      forgetPending();
      setPending(null);
    },
    dismissWarning: () => setWarning(null),
  };
}
