import Image from 'next/image';
import type { ReactNode } from 'react';
import { env } from '@/shared/config/env';

/** Frame pieces shared by the partner sign-in and sign-up screens (ported from the previous app). */
export const ASSET = '/illustrations/partners';

export interface ValueItem {
  icon: string;
  label: string;
  value: string;
}

export const PERKS: ValueItem[] = [
  { icon: 'icon-userplus.svg', label: 'When a student signs up', value: '₹50' },
  { icon: 'icon-percent.svg', label: 'Share of their first plan', value: '10%' },
  { icon: 'icon-bank.svg', label: 'Paid to your bank', value: 'Cash' },
];

export const fieldLabel = 'font-bold text-[12px] leading-[normal] tracking-[0.72px] text-partner-muted uppercase';
export const fieldBox =
  'flex w-full items-center overflow-hidden rounded-[14px] border-[1.4px] border-solid border-partner-input-line bg-partner-input transition-colors focus-within:border-brand-700';
export const primaryButton =
  'flex w-full items-center justify-center rounded-[14px] bg-brand-700 py-[18px] font-display text-[19px] leading-[normal] font-bold text-neutral-0 shadow-[0px_8px_18px_0px_rgba(61,52,139,0.28)] transition-colors hover:bg-partner-hover disabled:cursor-not-allowed disabled:opacity-60';
export const authCard =
  'flex w-full max-w-[480px] flex-col gap-[16px] rounded-[24px] bg-neutral-0 p-[22px] shadow-[0px_10px_28px_0px_rgba(36,29,82,0.1)] lg:gap-[18px] lg:rounded-[26px] lg:p-[34px] lg:shadow-[0px_14px_36px_0px_rgba(36,29,82,0.1)]';
// Written out in full so Tailwind sees the classes.
export const HERO_GRADIENT = {
  panel: 'bg-[linear-gradient(112.88deg,var(--color-partner-hero)_0%,var(--color-brand-800)_74.074%)]',
  banner: 'bg-[linear-gradient(127.31deg,var(--color-partner-hero)_0%,var(--color-brand-800)_74.074%)]',
  success: 'bg-[linear-gradient(121.73deg,var(--color-partner-hero)_0%,var(--color-brand-800)_74.074%)]',
};

