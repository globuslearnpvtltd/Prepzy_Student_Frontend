import { FocusChrome } from '@/shared/layout/focus-chrome';

/** Test player: header only (plus the competitive icon rail), no board sidebar or bottom bar. */
export default function FocusLayout({ children }: { children: React.ReactNode }) {
  return <FocusChrome>{children}</FocusChrome>;
}
