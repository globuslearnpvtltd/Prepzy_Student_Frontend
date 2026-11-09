'use client';

import { Skeleton, cx } from '@prepzy/design-system';
import type { ReactNode } from 'react';
import type { CountItem } from '../api';
import { useAssessments, useDoubts, useLearningHours, useLectures } from '../hooks';
import { colorAt, formatMinutes, share } from '../model';
import { WeekChart } from './week-chart';

type StudentQuery = { studentId: number; classId: number };

export const cardClass = 'bg-surface border-schools-line shadow-sm w-full rounded-[10px] border';
const sectionTitle = 'text-brand-700 text-[12px]/[16px] font-bold';
const smallCaps = 'text-neutral-550 mb-[10px] text-[10px]/[15px] font-semibold tracking-widest uppercase';

function SectionState({ loading, error }: { loading: boolean; error: boolean }) {
  if (loading) return <Skeleton className="mt-[20px] h-[120px] w-full" />;
  if (error) return <p className="text-neutral-550 mt-[20px] text-[12px]">Couldn&apos;t load this section.</p>;
  return null;
}

function EngagementRow({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <div className="bg-brand-50 shadow-sm flex w-full items-center justify-between gap-[10px] rounded-[10px] p-[10px]">
      <p className="text-neutral-900 text-[12px]/[16px] font-medium">{label}</p>
      <div className="flex flex-col gap-[1px] text-right">
        <p className="text-brand-700 text-[16px]/[18px] font-bold">{value}</p>
        <p className="text-neutral-900 text-[10px]/[12px] font-medium">{caption}</p>
      </div>
    </div>
  );
}

/** Weekly time chart + study engagement totals. */
export function LearningHoursSection(query: StudentQuery) {
  const { data, isPending, isError } = useLearningHours(query);
  const e = data?.engagement;
  return (
    <div className="grid grid-cols-1 gap-[20px] lg:grid-cols-[60%_38%]">
      <section className={cx(cardClass, 'h-full p-[20px]')} aria-label="Time on Prepzy this week">
        <h2 className={sectionTitle}>TIME ON PREPZY - THIS WEEK</h2>
        <SectionState loading={isPending} error={isError} />
        {data && (
          <div className="mt-[20px]">
            <WeekChart graph={data.graph} />
          </div>
        )}
      </section>
      <section className={cx(cardClass, 'h-full p-[16px]')} aria-label="Study engagement">
        <h2 className={sectionTitle}>STUDY ENGAGEMENT</h2>
        <SectionState loading={isPending} error={isError} />
        {data && (
          <div className="mt-[20px] flex flex-col gap-[20px]">
            <EngagementRow label="This Week" value={formatMinutes(e?.weekMinutes ?? 0)} caption="total time" />
            <EngagementRow
              label="Total Since Joining"
              value={formatMinutes(e?.totalMinutes ?? 0)}
              caption="lifetime on prepzy"
            />
            <EngagementRow
              label="Avg / Active Day"
              value={formatMinutes(e?.avgMinutesPerActiveDay ?? 0)}
              caption="this week"
            />
          </div>
        )}
      </section>
    </div>
  );
}

function ActivityCard({
  title,
  icon,
  total,
  topClass,
  totalClass,
  loading,
  error,
  children,
}: {
  title: string;
  icon: ReactNode;
  total: number | undefined;
  topClass: string;
  totalClass: string;
  loading: boolean;
  error: boolean;
  children?: ReactNode;
}) {
  return (
    <section className={cx(cardClass, 'border-t-[6px] p-[16px]', topClass)} aria-label={title}>
      <div className="mb-[10px] flex items-start justify-between">
        <div className="flex flex-col gap-[4px]">
          {icon}
          <h3 className="text-neutral-900 text-[16px]/[24px] font-bold">{title}</h3>
        </div>
        <span className={cx('text-[28px] leading-none font-bold', totalClass)}>{total}</span>
      </div>
      <SectionState loading={loading} error={error} />
      {children}
    </section>
  );
}

