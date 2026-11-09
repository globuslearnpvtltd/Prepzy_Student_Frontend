'use client';

import { cx } from '@prepzy/design-system';
import Link from 'next/link';
import { useState, type ComponentType } from 'react';
import type { School, SchoolClass } from '../api';
import { useClassStats, useClassStudents, useFeatureUsage, useSchool } from '../hooks';
import { schoolsRoutes } from '../model';
import { ClockIcon, DoubtIcon, ExamIcon, StudentsIcon, ThunderIcon, VideoIcon } from './icons';
import { LoadError, Panel, PanelTitle } from './schools-kit';

type ClassQuery = { classId: number; institutionId: number };
const show = (value: number | undefined) => (value === undefined ? '' : value);

function SchoolBanner({ school }: { school: School | undefined | null }) {
  return (
    <div className="bg-brand-700 border-schools-line shadow-schools-card flex flex-col gap-3 rounded-[10px] border p-[16px] md:flex-row md:items-center md:justify-between">
      <h1 className="text-neutral-0 m-0 text-[24px] leading-[36px] font-bold">
        {school ? [school.name, school.address].filter(Boolean).join(', ') : ' '}
      </h1>
      {school && (
        <div className="flex shrink-0 items-center gap-[10px]">
          <p className="bg-schools-peach text-brand-700 border-schools-line m-0 rounded-[16px] border px-[10px] py-[6px] text-[12px] leading-[18px] font-medium">
            {school.studentCount} Students
          </p>
          <p className="bg-brand-700 text-neutral-0 border-schools-line m-0 rounded-[16px] border px-[10px] py-[6px] text-[12px] leading-[18px] font-medium">
            {school.classCount} Classes
          </p>
        </div>
      )}
    </div>
  );
}

function ClassPicker({
  classes,
  selected,
  onSelect,
}: {
  classes: SchoolClass[];
  selected: SchoolClass | null;
  onSelect: (c: SchoolClass) => void;
}) {
  if (classes.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-[10px]" role="group" aria-label="Classes">
      {classes.map((c) => {
        const active = selected?.id === c.id;
        return (
          <button
            key={c.id}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(c)}
            className={cx(
              'border-schools-line m-0 rounded-[16px] border px-[10px] py-[6px] text-[12px] leading-[18px] font-medium',
              active ? 'bg-brand-700 text-neutral-0' : 'bg-neutral-0 text-brand-700',
            )}
          >
            {c.name} {c.stream}
          </button>
        );
      })}
    </div>
  );
}

function StatCard({
  title,
  value,
  valueClass,
  caption,
  Icon,
}: {
  title: string;
  value: string | number;
  valueClass: string;
  caption: string;
  Icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Panel className="flex h-full items-center justify-between p-[20px]">
      <div className="flex flex-col gap-[10px]">
        <PanelTitle as="h3">{title}</PanelTitle>
        <p className={cx('m-0 text-[24px] leading-[24px] font-bold', valueClass)}>{value}</p>
        <p className="text-brand-700 m-0 text-[12px] leading-[12px] font-medium">{caption}</p>
      </div>
      <Icon className="h-[40px] w-[40px] shrink-0" />
    </Panel>
  );
}

function ClassStats({ query, selected }: { query: ClassQuery; selected: SchoolClass }) {
  const { data, error } = useClassStats(query);
  if (error) return <LoadError error={error} label="class activity" />;
  return (
    <section aria-label="Class activity" className="grid gap-[20px] md:grid-cols-3">
      <StatCard
        title="TOTAL STUDENTS"
        value={show(data?.studentCount)}
        valueClass="text-schools-green"
        caption={`students joined in ${selected.name} ${selected.stream}`}
        Icon={StudentsIcon}
      />
      <StatCard
        title="WEEKLY ENGAGEMENT RATE"
        value={show(data?.activeStudents)}
        valueClass="text-brand-700"
        caption="students active this week"
        Icon={ThunderIcon}
      />
      <StatCard
        title="WEEKLY LEARNING HOURS"
        value={data ? `${data.totalHours} Hours` : ''}
        valueClass="text-schools-hours"
        caption="students interacted with prepzy this week"
        Icon={ClockIcon}
      />
    </section>
  );
}

