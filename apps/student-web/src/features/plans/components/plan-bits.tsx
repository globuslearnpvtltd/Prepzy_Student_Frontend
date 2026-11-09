import { cx } from '@prepzy/design-system';
import type { LearningPlan, PlanStatus } from '../api';

const PLAN_STATUS: Record<PlanStatus, string> = {
  ACTIVE: 'text-plan-amber border-plan-amber-line',
  EXPIRED: 'text-plan-red border-plan-red-line',
  CANCELLED: 'text-neutral-550 border-neutral-300',
};

const COURSE_STATUS: Record<PlanStatus, string> = {
  ACTIVE: 'text-success-700 border-plan-green-line',
  EXPIRED: 'text-plan-red border-plan-red-line',
  CANCELLED: 'text-neutral-550 border-neutral-300',
};

const pill = 'bg-surface inline-flex items-center rounded-full border px-3 py-[3px] text-[11px] font-semibold tracking-[0.04em]';

export const PlanStatusPill = ({ status }: { status: PlanStatus }) => <span className={cx(pill, PLAN_STATUS[status])}>{status}</span>;

export const CourseStatusPill = ({ status }: { status: PlanStatus }) => <span className={cx(pill, COURSE_STATUS[status])}>{status}</span>;

export function ReceiptRow({ label, value, success }: { label: string; value: string; success?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-[5px]">
      <dt className="text-neutral-550 text-[12px]">{label}</dt>
      <dd className={cx('text-[12px] font-bold', success ? 'text-plan-extend' : 'text-plan-ink')}>{value}</dd>
    </div>
  );
}

export function CourseCard({ course }: { course: LearningPlan['courses'][number] }) {
  return (
    <div className="border-plan-panel-line bg-plan-panel rounded-md border p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-neutral-550 text-[11px] font-medium tracking-[0.08em]">{course.label}</span>
        <CourseStatusPill status={course.status} />
      </div>
      <h3 className="text-plan-ink mt-3.5 text-lg leading-snug font-bold">{course.title}</h3>
    </div>
  );
}
