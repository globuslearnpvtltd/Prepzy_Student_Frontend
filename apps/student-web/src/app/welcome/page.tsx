import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Welcome } from '@/features/plans/ui';

export const metadata: Metadata = { title: "You're all set" };

/** Post-signup screen (the previous app's /pre-dashboard). */
export default function WelcomePage() {
  return (
    <Suspense>
      <Welcome />
    </Suspense>
  );
}
