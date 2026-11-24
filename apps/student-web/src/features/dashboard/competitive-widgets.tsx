'use client';

import { cx } from '@prepzy/design-system';
import { useQuery } from '@tanstack/react-query';
import { CircleCheck, Pencil, Sparkles, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useCurrentUser } from '@/features/auth';
import { FeatureLock } from '@/features/feature-access/ui';
import { routes } from '@/shared/config/routes';
import { useLiveDpp } from '@/shared/layout/shell-api';
import { ProgressRing } from '@/shared/ui/charts';
import { CompetitiveSubjectArt } from '@/shared/ui/competitive-subject-art';
import { dashboardApi } from './api';
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
  const query = useQuery({ queryKey: ['dashboard', exam.slug, 'subject-progress'], queryFn: () => dashboardApi.competitiveProgress(exam) });
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
          {query.data.map((subject) => (
            <li key={subject.name}>
              {/* Previous app's SubjectProgress card: white at rest; on hover (or keyboard focus) it fills with the
                  brand colour, the text turns white and the background artwork is outlined in orange. */}
              <Link
                href={subject.courseId ? routes.learnCourse(exam.slug, subject.courseId) : routes.learn(exam.slug)}
                className="group bg-surface text-foreground hover:bg-brand hover:text-on-brand focus-visible:bg-brand focus-visible:text-on-brand relative flex h-full flex-col justify-between overflow-hidden rounded-lg border border-neutral-100 p-4 shadow-sm transition-all duration-300 outline-none sm:p-6"
              >
                <span className="relative z-10 flex items-start justify-between">
                  <span>
                    <span className="mb-3 block text-xl leading-tight font-semibold sm:text-[28px] sm:leading-7">{subject.name}</span>
                    <span className="flex items-center gap-1.5 text-[14px] leading-[14px]">
                      <span className="font-semibold">
                        {subject.completed}/{subject.total}
                      </span>
                      Chapters
                    </span>
                  </span>
                  <ProgressRing percent={subject.percent} label={`${subject.name} progress`} />
                </span>
                <span className="hidden sm:mt-20 sm:block" aria-hidden="true" />
                <CompetitiveSubjectArt subject={subject.name} hover className="hidden sm:block" />
              </Link>
            </li>
          ))}
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

/** The previous card's clock-with-dots icon (white on the orange tile). */
function DppClockIcon() {
  return (
    <svg aria-hidden width="20" height="20" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M10.2115 6.19968C10.026 8.44615 8.12958 10.2112 5.83523 10.2112C4.67458 10.2112 3.56146 9.75017 2.74076 8.92947C1.92005 8.10876 1.45898 6.99564 1.45898 5.83499C1.45898 3.54065 3.22407 1.64428 5.47055 1.45874"
        stroke="currentColor"
        strokeWidth="1.37"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M5.83496 3.28223V5.83504H8.38777" stroke="currentColor" strokeWidth="1.37" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="7.29361" cy="1.64115" r="0.547" fill="currentColor" />
      <circle cx="8.93473" cy="2.73514" r="0.547" fill="currentColor" />
      <circle cx="10.029" cy="4.37625" r="0.547" fill="currentColor" />
    </svg>
  );
}

function Countdown() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const left = now ? untilMidnight(now) : { h: '00', m: '00', s: '00' };
  return (
    <div className="border-dpp-timer/12 bg-dpp-timer-soft flex shrink-0 items-center gap-2 rounded-lg border-2 px-2 py-2 sm:px-3 sm:py-3">
      <span className="bg-dpp-timer text-on-brand flex size-8 items-center justify-center rounded-sm sm:size-10">
        <DppClockIcon />
      </span>
      <span className="flex flex-col justify-center leading-none" role="timer" aria-label={`${left.h} hours ${left.m} minutes left`}>
        <span className="text-dpp-timer flex text-sm font-bold tabular-nums sm:text-md">
          <span className="inline-block w-[2ch] text-center">{left.h}</span>
          <span>:</span>
          <span className="inline-block w-[2ch] text-center">{left.m}</span>
          <span>:</span>
          <span className="inline-block w-[2ch] text-center">{left.s}</span>
        </span>
        <span className="text-dpp-left/80 text-[11px] font-medium sm:text-[12px]">Left</span>
      </span>
    </div>
  );
}

/**
 * Today's DPP (previous app's DailyDPPCard, same layout and colours): pencil badge, "Today's DPP · Day n", time left
 * until midnight (or "Attempted"), questions answered with a progress bar, subject chips and Start Now / Resume / View
 * Results. While loading the card keeps its layout with a disabled button, as before.
 */
