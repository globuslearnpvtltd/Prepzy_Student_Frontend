import type { Metadata } from 'next';
import { ChangePasswordScreen } from '@/features/profile/ui';

export const metadata: Metadata = { title: 'Change Password' };

export default function ChangePasswordPage() {
  return <ChangePasswordScreen />;
}
