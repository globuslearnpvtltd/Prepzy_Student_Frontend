'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  inr,
  rateFor,
  rewardFor,
  shareLabel,
  shareOf,
  TIER_LABEL,
  toggleNote,
  topperGainNote,
  type EarnRate,
  type FeaturedPurchase,
  type PlanOption,
  type Tier,
} from '../api';
import { brandGradient, Icon, PlanToggle, SectionHeading } from './kit';

function PayBar({ payer, mobilePayer, amount, slice }: { payer: string; mobilePayer: string; amount: number; slice: string }) {
  return (
    <div className="border-neutral-150 bg-brand-50 flex w-full items-stretch overflow-hidden rounded-md border lg:rounded-[14px]">
      <div className="text-ink flex min-w-0 flex-1 items-center gap-2 p-[14px] leading-[1.5] lg:gap-[10px] lg:px-5 lg:py-[18px]">
        <span className="truncate text-[13px] font-medium lg:hidden">{mobilePayer}</span>
        <span className="hidden truncate text-[14.5px] font-medium lg:inline">{payer}</span>
        <span className="text-[14px] font-bold whitespace-nowrap lg:text-[16px]">{inr(amount)}</span>
      </div>
      <span className="bg-accent-400 text-brand-900 flex shrink-0 items-center justify-center px-3 text-[12px] leading-[1.5] font-bold lg:w-[92px] lg:text-[13px]">
        {slice}
      </span>
    </div>
  );
}

function SliceNote({ text }: { text: string }) {
  return (
    <div className="flex w-full items-center justify-end gap-[6px] lg:-mt-[10px] lg:gap-2">
      <Icon name="slice-arrow.svg" width={10} height={12} className="hidden lg:block" />
      <span className="text-accent-800 text-[12.5px] leading-[1.5] font-semibold whitespace-nowrap lg:text-[14px]">
        <span className="lg:hidden">↓ </span>
        {text}
      </span>
    </div>
  );
}

function Wallet({ label, line, total }: { label: string; line: string; total: number }) {
  return (
    <div className={`flex w-full items-center gap-3 rounded-lg p-4 lg:gap-4 lg:rounded-[18px] lg:py-[22px] lg:pr-7 lg:pl-6 ${brandGradient}`}>
      <Icon name="wallet.svg" width={48} height={48} className="hidden lg:block" />
      <div className="flex min-w-0 flex-1 flex-col gap-[2px] leading-[1.5]">
        <span className="text-brand-100 text-[11.5px] lg:text-[13px]">{label}</span>
        <span className="text-on-brand text-[13px] font-semibold lg:text-[16px]">{line}</span>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-[2px]">
        <span className="text-accent-400 text-[28px] leading-[1.2] font-bold whitespace-nowrap lg:text-[36px]">{inr(total)}</span>
        <span className="text-brand-100 hidden text-[12.5px] leading-[1.5] whitespace-nowrap lg:block">= {inr(total)} off, at ₹1 per credit</span>
      </div>
    </div>
  );
}

const USES = [
  { icon: 'use-pay', title: 'Pay less on your own plan', body: 'Use credits at checkout on any Prepzy plan, no limits on amount that can be used.' },
  { icon: 'use-send', title: 'Send it to another student', body: 'Send any amount of your credits to another Prepzy student.' },
];

