import type { Metadata } from 'next';
import { SetupForm } from '@/features/auth/ui';

export const metadata: Metadata = { title: 'Set up your account' };

export default function SetupPage() {
  return <SetupForm />;
}
