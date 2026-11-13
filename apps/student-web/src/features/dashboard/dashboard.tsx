'use client';

import { cx } from '@prepzy/design-system';
import type { ComponentType } from 'react';
import type { ExamCategory } from '@/shared/config/exams';
import { ContinueLearning, SubjectListing as MySubjects } from '@/features/learn/ui';
import { JourneyCard } from '@/features/study-plan';
import { useExam } from '@/shared/hooks/use-exam';
import {
  ContinueAssessment,
  LinkParentCard,
  PlanBanner,
  ReferEarnTeaser,
  SolverDiscovery,
  SyllabusCards,
} from './board-widgets';
import { ChooseYourPlan, GetReadyExam } from './free-widgets';
import { Divider, NeetWelcome, PracticeRow, SubjectProgressCards } from './competitive-widgets';
import { HowYouFare, PerformanceOverview } from './performance-widgets';

export interface DashboardLayout {
  className: string;
  columns: { className: string; widgets: ComponentType[] }[];
}

/**
 * Dashboard layout per exam category (the previous app's compositions). Reorder or add widgets here;
 * no page code changes.
 */
export const DASHBOARD_WIDGETS: Record<ExamCategory, DashboardLayout> = {
  board: {
    className: 'flex w-full flex-col gap-5 md:flex-row',
    columns: [
      {
        className: 'flex w-full min-w-0 flex-col gap-[30px] md:w-[70%] md:gap-10',
        // GetReadyExam and ChooseYourPlan render only for a student without an active plan;
        // MySubjects then shows "My Free Courses".
        widgets: [PlanBanner, JourneyCard, ContinueLearning, ContinueAssessment, MySubjects, GetReadyExam, HowYouFare, ChooseYourPlan],
      },
      {
        className: 'flex w-full min-w-0 flex-col gap-5 md:w-[30%]',
        widgets: [SolverDiscovery, LinkParentCard, ReferEarnTeaser, SyllabusCards],
      },
    ],
  },
  competitive: {
    className: 'flex w-full flex-col items-start gap-2 md:flex-row',
    columns: [
      { className: 'w-full md:w-auto', widgets: [NeetWelcome] },
      {
        className: 'flex w-full min-w-0 flex-col items-start gap-6',
        widgets: [SubjectProgressCards, Divider, PracticeRow, Divider, PerformanceOverview],
      },
    ],
  },
  reference: { className: '', columns: [] },
};

export function Dashboard() {
  const exam = useExam();
  const layout = DASHBOARD_WIDGETS[exam.category];
  return (
    <div className={cx(layout.className)}>
      {layout.columns.map((column, index) => (
        // Columns and widgets are static per category, so their positions are stable keys.
        <div key={index} className={column.className}>
          {column.widgets.map((Widget, position) => (
            <Widget key={position} />
          ))}
        </div>
      ))}
    </div>
  );
}
