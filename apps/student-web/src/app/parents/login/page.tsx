import type { Metadata } from 'next';
import { ParentLoginScreen } from '@/features/parents/ui';

export const metadata: Metadata = { title: 'Sign in' };

export default function ParentsLoginPage() {
  return <ParentLoginScreen />;
}
