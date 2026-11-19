'use client';

import { JourneyCard, useDashboardJourney } from '@/features/study-plan';
import { PlanBanner, usePlanBanner } from './board-widgets';

/**
 * Plan card + study journey card (previous app's DashboardHeroRow). When the journey card is half width,
 * wide screens show the plan card's half form on the left and the journey card on the right; otherwise
 * (and on phones) they stack. Both layouts are switched by CSS at md, the previous useIsMobile breakpoint.
 */
export function DashboardHeroRow() {
  const journey = useDashboardJourney();
  const banner = usePlanBanner();
  // Nothing to show: render nothing, so the column's gap doesn't count an empty row.
  if (!banner && !journey.data) return null;
  const side = journey.data?.width === 'half' && !!banner;

  if (side) {
    return (
      <div
        data-testid="hero-row"
        data-layout="side"
        className="flex w-full flex-col gap-[30px] md:flex-row md:items-stretch md:gap-[24px]"
      >
        <div className="flex w-full min-w-0 flex-col md:flex-[264_1_0%]">
          <PlanBanner form="half" className="hidden md:flex" />
          <PlanBanner className="md:hidden" />
        </div>
        <JourneyCard className="min-w-0 md:flex-[553_1_0%] md:self-start" />
      </div>
    );
  }

  return (
    <div data-testid="hero-row" data-layout="stacked" className="flex w-full flex-col gap-[30px] md:gap-[24px]">
      <PlanBanner />
      <JourneyCard />
    </div>
  );
}
