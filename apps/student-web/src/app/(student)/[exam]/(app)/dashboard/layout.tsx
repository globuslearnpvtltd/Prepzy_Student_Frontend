import { DM_Sans, Patrick_Hand } from 'next/font/google';

/** Journey card on the dashboard (previous app's DiagnosticCardArt / MobileNotebookCard): DM Sans + Patrick Hand. */
const dmSans = DM_Sans({ subsets: ['latin'], weight: ['500', '700'], display: 'swap', variable: '--font-dm-sans-face' });
const patrickHand = Patrick_Hand({ subsets: ['latin'], weight: '400', display: 'swap', variable: '--font-patrick-hand-face' });

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
