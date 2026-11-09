'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { env } from '@/shared/config/env';
import { partnerRoutes } from '../api';
import { copyText, displayLink } from '../format';
import { usePartnerSummary } from '../hooks';
import { ASSET, HERO_GRADIENT } from './chrome';

// Glow rings are drawn around the check badge, so they stay centred on it at any width.
const ring = 'pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full';

/** Sign-up done: the partner link (with copy) and the way into the dashboard. */
export function SignupSuccess({ onGoToDashboard }: { onGoToDashboard: () => void }) {
  const summary = usePartnerSummary();
  const shareLink = summary.data?.shareLink ?? '';
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!shareLink || !(await copyText(shareLink))) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const linkText = shareLink ? displayLink(shareLink) : 'Getting your link…';
  const copyButton = (
    <button
      type="button"
      onClick={() => void copy()}
      disabled={!shareLink}
      className="bg-partner-chip text-brand-700 hover:bg-partner-chip-hover shrink-0 rounded-[8px] px-[14px] py-[8px] text-[14px] leading-[normal] transition-colors disabled:opacity-60"
    >
      {copied ? 'Copied!' : 'Copy link'}
    </button>
  );

  return (
    <>
      {/* Mobile: celebration banner, link card pulled up over its rounded bottom, then the CTA. */}
      <div className="flex min-w-0 flex-1 flex-col lg:hidden">
        <header className={`relative min-h-[392px] overflow-hidden rounded-b-[30px] px-[24px] pt-[26px] pb-[94px] ${HERO_GRADIENT.success}`}>
          <div className="pointer-events-none absolute top-[202px] left-0 h-[230px] w-full overflow-hidden">
            <Image
              src={`${ASSET}/brand-waves-mobile.svg`}
              alt=""
              width={514.527}
              height={220.279}
              className="absolute top-[4.08px] left-[-10.2%] h-auto w-[124.9%] max-w-none"
            />
          </div>
          <Image
            src={`${ASSET}/celebration-mobile.svg`}
            alt=""
            width={455.369}
            height={360.948}
            priority
            className="pointer-events-none absolute top-[-11px] left-[-10.53%] h-auto w-[110.53%] max-w-none"
          />
          <a
            href={env.parentDomain}
            aria-label="Prepzy home"
            className="font-display text-neutral-0 relative text-[25px] leading-[normal] font-extrabold no-underline"
          >
            <span className="text-partner-gold">P</span>repzy
          </a>

          <div className="relative mt-[46px] flex flex-col items-center gap-[14px] text-center">
            <span className="relative flex size-[88px] items-center justify-center">
              <span className={`${ring} bg-neutral-0/[0.055] size-[168px]`} />
              <span className={`${ring} bg-neutral-0/[0.075] size-[128px]`} />
              <span className={`${ring} bg-neutral-0/[0.095] size-[96px]`} />
              <span className="bg-neutral-0/[0.16] relative flex size-[88px] items-center justify-center rounded-full">
                <span className="bg-partner-mint flex size-[62px] items-center justify-center rounded-full">
                  <Image src={`${ASSET}/icon-check-32.svg`} alt="" width={32} height={32} />
                </span>
              </span>
            </span>
            <h1 className="font-display text-neutral-0 m-0 text-[38px] leading-[normal] font-extrabold">You&apos;re in</h1>
            <p className="text-partner-hero-text m-0 text-[16.5px] leading-[24px]">Your partner link is live. Share it and start earning.</p>
          </div>
        </header>

        <div className="relative -mt-[62px] flex flex-col px-[24px] pb-[32px]">
          <div className="bg-neutral-0 flex flex-col gap-[14px] rounded-[24px] p-[22px] shadow-[0px_10px_28px_0px_rgba(36,29,82,0.1)]">
            <div className="flex items-center gap-[10px]">
              <span className="bg-partner-gold flex size-[38px] shrink-0 items-center justify-center rounded-[12px]">
                <Image src={`${ASSET}/icon-crown.svg`} alt="" width={20} height={20} />
              </span>
              <div className="flex flex-col gap-[2px] leading-[normal] font-semibold">
                <h2 className="font-display text-partner-ink m-0 text-[19px] leading-[normal] font-semibold">Your partner link</h2>
                <span className="text-partner-green text-[14px]">Works for every exam</span>
              </div>
            </div>
            <span className="bg-partner-line h-[1px] w-full" />
            <div className="flex items-center justify-between gap-[12px]">
              <span className="text-partner-body min-w-0 flex-1 truncate text-[15px] leading-[22px]">{linkText}</span>
              {copyButton}
            </div>
            <div className="flex items-center gap-[8px] pt-[10px] pb-[2px]">
              <Image src={`${ASSET}/icon-calendar-17.svg`} alt="" width={17} height={17} />
              <span className="text-partner-ink min-w-0 flex-1 text-[14.5px] leading-[normal] font-semibold">
                PAN and bank needed before payout
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onGoToDashboard}
            className="font-display bg-partner-gold text-partner-night hover:bg-partner-gold-hover mt-[48px] flex w-full items-center justify-center rounded-[15px] py-[18px] text-[19px] leading-[normal] font-bold shadow-[0px_8px_18px_0px_rgba(180,83,9,0.3)] transition-colors"
          >
            Go to my dashboard
          </button>
          <Link
            href={partnerRoutes.payouts}
            className="text-brand-700 mt-[14px] self-start text-[14.5px] leading-[normal] font-bold no-underline hover:underline"
          >
            How payouts work
          </Link>
        </div>
      </div>

      {/* Desktop fills the window; only the space above the badge flexes so the page never scrolls. */}
      <main className="relative hidden min-w-0 flex-1 flex-col items-center gap-[26px] overflow-hidden px-[16px] pt-[clamp(60px,calc(100vh_-_640px),150px)] pb-[16px] lg:flex">
        <Image
          src={`${ASSET}/celebration.svg`}
          alt=""
          width={1512}
          height={661.446}
          priority
          className="pointer-events-none absolute top-[calc(clamp(60px,calc(100vh_-_640px),150px)_-_191.47px)] left-1/2 max-w-none -translate-x-1/2"
        />
        <span className="relative flex size-[104px] shrink-0 items-center justify-center">
          <span className={`${ring} bg-brand-700/[0.05] size-[210px]`} />
          <span className={`${ring} bg-brand-700/[0.065] size-[161px]`} />
          <span className={`${ring} bg-brand-700/[0.08] size-[119px]`} />
          <span className="bg-partner-mint-soft relative flex size-[104px] items-center justify-center rounded-full">
            <Image src={`${ASSET}/icon-check-50.svg`} alt="" width={50} height={50} />
          </span>
        </span>

        <div className="relative flex w-full max-w-[564px] flex-col items-center gap-[10px] text-center">
          <h1 className="font-display text-partner-ink m-0 text-[44px] leading-[normal] font-extrabold">You&apos;re in</h1>
          <p className="text-partner-muted m-0 text-[18px] leading-[normal]">
            Your Prepzy Partner account is activated, Now you can start
            <br />
            sharing your referral link and start earning
          </p>
        </div>

        <div className="border-partner-line bg-neutral-0 relative flex w-full max-w-[680px] flex-col gap-[16px] rounded-[24px] border-[1px] border-solid p-[28px] shadow-[0px_10px_28px_0px_rgba(36,29,82,0.07)]">
          <div className="flex items-center gap-[12px]">
            <span className="bg-partner-gold flex size-[44px] shrink-0 items-center justify-center rounded-[13px]">
              <Image src={`${ASSET}/icon-crown-23.svg`} alt="" width={23} height={23} />
            </span>
            <div className="flex flex-col gap-[3px] leading-[normal] font-semibold">
              <h2 className="font-display text-partner-ink m-0 text-[21px] leading-[normal] font-semibold">Your partner link</h2>
              <span className="text-partner-green text-[15px]">Works for every exam</span>
            </div>
          </div>
          <span className="bg-partner-line h-[1px] w-full" />
          <div className="flex items-center justify-between gap-[12px]">
            <span className="text-partner-body min-w-0 flex-1 truncate text-[15.5px] leading-[23px]">{linkText}</span>
            {copyButton}
          </div>
        </div>

        <button
          type="button"
          onClick={onGoToDashboard}
          className="font-display bg-brand-700 text-neutral-0 hover:bg-partner-hover relative flex w-full max-w-[360px] items-center justify-center rounded-[14px] py-[18px] text-[19px] leading-[normal] font-bold shadow-[0px_8px_18px_0px_rgba(61,52,139,0.28)] transition-colors"
        >
          Go to my dashboard
        </button>
        <Link href={partnerRoutes.payouts} className="text-brand-700 relative text-[15px] leading-[normal] font-bold no-underline hover:underline">
          How payouts work
        </Link>
      </main>
    </>
  );
}
