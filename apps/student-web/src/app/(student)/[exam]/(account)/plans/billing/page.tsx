import type { Metadata } from 'next';
import { BillingPage } from '@/features/plans/ui';

export const metadata: Metadata = { title: 'Billing & Invoices' };

export default function PlansBillingPage() {
  return <BillingPage />;
}
