import type { Metadata } from 'next';
import Script from 'next/script';
import { Suspense } from 'react';
import { RAZORPAY_SCRIPT } from '@/features/plans';
import { Checkout } from '@/features/plans/ui';

export const metadata: Metadata = { title: 'Choose your plan' };

/** Checkout. Razorpay's script loads only here, after the page is idle. */
export default function PlansPurchasePage() {
  return (
    <>
      <Script src={RAZORPAY_SCRIPT} strategy="lazyOnload" />
      <Suspense>
        <Checkout />
      </Suspense>
    </>
  );
}
