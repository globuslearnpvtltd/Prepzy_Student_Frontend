import type { Metadata } from 'next';
import { Suspense } from 'react';
import { OtpForm } from '@/features/auth/ui';

export const metadata: Metadata = { title: 'Verify your number' };

export default function VerifyOtpPage() {
  return (
    <Suspense>
      <OtpForm />
    </Suspense>
  );
}
