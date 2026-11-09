import { Button } from '@prepzy/design-system';
import { ClipboardList, Clock, Zap } from 'lucide-react';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { env } from '@/shared/config/env';

const STATS = [
  { icon: Zap, label: 'Doubts solved in seconds', value: '5s' },
  { icon: ClipboardList, label: 'Practice questions ready', value: '200k+' },
  { icon: Clock, label: 'Your teacher, always on', value: '24/7' },
] as const;

/** Decorative wave lines used on the brand panel and mobile hero. */
function Waves({ className }: { className: string }) {
  return (
    <svg
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 bottom-0 z-0 w-full ${className}`}
      viewBox="0 0 700 200"
      fill="none"
      preserveAspectRatio="none"
    >
      {[60, 150, 240, 330].map((y) => (
        <path
          key={y}
          d={`M-80 ${y}C80 ${y - 50} 180 ${y + 90} 380 ${y + 40}C580 ${y - 10} 600 ${y - 80} 740 ${y - 30}`}
          stroke="white"
          strokeOpacity="0.09"
          strokeWidth="22"
        />
      ))}
    </svg>
  );
}

/** Left half of every sign-in page on desktop. */
export function BrandPanel() {
  return (
    <aside className="from-brand-light via-brand-deep to-brand text-on-brand relative hidden min-h-dvh flex-col overflow-hidden bg-linear-to-br px-12 pt-16 lg:flex">
      <div className="relative z-10 max-w-xl">
        <h1 className="font-display text-[40px] leading-tight font-extrabold tracking-tight">
          Prepare better.
          <br />
          Score higher.
        </h1>
        <p className="mt-2 max-w-md text-[13px] opacity-80">
          AI lectures, instant doubt solving and real exam-pattern tests for whichever exam you are preparing for.
        </p>
        <ul className="mt-8 flex flex-col gap-3">
          {STATS.map(({ icon: Icon, label, value }) => (
            <li
              key={label}
              className="flex items-center justify-between gap-3 rounded-lg bg-surface/20 px-3 py-3.5 backdrop-blur"
            >
              <span className="flex min-w-0 items-center gap-3.5">
                <span className="bg-surface text-brand-deep grid size-11 place-items-center rounded-md">
                  <Icon aria-hidden size={20} strokeWidth={2.2} />
                </span>
                <span className="truncate text-sm font-medium">{label}</span>
              </span>
              <span className="text-gold text-lg font-bold">{value}</span>
            </li>
          ))}
        </ul>
      </div>
      <Waves className="h-[220px]" />
    </aside>
  );
}

/**
 * Right half on desktop / whole page on mobile: gradient hero (mobile), floating card,
 * optional stat list (mobile) and legal footer — the layout of the original onboarding screens.
 */
export function AuthScreen({
  eyebrow,
  title,
  subtitle,
  mobileTitle = title,
  mobileSubtitle = subtitle,
  step,
  showStats = false,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  mobileTitle?: string;
  mobileSubtitle?: string;
  /** Mobile progress bar: [current, total]. */
  step?: [number, number];
  showStats?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col pb-32 lg:pb-0">
      {step && (
        <div className="bg-line h-[3px] lg:hidden" aria-hidden="true">
          <div
            className="from-brand to-accent-400 h-full bg-linear-to-r"
            style={{ width: `${(step[0] / step[1]) * 100}%` }}
          />
        </div>
      )}

      <div className="hidden justify-end px-6 pt-6 lg:flex">
        <Image src="/brand/logo.png" alt="Prepzy" width={141} height={51} priority className="h-12 w-auto" />
      </div>

      <header className="from-brand-light via-brand-deep to-brand text-on-brand relative overflow-hidden bg-linear-[155deg] px-5 pt-6 pb-20 lg:hidden">
        <div className="relative z-10 mb-6 flex items-center justify-between">
          <Image src="/brand/logo-white.png" alt="Prepzy" width={86} height={29} priority className="h-7 w-auto" />
          <span className="text-[11px] font-semibold tracking-wide opacity-70">CBSE · NEET</span>
        </div>
        <h1 className="font-display relative z-10 mb-3 text-[28px] leading-tight font-extrabold">{mobileTitle}</h1>
        {mobileSubtitle && <p className="relative z-10 text-[13px] leading-relaxed opacity-80">{mobileSubtitle}</p>}
        <Waves className="h-[150px]" />
      </header>

      <main
        id="main"
        className="bg-surface relative z-10 mx-auto -mt-8 flex h-fit w-[92%] flex-col rounded-xl px-4 pt-8 pb-4 shadow-lg lg:my-auto lg:w-full lg:max-w-[480px] lg:p-10"
      >
        {eyebrow && (
          <p className="font-display text-foreground-subtle mb-2 hidden text-[11px] font-bold tracking-[2px] uppercase lg:block">
            {eyebrow}
          </p>
        )}
        <h2 className="font-display text-ink mb-2 hidden text-[30px] leading-tight font-extrabold lg:block">{title}</h2>
        {subtitle && <p className="text-foreground-soft mb-8 hidden text-sm leading-relaxed lg:block">{subtitle}</p>}
        {children}
        <p className="text-foreground-muted mt-4 px-2 text-center text-xs">
          By continuing, you agree to{' '}
          <a className="text-brand font-medium underline" href={`${env.parentDomain}/terms`}>
            Our Terms
          </a>{' '}
          and{' '}
          <a className="text-brand font-medium underline" href={`${env.parentDomain}/policy`}>
            Privacy Policy.
          </a>
        </p>
      </main>

      {showStats && (
        <ul className="flex flex-col gap-2.5 px-4 pt-5 lg:hidden">
          {STATS.map(({ icon: Icon, label, value }) => (
            <li
              key={label}
              className="border-line bg-surface flex items-center justify-between gap-3 rounded-lg border-2 px-4 py-3.5"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="bg-brand-soft text-brand grid size-10 shrink-0 place-items-center rounded-md">
                  <Icon aria-hidden size={18} strokeWidth={2.2} />
                </span>
                <span className="text-foreground-soft truncate text-[13px] font-medium">{label}</span>
              </span>
              <span className="text-brand shrink-0 text-[15px] font-bold">{value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Call-to-action: inline on desktop, pinned to the bottom of the screen on mobile (as in the original). */
export function AuthSubmit({ form, loading, children }: { form: string; loading?: boolean; children: ReactNode }) {
  return (
    <>
      <div className="mt-7 hidden lg:block">
        <SubmitButton form={form} loading={loading}>
          {children}
        </SubmitButton>
      </div>
      <div className="border-line bg-surface fixed inset-x-0 bottom-0 z-20 border-t px-4 pt-3 pb-[22px] shadow-[0_-10px_28px_rgb(0_0_0/0.07)] lg:hidden">
        <SubmitButton form={form} loading={loading}>
          {children}
        </SubmitButton>
      </div>
    </>
  );
}

function SubmitButton({ form, loading, children }: { form: string; loading?: boolean; children: ReactNode }) {
  return (
    <Button type="submit" form={form} size="xl" width="full" loading={loading}>
      {children}
    </Button>
  );
}
