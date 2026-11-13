import { redirect } from 'next/navigation';
import { routes } from '@/shared/config/routes';

/** The exam's plans page moved to the common /manage-plans (every exam's plans on one page). */
export default function PlansPage() {
  redirect(routes.managePlans());
}