export function BrandPanel({ heading, subtitle, fitScreen = false }: { heading: ReactNode; subtitle: string; fitScreen?: boolean }) {
  return (
    <aside
      className={`sticky top-0 hidden h-screen w-1/2 shrink-0 overflow-hidden lg:block xl:w-[660px] ${fitScreen ? '' : 'min-h-[720px]'} ${HERO_GRADIENT.panel}`}
    >
      <div className="pointer-events-none absolute bottom-[10px] flex h-[290px] w-full items-center justify-center overflow-hidden">
        <Image
          src={`${ASSET}/brand-waves.svg`}
          alt=""
          width={826.981}
          height={390.17}
          className="absolute top-[1.83px] left-[-63.69px] max-w-none"
        />
      </div>

      <div className="relative flex w-full max-w-[640px] flex-col gap-[20px] px-[40px] pt-[clamp(40px,9.5vh,80px)] xl:px-[60px]">
        <h1 className="font-display text-neutral-0 m-0 text-[42px] leading-[48px] font-extrabold xl:text-[54px] xl:leading-[60px]">
          {heading}
        </h1>
        <p className="text-partner-hero-text m-0 text-[19px] leading-[28px]">{subtitle}</p>
        <ul className="m-0 flex w-full list-none flex-col gap-[12px] p-0">
          {PERKS.map((perk) => (
            <li key={perk.label} className="bg-neutral-0/10 flex items-center gap-[14px] rounded-[16px] py-[10px] pr-[20px] pl-[16px]">
              <span className="bg-neutral-0 flex size-[40px] shrink-0 items-center justify-center rounded-[12px]">
                <Image src={`${ASSET}/${perk.icon}`} alt="" width={20} height={20} />
              </span>
              <span className="text-neutral-0 min-w-0 flex-1 text-[16px] leading-[normal] font-semibold whitespace-nowrap">
                {perk.label}
              </span>
              <span className="font-display text-partner-gold text-[22px] leading-[normal] font-bold whitespace-nowrap">
                {perk.value}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="pointer-events-none absolute bottom-0 left-1/2 aspect-[3/2] h-[clamp(240px,calc(100vh-520px),400px)] -translate-x-1/2">
        <Image
          src={`${ASSET}/partner-group.png`}
          alt="Teachers, parents and students who partner with Prepzy"
          fill
          sizes="600px"
          priority
          className="object-cover"
        />
      </div>
    </aside>
  );
}

export function PartnerLogo() {
  return (
    <a
      href={env.parentDomain}
      aria-label="Prepzy home"
      className="absolute top-[24px] right-[24px] hidden h-[65px] w-[184.659px] overflow-hidden lg:block"
    >
      <Image
        src={`${ASSET}/prepzy-logo-light-bg.png`}
        alt="Prepzy"
        width={500}
        height={500}
        className="absolute top-[-91.48%] left-0 h-[284.09%] w-full max-w-none"
      />
    </a>
  );
}

/** Tricolour chip shown before +91 in the mobile number field. */
export function IndiaFlag() {
  return (
    <span aria-hidden className="bg-neutral-0 flex h-[20px] w-[30px] shrink-0 flex-col overflow-hidden rounded-[3px]">
      <span className="bg-partner-saffron h-[6.66px]" />
      <span className="bg-neutral-0 h-[6.66px]" />
      <span className="bg-partner-india-green h-[6.66px]" />
    </span>
  );
}

/** Below lg the steps open with this banner; the step's card pulls up over its rounded bottom. */
export function MobileBanner({
  label,
  heading,
  subtitle,
  subtitleClassName = 'text-[16.5px] leading-[24px]',
}: {
  label: string;
  heading: ReactNode;
  subtitle: ReactNode;
  subtitleClassName?: string;
}) {
  return (
    <header className={`relative min-h-[318px] overflow-hidden rounded-b-[30px] px-[24px] pt-[26px] pb-[62px] lg:hidden ${HERO_GRADIENT.banner}`}>
      <div className="pointer-events-none absolute top-[128px] left-0 h-[230px] w-full overflow-hidden">
        <Image
          src={`${ASSET}/brand-waves-mobile.svg`}
          alt=""
          width={514.527}
          height={220.279}
          className="absolute top-[4.08px] left-[-10.2%] h-auto w-[124.9%] max-w-none"
        />
      </div>
      <div className="relative flex items-center justify-between">
        <a href={env.parentDomain} aria-label="Prepzy home">
          <Image src="/brand/logo-white.png" alt="Prepzy" width={102.928} height={34.584} />
        </a>
        <span className="text-partner-hero-label text-[14px] leading-[normal] font-semibold whitespace-nowrap uppercase">
          {label}
        </span>
      </div>
      <div className="relative mt-[49px] flex flex-col gap-[10px]">
        <h1 className="font-display text-neutral-0 m-0 text-[38px] leading-[44px] font-extrabold">{heading}</h1>
        <p className={`text-partner-hero-text m-0 ${subtitleClassName}`}>{subtitle}</p>
      </div>
    </header>
  );
}

export function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-brand-700 hover:text-partner-ink flex items-center gap-[7px] self-start text-[16px] leading-[normal] font-bold transition-colors lg:absolute lg:top-[52px] lg:left-[60px]"
    >
      <Image src={`${ASSET}/icon-chevron-left.svg`} alt="" width={18} height={18} />
      Back
    </button>
  );
}

export interface InfoCard {
  icon: string;
  mobileIcon?: string;
  title: string;
  desc: string;
}

/** `fitHeight` scales the cards with the window height on desktop, for steps that must fit one screen. */
export function InfoCards({ heading, cards, fitHeight = false }: { heading: string; cards: InfoCard[]; fitHeight?: boolean }) {
  return (
    <>
      <h2
        className={`font-display text-partner-ink m-0 text-center text-[26px] leading-[normal] font-semibold ${fitHeight ? 'lg:text-[length:clamp(20px,3vh,26px)]' : ''}`}
      >
        {heading}
      </h2>
      <ul
        className={`m-0 grid w-full max-w-[878px] list-none grid-cols-2 gap-[12px] p-0 sm:gap-[18px] lg:grid-cols-4 ${fitHeight ? 'lg:gap-[clamp(12px,2vh,18px)]' : ''}`}
      >
        {cards.map((card) => (
          <li
            key={card.title}
            className={`border-partner-line bg-neutral-0 flex flex-col items-start gap-[10px] rounded-[18px] border-[1px] border-solid p-[16px] sm:p-[20px] ${fitHeight ? 'lg:gap-[clamp(6px,1.2vh,10px)] lg:p-[clamp(12px,2vh,20px)]' : ''}`}
          >
            <span
              className={`bg-partner-tile flex size-[44px] shrink-0 items-center justify-center rounded-[13px] ${fitHeight ? 'lg:size-[clamp(34px,5vh,44px)]' : ''}`}
            >
              <Image src={`${ASSET}/${card.icon}`} alt="" width={22} height={22} />
            </span>
            <h3 className="font-display text-partner-ink m-0 text-[17px] leading-[normal] font-semibold">{card.title}</h3>
            <p className="text-partner-muted m-0 text-[14px] leading-[20px]">{card.desc}</p>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Mobile-only list of short rows: icon tile, one-line label, highlighted value (₹50, 10%, ✓). */
export function MobileValueCards({ items }: { items: ValueItem[] }) {
  return (
    <ul className="m-0 flex w-full max-w-[480px] list-none flex-col gap-[12px] p-0 lg:hidden">
      {items.map((item) => (
        <li
          key={item.label}
          className="border-partner-line bg-neutral-0 flex items-center gap-[13px] rounded-[16px] border-[1px] border-solid py-[12px] pr-[18px] pl-[14px]"
        >
          <span className="bg-partner-tile flex size-[40px] shrink-0 items-center justify-center rounded-[11px]">
            <Image src={`${ASSET}/${item.icon}`} alt="" width={20} height={20} />
          </span>
          <span className="text-partner-ink min-w-0 flex-1 text-[15px] leading-[normal] font-semibold">{item.label}</span>
          <span className="font-display text-brand-700 text-[20px] leading-[normal] font-bold whitespace-nowrap">{item.value}</span>
        </li>
      ))}
    </ul>
  );
}

/** Mobile version of InfoCards: one column with smaller (20px) icons. */
export function MobileInfoCards({ heading, cards }: { heading: string; cards: InfoCard[] }) {
  return (
    <section className="flex w-full max-w-[560px] flex-col gap-[14px] lg:hidden">
      <h2 className="font-display text-partner-ink m-0 text-[26px] leading-[normal] font-extrabold">{heading}</h2>
      <ul className="m-0 flex w-full list-none flex-col gap-[14px] p-0">
        {cards.map((card) => (
          <li
            key={card.title}
            className="border-partner-line bg-neutral-0 flex items-center gap-[14px] rounded-[18px] border-[1px] border-solid p-[16px]"
          >
            <span className="bg-partner-tile flex size-[40px] shrink-0 items-center justify-center rounded-[13px]">
              <Image src={`${ASSET}/${card.mobileIcon ?? card.icon}`} alt="" width={20} height={20} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <h3 className="font-display text-partner-ink m-0 text-[18px] leading-[normal] font-semibold">{card.title}</h3>
              <p className="text-partner-muted m-0 text-[14.5px] leading-[normal]">{card.desc}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="border-partner-error bg-neutral-0 text-partner-error m-0 w-full rounded-[14px] border-[1px] border-solid px-[16px] py-[10px] text-[14px] font-semibold"
    >
      {message}
    </p>
  );
}

export function LegalNote() {
  return (
    <p className="text-partner-muted m-0 text-center text-[13.5px] leading-[19px]">
      By continuing you agree to our{' '}
      <a href={`${env.parentDomain}/terms`} className="text-inherit underline">
        Terms
      </a>{' '}
      and{' '}
      <a href={`${env.parentDomain}/policy`} className="text-inherit underline">
        Privacy Policy
      </a>
      .
    </p>
  );
}

/** Text of an API error, or the fallback when there is none worth showing. */
export function errorText(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'status' in error && 'message' in error) {
    const { status, message } = error as { status: number; message: string };
    if (status !== 0 && message && !message.startsWith('Request failed')) return message;
  }
  return fallback;
}
