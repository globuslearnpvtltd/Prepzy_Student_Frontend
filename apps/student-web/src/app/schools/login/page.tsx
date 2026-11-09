import type { Metadata } from 'next';
import { SchoolsLogin } from '@/features/schools/ui';

export const metadata: Metadata = { title: 'Log in' };

export default function SchoolsLoginPage() {
  return <SchoolsLogin />;
}
