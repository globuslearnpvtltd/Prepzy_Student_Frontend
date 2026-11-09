'use client';

import { cx } from '@prepzy/design-system';
import { ArrowLeft, ArrowRight, BookMarked, CalendarDays, Check, ChevronRight, Clock } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { routes } from '@/shared/config/routes';
import {
  dayDots,
  formatDailyTime,
  formatDayHeading,
  formatFinishDate,
  initialDate,
  monthCells,
  monthLabel,
  planPercent,
  taskHref,
  toIso,
  toSentenceCase,
  type PlanDay,
  type PlanTask,
} from '../api';
import { saveReturnDate, takeReturnDate } from '../draft-store';
import { useClassContext, useCompleteDay, useDayTasks, usePlan, useSetTask } from '../hooks';
import { Notice, ScreenLoader } from './kit';

const STATUS_NOTE: Record<string, string> = {
  completed: 'You finished this plan. Take a new diagnostic test to build your next one.',
  abandoned: 'You stopped this plan. Take a new diagnostic test to build your next one.',
  superseded: 'This plan was replaced when you built a newer one from a more recent diagnostic test.',
};

const card = 'border-neutral-150 bg-surface rounded-2xl border shadow-[0px_4px_20px_rgba(0,0,0,0.06)]';

function StatTiles({ chapters, days, minutes }: { chapters: number; days: number; minutes: number }) {
  const tiles = [
    { label: 'Chapters', value: String(chapters), Icon: BookMarked, amber: false },
    { label: 'Study days', value: String(days), Icon: CalendarDays, amber: true },
    { label: 'Daily Time', value: formatDailyTime(minutes), Icon: Clock, amber: false },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
      {tiles.map(({ label, value, Icon, amber }, index) => (
        <div
          key={label}
          className={cx(
            'border-neutral-150 bg-surface flex flex-col gap-3 rounded-xl border p-5 shadow-[0px_8px_24px_rgba(16,24,40,0.05)]',
            index === 2 && 'col-span-2 md:col-span-1',
          )}
        >
          <div className="flex flex-col-reverse items-start gap-2 md:h-10 md:flex-row md:items-center md:justify-between md:gap-0">
            <span className="text-[14px] leading-5 font-semibold text-neutral-500 uppercase md:text-[13px] md:tracking-[0.5px] md:text-neutral-800">{label}</span>
            <span className={cx('flex size-10 shrink-0 items-center justify-center rounded-md', amber ? 'bg-accent-50' : 'bg-brand-50')}>
              <Icon aria-hidden className={cx('size-5', amber ? 'text-accent-400' : 'text-brand')} />
            </span>
          </div>
          <span className="text-[24px] leading-8 font-bold text-neutral-800 md:text-[32px] md:leading-[48px]">{value}</span>
        </div>
      ))}
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-[5px] md:gap-2">
      <span className={cx('size-2 rounded-full', className)} />
      <span className="text-[10px] leading-[15px] text-neutral-500 md:text-[12px] md:font-medium md:text-neutral-900">{label}</span>
    </span>
  );
}

const DOT = { done: 'bg-success-400', started: 'bg-accent-400', scheduled: 'bg-brand' } as const;

