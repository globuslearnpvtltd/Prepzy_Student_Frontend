'use client';

import { cx } from '@prepzy/design-system';
import { useState } from 'react';
import { env } from '@/shared/config/env';
import { capClause, inr, shareLabel, type Reward, type Tier } from '../api';
import { Icon, SectionHeading } from './kit';

const TONES = [
  { bg: 'bg-accent-50', text: 'text-accent-800' },
  { bg: 'bg-brand-50', text: 'text-brand' },
  { bg: 'bg-success-50', text: 'text-success-700' },
] as const;

const STEP_ICONS = [
  <Icon key="link" name="step-link.svg" width={18} height={18} />,
  <Icon key="user" name="step-user.svg" width={21} height={20} />,
  <span key="rupee" className="text-success-700 text-[15px] leading-none font-semibold">
    ₹
  </span>,
];

export function HowItWorks({ reward, topperReward, friendCredit, showRange }: { reward: Reward; topperReward: Reward; friendCredit: number; showRange: boolean }) {
  const caps = capClause(reward);
  const range =
    showRange && reward.flat === null && topperReward.percent !== reward.percent ? `${shareLabel(reward)}-${shareLabel(topperReward)}` : shareLabel(reward);
  const steps = [
    {
      title: 'Share your link',
      body: 'Your link is at the top of this page. Send it on WhatsApp or anywhere you chat. One link works for every class and exam.',
      mobileBody: 'Your link is at the top of this page. Send it on WhatsApp or anywhere you chat. Anyone who studies can join.',
      pill: `They get 1 month of Topper plan free + ${inr(friendCredit)}`,
    },
    {
      title: 'They join free',
      body: `They get a free first Topper Monthly plan and ${inr(friendCredit)} in credits. You get ${inr(reward.join)} the moment they sign up.`,
      mobileBody: `They get a free first Topper Monthly plan and ${inr(friendCredit)}. You get ${inr(reward.join)} when they sign up.`,
      pill: `You get ${inr(reward.join)}`,
    },
    {
      title: 'They buy a plan',
      body: `You get ${range} of what they pay${caps ? `, ${caps} per person` : ''}. It lands as Prepzy credits, ₹1 each.`,
      mobileBody: `You get ${shareLabel(reward)} of what they pay${caps ? `, ${caps} per person` : ''}.`,
      pill: `You get ${range} of their plan`,
    },
  ];
  return (
    <section className="flex w-full flex-col gap-4 lg:gap-7">
      <SectionHeading eyebrow="How it works" title="How Refer & Earn works" />
      <div className="relative hidden w-full grid-cols-3 gap-5 lg:grid">
        {steps.map((step, index) => (
          <div key={step.title} className={cx('flex min-w-0 flex-col items-start gap-[10px] rounded-lg px-[26px] pt-[26px] pb-7', TONES[index]!.bg)}>
            <div className="flex w-full items-center pb-[6px]">
              <span className="bg-surface flex size-11 shrink-0 items-center justify-center rounded-md">{STEP_ICONS[index]}</span>
              <span className="min-w-0 flex-1" />
              <span className={cx('text-[22px] leading-[1.25] font-medium opacity-55', TONES[index]!.text)}>0{index + 1}</span>
            </div>
            <p className="text-ink text-[16px] leading-[1.55] font-semibold">{step.title}</p>
            <p className="text-[13.5px] leading-[1.55] text-neutral-600">{step.body}</p>
            <span className={cx('bg-surface rounded-full px-3 py-[5px] text-[12.5px] leading-[1.5] font-semibold', TONES[index]!.text)}>{step.pill}</span>
          </div>
        ))}
        <span className="pointer-events-none absolute top-[33px] left-[calc((100%-40px)/3-5px)]">
          <Icon name="step-connector.svg" width={30} height={30} />
        </span>
        <span className="pointer-events-none absolute top-[33px] left-[calc((100%-40px)*2/3+15px)]">
          <Icon name="step-connector.svg" width={30} height={30} />
        </span>
      </div>
      {steps.map((step, index) => (
        <div key={step.title} className={cx('flex w-full gap-[14px] rounded-[14px] p-4 lg:hidden', TONES[index]!.bg)}>
          <span className={cx('w-7 shrink-0 text-[18px] leading-[1.25] font-medium', TONES[index]!.text)}>0{index + 1}</span>
          <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <p className="text-ink text-[14px] leading-[1.55] font-semibold">{step.title}</p>
            <p className="text-[12.5px] leading-[1.55] text-neutral-600">{step.mobileBody}</p>
          </div>
        </div>
      ))}
    </section>
  );
}

