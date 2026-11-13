import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AccountScreen } from '@/features/profile/ui';

export const metadata: Metadata = { title: 'My Account' };

// Suspense: the screen reads ?edit=1 with useSearchParams.
export default function ProfilePage() {
  return (
    <Suspense>
      <AccountScreen />
    </Suspense>
  );
}
