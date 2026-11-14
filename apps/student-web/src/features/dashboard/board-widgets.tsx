'use client';

import { cx } from '@prepzy/design-system';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, MessageCircle, Users } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useActivePlan, type ActivePlan } from '@/features/auth';
import { useActivePlanName } from '@/features/plans';
import { hasTestType } from '@/shared/config/exams';
import { routes } from '@/shared/config/routes';
import { dashboardApi, type ContinueTest } from './api';
import {
  ProgressBar,
  SectionError,
  useDashboardContext,
} from './widget-kit';

const titleCase = (value: string) => value.toLowerCase().replace(/(^|\s)\w/g, (c) => c.toUpperCase());

/* ---------------------------------- Plan banner ---------------------------------- */

export type PlanState = 'basic' | 'topper' | 'expiring' | 'lastday' | 'ended';

export function daysUntil(iso: string | null, now = new Date()): number {
  if (!iso) return 0;
  const end = new Date(iso);
  const today = new Date(now);
  end.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - today.getTime()) / 86_400_000);
}

/** Same thresholds as the previous banner: under 18 days is "expiring", day 0 is the last day. */
export function planState(plan: Pick<ActivePlan, 'durationMonths'>, daysLeft: number): PlanState {
  if (plan.durationMonths === 0) return 'basic';
  if (daysLeft < 0) return 'ended';
  if (daysLeft === 0) return 'lastday';
  if (daysLeft < 18) return 'expiring';
  return 'topper';
}

const formatDay = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'soon';

/** Banner copy; `name` is the plan's name from the API (display_name). */
export function planCopy(plan: ActivePlan, name: string, now = new Date()) {
  const daysLeft = daysUntil(plan.expiryDate, now);
  const state = planState(plan, daysLeft);
  const ends = formatDay(plan.expiryDate);
  const days = `${daysLeft} day${daysLeft === 1 ? '' : 's'}`;
  const copy: Record<PlanState, { pill: string; strip: string; headline: string; subline: string }> = {
    basic: {
      pill: name,
      strip: 'Lower daily limits, resets 5 AM',
      headline: 'Welcome back! Basic has lower daily limits. Topper gives you much higher limits.',
      subline: 'Daily limit resets at 5 AM',
    },
    topper: {
      pill: name,
      strip: `High daily limits, valid till ${ends}`,
      headline: `Welcome back! ${name} is active, with high daily limits.`,
      subline: `Plan valid till ${ends}`,
    },
    expiring: {
      pill: `${days} left`,
      strip: `Ends ${ends}`,
      headline: `Your ${name} plan ends in ${days}, on ${ends}.`,
      subline: 'You can renew once it ends',
    },
    lastday: {
      pill: `${name} · Last day`,
      strip: 'Basic limits are lower',
      headline: `Your ${name} plan ends tonight. Basic has lower daily limits.`,
      subline: 'You can renew from tomorrow',
    },
    ended: {
      pill: plan.durationMonths === 1 ? 'Monthly plan ended' : 'Academic year plan ended',
      strip: "You're on Basic, lower limits",
      headline: `Your ${name} plan has ended. You're on Basic now, with lower daily limits.`,
      subline: `Ended ${ends}`,
    },
  };
  return { state, ...copy[state] };
}

const TONE: Record<PlanState, { card: string; ink: string; soft: string; pill: string }> = {
  basic: { card: 'bg-brand', ink: 'text-on-brand', soft: 'text-on-brand/70', pill: 'bg-surface/10 border-surface/10 text-on-brand/80' },
  topper: { card: 'bg-brand', ink: 'text-on-brand', soft: 'text-on-brand/70', pill: 'bg-surface/10 border-surface/10 text-on-brand/80' },
  ended: { card: 'bg-brand', ink: 'text-on-brand', soft: 'text-on-brand/70', pill: 'bg-danger/20 border-danger/30 text-on-brand' },
  expiring: { card: 'bg-accent-100', ink: 'text-foreground', soft: 'text-foreground/65', pill: 'bg-accent-400 border-accent-400 text-on-brand' },
  lastday: { card: 'bg-danger-soft', ink: 'text-foreground', soft: 'text-foreground/65', pill: 'bg-danger border-danger text-on-brand' },
};

