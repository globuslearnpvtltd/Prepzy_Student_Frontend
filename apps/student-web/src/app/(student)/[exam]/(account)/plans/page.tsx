import type { Metadata } from 'next';
import { ManagePlans } from '@/features/plans/ui';

export const metadata: Metadata = { title: 'My Plans' };

export default function PlansPage() {
  return <ManagePlans />;
}
