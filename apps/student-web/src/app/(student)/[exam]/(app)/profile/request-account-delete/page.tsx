import type { Metadata } from 'next';
import { RequestDeleteScreen } from '@/features/profile/ui';

export const metadata: Metadata = { title: 'Delete Your Account' };

export default function RequestAccountDeletePage() {
  return <RequestDeleteScreen />;
}
