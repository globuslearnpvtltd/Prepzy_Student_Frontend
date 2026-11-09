'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { env } from '@/shared/config/env';
import { userMessage } from '@/shared/lib/errors';
import { plansApi, type PlanCategory, type VerifyPayload } from './api';
import type { Plan } from './catalog';
import { loadRazorpay } from './razorpay';

/** Gaps between automatic re-checks of a payment we couldn't confirm, in ms. */
export const VERIFY_RETRY_DELAYS = [4000, 8000, 15000];

export interface PendingPayment {
  plan: Plan;
  transactionId: string;
  initiatedAt: Date;
  payload: VerifyPayload;
}

export interface FailedPayment {
  plan: Plan;
  transactionId: string;
  attemptedAt: Date;
  reason: string | null;
}

interface Options {
  category: PlanCategory;
  coupon: string | null;
  /** Line shown in the Razorpay sheet. */
  describe: (plan: Plan) => string;
  prefill: { name: string; contact: string; email: string };
}

/**
 * Free plans activate directly; paid plans create an order, open Razorpay and verify the signature on the
 * server. A captured payment we can't confirm yet stays "pending" and is re-checked; a dismissed or failed
 * sheet is recorded with update-failed-purchase-status. Payment details are never logged.
 */
export function usePayment({ category, coupon, describe, prefill }: Options) {
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [pending, setPending] = useState<PendingPayment | null>(null);
  const [failed, setFailed] = useState<FailedPayment | null>(null);
  const [succeeded, setSucceeded] = useState<Plan | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const live = useRef(true);
  useEffect(
    () => () => {
      live.current = false;
    },
    [],
  );

  const confirm = useCallback(
    async (payment: PendingPayment) => {
      const ok = await plansApi.verify(category, payment.payload);
      if (ok && live.current) {
        setPending(null);
        setSucceeded(payment.plan);
      }
      return ok;
    },
    [category],
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
    const ok = await confirm(pending);
    setVerifying(false);
    // A failed manual check parks the automatic loop.
    if (!ok) setAttempts(VERIFY_RETRY_DELAYS.length);
  };

  const pay = async (plan: Plan) => {
    if (busy) return;
    setBusy(true);
    setFailed(null);
    setWarning(null);
    let opened = false;
    try {
      if (plan.isFree) {
        await plansApi.activateFree(category, plan);
        setSucceeded(plan);
        return;
      }
      const order = await plansApi.createOrder(category, { planId: plan.planId, priceId: plan.priceId, coupon });
      if (order.skipPayment) {
        setSucceeded(plan);
        return;
      }
      if (!env.razorpayKeyId) {
        setWarning('Online payments are not available right now. Please try again later.');
        return;
      }
      const Razorpay = await loadRazorpay();
      if (!Razorpay) {
        setWarning("Payment gateway didn't load. Check your connection and retry.");
        return;
      }
      let recorded = false;
      const recordFailure = (description: string | null) => {
        if (recorded) return;
        recorded = true;
        void plansApi.markFailed(category, order.orderId, description);
      };
      const checkout = new Razorpay({
        key: env.razorpayKeyId,
        // Authoritative amount from the backend order, never local maths.
        amount: order.amount,
        currency: order.currency,
        name: 'Prepzy',
        description: describe(plan),
        order_id: order.orderId,
        prefill,
        theme: { color: '#3D348B' },
        handler: async (payment) => {
          recorded = true;
          const pendingPayment: PendingPayment = {
            plan,
            transactionId: payment.razorpay_payment_id || order.orderId,
            initiatedAt: new Date(),
            payload: {
              payment_id: payment.razorpay_payment_id,
              order_id: payment.razorpay_order_id,
              signature: payment.razorpay_signature,
              coupon_id: order.couponId,
              userTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
          };
          setVerifying(true);
          const ok = await confirm(pendingPayment);
          setVerifying(false);
          setBusy(false);
          // Razorpay has the money; only our confirmation is missing. Keep re-checking.
          if (!ok) {
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
          transactionId: failure.error?.metadata?.payment_id ?? order.orderId,
          attemptedAt: new Date(),
          reason: failure.error?.description ?? null,
        });
        recordFailure(failure.error?.description ?? null);
      });
      checkout.open();
      opened = true;
    } catch (error) {
      setWarning(userMessage(error, plan.isFree ? "Couldn't activate this plan. Please try again." : "Couldn't start this payment. Please try again."));
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
    warning,
    pay,
    recheck,
    retry: () => {
      const plan = failed?.plan;
      setFailed(null);
      if (plan) void pay(plan);
    },
    clearFailed: () => setFailed(null),
    clearPending: () => setPending(null),
    dismissWarning: () => setWarning(null),
  };
}
