import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthScreen, LoginForm } from '@/features/auth/ui';

export const metadata: Metadata = { title: 'Log in' };

export default function LoginPage() {
  return (
    <AuthScreen
      eyebrow="Login"
      title="Welcome back"
      subtitle="Enter your registered mobile number to continue."
      mobileTitle="Welcome back!"
      mobileSubtitle="Enter your mobile number to continue learning."
      step={[1, 5]}
      showStats
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthScreen>
  );
}