function CreditUses({ title, mobileTitle }: { title: string; mobileTitle: string }) {
  return (
    <>
      <p className="text-ink text-[13.5px] leading-[1.5] font-semibold lg:hidden">{mobileTitle}</p>
      <p className="text-ink hidden text-[15px] font-semibold lg:block">{title}</p>
      <div className="flex w-full flex-col gap-[14px] lg:flex-row lg:gap-4">
        {USES.map((use) => (
          <div
            key={use.title}
            className="border-neutral-150 bg-surface flex min-w-0 flex-1 items-start gap-3 rounded-[14px] border p-[14px] lg:flex-col lg:gap-[10px] lg:rounded-lg lg:p-[22px]"
          >
            <Icon name={`${use.icon}-sm.svg`} width={36} height={36} className="lg:hidden" />
            <Icon name={`${use.icon}.svg`} width={44} height={44} className="hidden lg:block" />
            <div className="flex min-w-0 flex-1 flex-col gap-[2px] leading-[1.5] lg:gap-[10px]">
              <p className="text-ink text-[13.5px] font-semibold lg:text-[16px]">{use.title}</p>
              <p className="text-[12.5px] text-neutral-600 lg:text-[14px]">{use.body}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function MoneyFlowExample({ ownTier, rates, plan }: { ownTier: Tier; rates: EarnRate[]; plan: PlanOption | null }) {
  const [view, setView] = useState<Tier>(ownTier);
  if (!plan) return null;
  const rate = rateFor(rates, plan.examId);
  const reward = rewardFor(rate, view);
  const share = shareOf(reward, plan.price);
  const note = toggleNote(view, ownTier, topperGainNote(rewardFor(rate, 'free'), rewardFor(rate, 'paid')));
  const plain = reward.flat === null && share === Math.round((plan.price * reward.percent) / 100);
  return (
    <section className="flex w-full flex-col gap-[14px] lg:gap-5">
      <SectionHeading
        eyebrow="Where the money goes"
        title="How their plan turns into your credits"
        sub={`For example, someone joins with your link and buys ${plan.phrase}. Here is what you earn.`}
        mobileSub={`For example, a friend joins with your link and buys ${plan.phrase}.`}
      />
      <PlanToggle value={view} onChange={setView} note={note.text} noteTone={note.tone} />
      <PayBar payer="They pay Prepzy" mobilePayer="Your friend pays" amount={plan.price} slice={shareLabel(reward)} />
      <SliceNote text={plain ? `${shareLabel(reward)} of it, ${inr(share)}, comes to you` : `Your share, ${inr(share)}, comes to you`} />
      <Wallet label="You get, as Prepzy credits" line={`${inr(reward.join)} when they join + ${inr(share)} when they buy`} total={reward.join + share} />
      <CreditUses title="What you can do with your credits" mobileTitle="What you can do with your credits" />
    </section>
  );
}

export function MoneyFlowFriend({
  purchase,
  ownTier,
  rates,
  balance,
  plansHref,
}: {
  purchase: FeaturedPurchase;
  ownTier: Tier;
  rates: EarnRate[];
  balance: number;
  plansHref: string;
}) {
  const name = purchase.friend.name;
  const who = name ?? 'your friend';
  const Who = name ?? 'Your friend';
  const possessive = name ? `${name}’s` : 'your friend’s';
  const rate = rateFor(rates, purchase.examId);
  const reward = rewardFor(rate, purchase.tier);
  const topper = rewardFor(rate, 'paid');
  const topperShare = shareOf(topper, purchase.paid);
  // Rates may have changed since they bought; then only the real amount is safe to show.
  const current = shareOf(reward, purchase.paid) === Math.round(purchase.share);
  const slice = current ? shareLabel(reward) : inr(purchase.share);
  const plain = current && reward.flat === null && Math.round(purchase.share) === Math.round((purchase.paid * reward.percent) / 100);
  const exam = purchase.friend.examName ? `a ${purchase.friend.examName} plan` : 'a plan';
  const bought = `${Who} joined with your link and bought ${exam}.`;
  return (
    <section className="flex w-full flex-col gap-[14px] lg:gap-5">
      <SectionHeading
        eyebrow="Where the money goes"
        title={`How ${possessive} plan turned into your credits`}
        sub={current ? `${bought} You were on ${TIER_LABEL[purchase.tier]} plan when they bought, so your share was ${slice}.` : `${bought} Your share was ${slice}.`}
        mobileSub={current ? `${bought} You were on ${TIER_LABEL[purchase.tier]}, so your share was ${slice}.` : `${bought} Your share was ${slice}.`}
      />
      <PayBar payer={`${Who} paid Prepzy`} mobilePayer={`${Who} paid`} amount={purchase.paid} slice={slice} />
      <SliceNote text={plain ? `${slice} of it, ${inr(purchase.share)}, came to you` : `Your share, ${inr(purchase.share)}, came to you`} />
      <Wallet
        label="You got, as Prepzy credits"
        line={`${inr(purchase.join)} when ${who} joined + ${inr(purchase.share)} when they bought`}
        total={purchase.join + purchase.share}
      />
      {current && purchase.tier === 'free' && ownTier === 'free' && (
        <div className="bg-accent-50 flex w-full flex-col items-start gap-1 rounded-md px-[14px] py-3 lg:flex-row lg:items-center lg:gap-2 lg:px-4">
          <p className="text-accent-800 min-w-0 flex-1 text-[12.5px] leading-[1.5] font-medium lg:text-[13.5px]">
            On Topper, {who} would have brought you {inr(topper.join + topperShare)}: {inr(topper.join)} when they joined and{' '}
            {inr(topperShare)} when they bought. Upgrade before the next person you invite buys and you get {shareLabel(topper)} of
            their plan.
          </p>
          <Link href={plansHref} className="text-brand text-[12.5px] leading-[1.5] font-semibold whitespace-nowrap hover:underline lg:text-[13.5px]">
            See Topper plans →
          </Link>
        </div>
      )}
      <CreditUses title="What you can do with credits" mobileTitle={`What you can do with your ${inr(balance)}`} />
    </section>
  );
}