const BENEFITS = [
  { title: 'Solve problems with AI assistance', body: 'Upload Problem and get AI help from start of the solution till the end', mobileBody: 'Upload Problem and get AI help from start to end', accent: 'border-brand' },
  { title: 'Get AI Answers from NCERT books', body: 'Every answer shows the NCERT chapter and page.', mobileBody: 'Every answer shows the NCERT chapter and page', accent: 'border-accent-400' },
  { title: 'Past board papers', body: '5 years of timed CBSE and NEET papers, with evaluation.', mobileBody: '5 years of timed CBSE and NEET papers, with evaluation', accent: 'border-success-700' },
  { title: 'Unit-wise PYQ trends', body: 'See which topics come up most in past exams.', mobileBody: 'See which topics come up most in past exams', accent: 'border-danger' },
];

export function WhatTheyGet({ friendCredit }: { friendCredit: number }) {
  return (
    <section className="flex w-full flex-col gap-[14px] lg:gap-7">
      <SectionHeading eyebrow="What they get" title={`A free first month of Topper Monthly plan, plus ${inr(friendCredit)} in credits`} />
      <div className="bg-brand-50 hidden w-full grid-cols-2 gap-4 rounded-xl p-7 lg:grid xl:grid-cols-4">
        {BENEFITS.map((benefit, index) => (
          <div key={benefit.title} className="bg-surface flex min-w-0 flex-col items-start gap-[10px] rounded-[14px] p-5">
            <Icon name={`benefit-${index + 1}.svg`} width={40} height={40} />
            <p className="text-ink text-[15.5px] leading-[1.55] font-semibold">{benefit.title}</p>
            <p className="text-[14px] leading-[1.55] text-neutral-600">{benefit.body}</p>
          </div>
        ))}
      </div>
      {BENEFITS.map((benefit) => (
        <div key={benefit.title} className={cx('flex w-full flex-col gap-[2px] border-l-[3px] pl-[14px] lg:hidden', benefit.accent)}>
          <p className="text-ink text-[13.5px] leading-[1.55] font-semibold">{benefit.title}</p>
          <p className="text-[12.5px] leading-[1.55] text-neutral-600">{benefit.mobileBody}</p>
        </div>
      ))}
    </section>
  );
}

const planPart = (reward: Reward) =>
  reward.flat !== null ? `${inr(reward.flat)} when they buy their first plan` : `${shareLabel(reward)} of the first plan they buy`;

const limitsSentence = (reward: Reward) => {
  if (reward.flat !== null) return '';
  const clause = [reward.floor !== null && `never less than ${inr(reward.floor)}`, reward.cap !== null && `never more than ${inr(reward.cap)}`]
    .filter(Boolean)
    .join(' and ');
  return clause ? ` From one person, the plan part is ${clause}.` : '';
};

