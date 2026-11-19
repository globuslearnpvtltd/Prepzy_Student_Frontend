import localFont from 'next/font/local';
import { FocusChrome } from '@/shared/layout/focus-chrome';

/** Gilroy, the board test player's typeface in the previous app (`font-gilroy`), self-hosted and only loaded here. */
const gilroy = localFont({
  src: [
    { path: '../../../../shared/fonts/gilroy/Gilroy-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../../../../shared/fonts/gilroy/Gilroy-Medium.woff2', weight: '500', style: 'normal' },
    { path: '../../../../shared/fonts/gilroy/Gilroy-SemiBold.woff2', weight: '600', style: 'normal' },
    { path: '../../../../shared/fonts/gilroy/Gilroy-Bold.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-gilroy-face',
  display: 'swap',
  fallback: ['Poppins', 'ui-sans-serif', 'sans-serif'],
});

/**
 * Test player: header only (plus the competitive icon rail), no board sidebar or bottom bar.
 * `--font-gilroy` is re-declared here, where the Gilroy variable exists, so `font-gilroy` resolves to it.
 */
export default function FocusLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${gilroy.variable} [--font-gilroy:var(--font-gilroy-face),'Gilroy',var(--font-poppins),sans-serif]`}
    >
      <FocusChrome>{children}</FocusChrome>
    </div>
  );
}
