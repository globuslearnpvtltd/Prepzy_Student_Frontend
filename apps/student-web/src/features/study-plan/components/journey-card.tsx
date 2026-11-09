'use client';

import { cx } from '@prepzy/design-system';
import { ArrowRight, ClipboardCheck, Flag } from 'lucide-react';
import Link from 'next/link';
import { routes } from '@/shared/config/routes';
import { useExam } from '@/shared/hooks/use-exam';
import type { Journey } from '../api';
import { useClassContext, useJourney } from '../hooks';

interface CardCopy {
  lead: string;
  hand: string;
  body?: string;
  cta: string;
  href: string;
  art?: 'clipboard' | 'finish';
  secondary?: { label: string; href: string };
}

/** Copy and destination for each journey state (previous dashboard JourneyCard). */
export function journeyCopy(data: Journey, exam: string): CardCopy | null {
  const plan = routes.studyPlan(exam);
  switch (data.state) {
    case 'take_diagnostic':
      return { lead: 'Take a', hand: 'Diagnostic Test', body: 'Find your current level and get a personalized study plan', cta: 'Start Diagnostic Test', href: routes.diagnostic(exam), art: 'clipboard' };
    case 'resume_diagnostic':
      return {
        lead: 'Finish your',
        hand: 'Diagnostic Test',
        body: 'The timer is still running — pick up exactly where you left off',
        cta: 'Resume Test',
        href: data.assessmentId ? routes.diagnosticTest(exam, data.assessmentId) : routes.diagnostic(exam),
        art: 'clipboard',
      };
    case 'build_plan':
      return { lead: 'Your next steps just got clearer', hand: 'STUDY PLAN IS READY!', cta: 'Build My Plan', href: routes.studyPlanChapters(exam) };
    case 'weekly_progress':
      return { lead: 'This week', hand: 'Your study plan', cta: "Start today's tasks", href: plan };
    case 'tasks_partial':
      return { lead: 'You have completed', hand: `${data.completedCount} of ${data.taskCount} tasks`, cta: 'Continue task', href: plan };
    case 'tasks_done':
      return { lead: 'You have completed all', hand: `${data.taskCount} tasks for today`, cta: 'View next day', href: plan };
    case 'rest_day':
      return { lead: 'Nothing scheduled today', hand: 'ENJOY YOUR REST DAY!', cta: 'Preview tomorrow', href: plan };
    case 'catch_up':
      return { lead: 'Waiting from earlier days', hand: `${data.missedTasks} tasks to catch up`, cta: 'Catch up now', href: plan };
    case 'halfway':
      return { lead: 'You’ve already covered', hand: 'HALF THE PLAN for your study plan!', cta: 'Keep Going', href: plan };
    case 'plan_complete':
      return {
        lead: 'You’ve Reached',
        hand: 'Finish Line!',
        body: "You've finished every step in your study plan.",
        cta: 'Keep Going',
        href: plan,
        art: 'finish',
        secondary: data.canRetakeDiagnostic ? { label: 'Retake Diagnostic Test', href: routes.diagnostic(exam) } : undefined,
      };
    case 'plan_ended':
      return {
        lead: 'Your plan has ended',
        hand: `${data.remainingTasks} tasks left`,
        body: 'Finish what is left, or start fresh with a new diagnostic test',
        cta: 'Open My Plan',
        href: plan,
        art: 'clipboard',
      };
    default:
      return null;
  }
}

/** Ruled notebook paper with a red margin line, as on the previous journey cards. */
const paper =
  'bg-surface bg-[repeating-linear-gradient(to_bottom,transparent_0_34px,var(--color-brand-75)_34px_35px)] relative overflow-hidden rounded-2xl border border-neutral-150 shadow-lg';

function WeekStrip({ week }: { week: Journey['week'] }) {
  if (!week.length) return null;
  return (
    <div className="flex gap-2">
      {week.map((day) => (
        <span
          key={day.date || day.label}
          className={cx(
            'flex min-w-0 flex-1 flex-col items-center gap-1 rounded-md border py-2 text-[11px] font-semibold',
            day.isToday ? 'border-brand bg-brand-50 text-brand' : 'border-neutral-150 text-neutral-500',
          )}
        >
          {day.label}
          <span className={cx('text-[12px] font-bold', day.total > 0 && day.done >= day.total ? 'text-success-700' : 'text-neutral-900')}>
            {day.isRest ? '—' : `${day.done}/${day.total}`}
          </span>
        </span>
      ))}
    </div>
  );
}

/** Dashboard card that sends the student to the next step of the diagnostic → study plan journey. */
export function JourneyCard() {
  const exam = useExam();
  const { classId } = useClassContext();
  const journey = useJourney(classId);
  if (!journey.data) return null;
  const copy = journeyCopy(journey.data, exam.slug);
  if (!copy) return null;
  const Art = copy.art === 'finish' ? Flag : ClipboardCheck;
  return (
    <section aria-label="Your study journey" className={paper}>
      <span aria-hidden className="bg-danger/40 absolute inset-y-0 left-10 w-[2px]" />
      <div className="relative flex flex-col gap-4 py-6 pr-6 pl-14 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[14px] font-medium text-neutral-650">{copy.lead}</span>
          <span className="font-display text-brand text-[28px] leading-8 font-bold tracking-[1px]">{copy.hand}</span>
          {copy.body && <span className="max-w-[360px] text-[13px] leading-5 text-neutral-600">{copy.body}</span>}
          {journey.data.state === 'weekly_progress' && <WeekStrip week={journey.data.week} />}
          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              href={copy.href}
              className="bg-accent-400 text-on-brand flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-semibold shadow-[0px_8px_18px_rgba(255,170,62,0.25)] hover:opacity-90"
            >
              {copy.cta}
              <ArrowRight aria-hidden className="size-4" />
            </Link>
            {copy.secondary && (
              <Link href={copy.secondary.href} className="border-accent-400 text-accent-700 rounded-full border px-5 py-2.5 text-[14px] font-semibold hover:bg-accent-50">
                {copy.secondary.label}
              </Link>
            )}
          </div>
        </div>
        {copy.art && (
          <span aria-hidden className="bg-brand-100 text-brand hidden size-24 shrink-0 rotate-6 items-center justify-center rounded-md md:flex">
            <Art className="size-12" />
          </span>
        )}
      </div>
    </section>
  );
}
