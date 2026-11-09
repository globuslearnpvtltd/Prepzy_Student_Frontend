import type { Metadata } from 'next';
import { PartnerBankDetails } from '@/features/partners/ui';

export const metadata: Metadata = { title: 'KYC & bank details' };

export default function Page() {
  return <PartnerBankDetails />;
}
