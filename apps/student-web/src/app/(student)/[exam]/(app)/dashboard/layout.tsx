import localFont from 'next/font/local';

/*
 * Journey card on the dashboard (previous app's DiagnosticCardArt / MobileNotebookCard): DM Sans + Patrick Hand.
 * Self-hosted (Latin woff2 files in src/app/fonts/journey, SIL Open Font License) instead of next/font/google: the
 * staging server's build failed fetching DM Sans from Google Fonts ("Cannot read properties of null (reading '1')"),
 * and a build must not depend on reaching Google.
 */
const dmSans = localFont({
  src: [
    { path: '../../../../fonts/journey/dm-sans-500.woff2', weight: '500', style: 'normal' },
    { path: '../../../../fonts/journey/dm-sans-700.woff2', weight: '700', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-dm-sans-face',
});
const patrickHand = localFont({
  src: '../../../../fonts/journey/patrick-hand-400.woff2',
  weight: '400',
  display: 'swap',
  variable: '--font-patrick-hand-face',
});

/**
 * Dashboard pages. `--font-notebook` / `--font-hand` are re-declared where the font variables exist, so the
 * `font-notebook` / `font-hand` tokens resolve to them (`contents` keeps the page out of an extra box).
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${dmSans.variable} ${patrickHand.variable} contents [--font-hand:var(--font-patrick-hand-face),'Patrick_Hand',cursive] [--font-notebook:var(--font-dm-sans-face),'DM_Sans',ui-sans-serif,sans-serif]`}
    >
      {children}
    </div>
  );
}