/** Stacked share bar + "Name: count" legend. */
function ShareBar({ items }: { items: (CountItem & { fill: string })[] }) {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  return (
    <>
      <div className="mb-[10px] flex h-[6px] w-full overflow-hidden rounded-full">
        {items.map((s) => (
          <div key={s.id} style={{ width: share(s.count, total), backgroundColor: s.fill }} />
        ))}
      </div>
      <ul className="mb-[16px] flex flex-wrap gap-x-[12px] gap-y-[4px]">
        {items.map((s) => (
          <li key={s.id} className="flex items-center gap-[5px]">
            <span aria-hidden className="inline-block size-[10px] rounded-[2px]" style={{ backgroundColor: s.fill }} />
            <span className="text-neutral-900 text-[12px]/[16px]">
              {s.name}: <span className="font-semibold">{s.count}</span>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

function ScoreRow({ label, value, width, color }: { label: string; value: string; width: string; color: string }) {
  return (
    <div className="flex flex-col gap-[6px]">
      <div className="flex items-center justify-between">
        <span className="text-neutral-900 text-[13px]/[22px]">{label}</span>
        <span className="text-[13px]/[22px] font-bold" style={{ color }}>
          {value}
        </span>
      </div>
      <div className="bg-neutral-100 h-[5px] w-full overflow-hidden rounded-full">
        <div className="h-full rounded-full" style={{ width, backgroundColor: color }} />
      </div>
    </div>
  );
}

const withFill = (items: CountItem[]) => items.map((item, i) => ({ ...item, fill: item.color ?? colorAt(i) }));

function VideoIcon() {
  return (
    <svg aria-hidden width="30" height="30" viewBox="0 0 32 32" fill="none">
      <path d="M27 4H5a3 3 0 0 0-3 3v18a3 3 0 0 0 3 3h22a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3Z" className="fill-plan-rose-deep" />
      <path d="M5 4a3 3 0 0 0-3 3v18a3 3 0 0 0 3 3h11V4H5Z" className="fill-danger-450" />
      <path d="M25 24H7a1 1 0 1 1 0-2h18a1 1 0 1 1 0 2Z" className="fill-neutral-100" />
      <path d="M19 25a1 1 0 0 1-1-1v-2a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1Z" className="fill-neutral-100" />
      <path
        d="M20.45 12.67l-7-3.5A1 1 0 0 0 12 10.06v7.88a1 1 0 0 0 1.53.85l7-4.38a1 1 0 0 0-.08-1.74Z"
        className="fill-neutral-100"
      />
    </svg>
  );
}

function DoubtIcon() {
  return (
    <svg aria-hidden width="30" height="30" viewBox="0 0 39 39" className="fill-success-450">
      <path d="M33.17 33.88V39H5.7v-5.13c0-1.9 1.64-4.24 3.65-5.19l4.46-2.12 3.1 6.45 1.58-4.3c.31.06.62.14.95.14.32 0 .63-.08.95-.14l1.5 4.09 3.03-6.31 4.6 2.19c2-.95 3.65 1.4 3.65 3.3ZM19.44 26.49c3.92 0 7.1-4.88 7.1-9.35 0-4.47-3.18-6.84-7.1-6.84-3.92 0-7.1 2.37-7.1 6.84 0 4.47 3.18 9.35 7.1 9.35Z" />
      <circle cx="30.5" cy="11" r="2.2" />
      <circle cx="7.6" cy="12" r="1.8" />
      <circle cx="19" cy="4" r="2.4" />
    </svg>
  );
}

function TestIcon() {
  return (
    <svg aria-hidden width="30" height="30" viewBox="0 0 48 48" fill="none" className="fill-success-100 stroke-success-450">
      <path d="M38 38a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4V10a4 4 0 0 1 4-4h14l10 10v22Z" strokeWidth="1" />
      <path d="M15 33h18M15 37h12M20 17l-5 12M20 17l5 12M17 26h6M30 23v6M27 26h6" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function LecturesCard(query: StudentQuery) {
  const { data, isPending, isError } = useLectures(query);
  return (
    <ActivityCard
      title="AI Video Lectures"
      icon={<VideoIcon />}
      total={data?.total}
      topClass="border-t-brand-700"
      totalClass="text-brand-700"
      loading={isPending}
      error={isError}
    >
      {data && (
        <>
          <ShareBar items={withFill(data.subjects)} />
          <p className={smallCaps}>Chapters Covered</p>
          <ul className="flex flex-wrap gap-[8px]">
            {data.chapters.map((chapter) => (
              <li
                key={chapter}
                className="text-neutral-900 border-schools-line bg-schools-faint rounded-[6px] border px-[10px] py-[4px] text-[12px]/[22px] font-medium"
              >
                {chapter}
              </li>
            ))}
          </ul>
        </>
      )}
    </ActivityCard>
  );
}

export function DoubtsCard(query: StudentQuery) {
  const { data, isPending, isError } = useDoubts(query);
  return (
    <ActivityCard
      title="Doubts Resolved"
      icon={<DoubtIcon />}
      total={data?.total}
      topClass="border-t-schools-orange"
      totalClass="text-schools-orange"
      loading={isPending}
      error={isError}
    >
      {data && (
        <>
          <ShareBar items={withFill(data.subjects)} />
          <p className={cx(smallCaps, 'mt-[10px]')}>Chatbot wise data</p>
          {withFill(data.categories).map((c) => (
            <ScoreRow key={c.id} label={c.name} value={String(c.count)} width={`${Math.min(100, c.count)}%`} color={c.fill} />
          ))}
        </>
      )}
    </ActivityCard>
  );
}

export function AssessmentsCard(query: StudentQuery) {
  const { data, isPending, isError } = useAssessments(query);
  return (
    <ActivityCard
      title="Tests & Assessments ( With Avg Score )"
      icon={<TestIcon />}
      total={data?.total}
      topClass="border-t-brand-700"
      totalClass="text-schools-orange"
      loading={isPending}
      error={isError}
    >
      {data && (
        <div className="flex flex-col gap-[14px]">
          {data.categories.map((c, i) => (
            <ScoreRow
              key={c.label}
              label={`${c.label} (${c.count})`}
              value={`${c.percentage}%`}
              width={`${Math.min(100, c.percentage)}%`}
              color={colorAt(i)}
            />
          ))}
        </div>
      )}
    </ActivityCard>
  );
}
