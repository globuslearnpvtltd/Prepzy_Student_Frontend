import { ProfileChrome } from '@/features/profile/ui';

/** My Account pages: header only, full width, no sidebar (as in the previous app's /profile pages). */
export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <ProfileChrome>{children}</ProfileChrome>;
}