const FEATURES = [
  { key: 'exams', label: 'Exams', Icon: ExamIcon, tone: 'text-schools-green' },
  { key: 'doubts', label: 'Doubts', Icon: DoubtIcon, tone: 'text-schools-hours' },
  { key: 'lectures', label: 'Video Lectures', Icon: VideoIcon, tone: 'text-schools-green' },
  { key: 'doubtSolverChats', label: 'Step by step doubt solved', Icon: ExamIcon, tone: 'text-schools-green' },
  { key: 'customExams', label: 'Custom Topic Exams', Icon: ExamIcon, tone: 'text-schools-green' },
  { key: 'postAssessmentChats', label: 'Post Assessments Interaction', Icon: DoubtIcon, tone: 'text-schools-hours' },
] as const;

function FeatureUsagePanel({ query }: { query: ClassQuery | null }) {
  const { data, error } = useFeatureUsage(query);
  return (
    <Panel className="h-full p-[20px]">
      <PanelTitle>AVG FEATURE USAGE PER STUDENT</PanelTitle>
      {error ? (
        <div className="mt-[20px]">
          <LoadError error={error} label="feature usage" />
        </div>
      ) : (
        <ul className="border-schools-line mt-[20px] grid grid-cols-2 gap-[20px] border-b-2 pb-[20px]">
          {FEATURES.map(({ key, label, Icon, tone }) => (
            <li
              key={key}
              className="bg-brand-50 shadow-schools-card flex h-full items-center gap-[10px] rounded-[10px] p-[10px]"
            >
              <Icon className="h-[30px] w-[30px] shrink-0" />
              <div className="flex flex-col gap-[1px]">
                <p className={cx('m-0 text-[20px] leading-[24px] font-bold', tone)}>{show(data?.[key])}</p>
                <p className="text-brand-700 m-0 text-[10px] leading-[12px] font-medium">{label}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function StudentList({ query }: { query: ClassQuery }) {
  const { data, error, isPending } = useClassStudents(query);
  return (
    <Panel className="h-full p-[20px]">
      <PanelTitle>STUDENTS</PanelTitle>
      {error ? (
        <div className="mt-[20px]">
          <LoadError error={error} label="students" />
        </div>
      ) : !isPending && data?.length === 0 ? (
        <p className="text-neutral-550 mt-[20px] text-[12px]">No students in this class yet.</p>
      ) : (
        <ul className="mt-[20px] grid grid-cols-2 gap-[20px] sm:grid-cols-3 lg:grid-cols-5">
          {(data ?? []).map((student) => (
            <li key={student.id}>
              <Link
                href={schoolsRoutes.student(student.id, query.classId)}
                className="border-success-500/27 bg-schools-chip shadow-schools-card flex h-full items-center justify-center gap-[10px] rounded-[10px] border p-[10px]"
              >
                <span className="m-0 w-full truncate text-center text-[12px] leading-[24px] font-semibold text-neutral-900">
                  {student.firstName} {student.lastName}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** Teacher home: school banner, class picker, the class's weekly activity, feature usage and student list. */
export function SchoolsDashboard() {
  const school = useSchool();
  const [picked, setPicked] = useState<SchoolClass | null>(null);
  const classes = school.data?.classes ?? [];
  const selected = (picked && classes.find((c) => c.id === picked.id)) ?? classes[0] ?? null;
  const query = selected && school.data?.id ? { classId: selected.id, institutionId: school.data.id } : null;

  return (
    <main className="mx-auto mt-[40px] mb-[40px] flex max-w-[1440px] flex-col gap-[20px] px-4 md:px-0">
      {school.error ? <LoadError error={school.error} label="your school" /> : <SchoolBanner school={school.data} />}
      <ClassPicker classes={classes} selected={selected} onSelect={setPicked} />
      {query && selected && <ClassStats query={query} selected={selected} />}
      <div className="grid gap-[20px] md:grid-cols-2">
        <FeatureUsagePanel query={query} />
        {query && <StudentList query={query} />}
      </div>
      {school.isSuccess && classes.length === 0 && (
        <p className="text-neutral-550 text-[12px]">No classes are linked to your school yet.</p>
      )}
    </main>
  );
}
