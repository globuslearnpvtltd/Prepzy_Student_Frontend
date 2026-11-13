import { Source_Sans_3 } from 'next/font/google';
import { AccountFrame } from '@/shared/layout/exam-shell';

/** Labels and values of the plan cards and invoice tables (design token `font-partner`). */
const sourceSans = Source_Sans_3({ subsets: ['latin'], weight: ['600', '700'], display: 'swap', variable: '--font-source-sans' });

/**
 * Account pages outside any exam (/manage-plans): the header of the student's current exam, no section navigation.
 * `--font-partner` is re-declared where the Source Sans variable exists, so `font-partner` resolves to it.
 */
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${sourceSans.variable} [--font-partner:var(--font-source-sans),'Source_Sans_3',sans-serif]`}>
      <AccountFrame>{children}</AccountFrame>
    </div>
  );
}
