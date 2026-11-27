'use client';

import { routes } from '@/shared/config/routes';
import { useExam } from '@/shared/hooks/use-exam';
import type { Journey, JourneyState, PlanCategory } from '../api';
import { useDashboardJourney } from '../hooks';
import { DiagnosticCardArt } from './diagnostic-card-art';
import { FinishLineCard } from './finish-line-card';
import { MobileNotebookCard, MobileSlimCard } from './mobile-notebook-card';
import { SlimCardShellA, SlimCardShellB } from './slim-card-shells';
import { WeeklyProgressCard } from './weekly-progress-card';

interface CardCopy {
  lead: string;
  hand: string;
  body?: string;
  /** The body as the desktop artwork breaks it into lines (previous app's DiagnosticCardArt). */
  bodyLines?: string[];
  cta: string;
  href: string;
  art?: 'clipboard' | 'finish';
  secondary?: { label: string; href: string };
}

const lines = (...bodyLines: string[]) => ({ body: bodyLines.join(' '), bodyLines });

/** States the previous app drew as the notebook artwork (desktop DiagnosticCardArt, phone MobileNotebookCard). */
const NOTEBOOK_STATES = new Set<JourneyState>(['take_diagnostic', 'resume_diagnostic', 'plan_ended']);

/** Slim cards: shell A (inline on phones) for task counts, shell B (stacked on phones) for the rest. */
const SLIM_A = new Set<JourneyState>(['tasks_partial', 'tasks_done', 'catch_up']);
const SLIM_B = new Set<JourneyState>(['build_plan', 'rest_day', 'halfway']);

/** Copy and destination for each journey state (previous dashboard JourneyCard; competitive: NEETJourneyCard). */
export function journeyCopy(data: Journey, exam: string, category: PlanCategory = 'board'): CardCopy | null {
  const plan = routes.studyPlan(exam);
  switch (data.state) {
    case 'take_diagnostic':
      return {
        lead: 'Take a',
        hand: 'Diagnostic Test',
        ...lines('Find your current level and get a', 'personalized study plan'),
        cta: 'Start Diagnostic Test',
        href: routes.diagnostic(exam),
        art: 'clipboard',
      };
    case 'resume_diagnostic':
      return {
        lead: 'Finish your',
        hand: 'Diagnostic Test',
        ...lines('The timer is still running — pick up', 'exactly where you left off'),
        cta: 'Resume Test',
        href: data.assessmentId ? routes.diagnosticTest(exam, data.assessmentId) : routes.diagnostic(exam),
        art: 'clipboard',
      };
    case 'build_plan':
      // Competitive: no plan exists yet in this state, so the copy invites building one.
      return {
        lead: category === 'competitive' ? 'Your diagnostic test is done' : 'Your next steps just got clearer',
        hand: category === 'competitive' ? 'BUILD YOUR STUDY PLAN!' : 'STUDY PLAN IS READY!',
        cta: 'Build My Plan',
        href: routes.studyPlanChapters(exam),
      };
    case 'weekly_progress':
      return { lead: 'This week', hand: 'Your study plan', cta: "Start today's task", href: plan };
    case 'tasks_partial':
      return {
        lead: 'You have completed',
        hand: `${data.completedCount} of ${data.taskCount} tasks`,
        cta: 'Continue task',
        href: plan,
      };
    case 'tasks_done':
      return {
        lead: 'You have completed all',
        hand: `${data.taskCount} tasks for today`,
        cta: 'View next day',
        href: plan,
      };
    case 'rest_day':
      return { lead: 'Nothing scheduled today', hand: 'ENJOY YOUR REST DAY!', cta: 'Preview tomorrow', href: plan };
    case 'catch_up':
      return {
        lead: 'Waiting from earlier days',
        hand: `${data.missedTasks} tasks to catch up`,
        cta: 'Catch up now',
        href: plan,
      };
    case 'halfway':
      return {
        lead: 'You’ve already covered',
        hand: 'HALF THE PLAN for your study plan!',
        cta: 'Keep Going',
        href: plan,
      };
    case 'plan_complete':
      return {
        lead: 'You’ve Reached',
        hand: 'Finish Line!',
        body: "You've finished every step in your study plan.",
        cta: 'Keep Going',
        href: plan,
        art: 'finish',
        secondary: data.canRetakeDiagnostic
          ? { label: 'Retake Diagnostic Test', href: routes.diagnostic(exam) }
          : undefined,
      };
    case 'plan_ended':
      return {
        lead: 'Your plan has ended',
        hand: `${data.remainingTasks} tasks left`,
        ...lines('Finish what is left, or start fresh', 'with a new diagnostic test'),
        cta: 'Open My Plan',
        href: plan,
        art: 'clipboard',
      };
    default:
      return null;
  }
}

