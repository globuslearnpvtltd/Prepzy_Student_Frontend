import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthScreen, SignupForm } from '@/features/auth/ui';

export const metadata: Metadata = { title: 'Create your account' };

export default function GetStartedPage() {
  return (
    <AuthScreen
      variant="signup"
      title="Create your account"
      subtitle="We'll send a OTP on WhatsApp to verify your number."
      mobileTitle={
        <>
          Prepare better.
          <br />
          Score higher.
        </>
      }
      mobileSubtitle="AI lectures, instant doubt solving and real exam-pattern tests for whichever exam you are preparing for."
      step={[1, 5]}
      showStats
    >
      <Suspense>
        <SignupForm />
      </Suspense>
    </AuthScreen>
  );
}
