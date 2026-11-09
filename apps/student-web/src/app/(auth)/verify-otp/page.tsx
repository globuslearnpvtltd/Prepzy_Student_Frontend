import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthScreen, OtpForm } from '@/features/auth/ui';

export const metadata: Metadata = { title: 'Verify your number' };

export default function VerifyOtpPage() {
  return (
    <AuthScreen
      eyebrow="Verify"
      title="Enter the OTP"
      subtitle="We sent a 6-digit code to your WhatsApp."
      mobileTitle="Verify your number"
      step={[2, 5]}
    >
      <Suspense>
        <OtpForm />
      </Suspense>
    </AuthScreen>
  );
}