export function TodaysDpp() {
  const { exam } = useDashboardContext();
  const query = useLiveDpp(exam);
  const dpp = query.data;
  const loading = query.isPending;
  const submitted = dpp?.attempt?.status === 'submitted';
  const percent = dpp && dpp.questionCount > 0 ? Math.round((dpp.attempted / dpp.questionCount) * 100) : 0;
  const href = !dpp
    ? routes.dailyPractice(exam.slug)
    : submitted
      ? routes.testResult(exam.slug, 'dpp', dpp.attempt!.attemptId)
      : routes.testPlayer(exam.slug, 'dpp', dpp.dppId);
  const action = submitted ? 'View Results' : dpp?.attempt?.status === 'in_progress' ? 'Resume' : 'Start Now';
  const showTimer = !loading && !query.isError && !submitted;

  return (
    <section
      aria-labelledby="dpp-title"
      className="border-brand/70 bg-dpp-card shadow-dpp-card flex w-full flex-col gap-3 rounded-2xl border-2 p-4 sm:p-6"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 sm:gap-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <span className="relative hidden size-8 shrink-0 items-center justify-center sm:size-11 md:flex" aria-hidden="true">
            <span className="bg-dpp-dot pointer-events-none absolute bottom-[-3px] left-[-2px] size-1.5 rounded-full sm:bottom-[-6px] sm:left-[-1px] sm:size-2.5" />
            <span className="bg-dpp-dot/80 pointer-events-none absolute top-[-5px] right-[2px] size-1 rounded-full sm:top-[-8px] sm:right-[-4px] sm:size-1.5" />
            <span className="bg-brand/40 pointer-events-none absolute right-[-6px] bottom-[3px] size-[3px] rounded-full sm:right-[-9px] sm:bottom-[8px] sm:size-1" />
            <span className="from-brand to-dpp-glow shadow-dpp-icon flex size-8 items-center justify-center rounded-full bg-linear-to-r sm:size-11">
              <Pencil className="text-on-brand size-3.5 sm:size-5" />
            </span>
          </span>
          <div className="ml-2 flex min-w-0 flex-col">
            <h2 id="dpp-title" className="text-dpp-title truncate text-lg leading-tight font-bold sm:text-[24px]">
              Today&apos;s DPP
            </h2>
            {dpp?.day !== null && dpp?.day !== undefined && (
              <span className="text-dpp-muted text-sm font-medium">Day {dpp.day}</span>
            )}
          </div>
        </div>
        {!loading && !query.isError && submitted && (
          <span className="border-dpp-done/12 bg-dpp-done-soft text-dpp-done flex shrink-0 items-center gap-1.5 rounded-lg border-2 px-2.5 py-2 text-xs font-semibold sm:px-3 sm:py-3 sm:text-sm">
            <CircleCheck aria-hidden className="size-4" />
            Attempted
          </span>
        )}
        {showTimer && <Countdown />}
      </div>

      {query.isError ? (
        <SectionError title="Failed to load today's practice" error={query.error} />
      ) : !loading && !dpp ? (
        <p className="text-dpp-muted mt-3 text-sm">There&apos;s no practice paper today. Check back tomorrow!</p>
      ) : (
        <>
          {/* Questions answered + progress */}
          <div className="mt-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-dpp-muted text-sm font-medium sm:text-[16px]">Questions answered</span>
              <span className="text-dpp-count shrink-0 text-sm font-semibold sm:text-[15px]">
                {dpp?.attempted ?? 0} / {loading ? '–' : (dpp?.questionCount ?? 0)}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Questions answered"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="bg-dpp-track mt-2 h-2.5 w-full overflow-hidden rounded-full"
            >
              <div className="bg-dpp-timer/50 h-full rounded-full transition-all" style={{ width: `${percent}%` }} />
            </div>
          </div>
          {/* Subject chips */}
          {!!dpp?.subjects.length && (
            <ul className="mt-1 flex flex-wrap gap-2 sm:mt-3">
              {dpp.subjects.map((subject) => (
                <li key={subject} className="bg-dpp-chip text-brand rounded-md px-1.5 py-0.5 text-[13px] font-semibold lg:px-3 lg:py-2.5 lg:text-sm">
                  {subject}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* Start button (locked when the institute switched daily practice off) */}
      <div className="mt-2 sm:mt-6">
      <FeatureLock feature="practice_dpp" label="Today's DPP" badge="edge">
      <Link
        href={href}
        aria-disabled={loading || query.isError || undefined}
        className={cx(
          'bg-brand hover:bg-dpp-hover active:bg-dpp-active text-on-brand flex w-full items-center justify-center gap-2 rounded-xl py-1.5 text-md font-bold transition-colors sm:py-3',
          (loading || query.isError) && 'pointer-events-none cursor-not-allowed opacity-50',
        )}
      >
        {dpp || loading ? action : 'Open Daily Practice'}
      </Link>
      </FeatureLock>
      </div>
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
          <div className="mt-6 w-full">
          <FeatureLock feature="doubt_solver" label="Start Solving" badge="edge">
            <Link
              href={routes.doubtSolver(exam.slug)}
              className="from-accent-300 to-accent-700 text-on-brand inline-flex w-full items-center justify-center rounded-[13px] bg-linear-to-b px-6 py-2.5 text-[15px] font-semibold shadow-cta-dark"
            >
              Start Solving
            </Link>
          </FeatureLock>
          </div>
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
