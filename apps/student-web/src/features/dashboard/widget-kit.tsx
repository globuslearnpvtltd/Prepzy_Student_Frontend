'use client';

import type { ExamConfig } from '@/shared/config/exams';
import { cx, Skeleton } from '@prepzy/design-system';
import { useTestContext } from '@/features/exam-engine';
import { useExam } from '@/shared/hooks/use-exam';
import { userMessage } from '@/shared/lib/errors';
import { dashboardApi } from './api';

/** Exam + class the dashboard widgets load data for (the class picked in the class switcher). */
export function useDashboardContext() {
  const exam = useExam();
  const { context, isPending } = useTestContext();
  // noPlan: the plan request finished and the student has no active plan (free board student).
  return { exam, classId: context?.classId ?? null, noPlan: !isPending && !context };
}

/** Board "learner data" (weekly hours + profile completion), shared by the activity chart and the profile card. */
export const boardOverviewQuery = (exam: ExamConfig, classId: number | null) => ({
  queryKey: ['dashboard', exam.slug, 'board-overview', classId] as const,
  queryFn: () => dashboardApi.boardOverview(exam, classId!),
});

/** Inline failure message for one widget; the rest of the dashboard keeps working. */
export function SectionError({ title, error }: { title: string; error: unknown }) {
  return (
    <div role="alert" className="border-danger/30 bg-danger-soft rounded-xl border-2 p-6 text-sm">
      <p className="text-danger font-semibold">{title}</p>
      <p className="text-foreground-muted mt-1">{userMessage(error)}</p>
    </div>
  );
}

export function WidgetSkeleton({ className }: { className?: string }) {
  return (
    <div aria-busy="true" aria-label="Loading" className={cx('flex flex-col gap-3', className)}>
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

/** Bar with a track and fill, as on the previous course / test cards. */
export function ProgressBar({ percent, label, fill }: { percent: number; label: string; fill: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="border-line bg-surface h-2.5 w-full overflow-hidden rounded-full border-2"
      >
        <div className={cx('h-full rounded-full', fill)} style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
      </div>
      <span className="text-foreground-muted text-xs font-medium">{percent}%</span>
    </div>
  );
}

/** "Your Data will appear here!" over the previous app's empty-chart artwork. */
export function EmptyChart({ image }: { image: string }) {
  return (
    <div
      className="relative flex h-full items-center justify-center rounded-xl bg-cover bg-center p-5"
      style={{ backgroundImage: `url('${image}')` }}
    >
      <span className="border-brand-200 bg-brand-100 rounded-md border-2 px-4 py-3 text-[10px] font-semibold text-neutral-950">
        Your Data will appear here!
      </span>
    </div>
  );
}
