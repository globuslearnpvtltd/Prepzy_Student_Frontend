'use client';

import { cx } from '@prepzy/design-system';
import type { ReactNode } from 'react';
import type { CountItem } from '../api';
import {
  useAssessmentsSummary,
  useDoubtsSummary,
  useLearningHours,
  useLectureCompletion,
  useStudentProfile,
} from '../hooks';
import {
  buildWeek,
  DOUBT_CATEGORY_SERIES,
  DOUBT_SUBJECT_SERIES,
  formatJoined,
  initials,
  SERIES,
  seriesAt,
  share,
} from '../model';
import { DoubtIcon, ExamIcon, VideoIcon } from './icons';
import { LoadError, Panel, PanelTitle } from './schools-kit';
import { WeekChart } from './week-chart';

type Series = { bg: string; text: string };
type Query = { studentId: string; classId?: string | null };

function StudentCard({ studentId }: { studentId: string }) {
  const { data: student, error } = useStudentProfile(studentId);
  if (error) return <LoadError error={error} label="this student" />;
  const name = student ? `${student.firstName} ${student.lastName}`.trim() : '';
  return (
    <Panel className="flex flex-col gap-3 p-[16px] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-[14px]">
        <div className="bg-schools-pink flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-full">
          <span className="text-neutral-0 text-[16px] font-bold">
            {student ? initials(student.firstName, student.lastName) : ''}
          </span>
        </div>
        <div className="flex flex-col gap-[2px]">
          <h1 className="m-0 text-[18px] leading-[24px] font-bold text-neutral-900">{name || ' '}</h1>
          <p className="text-neutral-550 m-0 text-[13px] leading-[18px]">
            {student ? [student.className, student.school].filter(Boolean).join(' · ') : ' '}
          </p>
        </div>
      </div>
      <p className="m-0 text-[13px] font-semibold text-neutral-900">Since {formatJoined(student?.joinedAt ?? null)}</p>
    </Panel>
  );
}

function EngagementRow({ label, value, caption }: { label: string; value: number | undefined; caption: string }) {
  return (
    <li className="bg-brand-50 shadow-schools-card flex h-full items-center justify-between gap-[10px] rounded-[10px] p-[10px]">
      <p className="m-0 text-[12px] leading-[16px] font-medium text-neutral-900">{label}</p>
      <div className="flex flex-col gap-[1px]">
        <p className="text-brand-700 m-0 text-right text-[16px] leading-[18px] font-bold">{value ?? ''} Min</p>
        <p className="m-0 text-right text-[10px] leading-[12px] font-medium text-neutral-950">{caption}</p>
      </div>
    </li>
  );
}

function LearningHoursSection({ query }: { query: Query }) {
  const { data, error } = useLearningHours(query);
  return (
    <div className="grid gap-[20px] lg:grid-cols-[60%_38%]">
      <Panel className="h-full p-[20px]">
        <PanelTitle>TIME ON PREPZY - THIS WEEK</PanelTitle>
        <div className="mt-[20px] h-[200px] w-full">
          {error ? (
            <LoadError error={error} label="learning hours" />
          ) : (
            <WeekChart days={buildWeek(data?.graph ?? {})} />
          )}
        </div>
      </Panel>
      <Panel className="h-full p-[16px]">
        <PanelTitle>STUDY ENGAGEMENT</PanelTitle>
        <ul className="mt-[20px] flex flex-col gap-[20px]">
          <EngagementRow label="This Week" value={data?.thisWeek} caption="total time" />
          <EngagementRow label="Total Since Joining" value={data?.totalSinceJoining} caption="lifetime on prepzy" />
          <EngagementRow label="Avg / Active Day" value={data?.avgMinutesPerActiveDay} caption="this week" />
        </ul>
      </Panel>
    </div>
  );
}

function ActivityCard({
  accent,
  icon,
  title,
  total,
  totalClass,
  children,
}: {
  accent: string;
  icon: ReactNode;
  title: string;
  total: number | undefined;
  totalClass: string;
  children: ReactNode;
}) {
  return (
    <Panel className={cx('border-t-[6px] p-[16px]', accent)}>
      <div className="mb-[10px] flex items-start justify-between">
        <div className="flex flex-col gap-[4px]">
          {icon}
          <h3 className="m-0 text-[16px] leading-[24px] font-bold text-neutral-900">{title}</h3>
        </div>
        <span className={cx('text-[28px] leading-none font-bold', totalClass)}>{total ?? ''}</span>
      </div>
      {children}
    </Panel>
  );
}

