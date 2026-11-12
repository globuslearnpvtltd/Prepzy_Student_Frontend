import { AppChrome } from '@/shared/layout/exam-shell';

/** Plans and billing: the app's normal frame (header and the exam category's navigation), the same for every exam. */
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <AppChrome>{children}</AppChrome>;
}
