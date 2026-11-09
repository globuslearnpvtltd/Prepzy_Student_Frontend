'use client';

import { cx } from '@prepzy/design-system';
import { useQuery } from '@tanstack/react-query';
import { CircleCheck, Pencil, Sparkles, Timer, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useCurrentUser } from '@/features/auth';
import { routes } from '@/shared/config/routes';
import { useLiveDpp } from '@/shared/layout/shell-api';
import { ProgressRing } from '@/shared/ui/charts';
import { dashboardApi } from './api';
import { competitiveSubjectArt } from './subject-art';
import { SectionError, useDashboardContext, WidgetSkeleton } from './widget-kit';

/* ---------------------------------- Welcome ---------------------------------- */

/** "Hello <name>" card with the doctor illustration (female / male by the student's gender). */
export function NeetWelcome() {
  const user = useCurrentUser();
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  const name = user.data?.fullName ?? 'Student';
  const doctor = user.data?.gender === 'female' ? '/illustrations/neet/doctor-female.svg' : '/illustrations/neet/doctor-male.svg';
  const dismiss = (
    <button
      type="button"
      onClick={() => setDismissed(true)}
      aria-label="Dismiss"
      className="bg-surface/90 text-brand hover:bg-surface absolute top-3 right-3 z-10 flex size-6 items-center justify-center rounded-full md:top-4 md:right-4 md:size-7"
    >
      <X aria-hidden className="size-3.5" strokeWidth={2.5} />
    </button>
  );
  return (
    <section
      aria-labelledby="welcome-name"
      className="border-surface/10 bg-brand relative mx-auto flex w-[95%] shrink-0 items-center justify-between overflow-hidden rounded-xl border-[1.5px] px-4 md:mx-0 md:w-[260px] md:flex-col md:items-stretch md:px-0"
    >
      {dismiss}
      {/* Desktop spotlight over the whole card; on mobile it sits over the small illustration. */}
      <Image
        src="/illustrations/neet/spotlight.svg"
        alt=""
        width={356}
        height={410}
        aria-hidden
        className="pointer-events-none absolute top-0 left-1/2 hidden w-full -translate-x-1/2 md:block"
      />
      <div className="relative z-[1] flex flex-col pr-3 md:items-center md:px-6 md:pt-32 md:text-center">
        <p className="text-on-brand text-[16px] leading-5 md:text-[20px] md:leading-6">
          Hello<span className="md:hidden">,</span>
        </p>
        <h1 id="welcome-name" className="text-on-brand text-[22px] leading-[26px] font-bold md:text-[28px] md:leading-8">
          {name}
        </h1>
        <p className="text-on-brand/75 mt-2 max-w-[190px] text-[12px] leading-[17px] md:mt-3 md:max-w-none md:text-[13px] md:leading-[18px]">
          Stay consistent — your white coat is waiting for you.
        </p>
      </div>
      <div className="relative z-[1] h-[132px] w-[104px] shrink-0 overflow-hidden md:mt-5 md:flex md:h-auto md:w-full md:flex-1 md:items-end md:justify-center">
        <Image
          src="/illustrations/neet/spotlight.svg"
          alt=""
          width={356}
          height={410}
          aria-hidden
          className="pointer-events-none absolute top-0 left-1/2 w-full -translate-x-1/2 md:hidden"
        />
        <Image
          src={doctor}
          alt=""
          width={300}
          height={330}
          priority
          data-testid="doctor"
          data-gender={user.data?.gender ?? 'male'}
          className="absolute inset-0 h-[60%] w-full translate-y-[66%] object-contain object-bottom md:static md:h-auto md:max-w-[300px] md:translate-y-[6%]"
        />
      </div>
    </section>
  );
}

/* ------------------------------ Subject progress ------------------------------ */

