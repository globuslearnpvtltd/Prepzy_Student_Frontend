import type { Metadata, Viewport } from 'next';
import { Baloo_2, Poppins } from 'next/font/google';
// Component-free entry: this server layout must not pull the client components of the package barrel.
import { colorValue } from '@prepzy/design-system/runtime';
import { Analytics } from '@/shared/analytics/analytics';
import { Providers } from './providers';
import './globals.css';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-poppins',
});

/** Display face for headings (design token `font-display`). */
const baloo = Baloo_2({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-baloo',
});

export const metadata: Metadata = {
  title: { default: 'Prepzy', template: '%s · Prepzy' },
  description: 'Prepzy — learn, practise and track your exam preparation.',
  icons: { icon: '/brand/favicon.png' },
  robots: { index: false, follow: false },
};

/** Applies to every route: no nested layout or page exports its own `viewport`. */
export const viewport: Viewport = {
  themeColor: colorValue('brand'),
  width: 'device-width',
  initialScale: 1,
  // Lets content reach the screen edges on notched phones, so the `env(safe-area-inset-*)` paddings
  // (bottom nav, sheets, checkout bar) take effect.
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${poppins.variable} ${baloo.variable}`}>
      <body>
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
