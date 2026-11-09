import type { Metadata } from 'next';
import { PartnerLogin } from '@/features/partners/ui';

export const metadata: Metadata = { title: 'Sign in' };

export default function Page() {
  return <PartnerLogin />;
}
