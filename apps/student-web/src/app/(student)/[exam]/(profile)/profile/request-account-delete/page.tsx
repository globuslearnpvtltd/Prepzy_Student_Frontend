import type { Metadata } from 'next';
import { DeleteAccountPage } from '@/features/profile/ui';

export const metadata: Metadata = { title: 'Delete account' };

export default function RequestAccountDeletePage() {
  return <DeleteAccountPage />;
}
