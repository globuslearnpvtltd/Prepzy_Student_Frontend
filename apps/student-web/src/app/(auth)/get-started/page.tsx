import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthScreen, SignupForm } from '@/features/auth/ui';

export const metadata: Metadata = { title: 'Create your account' };

export default function GetStartedPage() {
  return (
    <AuthScreen
      title="Create your account"
      subtitle="We'll send a OTP on WhatsApp to verify your number."
      mobileTitle="Let's get you started"
      step={[1, 5]}
      showStats
    >
      <Suspense>
        <SignupForm />
      </Suspense>
    </AuthScreen>
  );
}
