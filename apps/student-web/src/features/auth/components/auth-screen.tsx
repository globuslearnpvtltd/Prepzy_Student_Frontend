import { Button } from '@prepzy/design-system';
import { ClipboardList, Clock, Zap } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { env } from '@/shared/config/env';

const STATS = [
  { icon: Zap, label: 'Doubts solved in seconds', value: '5s' },
  { icon: ClipboardList, label: 'Practice questions ready', value: '200k+' },
  { icon: Clock, label: 'Your teacher, always on', value: '24/7' },
] as const;

/** Decorative wave lines of the brand panel and the mobile heroes (`lines`: how many of the four). */
export function Waves({ className, lines = 4 }: { className: string; lines?: number }) {
  return (
    <svg
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 bottom-0 z-0 w-full ${className}`}
      viewBox="0 0 700 200"
      fill="none"
      preserveAspectRatio="none"
    >
      {[60, 150, 240, 330].slice(0, lines).map((y) => (
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

/** Purple gradient of every mobile hero. */
export const HERO_GRADIENT = 'from-brand-light via-brand-deep to-brand bg-linear-[155deg]';

/**
 * Left side of the login and sign-up pages on desktop. As in the original, a 70% basis shrinking against a
 * full-width form column, i.e. 70/170 ≈ 41% of the screen.
 */
export function BrandPanel() {
  return (
    <aside className="from-brand-light via-brand-deep to-brand text-on-brand relative hidden h-dvh w-[70%] overflow-hidden bg-linear-to-br lg:block">
      {/* Padding on an inner box: on the aside it would change how much the 70% basis shrinks. */}
      <div className="relative z-10 max-w-xl px-[50px] pt-[70px] box-content">
        <h1 className="font-display text-[40px] leading-tight font-extrabold tracking-tight">
          Prepare better.
          <br />
          Score higher.
        </h1>
        <p className="font-plain mt-2 max-w-md text-[13px] opacity-80">
          AI lectures, instant doubt solving and real exam-pattern tests for whichever exam you are preparing for.
        </p>
        <ul className="mt-8 flex flex-col gap-4">
          {STATS.map(({ icon: Icon, label, value }) => (
            <li
              key={label}
              className="bg-surface/20 flex items-center justify-between gap-4 rounded-lg px-4 py-3.5 backdrop-blur"
            >
              <span className="flex min-w-0 items-center gap-3.5">
                <span className="bg-surface text-brand-deep grid size-11 place-items-center rounded-md">
                  <Icon aria-hidden size={20} strokeWidth={2.2} />
                </span>
                <span className="truncate text-[14px] leading-5 font-medium">{label}</span>
              </span>
              <span className="text-gold text-[18px] leading-7 font-bold">{value}</span>
            </li>
          ))}
        </ul>
      </div>
      <Waves className="h-[220px]" />
    </aside>
  );
}

type Variant = 'login' | 'signup';

/**
 * Login and sign-up pages: brand panel (desktop, 70%) with the logo and a floating form card beside it;
 * on mobile a gradient hero, the card overlapping it and a stat list — the previous app's onboarding layout.
 */
export function AuthScreen({
  variant = 'login',
  eyebrow,
  title,
  subtitle,
  mobileTitle = title,
  mobileSubtitle = subtitle,
  step,
  showStats = false,
  children,
}: {
  variant?: Variant;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  mobileTitle?: ReactNode;
  mobileSubtitle?: string;
  /** Mobile progress bar: [current, total]. */
  step?: [number, number];
  showStats?: boolean;
  children: ReactNode;
}) {
  const signup = variant === 'signup';
  return (
    <div className={`flex min-h-dvh w-full leading-[1.75] lg:h-dvh lg:overflow-hidden ${signup ? 'bg-onboarding-signup' : 'bg-surface'}`}>
      <BrandPanel />
      <div className="flex min-h-dvh w-full min-w-0 flex-col overflow-x-hidden lg:h-dvh lg:min-h-0 lg:justify-between lg:overflow-y-auto">
        <div className="hidden justify-end px-6 lg:flex">
          {/* The original logo file was square (104×104 at this size), which sets the row height. */}
          <a href={env.parentDomain} className="flex h-[104px] w-[160px] items-center">
            <Image src="/brand/logo.png" alt="Prepzy" width={470} height={170} priority className="h-auto w-[65%]" />
          </a>
        </div>

        {step && (
          <div className="bg-line h-[3px] shrink-0 lg:hidden" aria-hidden="true">
            <div
              className="from-brand to-accent-400 h-full bg-linear-to-r"
              style={{ width: `${(step[0] / step[1]) * 100}%` }}
            />
          </div>
        )}

        <header
          className={`${HERO_GRADIENT} text-on-brand relative shrink-0 overflow-hidden ${
            signup ? 'rounded-b-[30px] px-4 py-9 md:hidden' : 'px-12 pt-6 pb-[80px] lg:hidden'
          }`}
        >
          <div className="relative z-10 mb-6 flex items-center justify-between">
            <a href={env.parentDomain} className="w-[86px]">
              <Image
                src="/brand/logo-white.png"
                alt="Prepzy"
                width={500}
                height={168}
                priority
                className="h-auto w-[65%]"
              />
            </a>
            <span className="text-[11px] font-semibold tracking-[0.5px] text-on-brand/70">CBSE · NEET</span>
          </div>
          <h1 className="font-display relative z-10 mb-4 text-[28px] leading-[1.2] font-extrabold tracking-[-0.4px]">
            {mobileTitle}
          </h1>
          {mobileSubtitle && (
            <p className="font-plain relative z-10 mb-[15px] text-[13px] leading-[1.55] text-on-brand/80">{mobileSubtitle}</p>
          )}
          <Waves className={signup ? 'h-[170px]' : 'h-[150px]'} />
        </header>

        <main
          id="main"
          className={`bg-surface shadow-onboarding-form relative z-10 mx-auto -mt-8 flex h-fit flex-col px-6 pt-8 lg:my-auto lg:max-w-[480px] ${
            signup ? 'w-[85%] rounded-2xl pb-2' : 'w-[92%] rounded-xl pb-6 lg:pt-10'
          }`}
        >
          {eyebrow && (
            <p className="font-display text-foreground-subtle mb-2 hidden text-[11px] font-bold tracking-[2px] uppercase lg:block">
              {eyebrow}
            </p>
          )}
          <h2
            className={`font-display text-ink hidden text-[30px] leading-[1.2] tracking-[-0.4px] lg:block ${
              signup ? 'mb-6 font-semibold' : 'mb-2 font-black'
            }`}
          >
            {title}
          </h2>
          {subtitle && (
            <p className={`text-foreground-soft hidden text-[14px] leading-[1.6] lg:block ${signup ? 'mb-7' : 'font-display mb-8'}`}>
              {subtitle}
            </p>
          )}
          {children}
          <p className="mt-6 px-2 text-center text-[12px] text-neutral-900/60">
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
          <ul className={`flex flex-col gap-2.5 px-6 pt-12 lg:hidden ${signup ? 'pb-8' : 'pb-[120px]'}`}>
            {STATS.map(({ icon: Icon, label, value }) => (
              <li
                key={label}
                className="border-line bg-surface shadow-onboarding-stat flex items-center justify-between gap-4 rounded-lg border-2 px-6 py-3.5"
              >
                <span className="flex min-w-0 items-center gap-4">
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
    </div>
  );
}

const SUBMIT = 'text-on-brand bg-brand hover:bg-brand w-full h-auto rounded-[14px] border-none font-bold leading-[1.75]';

/**
 * Call-to-action of the phone forms, as in the original: login pins it to the bottom of the screen on mobile,
 * sign-up keeps it inside the card; both show it inline on desktop.
 */
export function AuthSubmit({
  form,
  loading,
  variant = 'login',
  children,
}: {
  form: string;
  loading?: boolean;
  variant?: Variant;
  children: ReactNode;
}) {
  if (variant === 'signup') {
    return (
      <>
        <Button
          type="submit"
          form={form}
          loading={loading}
          className={`${SUBMIT} font-display shadow-onboarding-cta mt-2 p-4 text-[15px] lg:hidden`}
        >
          {children}
        </Button>
        <Button
          type="submit"
          form={form}
          loading={loading}
          className={`${SUBMIT} font-display shadow-brand-glow mt-7 hidden p-[18px] text-[19px] lg:flex`}
        >
          {children}
        </Button>
      </>
    );
  }
  return (
    <>
      <Button
        type="submit"
        form={form}
        loading={loading}
        className={`${SUBMIT} shadow-brand-glow mt-7 hidden p-[18px] text-[16px] lg:flex`}
      >
        {children}
      </Button>
      <div className="border-line bg-surface shadow-onboarding-bar fixed inset-x-0 bottom-0 z-20 border-t px-6 py-4 lg:hidden">
        <Button type="submit" form={form} loading={loading} className={`${SUBMIT} shadow-onboarding-cta px-4 py-4 text-[15px]`}>
          {children}
        </Button>
      </div>
    </>
  );
}

/** "New to Prepzy? Sign up for free" / "Already have an account? Login" around the submit button. */
export function AuthSwitch({
  prompt,
  href,
  linkClassName = '',
  className = '',
  children,
}: {
  prompt: string;
  href: string;
  linkClassName?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <p className={`text-foreground-soft text-center ${className}`}>
      {prompt}{' '}
      <Link className={`text-brand font-bold underline underline-offset-2 ${linkClassName}`} href={href}>
        {children}
      </Link>
    </p>
  );
}
