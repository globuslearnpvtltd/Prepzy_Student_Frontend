import type { Metadata } from 'next';
import { ParentScreen } from '@/features/profile/ui';

export const metadata: Metadata = { title: 'Parent' };

export default function ParentPage() {
  return <ParentScreen />;
}
