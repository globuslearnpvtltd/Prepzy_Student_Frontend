'use client';

import { cx } from '@prepzy/design-system';
import { useState } from 'react';
import { inr, shareLabel, shortLink, type Reward } from '../api';
import { brandGradient, Coins, Icon, type Spot } from './kit';

const DESKTOP_COINS: Spot[] = [
  { size: 30, left: 66, top: 43, rotate: 12 },
  { size: 20, left: 152, top: 168, rotate: -10 },
  { size: 14, left: 40, top: 190 },
  { size: 26, right: 110, top: 31, rotate: -18 },
  { size: 32, right: 63, top: 164, rotate: 15 },
  { size: 16, right: 183, top: 199, rotate: -8 },
];
const DESKTOP_SPARKLES: Spot[] = [
  { size: 12, left: 180, top: 26 },
  { size: 12, left: 110, top: 110 },
  { size: 12, left: 260, top: 210 },
  { size: 12, right: 198, top: 128 },
  { size: 12, right: 38, top: 100 },
  { size: 12, right: 268, top: 222 },
];
const MOBILE_COINS: Spot[] = [
  { size: 22, left: 15, top: 22, rotate: 12 },
  { size: 26, right: 14, top: 24, rotate: -10 },
  { size: 18, right: 14, top: 150 },
  { size: 16, left: 22, top: 162, rotate: 15 },
  { size: 12, right: 18, top: 70, rotate: -18 },
];
const CTA_COINS: Spot[] = [
  { size: 30, left: 33, top: 31, rotate: 12 },
  { size: 20, left: 60, top: 148, rotate: -10 },
  { size: 14, right: 46, top: 24 },
  { size: 26, right: 21, top: 145, rotate: -18 },
];

export function WhatsAppButton({ label, onClick, className }: { label: string; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'bg-success-350 text-on-brand flex items-center justify-center gap-2 rounded-md font-semibold transition-opacity hover:opacity-90 lg:gap-[10px]',
        className,
      )}
    >
      <Icon name="whatsapp.svg" width={18} height={18} />
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export function HeroBanner({ shareLink, reward, onShare }: { shareLink: string; reward: Reward; onShare: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (await copyText(shareLink)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <section
      className={cx(
        'relative w-full overflow-hidden rounded-[22px] px-5 pt-[43px] pb-5 lg:min-h-[260px] lg:rounded-xl lg:px-10 lg:pt-[55px] lg:pb-12',
        brandGradient,
      )}
    >
      <div className="hidden lg:block">
        <Coins coins={DESKTOP_COINS} sparkles={DESKTOP_SPARKLES} />
      </div>
      <div className="lg:hidden">
        <Coins coins={MOBILE_COINS} />
      </div>
      <div className="relative flex flex-col items-center gap-4 lg:gap-[34px]">
        <div className="flex flex-col items-center gap-[10px] text-center lg:gap-[14px]">
          <h1 className="text-on-brand max-w-[284px] text-[24px] leading-[1.2] font-bold lg:max-w-[900px] lg:text-[32px]">
            Refer anyone, friend or student, save on your next plan
          </h1>
          <p className="text-brand-100 max-w-[300px] text-[12.5px] leading-[1.5] lg:max-w-[880px] lg:text-[14.5px]">
            They get a free first month. You get {inr(reward.join)} when they join and {shareLabel(reward)} of their plan when they
            buy. Every ₹1 in credits is ₹1 off.
          </p>
        </div>
        <div className="flex w-full flex-col gap-[10px] lg:w-auto lg:flex-row lg:flex-wrap lg:justify-center lg:gap-3">
          <WhatsAppButton label="Share on WhatsApp" onClick={onShare} className="w-full py-[14px] text-[14px] lg:w-auto lg:px-[22px] lg:text-[14.5px]" />
          <div className="border-on-brand/25 bg-on-brand/10 flex w-full min-w-0 items-center gap-2 rounded-md border px-[14px] py-3 lg:w-auto lg:max-w-[420px] lg:gap-[10px] lg:px-4 lg:py-[13px]">
            <Icon name="link-white.svg" width={18} height={18} />
            <span className="text-on-brand min-w-0 truncate text-[13px] font-semibold lg:text-[14px]" title={shareLink}>
              {shortLink(shareLink)}
            </span>
            <span className="min-w-0 flex-1 lg:hidden" />
            <button
              type="button"
              onClick={copy}
              aria-label={copied ? 'Link copied' : 'Copy link'}
              className="text-accent-250 flex shrink-0 items-center text-[12.5px] font-semibold hover:underline lg:text-[14px]"
            >
              {copied ? (
                'Copied'
              ) : (
                <>
                  <Icon name="copy.svg" width={15} height={21} className="lg:hidden" />
                  <span className="hidden lg:inline">Copy</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ClosingCta({ hasFriends, joinCredit, onShare }: { hasFriends: boolean; joinCredit: number; onShare: () => void }) {
  const title = hasFriends ? 'Know someone else preparing for boards or NEET?' : 'Who will be your first friend on Prepzy?';
  const body = hasFriends
    ? `Share your link again. Every friend who joins adds ${inr(joinCredit)} to your credits, and more when they buy.`
    : `Think of anyone preparing for boards or NEET: a classmate, a cousin, a junior. They start with a free month, and you get ${inr(joinCredit)} the moment they join.`;
  const button = hasFriends ? 'Share Your Referral Link' : 'Share Your Referral Link With Other Students';
  return (
    <section
      className={cx(
        'relative flex w-full flex-col gap-[10px] overflow-hidden rounded-[18px] px-[18px] py-[22px] lg:min-h-[200px] lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-6 lg:rounded-xl lg:py-10 lg:pr-14 lg:pl-24',
        brandGradient,
      )}
    >
      <div className="hidden lg:block">
        <Coins coins={CTA_COINS} />
      </div>
      <div className="relative flex min-w-0 flex-col gap-[10px] lg:max-w-[640px] lg:flex-1 lg:basis-[360px] lg:gap-2">
        <h2 className="text-on-brand text-[17px] leading-[1.5] font-semibold lg:text-[24px] lg:leading-[1.2]">{title}</h2>
        <p className="text-brand-100 text-[12.5px] leading-[1.5] lg:text-[14px] lg:leading-[1.55]">{body}</p>
      </div>
      <WhatsAppButton label={button} onClick={onShare} className="relative w-full px-[22px] py-3 text-[13.5px] lg:w-auto lg:py-[14px] lg:text-[14.5px]" />
    </section>
  );
}
