import type { Metadata } from 'next';
import { PartnerSignup } from '@/features/partners/ui';

export const metadata: Metadata = { title: 'Become a partner' };

export default function Page() {
  return <PartnerSignup />;
}