/** Hero: the student's plan at a glance (collapsible), with the "link a parent" prompt on mobile. */
export function PlanBanner() {
  const { exam } = useDashboardContext();
  const plan = useActivePlan(exam);
  const name = useActivePlanName(exam, plan.data);
  const [expanded, setExpanded] = useState(false);
  if (!plan.data || !name) return null;
  const { state, pill, strip, headline, subline } = planCopy(plan.data, name);
  const tone = TONE[state];
  const cta = state === 'basic' || state === 'ended';
  return (
    <section aria-label="Your plan" className={cx('relative w-full overflow-hidden rounded-xl', tone.card)}>
      {tone.card === 'bg-brand' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/illustrations/dashboard/welcome-waves.svg"
          alt=""
          aria-hidden
          className="pointer-events-none absolute top-0 left-0 h-[897px] w-[897px] max-w-none -scale-y-100"
        />
      )}
      <div className="relative p-6">
        <span className={cx('flex w-fit items-center rounded-full border px-3 py-1.5 text-[14px] font-semibold md:min-h-[34px] md:py-1', tone.pill)}>
          {pill}
        </span>
        <p className={cx('mt-4 pr-10 text-[18px] leading-6 font-bold', tone.ink)}>{expanded ? headline : strip}</p>
        {expanded && <p className={cx('mt-1.5 text-[14px] leading-5', tone.soft)}>{subline}</p>}
        {cta && (
          <Link
            href={routes.managePlans()}
            className="bg-accent-400 text-on-brand mt-4 flex w-full items-center justify-center rounded-[14px] px-[18px] py-3 text-[14px] font-bold md:h-[38px] md:w-[146px] md:p-0"
          >
            {state === 'ended' ? 'View plans' : 'Upgrade Plan'}
          </Link>
        )}
        <div className="border-surface/15 mt-4 flex items-center justify-between gap-3 border-t pt-4 md:hidden">
          <span className={cx('text-[13px]', tone.soft)}>Link a parent to follow your progress</span>
          <Link
            href={routes.profile(exam.slug)}
            className="border-surface/30 bg-surface/10 text-on-brand shrink-0 rounded-[10px] border px-4 py-2 text-[13px] font-semibold"
          >
            Link
          </Link>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-label={expanded ? 'Hide plan details' : 'Show plan details'}
        aria-expanded={expanded}
        className={cx(
          'absolute top-[25px] right-6 flex size-8 items-center justify-center rounded-full border',
          tone.card === 'bg-brand' ? 'bg-surface/10 border-surface/10 text-on-brand' : 'bg-surface/55 border-foreground/10 text-foreground',
        )}
      >
        <ChevronDown aria-hidden className={cx('size-4 transition-transform', expanded && 'rotate-180')} />
      </button>
    </section>
  );
}

/* ------------------------------ Shared card styles ------------------------------ */

const card = 'border-neutral-200 bg-surface rounded-xl border-2 p-6';
const cardTitle = 'text-[16px] leading-5 font-semibold text-neutral-800';

/* ---------------------------- Continue your assessment ---------------------------- */

const TEST_LABEL: Record<ContinueTest['kind'], string> = {
  pyq: 'Board Exam',
  mock: 'Mock Exam',
  mid_term: 'Course Test',
  final: 'Course Test',
  other: 'Course Test',
};

const TEST_IMAGE: Record<ContinueTest['kind'], string> = {
  mock: '/illustrations/tests/mock.jpg',
  pyq: '/illustrations/tests/pyq.jpg',
  mid_term: '/illustrations/tests/mid.jpg',
  final: '/illustrations/tests/final.jpg',
  other: '/illustrations/tests/course.jpg',
};

