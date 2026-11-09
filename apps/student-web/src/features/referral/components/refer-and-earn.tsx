'use client';

import { Skeleton } from '@prepzy/design-system';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useActivePlan } from '@/features/auth';
import { routes } from '@/shared/config/routes';
import { useExam } from '@/shared/hooks/use-exam';
import { findFeaturedPurchase, pickExamplePlan, rateFor, rewardFor, shareMessage, whatsappUrl } from '../api';
import { referralKeys, usePlanOptions, useReferralHub } from '../hooks';
import { CreditStatement, ReferralsEmpty, ReferralsList } from './referrals';
import { EarningsCalculator } from './calculator';
import { ClosingCta, HeroBanner } from './hero';
import { Faq, HowItWorks, ReferFooter, WhatTheyGet } from './info';
import { MoneyFlowExample, MoneyFlowFriend } from './money-flow';
import { SendCreditsDialog } from './send-credits-dialog';

const PAGE = 'text-ink flex w-full min-w-0 flex-1 flex-col gap-11 pb-6 leading-normal lg:gap-[72px] lg:px-5 lg:pt-2';

function LoadingState() {
  return (
    <div className={PAGE} aria-busy="true" aria-label="Loading Refer & Earn">
      <Skeleton className="h-[339px] w-full rounded-[22px] lg:h-[260px]" />
      <div className="flex flex-col gap-[14px] lg:gap-5">
        <Skeleton className="h-[14px] w-[120px]" />
        <Skeleton className="h-[26px] w-[240px]" />
        <Skeleton className="h-[220px] w-full rounded-lg lg:h-[112px]" />
      </div>
      <div className="grid w-full gap-4 lg:grid-cols-3 lg:gap-5">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 rounded-lg lg:h-[220px]" />
        ))}
      </div>
    </div>
  );
}

/** Refer & Earn hub for any exam: the exam (rates, example plan, share message) comes from the registry. */
export function ReferAndEarn() {
  const exam = useExam();
  const router = useRouter();
  const queryClient = useQueryClient();
  const hub = useReferralHub();
  const plans = usePlanOptions();
  const plan = useActivePlan(exam);
  const [sending, setSending] = useState(false);

  const options = useMemo(() => plans.data ?? [], [plans.data]);
  const examplePlan = useMemo(() => pickExamplePlan(options, plan.data?.classId ?? null, exam.examId), [options, plan.data?.classId, exam.examId]);
  const featured = useMemo(() => (hub.data ? findFeaturedPurchase(hub.data.friends, hub.data.statement) : null), [hub.data]);

  if (hub.isPending) return <LoadingState />;
  if (hub.isError)
    return (
      <div className={PAGE}>
        <div role="alert" className="bg-brand-50 flex w-full flex-col items-center gap-[10px] rounded-xl px-5 py-12 text-center">
          <h1 className="text-ink text-[18px] font-semibold lg:text-[22px]">We couldn&apos;t load Refer &amp; Earn</h1>
          <p className="max-w-[420px] text-[13px] leading-[1.5] text-neutral-600 lg:text-[14px]">
            Check your connection and try again. Your credits and referrals are safe.
          </p>
          <button type="button" onClick={() => hub.refetch()} className="bg-brand text-on-brand hover:bg-brand-hover mt-2 rounded-md px-6 py-3 text-[14px] font-semibold">
            Try again
          </button>
        </div>
      </div>
    );

  const { summary, friends, rates, statement } = hub.data;
  const rate = rateFor(rates, exam.examId);
  const ownReward = rewardFor(rate, summary.tier);
  const basic = rewardFor(rate, 'free');
  const topper = rewardFor(rate, 'paid');
  const hasFriends = friends.length > 0;
  const plansHref = routes.plans(exam.slug);

  const share = () => {
    window.open(whatsappUrl(shareMessage(exam, summary.shareLink, summary.friendJoinCredit)), '_blank', 'noopener,noreferrer');
  };

  return (
    <div className={PAGE}>
      <HeroBanner shareLink={summary.shareLink} reward={ownReward} onShare={share} />
      {hasFriends ? (
        <>
          <ReferralsList friends={friends} balance={summary.balance} onSend={() => setSending(true)} onUse={() => router.push(plansHref)} />
          <CreditStatement statement={statement} friends={friends} />
          {featured ? (
            <MoneyFlowFriend purchase={featured} ownTier={summary.tier} rates={rates} balance={summary.balance} plansHref={plansHref} />
          ) : (
            <MoneyFlowExample ownTier={summary.tier} rates={rates} plan={examplePlan} />
          )}
          <EarningsCalculator ownTier={summary.tier} rates={rates} options={options} examId={exam.examId} hasFriends />
          <HowItWorks reward={ownReward} topperReward={topper} friendCredit={summary.friendJoinCredit} showRange={false} />
        </>
      ) : (
        <>
          <ReferralsEmpty balance={summary.balance} friendCount={summary.friendCount} onInvite={share} />
          <HowItWorks reward={ownReward} topperReward={topper} friendCredit={summary.friendJoinCredit} showRange={summary.tier === 'free'} />
          <EarningsCalculator ownTier={summary.tier} rates={rates} options={options} examId={exam.examId} hasFriends={false} />
          <MoneyFlowExample ownTier={summary.tier} rates={rates} plan={examplePlan} />
          <WhatTheyGet friendCredit={summary.friendJoinCredit} />
        </>
      )}
      <Faq tier={summary.tier} basic={basic} topper={topper} />
      <ClosingCta hasFriends={hasFriends} joinCredit={ownReward.join} onShare={share} />
      <ReferFooter />
      <SendCreditsDialog
        open={sending}
        balance={summary.balance}
        onClose={() => setSending(false)}
        onSent={() => void queryClient.invalidateQueries({ queryKey: referralKeys.hub })}
      />
    </div>
  );
}
