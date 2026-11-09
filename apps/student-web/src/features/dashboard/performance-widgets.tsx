'use client';

import { cx } from '@prepzy/design-system';
import { useQuery } from '@tanstack/react-query';
import { BarChart, LineChart, type BarDatum } from '@/shared/ui/charts';
import { dashboardApi, formatHours, weeklyAverage, type DayActivity } from './api';
import { boardOverviewQuery, EmptyChart, SectionError, useDashboardContext, WidgetSkeleton } from './widget-kit';

/** Board: first letter per day ("M T W …"). Competitive: full names, every other day labelled (as before). */
export function toBars(days: DayActivity[], labels: 'initial' | 'alternate'): BarDatum[] {
  return days.map((d, index) => ({
    name: d.day,
    label: labels === 'initial' ? (d.day === 'Today' ? 'Today' : d.day.charAt(0)) : index % 2 === 0 ? d.day : '',
    value: d.hours,
    display: formatHours(d.hours),
  }));
}

function useActivity() {
  const { exam, classId } = useDashboardContext();
  const competitive = exam.category === 'competitive';
  const board = useQuery({
    ...boardOverviewQuery(exam, classId),
    enabled: !competitive && classId !== null,
    select: (data) => data.activity,
  });
  const neet = useQuery({
    queryKey: ['dashboard', exam.slug, 'activity', classId],
    queryFn: () => dashboardApi.competitiveActivity(exam, classId!),
    enabled: competitive && classId !== null,
  });
  return competitive ? neet : board;
}

export function ActivityCard() {
  const { exam, noPlan } = useDashboardContext();
  const query = useActivity();
  const days = query.data ?? [];
  return (
    <div className="h-[300px] w-full md:h-[343px]">
      {noPlan ? (
        <EmptyChart image="/illustrations/dashboard/no-data-activity.jpg" />
      ) : query.isPending ? (
        <WidgetSkeleton className="p-6" />
      ) : query.isError ? (
        <SectionError title="Failed to fetch learning hours" error={query.error} />
      ) : days.length === 0 ? (
        <EmptyChart image="/illustrations/dashboard/no-data-activity.jpg" />
      ) : (
        <div className="flex h-full flex-col gap-[30px] rounded-lg p-6">
          <div className="flex flex-col gap-2">
            <p className="text-foreground text-[24px] leading-6 font-semibold">{formatHours(weeklyAverage(days))}</p>
            <p className="text-neutral-450 text-[14px] leading-4 font-medium">Average learning hours of this week</p>
          </div>
          <BarChart
            className="min-h-0 flex-1"
            caption="Learning hours per day this week"
            data={toBars(days, exam.category === 'competitive' ? 'alternate' : 'initial')}
          />
        </div>
      )}
    </div>
  );
}

export function ScoresCard() {
  const { exam, classId, noPlan } = useDashboardContext();
  const query = useQuery({
    queryKey: ['dashboard', exam.slug, 'scores', classId],
    queryFn: () => dashboardApi.subjectScores(exam, classId!),
    enabled: classId !== null,
  });
  const subjects = query.data?.subjects ?? [];
  const empty = subjects.length === 0 || subjects.every((s) => s.thisAttempt === 0 && s.lastAttempt === 0);
  return (
    <div className="h-[300px] w-full md:h-[343px]">
      {noPlan ? (
        <EmptyChart image="/illustrations/dashboard/no-data-scores.jpg" />
      ) : query.isPending ? (
        <WidgetSkeleton className="p-6" />
      ) : query.isError ? (
        <SectionError title="Failed to fetch graph data" error={query.error} />
      ) : empty ? (
        <EmptyChart image="/illustrations/dashboard/no-data-scores.jpg" />
      ) : (
        <div className="border-info-soft flex h-full flex-col rounded-xl border-2 p-5">
          <div className="flex flex-col gap-2">
            <p className="text-foreground text-[24px] leading-6 font-semibold">{query.data?.overall}%</p>
            <p className="text-neutral-450 text-[12px] leading-4 font-medium lg:text-[14px]">
              Average Current Attempt Score across all subjects
            </p>
          </div>
          <LineChart
            className="min-h-0 flex-1"
            caption="Score per subject, last and current attempt"
            categories={subjects.map((s) => s.subject)}
            series={[
              { name: 'Last Attempt', tone: 'light', values: subjects.map((s) => s.lastAttempt) },
              { name: 'Current Attempt', tone: 'strong', values: subjects.map((s) => s.thisAttempt) },
            ]}
          />
          {exam.category === 'competitive' && (
            <p className="text-foreground-subtle mt-1 text-center text-[10px]">All scores shown are rounded off.</p>
          )}
        </div>
      )}
    </div>
  );
}

const chartCard = 'border-line bg-surface w-full rounded-xl border shadow-lg';

/** Board: "How you fare" — learning hours and test scores. */
export function HowYouFare() {
  return (
    <section aria-labelledby="fare-title">
      <h2 id="fare-title" className="text-neutral-850 mb-2.5 text-[18px] leading-[18px] font-semibold md:text-[24px] md:leading-6">
        How you fare
      </h2>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className={chartCard}>
          <ActivityCard />
        </div>
        <div className={chartCard}>
          <ScoresCard />
        </div>
      </div>
    </section>
  );
}

/** Competitive: "Your Performance Overview". */
export function PerformanceOverview() {
  return (
    <section aria-labelledby="performance-title" className="w-full">
      <h2 id="performance-title" className="mb-4 text-[15px] leading-5 font-medium text-neutral-900">
        Your Performance Overview
      </h2>
      <div className="grid w-full grid-cols-1 gap-8 md:grid-cols-2">
        <div className={chartCard}>
          <ActivityCard />
        </div>
        <div className={cx(chartCard, 'rounded-xl')}>
          <ScoresCard />
        </div>
      </div>
    </section>
  );
}
