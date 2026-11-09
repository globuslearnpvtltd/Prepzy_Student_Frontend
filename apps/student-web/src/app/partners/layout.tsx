import type { Metadata } from 'next';
import { Source_Sans_3 } from 'next/font/google';

/** Body face of the partner sign-in / sign-up screens (design token `font-partner`). */
const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
  variable: '--font-source-sans',
});

export const metadata: Metadata = { title: { default: 'Partners', template: '%s · Prepzy Partners' } };

/**
 * Partners portal (partners.prepzy.ai, or /partners on the main host). Each page renders its own chrome.
 * `--font-partner` is re-declared here, where the Source Sans variable exists, so `font-partner` resolves to it.
 */
export default function PartnersLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${sourceSans.variable} bg-partner-canvas min-h-dvh [--font-partner:var(--font-source-sans),'Source_Sans_3',sans-serif]`}>{children}</div>;
}