function StackedBar({ items, series }: { items: CountItem[]; series: readonly Series[] }) {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  return (
    <>
      <div className="mb-[10px] flex h-[6px] w-full overflow-hidden rounded-full" aria-hidden="true">
        {items.map((item, i) => (
          <div
            key={`${item.name}-${i}`}
            className={seriesAt(series, i).bg}
            style={{ width: share(item.count, total) }}
          />
        ))}
      </div>
      <ul className="mb-[16px] flex flex-wrap gap-x-[12px] gap-y-[4px]">
        {items.map((item, i) => (
          <li key={`${item.name}-${i}`} className="flex items-center gap-[5px]">
            <span className={cx('inline-block h-[10px] w-[10px] rounded-[2px]', seriesAt(series, i).bg)} />
            <span className="text-[12px] text-neutral-900">
              {item.name}: <span className="font-semibold">{item.count}</span>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

const subHeading = 'm-0 mb-[10px] text-[10px] font-semibold tracking-widest text-neutral-550 uppercase';

function ProgressRow({ label, value, width, tone }: { label: string; value: string; width: string; tone: Series }) {
  return (
    <li className="flex flex-col gap-[6px]">
      <div className="flex items-center justify-between">
        <span className="text-[13px] leading-[22px] text-neutral-900">{label}</span>
        <span className={cx('text-[13px] font-bold', tone.text)}>{value}</span>
      </div>
      <div className="h-[5px] w-full overflow-hidden rounded-full bg-neutral-100">
        <div className={cx('h-full rounded-full', tone.bg)} style={{ width }} />
      </div>
    </li>
  );
}

function LecturesCard({ query }: { query: Query }) {
  const { data, error } = useLectureCompletion(query);
  return (
    <ActivityCard
      accent="border-t-brand-700"
      icon={<VideoIcon className="h-[30px] w-[30px]" />}
      title="AI Video Lectures"
      total={data?.total}
      totalClass="text-brand-700"
    >
      {error ? (
        <LoadError error={error} label="video lectures" />
      ) : (
        <>
          <StackedBar items={data?.subjects ?? []} series={SERIES} />
          <p className={subHeading}>Chapters Covered</p>
          <ul className="flex flex-wrap gap-[8px]">
            {(data?.chapters ?? []).map((chapter) => (
              <li
                key={chapter}
                className="border-schools-line bg-schools-faint rounded-[6px] border px-[10px] py-[4px] text-[12px] font-medium text-neutral-900"
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

function DoubtsCard({ query }: { query: Query }) {
  const { data, error } = useDoubtsSummary(query);
  return (
    <ActivityCard
      accent="border-t-schools-orange"
      icon={<DoubtIcon className="h-[30px] w-[30px]" />}
      title="Doubts Resolved"
      total={data?.total}
      totalClass="text-schools-orange"
    >
      {error ? (
        <LoadError error={error} label="doubts" />
      ) : (
        <>
          <StackedBar items={data?.subjects ?? []} series={DOUBT_SUBJECT_SERIES} />
          <p className={cx(subHeading, 'mt-[10px]')}>Chatbot wise data</p>
          <ul>
            {(data?.categories ?? []).map((category, i) => (
              <ProgressRow
                key={category.name}
                label={category.name}
                value={String(category.count)}
                // As in the previous app, the bar uses the count as a percentage.
                width={`${Math.min(category.count, 100)}%`}
                tone={seriesAt(DOUBT_CATEGORY_SERIES, i)}
              />
            ))}
          </ul>
        </>
      )}
    </ActivityCard>
  );
}

function AssessmentsCard({ query }: { query: Query }) {
  const { data, error } = useAssessmentsSummary(query);
  return (
    <ActivityCard
      accent="border-t-brand-700"
      icon={<ExamIcon className="h-[30px] w-[30px]" />}
      title="Tests & Assessments ( With Avg Score )"
      total={data?.total}
      totalClass="text-schools-orange"
    >
      {error ? (
        <LoadError error={error} label="assessments" />
      ) : (
        <ul className="mt-[2px] flex flex-col gap-[14px]">
          {(data?.categories ?? []).map((category, i) => (
            <ProgressRow
              key={category.name}
              label={`${category.name} (${category.count})`}
              value={`${category.percentage}%`}
              width={`${Math.min(Math.max(category.percentage, 0), 100)}%`}
              tone={seriesAt(SERIES, i)}
            />
          ))}
        </ul>
      )}
    </ActivityCard>
  );
}

/** One student's week: profile, time on Prepzy, study engagement, lectures, doubts and assessments. */
export function SchoolsStudentDetail({ studentId, classId }: { studentId: string; classId?: string | null }) {
  const query = { studentId, classId: classId ?? null };
  return (
    <main className="mx-auto mt-[40px] mb-[40px] flex max-w-[1440px] flex-col gap-[20px] px-4 md:px-0">
      <StudentCard studentId={studentId} />
      <LearningHoursSection query={query} />
      <section aria-labelledby="schools-activity">
        <h2 id="schools-activity" className="text-brand-700 m-0 p-0 text-[12px] leading-[16px] font-bold">
          Prepzy Feature Activity This Week
        </h2>
        <div className="mt-[20px] grid gap-[20px] md:grid-cols-3">
          <LecturesCard query={query} />
          <DoubtsCard query={query} />
          <AssessmentsCard query={query} />
        </div>
      </section>
    </main>
  );
}