export function SubjectProgressCards() {
  const { exam } = useDashboardContext();
  const query = useQuery({ queryKey: ['dashboard', exam.slug, 'subject-progress'], queryFn: dashboardApi.competitiveProgress });
  return (
    <section aria-labelledby="subject-progress" className="w-full rounded-2xl p-3">
      <h2 id="subject-progress" className="mb-4 flex h-8 items-center text-[15px] leading-5 font-medium text-neutral-900">
        Subject Progress
      </h2>
      {query.isPending ? (
        <WidgetSkeleton />
      ) : query.isError ? (
        <SectionError title="Failed to fetch subject progress" error={query.error} />
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4 lg:gap-5">
          {query.data.map((subject) => {
            const art = competitiveSubjectArt(subject.name);
            return (
              <li key={subject.name}>
                <Link
                  href={subject.courseId ? routes.learnCourse(exam.slug, subject.courseId) : routes.learn(exam.slug)}
                  className="group border-line bg-surface text-foreground hover:bg-brand hover:text-on-brand relative flex h-full flex-col justify-between overflow-hidden rounded-lg border p-6 shadow-sm transition-all duration-300"
                >
                  <span className="relative z-10 flex items-start justify-between">
                    <span>
                      <span className="mb-3 block text-xl leading-tight font-semibold sm:text-[28px] sm:leading-7">
                        {subject.name}
                      </span>
                      <span className="flex items-center gap-1.5 text-[14px] leading-[14px]">
                        <span className="font-semibold">
                          {subject.completed}/{subject.total}
                        </span>
                        Chapters
                      </span>
                    </span>
                    <ProgressRing percent={subject.percent} label={`${subject.name} progress`} className="group-hover:text-on-brand" />
                  </span>
                  <span className="hidden sm:mt-20 sm:block" aria-hidden="true" />
                  {art && (
                    <Image
                      src={art.src}
                      alt=""
                      width={art.width}
                      height={art.height}
                      unoptimized
                      className="absolute hidden sm:block"
                      style={{ bottom: art.bottom, right: art.right, left: art.left }}
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ---------------------------------- Today's DPP ---------------------------------- */

/** Time left until midnight, "HH:MM:SS" parts (the paper changes at midnight). */
export function untilMidnight(now: Date): { h: string; m: string; s: string } {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const diff = Math.max(0, midnight.getTime() - now.getTime());
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    h: pad(Math.floor(diff / 3_600_000)),
    m: pad(Math.floor((diff % 3_600_000) / 60_000)),
    s: pad(Math.floor((diff % 60_000) / 1000)),
  };
}

function Countdown() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const left = now ? untilMidnight(now) : { h: '--', m: '--', s: '--' };
  return (
    <div className="border-warning-500/10 bg-warning-100 flex shrink-0 items-center gap-2 rounded-lg border-2 p-2 sm:p-3">
      <span className="bg-warning-500 text-on-brand flex size-8 items-center justify-center rounded-sm sm:size-10">
        <Timer aria-hidden className="size-5" />
      </span>
      <span className="flex flex-col justify-center leading-none" role="timer" aria-label={`${left.h} hours ${left.m} minutes left`}>
        <span className="text-warning-500 text-sm font-bold tabular-nums sm:text-md">
          {left.h}:{left.m}:{left.s}
        </span>
        <span className="text-warning-500/80 text-[11px] font-medium sm:text-[12px]">Left</span>
      </span>
    </div>
  );
}

export function TodaysDpp() {
  const { exam } = useDashboardContext();
  const query = useLiveDpp(exam);
  const dpp = query.data;
  const submitted = dpp?.attempt?.status === 'submitted';
  const percent = dpp && dpp.questionCount > 0 ? Math.round((dpp.attempted / dpp.questionCount) * 100) : 0;
  const href = !dpp
    ? routes.dailyPractice(exam.slug)
    : submitted
      ? routes.testResult(exam.slug, 'dpp', dpp.attempt!.attemptId)
      : routes.testPlayer(exam.slug, 'dpp', dpp.dppId);
  const action = submitted ? 'View Results' : dpp?.attempt?.status === 'in_progress' ? 'Resume' : 'Start Now';

  return (
    <section aria-labelledby="dpp-title" className="border-brand/70 bg-canvas flex w-full flex-col gap-3 rounded-2xl border-2 p-4 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-2 sm:gap-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <span className="relative hidden size-11 shrink-0 items-center justify-center md:flex" aria-hidden="true">
            <span className="bg-brand-300 absolute -bottom-1.5 -left-px size-2.5 rounded-full" />
            <span className="bg-brand-300/80 absolute -top-2 -right-1 size-1.5 rounded-full" />
            <span className="from-brand to-brand-400 flex size-11 items-center justify-center rounded-full bg-linear-to-r shadow-card">
              <Pencil className="text-on-brand size-5" />
            </span>
          </span>
          <div className="ml-2 flex min-w-0 flex-col">
            <h2 id="dpp-title" className="truncate text-lg leading-tight font-bold text-neutral-950 sm:text-[24px]">
              Today&apos;s DPP
            </h2>
            {dpp?.day !== null && dpp?.day !== undefined && (
              <span className="text-foreground-muted text-sm font-medium">Day {dpp.day}</span>
            )}
          </div>
        </div>
        {submitted ? (
          <span className="border-success/10 bg-success-soft text-success flex shrink-0 items-center gap-1.5 rounded-lg border-2 px-2.5 py-2 text-xs font-semibold sm:px-3 sm:py-3 sm:text-sm">
            <CircleCheck aria-hidden className="size-4" />
            Attempted
          </span>
        ) : (
          dpp && <Countdown />
        )}
      </div>

      {query.isPending ? (
        <WidgetSkeleton />
      ) : query.isError ? (
        <SectionError title="Failed to load today's practice" error={query.error} />
      ) : !dpp ? (
        <p className="text-foreground-muted mt-3 text-sm">There&apos;s no practice paper today. Check back tomorrow!</p>
      ) : (
        <>
          <div className="mt-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-foreground-muted text-sm font-medium sm:text-[16px]">Questions answered</span>
              <span className="text-foreground-subtle shrink-0 text-sm font-semibold sm:text-[15px]">
                {dpp.attempted} / {dpp.questionCount}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Questions answered"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-neutral-200"
            >
              <div className="bg-warning-500/50 h-full rounded-full" style={{ width: `${percent}%` }} />
            </div>
          </div>
          {dpp.subjects.length > 0 && (
            <ul className="mt-1 flex flex-wrap gap-2 sm:mt-3">
              {dpp.subjects.map((subject) => (
                <li key={subject} className="bg-brand-75 text-brand rounded-md px-1.5 py-0.5 text-[13px] font-semibold lg:px-3 lg:py-2.5 lg:text-sm">
                  {subject}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <Link
        href={href}
        aria-disabled={query.isPending || undefined}
        className={cx(
          'bg-brand hover:bg-brand-deep text-on-brand mt-2 flex w-full items-center justify-center rounded-xl py-1.5 text-md font-bold sm:mt-6 sm:py-3',
          (query.isPending || query.isError) && 'pointer-events-none opacity-60',
        )}
      >
        {dpp ? action : 'Open Daily Practice'}
      </Link>
    </section>
  );
}

/* --------------------------------- Ask Socrates --------------------------------- */

export function AskSocrates() {
  const { exam } = useDashboardContext();
  return (
    <section
      aria-labelledby="socrates-title"
      className="from-night-700/80 via-night-800 to-night-900/90 relative flex h-full w-full flex-col justify-center overflow-hidden rounded-[28px] bg-linear-to-br p-4 shadow-lg sm:p-6"
    >
      <span aria-hidden className="text-on-brand/20 pointer-events-none absolute top-[8%] left-[11%] font-serif text-lg select-none">
        π
      </span>
      <span aria-hidden className="text-on-brand/15 pointer-events-none absolute top-[32%] left-[6%] text-xs font-semibold select-none">
        x²
      </span>
      <span aria-hidden className="bg-surface/40 pointer-events-none absolute top-[58%] left-[4%] size-1 rounded-full" />
      <span aria-hidden className="text-on-brand/10 pointer-events-none absolute top-[9%] right-[38%] select-none">
        △
      </span>
      <span aria-hidden className="bg-surface/50 pointer-events-none absolute top-[15%] right-[3%] size-1.5 rounded-full" />
      <div className="relative grid grid-cols-1 items-center gap-10 md:grid-cols-[1.15fr_0.85fr]">
        <div className="flex w-full flex-col items-start gap-2">
          <h2 id="socrates-title" className="text-on-brand text-2xl leading-tight font-extrabold sm:text-[40px] sm:leading-[36.72px]">
            Ask Socrates
          </h2>
          <p className="text-on-brand/75 mt-3 text-[13px] sm:mt-4 sm:text-[14px]">
            Solve NEET questions with clear, step-by-step explanations and instant concept guidance.
          </p>
          <Link
            href={routes.doubtSolver(exam.slug)}
            className="from-accent-300 to-accent-700 text-on-brand mt-6 inline-flex w-full items-center justify-center rounded-[13px] bg-linear-to-b px-6 py-2.5 text-[15px] font-semibold shadow-cta-dark"
          >
            Start Solving
          </Link>
        </div>
        <div className="relative hidden items-center md:flex" aria-hidden="true">
          <div className="w-full space-y-3">
            <div className="bg-surface/10 ml-auto max-w-[88%] rounded-[18px] rounded-tr-[5px] px-4 py-2.5">
              <p className="text-on-brand/85 text-[11.5px] leading-snug">A ball is thrown up at 20 m/s. Find the max height it reaches.</p>
            </div>
            <div className="from-night-700/90 to-night-800 shadow-cta-dark mr-auto max-w-[92%] rounded-[18px] rounded-tl-[5px] bg-linear-to-br px-4 py-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="from-accent-300 to-accent-700 flex size-5 items-center justify-center rounded-full bg-linear-to-br">
                  <Sparkles className="text-on-brand size-[11px]" />
                </span>
                <span className="text-accent-700 text-[10px] font-bold tracking-wide">SOCRATES</span>
              </div>
              <p className="text-on-brand/80 text-[11px] leading-relaxed">
                <span className="text-on-brand font-semibold">Step 1:</span> At the peak, final velocity v = 0. Use{' '}
                <span className="text-accent-300 font-mono">v² = u² − 2gh</span> …
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Today's DPP next to Ask Socrates (2 : 3 on large screens). */
export function PracticeRow() {
  return (
    <div className="grid w-full grid-cols-1 gap-3 px-3 lg:grid-cols-[2fr_3fr] lg:gap-6">
      <TodaysDpp />
      <AskSocrates />
    </div>
  );
}

export function Divider() {
  return <hr className="bg-brand-200 h-px w-full border-0" />;
}
