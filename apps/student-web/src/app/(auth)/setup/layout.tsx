import { Source_Sans_3 } from 'next/font/google';

/** The class setup's body face (the previous app's `font-sourceSans`; design token `font-partner`). */
const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
  variable: '--font-source-sans',
});

/** `--font-partner` is re-declared where the Source Sans variable exists, so `font-partner` resolves to it. */
export default function SetupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${sourceSans.variable} [--font-partner:var(--font-source-sans),'Source_Sans_3',sans-serif]`}>
      {children}
    </div>
  );
}
