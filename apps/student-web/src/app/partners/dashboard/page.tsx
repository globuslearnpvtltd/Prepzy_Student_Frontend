import type { Metadata } from 'next';
import { PartnerDashboard } from '@/features/partners/ui';

export const metadata: Metadata = { title: 'Dashboard' };

export default function Page() {
  return <PartnerDashboard />;
}
