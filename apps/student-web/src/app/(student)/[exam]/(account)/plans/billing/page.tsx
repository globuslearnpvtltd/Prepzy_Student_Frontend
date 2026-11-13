import { redirect } from 'next/navigation';
import { routes } from '@/shared/config/routes';

/** Billing history is part of /manage-plans now (each plan's invoices and the invoices of ended plans). */
export default function PlansBillingPage() {
  redirect(routes.managePlans());
}
