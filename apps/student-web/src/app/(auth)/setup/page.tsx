import type { Metadata } from 'next';
import { AuthScreen, SetupForm } from '@/features/auth/ui';

export const metadata: Metadata = { title: 'Set up your account' };

export default function SetupPage() {
  return (
    <AuthScreen
      eyebrow="Almost there"
      title="Set up your plan"
      subtitle="Tell us where you are so we can tailor your plan."
      step={[4, 5]}
    >
      <SetupForm />
    </AuthScreen>
  );
}
