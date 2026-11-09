import { AppChrome } from '@/shared/layout/exam-shell';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppChrome>{children}</AppChrome>;
}
