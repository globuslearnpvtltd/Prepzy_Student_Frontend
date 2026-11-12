import { CheckoutChrome } from '@/features/plans/ui';

/** Checkout: the Plans page's top navbar, no sidebar, the full width for the purchase flow. */
export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return <CheckoutChrome>{children}</CheckoutChrome>;
}
