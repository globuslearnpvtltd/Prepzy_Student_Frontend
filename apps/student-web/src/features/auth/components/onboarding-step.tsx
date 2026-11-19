import { Button } from '@prepzy/design-system';
import { ChevronLeft, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { HERO_GRADIENT, Waves } from './auth-screen';

/** Steps of the sign-up flow (phone, OTP, exam, setup, …) shown by the progress dashes. */
export const SIGNUP_STEPS = 5;

/**
 * "‹ Back" at the top of an onboarding step: grey on the page, white on the mobile hero. A link to the previous page,
 * or a button (`onClick`) for a step inside the same page (e.g. back from the bundle choice to the target year).
 */
export function BackLink({ href, onClick, onBrand = false }: { href?: string; onClick?: () => void; onBrand?: boolean }) {
  const className = `flex cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-[13px] font-semibold ${
    onBrand ? 'text-on-brand' : 'text-foreground-soft hover:text-brand transition-colors'
  }`;
  const content = (
    <>
      <ChevronLeft aria-hidden size={16} strokeWidth={2.5} />
      Back
    </>
  );
  if (onClick || !href) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }
  return (
    <Link href={href} replace className={className}>
      {content}
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
 * The previous app's two layouts of these steps (exam-selection page and NeetSetupComponent):
 * - `exam`: exam selection — the page fills the screen on desktop (the cards scroll), 1040px content, the Continue bar
 *   stays at the bottom.
 * - `cards`: target-year / bundle setup — 960px content, the Continue button inline on desktop.
 */
const LAYOUT = {
  exam: {
    page: 'bg-onboarding-page min-h-dvh lg:h-dvh lg:min-h-0',
    main: 'items-center px-4 pt-5 pb-32 lg:min-h-0 lg:overflow-y-auto lg:pt-4 lg:pb-6',
    content: 'w-full max-w-[1040px] text-center',
    subtitle: 'mb-7',
    footer:
      'border-line bg-surface shadow-onboarding-bar-soft fixed inset-x-0 bottom-0 z-20 border-t px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] lg:static lg:shrink-0 lg:bg-onboarding-page lg:py-5 lg:shadow-none',
  },
  cards: {
    page: 'bg-onboarding-page min-h-dvh',
    main: 'items-center px-4 pt-5 pb-32 lg:pt-6 lg:pb-8',
    content: 'w-full max-w-[960px] text-center',
    subtitle: 'mb-6',
    footer:
      'border-line bg-surface shadow-onboarding-bar-soft fixed inset-x-0 bottom-0 z-10 border-t p-4 lg:static lg:border-0 lg:bg-transparent lg:pb-10 lg:shadow-none',
  },
} as const;

export type StepLayout = keyof typeof LAYOUT;

/**
 * Exam selection and target-year steps: a back link and progress dashes above a centred title on desktop, a rounded
 * gradient hero on mobile, then the choices and a Continue button (pinned to the bottom on mobile).
 */
export function OnboardingStep({
  step,
  backHref,
  onBack,
  title,
  subtitle,
  mobileSubtitle = subtitle,
  layout = 'cards',
  footer,
  children,
}: {
  step: number;
  backHref?: string;
  /** Back inside the page (instead of `backHref`). */
  onBack?: () => void;
  title: string;
  subtitle: string;
  mobileSubtitle?: string;
  layout?: StepLayout;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const ui = LAYOUT[layout];
  return (
    <div className={`flex flex-col leading-[1.75] ${ui.page}`}>
      <header className="hidden shrink-0 items-center justify-between px-10 py-4 lg:flex">
        <BackLink href={backHref} onClick={onBack} />
        <span className="flex items-center gap-2">
          <StepLabel step={step} className="text-foreground-subtle text-[11px] font-semibold" />
          <StepDashes
            current={step}
            active="bg-brand w-6 rounded-full"
            done="bg-brand w-4 rounded-full"
            todo="bg-line w-4 rounded-full"
          />
        </span>
      </header>

      <div className={`${HERO_GRADIENT} relative shrink-0 overflow-hidden rounded-b-[28px] lg:hidden`}>
        <div className="relative z-10 px-[22px] pt-9 pb-4">
          <div className="mb-5 flex items-center justify-between">
            <BackLink href={backHref} onClick={onBack} onBrand />
            <StepLabel step={step} className="sr-only" />
            <StepDashes
              current={step}
              active="bg-on-brand w-6 rounded-full"
              done="bg-on-brand w-4 rounded-full"
              todo="bg-on-brand/30 w-4 rounded-full"
            />
          </div>
          <h1 className="font-display text-on-brand text-[26px] leading-[1.2] font-extrabold tracking-[-0.4px]">{title}</h1>
          <p className="text-on-brand/75 mt-2 text-[13px] font-medium">{mobileSubtitle}</p>
        </div>
        <Waves className="h-[110px]" lines={2} />
      </div>

      <main id="main" className={`flex flex-1 flex-col ${ui.main}`}>
        <div className={ui.content}>
          <h1 className="font-display text-ink hidden text-[34px] leading-[1.2] font-bold tracking-[-0.5px] lg:block">
            {title}
          </h1>
          <p className={`text-foreground-subtle mt-2 hidden text-[14px] font-medium lg:block ${ui.subtitle}`}>{subtitle}</p>
          {children}
        </div>
      </main>

      {footer && <div className={ui.footer}>{footer}</div>}
    </div>
  );
}

/** Continue button of the exam and target-year steps (previous app: 54px, 360px wide on desktop). */
export function ContinueButton({
  disabled,
  loading,
  onClick,
  children = 'Continue',
}: {
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <Button
      disabled={disabled}
      loading={loading}
      onClick={onClick}
      className="bg-brand hover:bg-brand text-on-brand shadow-onboarding-continue hover:shadow-onboarding-continue-hover flex h-[54px] w-full rounded-[16px] border-none text-[15px] leading-[1.75] font-bold transition-all active:scale-[0.99] disabled:active:scale-100 lg:mx-auto lg:max-w-[360px]"
    >
      {children}
    </Button>
  );
}

/** Amber info banner under the choices. */
export function OnboardingNotice({ children }: { children: ReactNode }) {
  return (
    <div className="bg-onboarding-notice-soft mx-auto mt-4 flex w-full items-start gap-2.5 rounded-[14px] p-3.5 lg:w-fit">
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