export function buildFaqs(tier: Tier, basic: Reward, topper: Reward) {
  const own = tier === 'paid' ? topper : basic;
  const topperRate = tier === 'paid' ? '' : ` If you are on a paid Topper plan, it's ${inr(topper.join)} and ${shareLabel(topper)}.`;
  return [
    { q: 'How much can I earn?', a: `You get ${inr(own.join)} when someone signs up with your link, and ${planPart(own)}.${topperRate}${limitsSentence(own)}` },
    {
      q: 'Who can I invite?',
      a: "Anyone who's studying and new to Prepzy. A classmate, a cousin, your younger sister, someone from your coaching batch. It doesn't matter which class or exam they're preparing for. One link works for all of them.",
    },
    {
      q: 'When will I get my credits?',
      a: `The ${inr(own.join)} shows up as soon as they finish signing up. The bigger part comes when they buy a plan. Their free first month doesn't count as buying.`,
    },
    {
      q: 'What can I do with my credits?',
      a: "Use them to pay for your own plan. ₹1 of credit is ₹1 off, and if you have enough, they can cover the whole price. You can also send them to another Prepzy student. You can't take them out as cash.",
    },
    { q: 'Do my credits expire?', a: 'No. They stay in your account until you use them or send them.' },
    {
      q: "If I upgrade to Topper, do I earn more on people I've already invited?",
      a: `Yes, on anything they buy after you upgrade. Your rate depends on your plan at the moment each reward comes in. The ${inr(basic.join)} you already got when they joined stays the same.`,
    },
    {
      q: "Someone signed up but I can't see them. Why?",
      a: "They only show up if they signed up using your link. If they found Prepzy some other way, like searching for it or tapping an ad, there's no way for us to know you sent them.",
    },
    {
      q: 'Why does one of my referrals say "Under review"?',
      a: 'We check sign-ups that look like the same person making more than one account, or several accounts made on one phone. While we check, no credits are added. If it turns out fine, you get them as usual.',
    },
  ];
}

export function Faq({ tier, basic, topper }: { tier: Tier; basic: Reward; topper: Reward }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="flex w-full flex-col items-center gap-4 lg:gap-6">
      <h2 className="text-ink w-full text-center text-[19px] font-bold tracking-[-0.285px] lg:text-[29.4px]">Refer &amp; Earn questions, answered.</h2>
      <div className="flex w-full flex-col gap-[12.6px]">
        {buildFaqs(tier, basic, topper).map((faq, index) => {
          const isOpen = open === index;
          return (
            <div
              key={faq.q}
              className={cx(
                'flex w-full flex-col gap-[10.5px] rounded-md border px-4 py-[14px] lg:rounded-[14.7px] lg:px-[23px] lg:py-[19px]',
                isOpen ? 'bg-brand-75 border-transparent' : 'border-ink/10 bg-surface',
              )}
            >
              <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : index)} className="flex w-full items-center justify-between gap-3 text-left">
                <span className="text-ink min-w-0 flex-1 text-[13.5px] font-semibold lg:text-[16.3px]">{faq.q}</span>
                <Icon name={isOpen ? 'faq-minus.svg' : 'faq-plus.svg'} width={19} height={19} />
              </button>
              {isOpen && <p className="text-[12.5px] leading-[1.55] text-neutral-600 lg:text-[14.7px]">{faq.a}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function ReferFooter() {
  const terms = `${/^https?:/.test(env.parentDomain) ? env.parentDomain : 'https://prepzy.ai'}/terms`;
  const link = 'text-brand text-[12.5px] leading-[1.55] font-semibold whitespace-nowrap hover:underline lg:text-[14px]';
  return (
    <footer className="flex w-full flex-col gap-2 text-[12.5px] leading-[1.55] lg:flex-row lg:items-center lg:gap-6 lg:text-[14px]">
      <div className="flex gap-[18px] lg:gap-6">
        <a href={terms} target="_blank" rel="noopener noreferrer" className={link}>
          Terms and conditions
        </a>
        <a href="mailto:contact@prepzy.ai" className={link}>
          Contact support
        </a>
      </div>
      <span className="hidden min-w-0 flex-1 lg:block" />
      <p className="text-[12.5px] leading-[1.55] text-neutral-600 lg:text-[12px]">Self-referrals and duplicate accounts are never credited.</p>
    </footer>
  );
}
