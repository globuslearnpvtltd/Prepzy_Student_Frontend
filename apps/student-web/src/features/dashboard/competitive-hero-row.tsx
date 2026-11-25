'use client';

import type { JourneyState } from '@/features/study-plan';
import { WeeklyProgressCard, useDashboardJourney } from '@/features/study-plan';
import { routes } from '@/shared/config/routes';
import { useExam } from '@/shared/hooks/use-exam';
import { DashboardHeroRow } from './hero-row';

/** Active-plan cards that the week strip is shown underneath (weekly_progress is itself that card). */
export const WEEK_ALONGSIDE_STATES: ReadonlySet<JourneyState> = new Set<JourneyState>([
  'tasks_partial',
  'tasks_done',
  'catch_up',
  'rest_day',
  'halfway',
]);

/**
 * Competitive dashboard's plan + study journey cards (previous app's NEETDashboardHeroRow): the shared hero row,
 * and — while a plan is running — the week strip under a full-width journey card ("2 of 4 tasks" + week).
 */
export function CompetitiveHeroRow() {
  const exam = useExam();
  const journey = useDashboardJourney();
  const data = journey.data;
  const showWeek = !!data && data.width !== 'half' && WEEK_ALONGSIDE_STATES.has(data.state) && data.week.length > 0;

  return (
    <div data-testid="competitive-hero-row" className="flex w-full flex-col gap-[30px] px-3 pt-3 empty:hidden md:gap-[24px]">
      <DashboardHeroRow fill />
      {showWeek && <WeeklyProgressCard week={data.week} href={routes.studyPlan(exam.slug)} />}
    </div>
  );
}
