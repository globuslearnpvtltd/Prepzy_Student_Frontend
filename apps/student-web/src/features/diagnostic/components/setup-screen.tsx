'use client';

import { cx } from '@prepzy/design-system';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowRight, BookOpen, Check, ChevronDown, ClipboardList, Clock, Info, Layers, Lightbulb, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { modulesOf, toSentenceCase, useClassContext, useSyllabus, type DiagnosticRules, type SyllabusSubject } from '@/features/study-plan';
import { BackButton, Breadcrumb, Notice, ProgressRing, ScreenLoader, stickyFooter } from '@/features/study-plan/ui';
import { routes } from '@/shared/config/routes';
import { isApiError, userMessage } from '@/shared/lib/errors';
import { diagnosticApi, formatDuration } from '../api';

const STEPS = ['Select Topics', 'Review Blueprint', 'Take Test'];

export function Stepper({ current, onBack, backHref }: { current: 1 | 2 | 3; onBack?: () => void; backHref?: string }) {
  return (
    <div className="border-neutral-150 flex w-full items-center justify-between gap-4 md:h-20 md:rounded-2xl md:border md:bg-surface md:p-5 md:shadow-[0px_18px_44px_rgba(61,52,139,0.06)]">
      <BackButton onClick={onBack} href={backHref} />
      <ol className="flex min-w-0 items-center gap-2 overflow-x-auto md:gap-4">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const lit = current >= n;
          return (
            <li key={label} className="flex shrink-0 items-center gap-2">
              <span className={cx('flex size-7 items-center justify-center rounded-[14px] text-[13px] font-bold tabular-nums md:font-semibold', lit ? 'bg-brand text-on-brand' : 'bg-brand-125 text-neutral-400')}>
                {current > n ? (
                  <>
                    <Check aria-hidden className="size-[14px] md:hidden" />
                    <span className="hidden md:inline">{n}</span>
                  </>
                ) : (
                  n
                )}
              </span>
              <span className={cx('hidden text-[14px] font-semibold whitespace-nowrap md:inline', lit ? 'text-brand' : 'text-neutral-400')}>{label}</span>
              {n < STEPS.length && <span aria-hidden className={cx('ml-2 h-1 w-8 rounded-full md:ml-2', current > n ? 'bg-brand' : 'bg-brand-175')} />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ChapterTile({ name, topics, selected, disabled, selectable, onToggle }: { name: string; topics: number; selected: boolean; disabled: boolean; selectable: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={onToggle}
      className={cx(
        'flex items-center gap-4 rounded-xl border-2 p-5 text-left disabled:cursor-not-allowed disabled:opacity-55',
        selected ? 'border-brand bg-brand-125 shadow-[0px_10px_24px_rgba(61,52,139,0.07)]' : disabled ? 'border-neutral-150 bg-neutral-50' : 'border-neutral-150 bg-surface',
      )}
    >
      <span className={cx('bg-surface text-brand flex size-6 shrink-0 items-center justify-center rounded-[6px] border-[1.5px]', selected ? 'border-brand' : 'border-brand-175')}>
        {selected && <Check aria-hidden className="size-[15px]" strokeWidth={3} />}
      </span>
      <span className="min-w-0">
        <span className={cx('block text-[15px] leading-[1.3] font-semibold', selected ? 'text-brand' : 'text-neutral-800')}>{toSentenceCase(name)}</span>
        <span className="mt-[3px] block text-[12px] text-neutral-350">
          {topics} topics{!selectable && ' · no questions yet'}
        </span>
      </span>
    </button>
  );
}

function ChapterSelection({
  subjects,
  rules,
  selected,
  focusId,
  onToggle,
  onContinue,
  continuing,
}: {
  subjects: SyllabusSubject[];
  rules: DiagnosticRules;
  selected: number[];
  focusId: number | null;
  onToggle: (moduleId: number, subjectId: number) => void;
  onContinue: () => void;
  continuing: boolean;
}) {
  const [activeId, setActiveId] = useState<number | null>(focusId ?? subjects[0]?.id ?? null);
  const [mobileOpen, setMobileOpen] = useState(true);
  const [openCourses, setOpenCourses] = useState<Record<number, boolean>>({});
  const set = useMemo(() => new Set(selected), [selected]);
  const countFor = (subject: SyllabusSubject) => modulesOf(subject).filter((m) => set.has(m.id)).length;
  const active = subjects.find((s) => s.id === activeId) ?? null;
  const atCap = active ? countFor(active) >= rules.maxPerSubject : false;
  const total = subjects.reduce((sum, s) => sum + s.moduleCount, 0);
  const remaining = Math.max(0, rules.minTotal - selected.length);
  const tiles = (subject: SyllabusSubject, modules = modulesOf(subject)) => {
    const cap = countFor(subject) >= rules.maxPerSubject;
    return modules.map((m) => (
      <ChapterTile
        key={m.id}
        name={m.name}
        topics={m.topicCount}
        selectable={m.selectable}
        selected={set.has(m.id)}
        disabled={!m.selectable || (cap && !set.has(m.id))}
        onToggle={() => onToggle(m.id, subject.id)}
      />
    ));
  };

  return (
    <div className="flex w-full flex-col">
      {/* Phones: one accordion per subject */}
      <div className="flex flex-col gap-3 md:hidden">
        <h1 className="mt-4 text-[26px] leading-[1.18] font-bold text-neutral-950">Which chapters have you studied?</h1>
        <p className="text-[14px] text-neutral-500">Choose the chapters you&apos;ve covered so far to help us build your diagnostic test.</p>
        {subjects.map((subject) => {
          const open = mobileOpen && subject.id === activeId;
          return (
            <div key={subject.id} className="border-neutral-150 bg-surface flex flex-col gap-3 rounded-lg border p-5">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => (subject.id === activeId ? setMobileOpen(!mobileOpen) : (setActiveId(subject.id), setMobileOpen(true)))}
                className="flex items-center justify-between gap-3 text-left"
              >
                <span className="flex flex-col">
                  <span className={cx('text-[20px] font-bold', open ? 'text-brand' : 'text-neutral-900')}>{subject.name}</span>
                  <span className="text-[12px] text-neutral-500">
                    {subject.moduleCount} Chapters · {countFor(subject)} selected
                  </span>
                </span>
                <ChevronDown aria-hidden className={cx('text-brand size-5 transition-transform', open && 'rotate-180')} />
              </button>
              {open && <div className="flex flex-col gap-3">{tiles(subject)}</div>}
            </div>
          );
        })}
      </div>

      {/* Desktop: subject list + chapters of the active subject */}
      <div className="hidden w-full flex-col gap-6 md:flex lg:flex-row lg:items-start">
        <aside className="border-neutral-150 bg-surface flex w-full shrink-0 flex-col gap-5 rounded-[28px] border p-6 shadow-[0px_18px_44px_rgba(61,52,139,0.06)] lg:w-[320px]">
          <div>
            <h2 className="text-[20px] leading-[1.25] font-bold text-neutral-950">Select a subject</h2>
            <p className="text-neutral-350 mt-[6px] text-[13px]">Choose one subject to view its chapters</p>
            <span className="bg-brand-50 text-brand mt-[14px] inline-flex items-center gap-[6px] rounded-full px-3 py-[6px] text-[11px] font-semibold">
              <Info aria-hidden className="size-3" /> Min {rules.minTotal} chapters overall
            </span>
          </div>
          <ul className="border-neutral-150 bg-brand-25 flex flex-col gap-4 rounded-xl border p-2">
            {subjects.map((subject) => {
              const count = countFor(subject);
              if (subject.id === activeId)
                return (
                  <li key={subject.id} className="-mx-2">
                    <div className="bg-brand flex min-h-[180px] flex-col gap-3 rounded-lg p-5 shadow-[0px_12px_32px_rgba(61,52,139,0.25)]">
                      <div>
                        <span className="text-on-brand block text-[19px] leading-[1.2] font-bold">{subject.name}</span>
                        <span className="text-on-brand/60 mt-1 block text-[12px]">{subject.moduleCount} chapters</span>
                      </div>
                      <div className="bg-on-brand/10 mt-auto rounded-md p-4">
                        <span className="text-on-brand/55 block text-[10px] font-medium tracking-[0.1em] uppercase">Selected</span>
                        <span className="text-on-brand mt-1 block text-[15px] font-bold">
                          {count} of {rules.maxPerSubject} chapters
                        </span>
                        <span className="bg-on-brand/20 mt-3 block h-[5px] w-full overflow-hidden rounded-full">
                          <span className="bg-surface block h-full rounded-full" style={{ width: `${Math.min(100, (count / rules.maxPerSubject) * 100)}%` }} />
                        </span>
                      </div>
                    </div>
                  </li>
                );
              return (
                <li key={subject.id}>
                  <button type="button" onClick={() => setActiveId(subject.id)} className="border-neutral-150 hover:bg-surface flex w-full flex-col gap-[10px] rounded-lg border p-5 text-left">
                    <span className="text-[17px] font-bold text-neutral-950">{subject.name}</span>
                    <span className="flex items-center justify-between gap-2 text-[11.5px]">
                      <span className="text-neutral-350">{subject.moduleCount} Chapters</span>
                      <span className={cx('font-semibold', count ? 'text-brand' : 'text-neutral-350')}>
                        {count} of {subject.moduleCount} selected
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
        <section className="min-w-0 flex-1">
          <h1 className="text-[26px] leading-[1.18] font-bold tracking-[-0.01em] text-neutral-950 sm:text-[32px]">Which chapters have you studied?</h1>
          <p className="mt-2 text-[14px] text-neutral-500">Choose the chapters you&apos;ve covered so far to help us build your diagnostic test.</p>
          <div className={cx('mt-5 flex items-center gap-[14px] rounded-xl border px-5 py-3', atCap ? 'bg-danger-soft border-danger/20' : 'bg-accent-50 border-accent-100')}>
            <span className={cx('text-on-brand flex size-7 shrink-0 items-center justify-center rounded-full', atCap ? 'bg-danger' : 'bg-accent-400')}>
              <Info aria-hidden className="size-[15px]" />
            </span>
            <div className="min-w-0">
              <p className={cx('text-[16px] leading-6 font-bold', atCap ? 'text-danger' : 'text-accent-800')}>{atCap ? 'Maximum chapter limit reached' : 'Select your prefered chapters'}</p>
              <p className={cx('text-[12.5px]', atCap ? 'text-danger' : 'text-accent-700')}>
                {atCap
                  ? `You can select up to ${rules.maxPerSubject} chapters per subject, unselect one to choose another.`
                  : `Each subject supports up to ${rules.maxPerSubject} chapters, pick the ones you want to focus on first.`}
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-4">
            {active?.courses.map((course) => {
              const open = openCourses[course.id] ?? course.id === active.courses[0]?.id;
              const picked = course.modules.filter((m) => set.has(m.id)).length;
              return (
                <div key={course.id} className="border-neutral-150 bg-surface flex flex-col gap-6 rounded-[28px] border p-7 shadow-[0px_18px_44px_rgba(61,52,139,0.06)]">
                  <button type="button" aria-expanded={open} onClick={() => setOpenCourses({ ...openCourses, [course.id]: !open })} className="flex items-center justify-between gap-4 text-left">
                    <span>
                      <span className="block text-[20px] font-bold text-neutral-950">{course.name}</span>
                      <span className="text-neutral-350 mt-1 block text-[12.5px]">
                        {course.modules.length} chapters
                        {picked > 0 && <span className="text-brand font-semibold"> · {picked} selected</span>}
                      </span>
                    </span>
                    <span className="bg-brand-50 text-brand flex size-8 shrink-0 items-center justify-center rounded-full">
                      <ChevronDown aria-hidden className={cx('size-[17px] transition-transform', open && 'rotate-180')} />
                    </span>
                  </button>
                  {open && <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{tiles(active, course.modules)}</div>}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className={stickyFooter}>
        <div className="flex min-w-0 items-center gap-2 md:gap-[14px]">
          <ProgressRing value={selected.length} progress={selected.length / rules.minTotal} size={48} stroke={4} />
          <div className="flex flex-col">
            <p className="text-[14px] font-bold text-neutral-950 md:text-[16px]">
              {selected.length} {selected.length === 1 ? 'chapter' : 'chapters'} selected
            </p>
            <p className="text-[13px] text-neutral-900/40">{remaining > 0 ? `Select ${remaining} more to continue` : `out of ${String(total).padStart(2, '0')} total`}</p>
          </div>
        </div>
        <button
          type="button"
          disabled={remaining > 0 || continuing}
          onClick={onContinue}
          className="bg-brand text-on-brand flex h-12 shrink-0 items-center gap-2 rounded-[14px] px-6 text-[15px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        >
          {continuing ? 'Loading…' : 'Continue'}
          <ArrowRight aria-hidden className="size-4" />
        </button>
      </div>
    </div>
  );
}

function StatTile({ icon, value, label }: { icon: ReactNode; value: string | number; label: string }) {
  return (
    <div className="border-brand-175 bg-surface flex flex-col items-center justify-center gap-3 rounded-lg border p-4 text-center md:gap-2 md:border-neutral-150 md:px-3 md:py-5">
      <span className="bg-brand-50 text-brand flex size-10 items-center justify-center rounded-md md:size-8">{icon}</span>
      <span className="text-[18px] font-bold text-neutral-950">{value}</span>
      <span className="text-[12px] font-medium text-neutral-900/60 md:text-[11px] md:text-neutral-350">{label}</span>
    </div>
  );
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

function BlueprintReview({
  subjects,
  selected,
  classId,
  onRemove,
  onAdd,
  onStart,
  starting,
  error,
}: {
  subjects: SyllabusSubject[];
  selected: number[];
  classId: number;
  onRemove: (id: number) => void;
  onAdd: (subjectId: number) => void;
  onStart: () => void;
  starting: boolean;
  error: string | null;
}) {
  const blueprint = useQuery({
    queryKey: ['diagnostic', 'blueprint', classId, selected],
    queryFn: () => diagnosticApi.blueprint(classId, selected),
    placeholderData: (previous) => previous,
  });
  const grouped = subjects
    .map((subject) => ({ subject, modules: modulesOf(subject).filter((m) => selected.includes(m.id)) }))
    .filter((g) => g.modules.length > 0);
  const bp = blueprint.data;
  const canStart = !!bp?.isValid && !starting;

  return (
    <div className="flex w-full flex-col gap-5 md:gap-6 lg:flex-row lg:items-stretch">
      <section className="flex min-w-0 flex-1 flex-col gap-5 md:gap-6">
        {grouped.map(({ subject, modules }) => (
          <div key={subject.id} className="border-neutral-150 bg-surface flex flex-col gap-4 rounded-lg border p-5 md:gap-5 md:rounded-2xl md:p-7 md:shadow-[0px_18px_44px_rgba(61,52,139,0.06)]">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <h2 className="text-[20px] font-bold text-neutral-950">{subject.name}</h2>
                <span className="text-neutral-350 text-[12.5px]">
                  {modules.length} {plural(modules.length, 'chapter', 'chapters')} selected
                </span>
              </div>
              <button type="button" onClick={() => onAdd(subject.id)} className="bg-brand-50 text-brand flex h-10 items-center gap-2 rounded-md px-[18px] text-[13px] font-semibold hover:opacity-80">
                <Plus aria-hidden className="size-[14px]" />
                Add Chapter
              </button>
            </div>
            <div className="flex flex-col gap-3">
              {modules.map((m) => (
                <div key={m.id} className="border-brand-175 flex items-center justify-between gap-4 rounded-lg border bg-neutral-50 px-5 py-[18px]">
                  <div className="flex min-w-0 flex-col gap-[2px]">
                    <span className="truncate text-[14px] font-semibold text-neutral-950">{toSentenceCase(m.name)}</span>
                    <span className="text-neutral-350 text-[12px]">
                      {m.topicCount} core syllabus {plural(m.topicCount, 'topic', 'topics')}
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${toSentenceCase(m.name)}`}
                    onClick={() => onRemove(m.id)}
                    className="hover:text-danger flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-neutral-900/40 bg-neutral-50 text-neutral-600"
                  >
                    <X aria-hidden className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
      <aside className="border-neutral-150 bg-brand-25 flex shrink-0 flex-col justify-between gap-6 rounded-[28px] border p-8 lg:w-[392px]">
        <div className="flex flex-col gap-6">
          <div className="hidden flex-col gap-1 md:flex">
            <h2 className="text-[20px] font-bold text-neutral-950">Diagnostic Blueprint</h2>
            <span className="text-neutral-350 text-[12.5px]">Review your test parameters</span>
          </div>
          {bp ? (
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <StatTile icon={<Clock aria-hidden className="size-[18px]" />} value={formatDuration(bp.durationSeconds)} label="Exam Duration" />
              <StatTile icon={<ClipboardList aria-hidden className="size-[18px]" />} value={bp.totalQuestions} label={plural(bp.totalQuestions, 'MCQ', 'MCQs')} />
              <StatTile icon={<Layers aria-hidden className="size-[18px]" />} value={bp.chapterCount} label={plural(bp.chapterCount, 'Chapter', 'Chapters')} />
              <StatTile icon={<BookOpen aria-hidden className="size-[18px]" />} value={bp.subjectCount} label={plural(bp.subjectCount, 'Subject', 'Subjects')} />
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-neutral-500">{blueprint.isError ? userMessage(blueprint.error) : 'Building your blueprint...'}</p>
          )}
          <div className="bg-accent-50 border-accent-100 flex flex-col gap-4 rounded-2xl border-2 p-5 shadow-[0px_16px_36px_rgba(249,115,22,0.1)]">
            <div className="flex items-center gap-[10px]">
              <span className="bg-accent-100 text-accent-400 flex size-7 items-center justify-center rounded-full">
                <Lightbulb aria-hidden className="size-[15px]" />
              </span>
              <div className="flex flex-col">
                <span className="text-[14px] font-bold text-neutral-950">Atlas AI</span>
                <span className="text-neutral-350 text-[11px]">Your partner to help you stay focused.</span>
              </div>
            </div>
            <p className="text-[12.5px] leading-[1.5] text-neutral-600">Use the timer to pace yourself and leave time to review.</p>
          </div>
          {bp && !bp.isValid && bp.errors.length > 0 && (
            <div role="alert" className="bg-danger-soft border-danger/30 text-danger rounded-lg border p-[14px] text-[13px]">
              {bp.errors.join(' ')}
            </div>
          )}
          {error && (
            <p role="alert" className="text-danger text-sm">
              {error}
            </p>
          )}
        </div>
        <button
          type="button"
          disabled={!canStart}
          onClick={onStart}
          className={cx('text-on-brand flex h-12 w-full items-center justify-center gap-2 rounded-md text-[15px] font-semibold', canStart ? 'bg-brand' : 'bg-neutral-300 cursor-not-allowed')}
        >
          {starting ? 'Starting...' : 'Start Test'}
          {!starting && <ArrowRight aria-hidden className="size-4" />}
        </button>
      </aside>
    </div>
  );
}

/** Diagnostic setup: pick chapters → review the blueprint → start (redirects when a test is running or cooling down). */
export function DiagnosticSetupScreen() {
  const router = useRouter();
  const { exam, classId, isPending } = useClassContext();
  const status = useQuery({ queryKey: ['diagnostic', 'status', classId], queryFn: () => diagnosticApi.status(classId!), enabled: !!classId });
  const syllabus = useSyllabus(classId, exam?.examId ?? 0);
  const [step, setStep] = useState<1 | 2>(1);
  const [selected, setSelected] = useState<number[]>([]);
  const [focusId, setFocusId] = useState<number | null>(null);
  const subjects = useMemo(() => syllabus.data?.subjects ?? [], [syllabus.data]);
  const rules = syllabus.data?.rules ?? { minTotal: 5, maxPerSubject: 5 };
  const slug = exam?.slug ?? '';

  useEffect(() => {
    if (!status.data || !slug) return;
    if (status.data.state === 'in_progress' && status.data.assessmentId) router.replace(routes.diagnosticTest(slug, status.data.assessmentId));
    else if (status.data.state === 'cooldown') router.replace(routes.diagnosticResult(slug));
  }, [status.data, slug, router]);

  useEffect(() => {
    if (step === 2 && selected.length === 0) setStep(1);
  }, [step, selected.length]);

  const subjectOf = useMemo(() => new Map(subjects.flatMap((s) => modulesOf(s).map((m) => [m.id, s.id] as const))), [subjects]);

  const start = useMutation({
    mutationFn: () => diagnosticApi.start(classId!, selected),
    onSuccess: (id) => router.replace(routes.diagnosticTest(slug, id)),
    onError: (error) => {
      if (isApiError(error) && error.status === 429) router.replace(routes.diagnosticResult(slug));
    },
  });

  if (!isPending && !classId) return <Notice title="No active class" body="Pick a class from the sidebar to take your diagnostic test." />;
  if (status.isError || syllabus.isError)
    return (
      <Notice
        tone="danger"
        title="Something went wrong"
        body={userMessage(status.error ?? syllabus.error, "We couldn't load your chapters. Please try again.")}
        action={{ label: 'Back to dashboard', href: routes.dashboard(slug) }}
      />
    );
  if (isPending || status.isPending || syllabus.isPending || status.data.state === 'in_progress' || status.data.state === 'cooldown')
    return <ScreenLoader message="Loading Your Syllabus" sub="Fetching the chapters for your class..." />;
  if (!subjects.length) return <Notice title="No chapters available yet" body="Your class doesn't have diagnostic content set up yet. Please check back soon." />;

  const toggle = (moduleId: number, subjectId: number) =>
    setSelected((prev) => {
      if (prev.includes(moduleId)) return prev.filter((id) => id !== moduleId);
      if (prev.filter((id) => subjectOf.get(id) === subjectId).length >= rules.maxPerSubject) return prev;
      return [...prev, moduleId];
    });

  return (
    <div className="w-full">
      <div className="mb-4 md:mb-6">
        <Stepper current={step} onBack={step === 2 ? () => setStep(1) : undefined} backHref={step === 1 ? routes.dashboard(slug) : undefined} />
      </div>
      <Breadcrumb dashboardHref={routes.dashboard(slug)} current="Diagnostic test" className={cx('md:hidden', step === 2 && 'mb-5')} />
      {step === 1 ? (
        <ChapterSelection subjects={subjects} rules={rules} selected={selected} focusId={focusId} onToggle={toggle} onContinue={() => setStep(2)} continuing={false} />
      ) : (
        <BlueprintReview
          subjects={subjects}
          selected={selected}
          classId={classId!}
          onRemove={(id) => setSelected((prev) => prev.filter((m) => m !== id))}
          onAdd={(subjectId) => {
            setFocusId(subjectId);
            setStep(1);
          }}
          onStart={() => start.mutate()}
          starting={start.isPending}
          error={start.isError && !(isApiError(start.error) && start.error.status === 429) ? userMessage(start.error, "We couldn't start your test. Please try again.") : null}
        />
      )}
    </div>
  );
}
