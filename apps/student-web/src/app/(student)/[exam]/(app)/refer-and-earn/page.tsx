import type { Metadata } from 'next';
import { ReferAndEarn } from '@/features/referral/ui';

export const metadata: Metadata = { title: 'Refer & Earn' };

export default function ReferAndEarnPage() {
  return <ReferAndEarn />;
}
