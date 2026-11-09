import type { Metadata } from 'next';
import { ProfileScreen } from '@/features/profile/ui';

export const metadata: Metadata = { title: 'My Profile' };

export default function ProfilePage() {
  return <ProfileScreen />;
}
