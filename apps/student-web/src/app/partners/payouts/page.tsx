import type { Metadata } from 'next';
import { PartnerPayouts } from '@/features/partners/ui';

export const metadata: Metadata = { title: 'Payouts' };

export default function Page() {
  return <PartnerPayouts />;
}
