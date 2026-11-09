import type { Metadata } from 'next';
import { ParentDashboard, ParentHeader } from '@/features/parents/ui';

export const metadata: Metadata = { title: 'Dashboard' };

export default function ParentsDashboardPage() {
  return (
    <>
      <ParentHeader />
      <ParentDashboard />
    </>
  );
}
