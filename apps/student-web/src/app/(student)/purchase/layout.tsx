import { Suspense } from 'react';
import { CheckoutChrome } from '@/features/plans/ui';
import { PageSpinner } from '@/shared/layout/status-screens';

/**
 * The common checkout (/purchase), outside any exam: the exam comes from ?exam= (else the remembered exam, else the
 * first purchasable one). The Plans page's top navbar of that exam, no sidebar, the full width for the purchase flow.
 */
export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<PageSpinner />}>
      <CheckoutChrome>{children}</CheckoutChrome>
    </Suspense>
  );
}
