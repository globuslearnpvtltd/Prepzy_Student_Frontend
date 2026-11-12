import { Button } from '@prepzy/design-system';
import { ChevronLeft, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { HERO_GRADIENT, Waves } from './auth-screen';

/** Steps of the sign-up flow (phone, OTP, exam, setup, …) shown by the progress dashes. */
export const SIGNUP_STEPS = 5;

/** "‹ Back" link at the top of an onboarding step: grey on the page, white on the mobile hero. */
export function BackLink({ href, onBrand = false }: { href: string; onBrand?: boolean }) {
  return (
    <Link
      href={href}
      replace
      className={`flex items-center gap-1 text-[13px] font-semibold ${
        onBrand ? 'text-on-brand' : 'text-foreground-soft hover:text-brand transition-colors'
      }`}
    >
      <ChevronLeft aria-hidden size={16} strokeWidth={2.5} />
      Back
    </Link>
  );
}

/**
 * Progress dashes of the onboarding flow. `current` is 1-based; done and current dashes are filled, the current
 * one is longer. Sizes and colours are passed so each screen keeps the original's exact proportions.
 */
export function StepDashes({
  current,
  count = SIGNUP_STEPS,
  className = 'gap-1.5',
  active,
  done,
  todo,
}: {
  current: number;
  count?: number;
  className?: string;
  active: string;
  done: string;
  todo: string;
}) {
  return (
    <span aria-hidden className={`flex items-center ${className}`}>
      {Array.from({ length: count }, (_, i) => i + 1).map((n) => (
        <span key={n} className={`h-1.5 transition-all ${n === current ? active : n < current ? done : todo}`} />
      ))}
    </span>
  );
}

/** Screen-reader text for the dashes. */
export function StepLabel({ step, className }: { step: number; className: string }) {
  return (
    <span className={className}>
      Step {step}
      <span className="sr-only"> of {SIGNUP_STEPS}</span>
    </span>
  );
}

/**
 * The original's two step layouts (spacing is what it rendered, its Bootstrap utilities included):
 * - `cards`: exam selection and target-year setup — tinted page, centred cards, a 360px Continue button.
 * - `classes`: class setup — white page, left-aligned class cards, a full-width Continue button.
 */
const LAYOUT = {
  cards: {
    page: 'bg-onboarding-page',
    header: 'px-12 py-6',
    label: 'text-[11px] font-semibold',
    labelGap: 'gap-2',
    main: 'items-center px-6 pt-12 pb-32 lg:pb-5',
    content: 'w-full max-w-[960px] text-center',
    title: 'text-[34px] leading-[1.2] font-bold',
    subtitle: 'text-foreground-subtle mt-2 mb-7',
    footer: 'border-line shadow-onboarding-bar-soft fixed inset-x-0 bottom-0 z-10 border-t p-6 lg:static lg:border-0 lg:shadow-none',
  },
  classes: {
    page: 'bg-surface',
    header: 'px-10 py-6',
    label: 'text-[12px] font-bold',
    labelGap: 'gap-2.5',
    main: 'px-4 pt-4 pb-24 lg:flex-none lg:pb-0',
    content: 'w-full lg:mx-auto lg:max-w-[960px]',
    title: 'text-center text-[38px] leading-[1.18] font-black',
    subtitle: 'text-onboarding-gold mt-1.5 mb-6 text-center leading-[1.5]',
    footer:
      'border-line bg-surface shadow-onboarding-bar-soft fixed inset-x-0 bottom-0 z-10 border-t p-4 lg:static lg:mx-auto lg:w-full lg:max-w-[960px] lg:border-0 lg:bg-transparent lg:px-0 lg:pt-4 lg:pb-6 lg:shadow-none',
  },
} as const;

export type StepLayout = keyof typeof LAYOUT;

/**
 * Exam selection and setup steps: a back link and progress dashes above a centred title on desktop, a rounded
 * gradient hero on mobile, then the choices and a Continue button (pinned to the bottom on mobile).
 */
export function OnboardingStep({
  step,
  backHref,
  title,
  subtitle,
  mobileSubtitle = subtitle,
  layout = 'cards',
  footer,
  children,
}: {
  step: number;
  backHref: string;
  title: string;
  subtitle: string;
  mobileSubtitle?: string;
  layout?: StepLayout;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const ui = LAYOUT[layout];
  return (
    <div className={`flex min-h-dvh flex-col leading-[1.75] ${ui.page}`}>
      <header className={`hidden items-center justify-between lg:flex ${ui.header}`}>
        <BackLink href={backHref} />
        <span className={`flex items-center ${ui.labelGap}`}>
          <StepLabel step={step} className={`text-foreground-subtle ${ui.label}`} />
          <StepDashes
            current={step}
            active="bg-brand w-6 rounded-full"
            done="bg-brand w-4 rounded-full"
            todo="bg-line w-4 rounded-full"
          />
        </span>
      </header>

      <div className={`${HERO_GRADIENT} relative overflow-hidden rounded-b-[28px] lg:hidden`}>
        <div className="relative z-10 px-[22px] pt-9 pb-6">
          <div className="mb-12 flex items-center justify-between">
            <BackLink href={backHref} onBrand />
            <StepLabel step={step} className="sr-only" />
            <StepDashes
              current={step}
              active="bg-on-brand w-6 rounded-full"
              done="bg-on-brand w-4 rounded-full"
              todo="bg-on-brand/30 w-4 rounded-full"
            />
          </div>
          <h1
            className={`font-display text-on-brand text-[26px] leading-[1.2] tracking-[-0.4px] ${
              layout === 'classes' ? 'mt-1 font-black' : 'font-extrabold'
            }`}
          >
            {title}
          </h1>
          <p className="font-plain text-on-brand/75 mt-2 mb-[15px] text-[13px] font-medium">{mobileSubtitle}</p>
        </div>
        <Waves className={layout === 'classes' ? 'h-[90px]' : 'h-[110px]'} lines={2} />
      </div>

      <main id="main" className={`flex flex-1 flex-col ${ui.main}`}>
        <div className={ui.content}>
          <h1 className={`font-display text-ink hidden tracking-[-0.5px] lg:block ${ui.title}`}>{title}</h1>
          <p className={`font-plain hidden text-[14px] font-medium lg:block ${ui.subtitle}`}>{subtitle}</p>
          {children}
        </div>
      </main>

      {footer && <div className={ui.footer}>{footer}</div>}
    </div>
  );
}

/** Continue button of an onboarding step (`classes`: the class step's full-width version). */
export function ContinueButton({
  disabled,
  loading,
  onClick,
  layout = 'cards',
  children = 'Continue',
}: {
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
  layout?: StepLayout;
  children?: ReactNode;
}) {
  return (
    <Button
      disabled={disabled}
      loading={loading}
      onClick={onClick}
      className={`bg-brand hover:bg-brand text-on-brand flex w-full rounded-lg border-none font-bold ${
        layout === 'classes'
          ? 'shadow-onboarding-continue lg:shadow-brand-glow lg:font-display h-auto p-4 text-[14px] leading-[1.75] lg:py-2.5 lg:text-[18px]'
          : 'shadow-onboarding-continue h-[54px] text-[15px] leading-[1.75] lg:mx-auto lg:max-w-[360px]'
      }`}
    >
      {children}
    </Button>
  );
}

/** Amber info banner under the choices. */
export function OnboardingNotice({ children }: { children: ReactNode }) {
  return (
    <div className="bg-onboarding-notice-soft mx-auto mt-6 flex w-full items-start gap-2.5 rounded-[14px] p-3.5 lg:w-fit">
      <ShieldCheck aria-hidden size={16} className="text-onboarding-notice-icon mt-0.5 shrink-0" />
      <p className="text-onboarding-notice-text text-left text-[12px] leading-[1.5] font-medium lg:text-[13px]">
        {children}
      </p>
    </div>
  );
}

/** Radio dot at the end of an onboarding choice card. */
export function ChoiceDot({ selected, className = '' }: { selected: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
        selected ? 'border-brand bg-brand' : 'border-onboarding-radio bg-surface'
      } ${className}`}
    >
      {selected && <span className="size-2 rounded-full bg-on-brand" />}
    </span>
  );
}

/** Classes shared by the onboarding choice cards (an OptionTile restyled like the original cards). */
export const CHOICE_CARD =
  'border-2 leading-[1.75] transition-all data-[state=checked]:border-brand data-[state=checked]:bg-brand-soft data-[state=unchecked]:border-line data-[state=unchecked]:bg-surface data-[state=unchecked]:hover:border-brand/40 data-[state=unchecked]:hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60';
