import type { Metadata } from 'next';
import { ManagePlans } from '@/features/plans/ui';

export const metadata: Metadata = { title: 'Manage Plans' };

export default function ManagePlansPage() {
  return <ManagePlans />;
}