export function MonthCalendar({ days, selected, onSelect }: { days: PlanDay[]; selected: string; onSelect: (iso: string) => void }) {
  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  const [view, setView] = useState(() => {
    const [y, m] = selected.split('-').map(Number);
    return y! * 12 + (m! - 1);
  });
  const range = useMemo(() => {
    const dates = days.map((d) => d.date).sort();
    const index = (iso: string) => Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1;
    return dates.length ? { first: index(dates[0]!), last: index(dates[dates.length - 1]!) } : null;
  }, [days]);
  const year = Math.floor(view / 12);
  const month = view % 12;
  const today = toIso(new Date());
  const percent = planPercent(days);

  return (
    <div className={cx(card, 'flex w-full flex-col gap-3 rounded-2xl p-6 md:gap-4 xl:w-[670px] xl:shrink-0')}>
      <div className="flex items-center justify-between gap-3 md:items-start md:gap-4">
        <div className="flex flex-col md:gap-[6px]">
          <span className="text-[18px] leading-[27px] font-bold text-neutral-900">{monthLabel(year, month)}</span>
          <span className="hidden text-[12px] leading-[18px] text-neutral-900/70 md:block">Pick a day to see planned study time and tasks</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {[
            { label: 'Previous month', Icon: ArrowLeft, by: -1, disabled: !!range && view <= range.first },
            { label: 'Next month', Icon: ArrowRight, by: 1, disabled: !!range && view >= range.last },
          ].map(({ label, Icon, by, disabled }) => (
            <button
              key={label}
              type="button"
              aria-label={label}
              disabled={disabled}
              onClick={() => setView((v) => v + by)}
              className="flex size-8 items-center justify-center rounded-[10px] bg-neutral-50 p-2 hover:enabled:opacity-75 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Icon aria-hidden className="size-4 text-neutral-900" />
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-[6px]">
        <div className="flex items-center justify-between text-[11px] leading-[17px]">
          <span className="font-semibold text-neutral-900/60">Monthly Study Plan</span>
          <span className="text-brand font-bold">{percent}%</span>
        </div>
        <div className="bg-brand-175 h-[6px] w-full overflow-hidden rounded-full" role="progressbar" aria-label="Plan progress" aria-valuenow={percent}>
          <div className="bg-brand h-full rounded-full" style={{ width: `${percent}%` }} />
        </div>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <span key={d} className="text-center text-[11px] leading-[17px] font-bold text-neutral-900/60">
            <span className="md:hidden">{d[0]}</span>
            <span className="hidden md:inline">{d}</span>
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {monthCells(year, month).map((day, i) => {
          if (day === null) return <span key={i} aria-hidden />;
          const iso = toIso(new Date(year, month, day));
          const planDay = byDate.get(iso);
          const isSelected = iso === selected;
          const isToday = iso === today;
          return (
            <button
              key={i}
              type="button"
              disabled={!planDay}
              onClick={() => onSelect(iso)}
              aria-pressed={isSelected}
              aria-label={iso}
              className={cx(
                'flex h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-[4px] border md:h-[62px] md:rounded-md',
                isSelected ? 'bg-brand border-transparent' : isToday ? 'bg-brand-75 border-brand-300' : 'border-transparent bg-neutral-50',
              )}
            >
              <span className={cx('text-[14px] leading-[21px] font-medium', isSelected ? 'text-on-brand' : 'text-neutral-900')}>{day}</span>
              {planDay &&
                (planDay.isRestDay ? (
                  <span className={cx('bg-brand-150 size-1 rounded-full border md:size-[5px]', isSelected ? 'border-on-brand' : 'border-brand')} />
                ) : (
                  <span className="flex items-center gap-px md:gap-[2px]">
                    {dayDots(planDay).map((dot, n) => (
                      <span key={n} className={cx('size-1 rounded-full md:size-[5px]', dot === 'scheduled' && isSelected ? 'bg-on-brand' : DOT[dot])} />
                    ))}
                  </span>
                ))}
              {planDay && !planDay.isRestDay && (
                <span className={cx('hidden text-[9px] leading-[14px] font-medium md:block', isSelected ? 'text-on-brand' : 'text-neutral-900/50')}>
                  {planDay.totalMinutes}m
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="bg-neutral-150 h-px w-full md:hidden" />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 md:gap-4">
        <Legend className="bg-brand" label="Scheduled task" />
        <Legend className="bg-accent-400" label="Halfway check" />
        <Legend className="bg-success-400" label="Completed task" />
        <Legend className="bg-brand-150 border-brand border" label="Rest day" />
      </div>
    </div>
  );
}

const PILL = {
  completed: { label: 'Completed', className: 'bg-success-50 border-success-100 text-success-400' },
  in_progress: { label: 'In progress', className: 'bg-accent-50 border-accent-100 text-accent-400' },
  todo: { label: 'To do', className: 'bg-neutral-100/50 border-neutral-150/50 text-neutral-450' },
} as const;

function taskTitle(task: PlanTask) {
  if (task.code === 'DS') return { title: 'Solve Doubts with Socrates', caption: 'Solve doubt problems with help of Socrates', captionFirst: false };
  return { title: task.title ? `${task.label} · ${toSentenceCase(task.title)}` : task.label, caption: task.subjectTitle ?? task.label, captionFirst: true };
}

function TaskRow({ task, href, onToggle, onOpen }: { task: PlanTask; href: string | null; onToggle: () => void; onOpen: () => void }) {
  const { title, caption, captionFirst } = taskTitle(task);
  const pill = PILL[task.status];
  const captionEl = <span className="truncate text-[12px] leading-[18px] text-neutral-900/50 md:text-[13px] md:leading-5">{caption}</span>;
  const text = (
    <span className="flex min-w-0 flex-1 flex-col gap-[2px] text-left">
      {captionFirst && captionEl}
      <span className={cx('text-[12px] leading-[18px] font-semibold text-neutral-900 md:text-[14px] md:leading-[21px]', task.isCompleted && 'line-through', href && 'group-hover:underline')}>
        {title}
      </span>
      {!captionFirst && captionEl}
    </span>
  );
  return (
    <div className="flex items-center gap-3 rounded-md bg-neutral-50 px-5 py-[10px] md:p-5">
      <button
        type="button"
        role="checkbox"
        aria-checked={task.isCompleted}
        aria-label={`Mark ${title} ${task.isCompleted ? 'not done' : 'done'}`}
        onClick={onToggle}
        className={cx('border-brand flex size-6 shrink-0 items-center justify-center rounded-[6px] border-2', task.isCompleted ? 'bg-brand' : 'bg-transparent')}
      >
        {task.isCompleted && <Check aria-hidden className="text-on-brand size-[14px]" strokeWidth={3} />}
      </button>
      {href ? (
        <button type="button" onClick={onOpen} className="group flex min-w-0 flex-1 items-center gap-[6px]">
          {text}
          <ChevronRight aria-hidden className="size-4 shrink-0 text-neutral-900/50" />
        </button>
      ) : (
        text
      )}
      <span className={cx('flex h-[30px] shrink-0 items-center rounded-full border px-[10px] text-[12px] leading-[18px] font-semibold', pill.className)}>{pill.label}</span>
    </div>
  );
}

function DayPanel({ classId, planId, date, day, examSlug }: { classId: number; planId: number; date: string; day: PlanDay | null; examSlug: string }) {
  const tasks = useDayTasks(planId, date);
  const setTask = useSetTask(classId, planId, date);
  const completeDay = useCompleteDay(classId, planId, date);
  const list = tasks.data ?? [];
  const isRest = !!day?.isRestDay;
  const done = !!day?.isCompleted || (list.length > 0 && list.every((t) => t.isCompleted));
  const canComplete = !isRest && list.length > 0 && !done && !tasks.isFetching;

  const open = (task: PlanTask) => {
    const href = taskHref(examSlug, task);
    if (!href) return;
    saveReturnDate(date);
    window.open(href, '_blank', 'noopener');
    if (task.status === 'todo') setTask.mutate({ taskId: task.id, status: 'in_progress' });
  };
  const message = (text: string) => (
    <div className="flex min-h-[180px] items-center justify-center rounded-md bg-neutral-50 p-5 text-center text-[13px] leading-5 font-medium text-neutral-900/50">{text}</div>
  );

  return (
    <div className="border-neutral-150 bg-surface flex h-full w-full flex-col gap-3 rounded-2xl border p-6 shadow-[0px_12px_32px_rgba(16,24,40,0.05)]">
      <div className="flex flex-col items-start gap-1">
        <span className="bg-brand-50 text-brand rounded-[10px] px-[14px] py-2 text-[12px] leading-[18px] font-bold">Selected Date Tasks</span>
        <h2 className="text-[18px] leading-[27px] font-bold text-neutral-900">{formatDayHeading(date)}</h2>
      </div>
      <div className="flex min-h-[180px] flex-1 flex-col gap-3 overflow-y-auto md:pr-[10px] xl:min-h-0" aria-busy={tasks.isPending}>
        {tasks.isPending
          ? message('Loading tasks…')
          : isRest
            ? message('Rest day — nothing scheduled. Take the break; the plan accounts for it.')
            : list.length === 0
              ? message('No tasks scheduled for this day.')
              : list.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    href={taskHref(examSlug, task)}
                    onOpen={() => open(task)}
                    onToggle={() =>
                      setTask.mutate({ taskId: task.id, status: task.isCompleted ? (task.isStarted ? 'in_progress' : 'todo') : 'completed' })
                    }
                  />
                ))}
      </div>
      <button
        type="button"
        disabled={!canComplete || completeDay.isPending}
        onClick={() => day && completeDay.mutate(day.dayId)}
        className={cx(
          'text-on-brand flex h-[52px] w-full items-center justify-center rounded-[14px] px-5 text-[16px] font-bold disabled:cursor-not-allowed',
          canComplete ? 'bg-brand shadow-[0px_8px_20px_rgba(61,52,139,0.12)] hover:opacity-90' : 'bg-brand-300',
        )}
      >
        {done ? 'Day completed' : 'Mark Day as Completed'}
      </button>
    </div>
  );
}

/** "Your Study Plan at a Glance": stats, month calendar and the selected day's tasks. */
export function StudyPlanScreen() {
  const { exam, classId, isPending: classPending } = useClassContext();
  const plan = usePlan(classId);
  const [selected, setSelected] = useState<string | null>(null);
  const days = useMemo(() => plan.data?.days ?? [], [plan.data]);

  useEffect(() => {
    if (plan.data && selected === null) setSelected(initialDate(plan.data.days, toIso(new Date()), takeReturnDate()));
  }, [plan.data, selected]);

  if (!classPending && !classId) return <Notice title="No active class" body="Pick a class from the sidebar to see your study plan." />;
  if (classPending || plan.isPending) return <ScreenLoader message="Loading Your Study Plan" sub="Pulling together your schedule..." />;
  if (plan.isError) return <Notice title="Couldn't load your plan" body="We couldn't load your study plan." action={{ label: 'Try again', onClick: () => plan.refetch() }} />;
  const header = plan.data.plan;
  if (!header || !exam)
    return (
      <Notice
        title="No study plan yet"
        body="Build a plan from your diagnostic results and it will show up here."
        action={{ label: 'Build my study plan', href: routes.studyPlanChapters(exam?.slug ?? '') }}
      />
    );
  const date = selected ?? initialDate(days, toIso(new Date()));
  const day = days.find((d) => d.date === date) ?? null;

  return (
    <div className="flex flex-col gap-4 md:gap-6 md:p-3">
      <div className="flex flex-col pb-1 md:gap-[6px] md:pb-0">
        <h1 className="text-[32px] leading-[42px] font-bold text-neutral-900 md:text-[28px] md:leading-6">Your Study Plan at a Glance</h1>
        <p className="text-[16px] leading-6 text-neutral-900/70 md:text-[15px] md:text-neutral-500">
          Custom study map curated by <span className="font-bold">Atlas AI</span> to finish by {formatFinishDate(header.targetDate)}.
        </p>
      </div>
      {STATUS_NOTE[header.status] && (
        <div className="bg-accent-50 border-accent-400 text-accent-800 rounded-md border px-4 py-3 text-[13px] leading-[18px] font-medium">{STATUS_NOTE[header.status]}</div>
      )}
      <StatTiles chapters={header.chapterCount} days={header.totalDays} minutes={header.dailyMinutes} />
      <div className="flex flex-col gap-4 md:gap-6 xl:flex-row xl:items-stretch">
        <MonthCalendar days={days} selected={date} onSelect={setSelected} />
        <div className="flex min-w-0 flex-1 xl:relative">
          <div className="flex w-full xl:absolute xl:inset-0">
            <DayPanel classId={classId!} planId={header.planId} date={date} day={day} examSlug={exam.slug} />
          </div>
        </div>
      </div>
    </div>
  );
}
