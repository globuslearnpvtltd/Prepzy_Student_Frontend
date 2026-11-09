'use client';

import { cx } from '@prepzy/design-system';
import { Check, ChevronDown, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { routes } from '@/shared/config/routes';
import { modulesOf, toSentenceCase, type SyllabusSubject } from '../api';
import { useStudyPlanDraft } from '../draft-store';
import { useClassContext, useSyllabus } from '../hooks';
import { BackButton, Breadcrumb, Notice, ProgressRing, ScreenLoader, stickyFooter } from './kit';

function ChapterRow({ index, name, topics, selected, onToggle }: { index: number; name: string; topics: number; selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={cx('flex items-center gap-4 rounded-xl border p-4 text-left md:border-brand-175', selected ? 'bg-brand-125 border-brand-175' : 'bg-surface border-neutral-150')}
    >
      <span className={cx('flex size-6 shrink-0 items-center justify-center rounded-full border', selected ? 'border-brand bg-brand' : 'border-brand-175 bg-surface md:border-[1.5px] md:bg-transparent')}>
        {selected && <Check aria-hidden className="text-on-brand size-[14px]" strokeWidth={3} />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[16px] leading-[22px] font-semibold text-neutral-800">
          Chapter {index + 1} · {toSentenceCase(name)}
        </span>
        <span className="hidden text-[13px] leading-[18px] font-medium text-neutral-900/60 md:block">
          {topics} {topics === 1 ? 'topic' : 'topics'}
        </span>
      </span>
      <span className={cx('border-brand-175 bg-surface hidden h-8 shrink-0 items-center rounded-full border px-3 text-[12px] font-semibold md:flex', selected ? 'text-brand' : 'text-neutral-650')}>
        {selected ? 'Selected' : 'Add'}
      </span>
    </button>
  );
}

function SubjectCard({ subject, selected, open, onOpen, onToggle }: { subject: SyllabusSubject; selected: Set<number>; open: boolean; onOpen: () => void; onToggle: (id: number) => void }) {
  const modules = modulesOf(subject);
  const chosen = modules.filter((m) => selected.has(m.id)).length;
  const [courseId, setCourseId] = useState(subject.courses[0]?.id);
  const activeCourse = subject.courses.find((c) => c.id === courseId) ?? subject.courses[0];
  const numberOf = new Map(modules.map((m, i) => [m.id, i]));
  return (
    <div className={cx('border-neutral-150 bg-surface flex flex-col gap-4 rounded-lg border p-5 md:rounded-[28px] md:p-6 md:shadow-[0px_18px_44px_rgba(61,52,139,0.08)]', chosen ? 'md:border-brand' : 'md:border-neutral-150')}>
      <button type="button" onClick={onOpen} aria-expanded={open} className="text-left">
        <span className="flex items-center justify-between gap-4">
          <span className="flex min-w-0 flex-col gap-[6px]">
            <span className={cx('text-[20px] leading-6 font-bold md:text-[24px] md:leading-8', open ? 'text-brand md:text-neutral-800' : 'text-neutral-900 md:text-neutral-800')}>{subject.name}</span>
            <span className="flex items-center gap-[10px]">
              <span className="text-[12px] font-medium text-neutral-900/60 md:text-[14px] md:font-semibold md:text-neutral-350">
                <span className="md:hidden">{modules.length} Chapters</span>
                <span className="hidden md:inline">{modules.length} chapters available</span>
              </span>
              {chosen > 0 && <span className="bg-brand text-on-brand rounded-full px-[10px] py-[2px] text-[12px] font-semibold">{chosen} selected</span>}
            </span>
          </span>
          <span className="border-brand-175 bg-brand-125 text-brand flex size-6 shrink-0 items-center justify-center rounded-full border md:h-10 md:w-auto md:px-3">
            <ChevronDown aria-hidden className={cx('size-4 transition-transform md:size-[18px]', open && 'rotate-180')} />
          </span>
        </span>
      </button>
      {open && (
        <>
          <div className="hidden flex-col gap-3 md:flex">
            {modules.map((m, i) => (
              <ChapterRow key={m.id} index={i} name={m.name} topics={m.topicCount} selected={selected.has(m.id)} onToggle={() => onToggle(m.id)} />
            ))}
          </div>
          <div className="flex flex-col gap-4 md:hidden">
            {subject.courses.length > 1 && (
              <div className="flex flex-wrap gap-3">
                {subject.courses.map((course) => (
                  <button
                    key={course.id}
                    type="button"
                    aria-pressed={course.id === activeCourse?.id}
                    onClick={() => setCourseId(course.id)}
                    className={cx('rounded-full border px-3 py-2 text-[12px] font-semibold', course.id === activeCourse?.id ? 'border-brand-175 bg-brand-125 text-brand' : 'bg-surface border-neutral-100 text-neutral-900')}
                  >
                    {course.name}
                  </button>
                ))}
              </div>
            )}
            {(activeCourse?.modules ?? []).map((m) => (
              <ChapterRow key={m.id} index={numberOf.get(m.id) ?? 0} name={m.name} topics={m.topicCount} selected={selected.has(m.id)} onToggle={() => onToggle(m.id)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** "Choose chapters for your study plan" (after the diagnostic report). */
export function ChaptersScreen() {
  const { exam, classId, isPending } = useClassContext();
  const syllabus = useSyllabus(classId, exam?.examId ?? 0);
  const draft = useStudyPlanDraft();
  const [openId, setOpenId] = useState<number | null>(null);
  const subjects = useMemo(() => syllabus.data?.subjects ?? [], [syllabus.data]);
  const picked = useMemo(() => (draft.classId === classId ? draft.moduleIds : []), [draft.classId, draft.moduleIds, classId]);
  const selected = useMemo(() => new Set(picked), [picked]);

  // Drop chapters that are no longer offered.
  useEffect(() => {
    if (!syllabus.data || !classId) return;
    const shown = new Set(subjects.flatMap((s) => modulesOf(s).map((m) => m.id)));
    const kept = picked.filter((id) => shown.has(id));
    if (kept.length !== picked.length) draft.setDraft(classId, kept);
  }, [syllabus.data, subjects, picked, classId, draft]);

  if (!isPending && !classId) return <Notice title="No active class" body="Pick a class from the sidebar to build a study plan." />;
  if (isPending || syllabus.isPending) return <ScreenLoader message="Loading Your Chapters" sub="Pulling together your syllabus..." />;
  if (syllabus.isError || !exam)
    return (
      <Notice
        title="Couldn't load your chapters"
        body="We couldn't load your chapters. Please try again."
        action={{ label: 'Try again', onClick: () => syllabus.refetch() }}
      />
    );

  const toggle = (id: number) => draft.setDraft(classId, selected.has(id) ? picked.filter((m) => m !== id) : [...picked, id]);
  const total = subjects.reduce((sum, s) => sum + s.moduleCount, 0);
  const count = picked.length;

  return (
    <div className="flex min-h-full w-full flex-col">
      <div className="border-neutral-150 flex items-center justify-between md:h-20 md:rounded-2xl md:border md:bg-surface md:px-5 md:shadow-[0px_16px_40px_rgba(61,52,139,0.08)]">
        <BackButton href={routes.diagnosticResult(exam.slug)} />
      </div>
      <Breadcrumb dashboardHref={routes.dashboard(exam.slug)} current="Study plan" className="mt-4 md:hidden" />
      <div className="flex flex-col py-5 md:gap-[6px] md:py-6">
        <h1 className="text-[32px] leading-[42px] font-bold text-neutral-900 md:text-[40px] md:leading-[48px]">Choose chapters for your study plan</h1>
        <p className="text-[16px] leading-6 text-neutral-900/70">Your study plan will be built from the chapters you choose.</p>
      </div>
      <div className="flex flex-col gap-3">
        {subjects.map((subject) => (
          <SubjectCard
            key={subject.id}
            subject={subject}
            selected={selected}
            open={openId === subject.id}
            onOpen={() => setOpenId(openId === subject.id ? null : subject.id)}
            onToggle={toggle}
          />
        ))}
      </div>
      <div className={stickyFooter}>
        <div className="flex items-center gap-2 md:gap-3">
          <span className="md:hidden">
            <ProgressRing value={count} progress={total ? count / total : 0} size={54} stroke={5.5} />
          </span>
          <span className="hidden md:block">
            <ProgressRing value={count} progress={total ? count / total : 0} size={36} stroke={3} />
          </span>
          <span className="flex flex-col">
            <span className="text-[14px] leading-5 font-bold text-neutral-900 md:text-[16px] md:leading-6 md:text-neutral-800">
              <span className="md:hidden">{count} selected</span>
              <span className="hidden md:inline">
                {count} chapter{count === 1 ? '' : 's'} selected
              </span>
            </span>
            <span className="text-[14px] leading-4 text-neutral-900/40 md:text-[13px] md:leading-5 md:font-medium md:text-neutral-350">
              <span className="md:hidden">out of </span>
              <span className="hidden md:inline">of </span>
              {String(total).padStart(2, '0')} total
            </span>
          </span>
        </div>
        {count > 0 ? (
          <Link
            href={routes.studyPlanCreate(exam.slug)}
            className="bg-brand text-on-brand flex h-12 min-w-[141px] shrink-0 items-center justify-center gap-[6px] rounded-[14px] px-4 text-[16px] font-semibold hover:opacity-90 md:min-w-0 md:px-8 md:text-[15px]"
          >
            <span className="md:hidden">Build Plan</span>
            <span className="hidden md:inline">Build my plan</span>
            <ChevronRight aria-hidden className="size-[18px]" />
          </Link>
        ) : (
          <button type="button" disabled className="bg-brand text-on-brand flex h-12 min-w-[141px] items-center justify-center gap-[6px] rounded-[14px] px-4 text-[16px] font-semibold opacity-50 md:px-8 md:text-[15px]">
            <span className="md:hidden">Build Plan</span>
            <span className="hidden md:inline">Build my plan</span>
            <ChevronRight aria-hidden className="size-[18px]" />
          </button>
        )}
      </div>
    </div>
  );
}