/** Ruled notebook paper with a red margin line, as on the previous journey cards. */
/**
 * Dashboard card that sends the student to the next step of the diagnostic → study plan journey, drawn as the
 * previous app's JourneyCard did. Phone and desktop versions are both rendered and switched by CSS (md, the
 * previous useIsMobile breakpoint), so there is no hydration flash.
 */
export function JourneyCard({ className, fill = false }: { className?: string; fill?: boolean }) {
  const exam = useExam();
  const journey = useDashboardJourney();
  if (!journey.data) return null;
  const copy = journeyCopy(journey.data, exam.slug, exam.category);
  if (!copy) return null;
  const { state } = journey.data;

  const body = (() => {
    if (NOTEBOOK_STATES.has(state)) {
      return (
        <>
          <MobileNotebookCard
            art="clipboard"
            lead={copy.lead}
            hand={copy.hand}
            body={copy.body ?? ''}
            ctaLabel={copy.cta}
            href={copy.href}
            className="md:hidden"
          />
          {/* fill: grow past the art's 553px to fill the row (competitive dashboard) at the same height. */}
          <div
            className={`shadow-journey-card hidden w-full rounded-[24px] md:block ${fill ? '' : 'max-w-[553px]'}`}
          >
            <DiagnosticCardArt
              className="block h-auto w-full"
              stretch={fill}
              lead={copy.lead}
              hand={copy.hand}
              bodyLines={copy.bodyLines ?? []}
              ctaLabel={copy.cta}
              href={copy.href}
            />
          </div>
        </>
      );
    }
    if (SLIM_A.has(state) || SLIM_B.has(state)) {
      const Shell = SLIM_A.has(state) ? SlimCardShellA : SlimCardShellB;
      return (
        <>
          <MobileSlimCard
            layout={SLIM_A.has(state) ? 'inline' : 'stacked'}
            lead={copy.lead}
            hand={copy.hand}
            ctaLabel={copy.cta}
            href={copy.href}
            className="md:hidden"
          />
          <div className="shadow-journey-card hidden w-full rounded-[24px] md:block">
            <Shell
              className="block h-auto w-full"
              lead={copy.lead}
              hand={copy.hand}
              ctaLabel={copy.cta}
              href={copy.href}
            />
          </div>
        </>
      );
    }
    if (state === 'weekly_progress') return <WeeklyProgressCard week={journey.data.week} href={copy.href} />;
    // plan_complete
    return (
      <>
        <MobileNotebookCard
          art="finish"
          lead={copy.lead}
          hand={copy.hand}
          body={copy.body ?? ''}
          ctaLabel={copy.cta}
          href={copy.href}
          secondary={copy.secondary}
          className="md:hidden"
        />
        <div className="hidden w-full md:block">
          <FinishLineCard href={copy.href} retakeHref={copy.secondary?.href} />
        </div>
      </>
    );
  })();

  return (
    <section aria-label="Your study journey" className={className}>
      {body}
    </section>
  );
}