export function ContinueAssessment() {
  const { exam, classId } = useDashboardContext();
  const query = useQuery({
    queryKey: ['dashboard', exam.slug, 'continue-tests', classId],
    queryFn: () => dashboardApi.continueTests(exam, classId!),
    enabled: classId !== null,
  });
  if (query.isError) return <SectionError title="Failed to fetch Continue Assessments" error={query.error} />;
  const tests = query.data ?? [];
  if (tests.length === 0) return null;
  const chip = 'border-brand-150 rounded-[6px] px-2 py-[5px] text-[8px] leading-2 md:text-[11px] md:leading-3';
  return (
    <section aria-labelledby="continue-assessment" className={card}>
      <div className="flex items-center justify-between">
        <h2 id="continue-assessment" className={cardTitle}>
          Continue your Assessment
        </h2>
        <Link href={routes.assessments(exam.slug)} className="text-accent-400 text-[14px] font-medium">
          View All Tests
        </Link>
      </div>
      <ul className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
        {tests.map((test) => {
          const playable = test.testType && hasTestType(exam, test.testType);
          return (
            <li key={`${test.kind}-${test.setId}`}>
              <Link
                href={playable ? routes.testPlayer(exam.slug, test.testType!, test.setId) : routes.assessments(exam.slug)}
                aria-label={`Resume ${TEST_LABEL[test.kind]} ${test.className}, ${test.percent}% done`}
                className="border-line bg-canvas flex h-full items-center gap-5 rounded-lg border-2 p-2.5"
              >
                <span className="border-line relative block h-[140px] w-2/5 shrink-0 overflow-hidden rounded-[14px] border md:h-[128px]">
                  <Image src={TEST_IMAGE[test.kind]} alt="" fill sizes="200px" className="object-cover" />
                </span>
                <span className="mb-3.5 flex flex-1 flex-col gap-1.5 md:gap-[13px]">
                  <span className="flex gap-3">
                    <span className={cx(chip, 'bg-brand-75 text-brand border font-medium')}>{titleCase(test.className)}</span>
                    {test.kind === 'pyq' && (
                      <span className={cx(chip, 'bg-surface text-brand border-2 font-semibold')}>{test.setNumber}</span>
                    )}
                    <span className={cx(chip, 'bg-surface text-brand border-2 font-semibold')}>{TEST_LABEL[test.kind]}</span>
                  </span>
                  <span className="text-neutral-850 text-[16px] leading-6 font-semibold md:text-[20px] md:leading-5">
                    {test.className}
                  </span>
                  <ProgressBar percent={test.percent} label={`${test.className} progress`} fill="bg-brand" />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* --------------------------------- Right column --------------------------------- */

/** Socrates (step-by-step solver) card with the concept-card illustration. */
export function SolverDiscovery() {
  const { exam } = useDashboardContext();
  const concepts = ['Concept 1', 'Concept 2', 'Concept 3', 'Concept 4'];
  return (
    <section
      aria-labelledby="solver-title"
      className="group border-brand-100 hover:border-brand-300 bg-brand/30 flex w-full flex-col overflow-hidden rounded-[15px] border-2 shadow-card"
    >
      <div className="from-brand-400 to-brand relative h-[130px] w-full overflow-hidden bg-linear-to-b" aria-hidden="true">
        <p className="text-on-brand/90 absolute top-2 left-4 text-[13px] leading-[18px] font-semibold">
          One concept card for every step
        </p>
        {concepts.map((concept, index) => (
          <div
            key={concept}
            className={cx(
              'bg-surface absolute top-12 h-[100px] w-[28%] rounded-[10px] border-t-[3px] border-l-[3px] px-2 pt-1.5 transition-transform duration-300 group-hover:-translate-y-2',
              index === 0 ? 'border-brand-300' : 'border-brand-100',
            )}
            style={{ left: `${[2.5, 25, 47, 69][index]}%`, zIndex: index + 1 }}
          >
            <p className={cx('text-[13px] leading-4 font-semibold whitespace-nowrap', index === 0 ? 'text-brand' : 'text-foreground-subtle')}>
              {concept}
            </p>
            {[100, 100, 55].map((width, line) => (
              <div key={line} className={cx('mt-1 h-1 rounded-full', index === 0 ? 'bg-brand-100' : 'bg-brand-50')} style={{ width: `${width}%` }} />
            ))}
          </div>
        ))}
      </div>
      <div className="bg-surface flex w-full flex-col px-[18px] py-4">
        <div className="flex items-center gap-2">
          <Image src="/illustrations/dashboard/socrates.jpg" alt="" width={24} height={24} className="size-6 rounded-full object-cover" />
          <span className="text-brand text-[13px] leading-4 font-semibold tracking-[0.2px]">Socrates · Step by Step</span>
        </div>
        <h2 id="solver-title" className="font-display text-ink mt-5 text-[22px] leading-6 font-bold">
          Get it solved step by step
        </h2>
        <p className="text-foreground-soft mt-2.5 text-[13px] leading-[19px]">
          Socrates walks you through one step at a time, so you reach the answer yourself.
        </p>
        <Link
          href={routes.doubtSolver(exam.slug)}
          className="from-brand-450 to-brand text-on-brand mt-3.5 flex w-full items-center justify-center rounded-[15px] bg-linear-to-b py-[9px] text-[15px] font-semibold shadow-raised"
        >
          Start Solving
        </Link>
        <div className="bg-brand-100 mt-3.5 h-px w-full" />
        <p className="text-foreground-muted mt-2.5 flex items-center gap-2 text-[13px] font-semibold">
          <MessageCircle aria-hidden className="size-3.5" />
          <span>
            Just want the answer?{' '}
            <Link href={routes.atlas(exam.slug)} scroll={false} className="text-brand font-bold hover:underline">
              Use Atlas.
            </Link>
          </span>
        </p>
      </div>
    </section>
  );
}

export function LinkParentCard() {
  const { exam } = useDashboardContext();
  return (
    <section aria-labelledby="parent-title" className="border-line bg-surface flex w-full flex-col gap-4 rounded-lg border p-5 md:p-6">
      <div className="flex items-start gap-3">
        <span className="bg-accent-50 flex size-11 shrink-0 items-center justify-center rounded-[10px]">
          <Users aria-hidden className="size-7 fill-current text-neutral-950" />
        </span>
        <div className="flex flex-col gap-1.5">
          <h2 id="parent-title" className="text-ink text-[16px] leading-[22px] font-bold">
            Link your parent&apos;s details
          </h2>
          <p className="text-neutral-400 text-[14px] leading-5">
            Add a parent so they can follow your progress report and analytics on the Parent Dashboard.
          </p>
        </div>
      </div>
      <Link
        href={routes.profile(exam.slug)}
        className="bg-accent-400 text-on-brand w-full rounded-[24px] py-3 text-center text-[14px] font-bold hover:opacity-90"
      >
        Add parent details
      </Link>
    </section>
  );
}

export function ReferEarnTeaser() {
  const { exam } = useDashboardContext();
  const query = useQuery({ queryKey: ['dashboard', 'referral'], queryFn: dashboardApi.referralSummary });
  const summary = query.data;
  if (!summary) return null;
  const repeat = summary.friendCount > 0;
  return (
    <Link
      href={routes.referAndEarn(exam.slug)}
      className="from-brand-600 to-brand text-on-brand block w-full rounded-lg bg-linear-135 p-5 transition-transform hover:scale-[1.01] md:p-6"
    >
      <span className="flex items-center justify-between">
        <span className="text-[16px] font-bold">Refer &amp; Earn</span>
        {repeat && (
          <span className="text-[11px] opacity-85">
            {summary.friendCount} friend{summary.friendCount === 1 ? '' : 's'} invited
          </span>
        )}
      </span>
      {repeat ? (
        <>
          <span className="mt-2 block text-[30px] leading-none font-black">₹{summary.balance}</span>
          <span className="mt-1 block text-[12.5px] opacity-90">Credits usable on any plan, any exam.</span>
        </>
      ) : (
        <>
          <span className="mt-2 block text-[18px] leading-6 font-bold">Invite friends, earn credits</span>
          <span className="mt-1 block text-[13px] leading-[19px] opacity-90">
            {summary.tier === 'paid'
              ? "You're on the top rate — earn credits every time a friend joins or upgrades."
              : 'Earn credits when a friend joins or upgrades. Paid members earn 2× per referral.'}
          </span>
        </>
      )}
      <span className="bg-accent-400 mt-4 block w-full rounded-[24px] py-2.5 text-center text-[14px] font-bold">
        {repeat ? 'Invite more friends' : 'See how it works'}
      </span>
    </Link>
  );
}
