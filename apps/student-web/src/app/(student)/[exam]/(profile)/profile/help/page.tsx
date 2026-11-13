import type { Metadata } from 'next';
import { HelpScreen } from '@/features/profile/ui';

export const metadata: Metadata = { title: 'Help and support' };

export default function HelpPage() {
  return <HelpScreen />;
}
