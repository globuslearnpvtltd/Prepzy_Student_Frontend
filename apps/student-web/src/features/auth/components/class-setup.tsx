'use client';

import { Alert, Skeleton } from '@prepzy/design-system';
import { useQuery } from '@tanstack/react-query';
import { Atom, BookOpen, ChartLine, Check, ChevronLeft, DraftingCompass, FlaskConical, Landmark, type LucideIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ExamConfig } from '@/shared/config/exams';
import { routes } from '@/shared/config/routes';
import { userMessage } from '@/shared/lib/errors';
import { authApi } from '../api';
import type { ClassOption } from '../model';
import { StepDashes, StepLabel } from './onboarding-step';

/**
 * Class setup of a board exam (the previous app's CbseSetupComponent): white top bar with "Step 4", "Your future starts
 * here", class cards grouped Foundation / Secondary · Boards / Senior · Choose stream, and a "Choose your stream" screen
 * for a class with several streams. Any exam whose backend onboarding asks for a class uses it: the classes come from
 * GET …/classes, grouped by the class number in their title (no exam-specific code).
 */

const CLASS_STEP = 4;
const CLASS_STEPS = 4;

export const gradeOf = (title: string) => Number(/\d+/.exec(title)?.[0] ?? NaN);

/** Caption under a class card, by grade (previous app's getClassSubtitle). */
const GRADE_CAPTION: Record<number, string> = {
  6: 'NCERT · practice · Atlas AI',
  7: 'NCERT · practice · Atlas AI',
  8: 'Foundation for 9 & 10',
  9: 'Concept-clear + practice',
  10: 'Board-ready · past papers',
};

/** Subjects, icon and icon colour of a stream (previous app's getStreamMeta, by stream name). */
function streamMeta(streamName: string): { subjects: string; Icon: LucideIcon; tone: string } {
  const s = streamName.toLowerCase();
  if (s.includes('pcmb')) return { subjects: 'Physics · Chemistry · Maths · Biology', Icon: Atom, tone: 'text-brand' };
  if (s.includes('pcm')) return { subjects: 'Physics · Chemistry · Maths', Icon: DraftingCompass, tone: 'text-onboarding-stream-pcm' };
  if (s.includes('pcb')) return { subjects: 'Physics · Chemistry · Biology', Icon: FlaskConical, tone: 'text-onboarding-stream-pcb' };
  if (s.includes('commerce')) return { subjects: 'Accountancy · Business · Economics', Icon: ChartLine, tone: 'text-onboarding-gold' };
  if (s.includes('humanities') || s.includes('arts')) {
    return { subjects: 'History · Political Science · Geography', Icon: Landmark, tone: 'text-onboarding-stream-humanities' };
  }
  return { subjects: '', Icon: BookOpen, tone: 'text-brand' };
}

/** Classes that share a title (e.g. CLASS 11 PCM / PCB / Humanities) form one card. */
interface ClassGroup {
  key: string;
  grade: number;
  items: ClassOption[];
}

function groupClasses(classes: ClassOption[]): ClassGroup[] {
  const groups = new Map<string, ClassGroup>();
  for (const c of classes) {
    const key = c.title.trim().toUpperCase();
    const group = groups.get(key) ?? { key, grade: gradeOf(c.title), items: [] };
    group.items.push(c);
    groups.set(key, group);
  }
  return [...groups.values()];
}

const hasStreams = (group: ClassGroup) => group.items.length > 1 && group.items.some((c) => !!c.streamName);

/** "Class 9" for a numbered class (as the previous app showed it), else the class title as stored. */
const classLabel = (group: ClassGroup) => (Number.isFinite(group.grade) ? `Class ${group.grade}` : group.items[0]!.title);

/** Sections of the class list: Foundation (6–8), Secondary · Boards (9–10), Senior (11+ and any class with streams). */
function sectionsOf(groups: ClassGroup[]) {
  const senior = (g: ClassGroup) => hasStreams(g) || g.grade >= 11;
  const foundation = groups.filter((g) => !senior(g) && g.grade >= 6 && g.grade <= 8);
  const secondary = groups.filter((g) => !senior(g) && (g.grade === 9 || g.grade === 10));
  const seniors = groups.filter(senior);
  const others = groups.filter((g) => !foundation.includes(g) && !secondary.includes(g) && !seniors.includes(g));
  const byGrade = (a: ClassGroup, b: ClassGroup) => (a.grade || 0) - (b.grade || 0);
  return [
    { label: 'Foundation', columns: 'sm:grid-cols-3', groups: foundation.sort(byGrade) },
    { label: 'Secondary · Boards', columns: 'sm:grid-cols-2', groups: secondary.sort(byGrade) },
    { label: 'Senior · Choose stream', columns: 'sm:grid-cols-2', groups: seniors.sort(byGrade) },
    { label: null, columns: 'sm:grid-cols-3', groups: others },
  ].filter((section) => section.groups.length > 0);
}

export function ClassSetup({
  exam,
  preselected,
  submitting,
  error,
  onSubmit,
}: {
  exam: ExamConfig;
  preselected: number | null;
  submitting: boolean;
  error: unknown;
  onSubmit: (classId: number) => void;
}) {
  const router = useRouter();
  const classes = useQuery({
    queryKey: ['auth', 'class-options', exam.examId],
    queryFn: () => authApi.classOptions(exam),
    staleTime: Infinity,
  });
  const [selected, setSelected] = useState<number | null>(null);
  const [streamGroup, setStreamGroup] = useState<string | null>(null);

  // A class preselected by a marketing link (/get-started?class_id=…), once, when the list arrives.
  const preselectedDone = useRef(false);
  useEffect(() => {
    if (preselectedDone.current || !classes.data) return;
    preselectedDone.current = true;
    if (preselected && classes.data.some((c) => c.classId === preselected)) setSelected(preselected);
  }, [classes.data, preselected]);

  const toggle = (classId: number) => setSelected((current) => (current === classId ? null : classId));
  const groups = groupClasses(classes.data ?? []);
  const openGroup = groups.find((g) => g.key === streamGroup) ?? null;
  const back = () => (openGroup ? setStreamGroup(null) : router.replace(routes.examSelection()));

  const continueButton = (size: string) => (
    <button
      type="button"
      onClick={() => selected !== null && onSubmit(selected)}
      disabled={selected === null || submitting}
      className={`bg-brand text-on-brand font-display shadow-onboarding-class-continue hover:shadow-onboarding-class-continue-hover cursor-pointer rounded-[12px] border-none font-bold transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ${size}`}
    >
      {submitting ? 'Setting up…' : 'Continue'}
    </button>
  );

  return (
    <div className="bg-onboarding-class-page font-partner flex min-h-dvh flex-col lg:h-dvh lg:min-h-0 lg:overflow-hidden">
      {/* Top bar */}
      <div className="border-onboarding-class-bar bg-surface flex h-[52px] shrink-0 items-center justify-between border-b px-4 lg:h-[60px] lg:justify-end lg:px-10">
        <BackButton onClick={back} className="flex lg:hidden" />
        <span className="flex items-center gap-2.5">
          <StepLabel step={CLASS_STEP} className="text-onboarding-class-muted text-[12px] font-bold" />
          <StepDashes
            current={CLASS_STEP}
            count={CLASS_STEPS}
            className="gap-1"
            active="h-[5px]! w-6 rounded-full bg-brand duration-300"
            done="h-[5px]! w-3.5 rounded-full bg-brand duration-300"
            todo="h-[5px]! w-3.5 rounded-full bg-line duration-300"
          />
        </span>
      </div>

      <main
        id="main"
        className="flex flex-1 flex-col px-4 pt-4 pb-28 lg:min-h-0 lg:overflow-y-auto lg:px-10 lg:pt-8 lg:pb-8 lg:[scrollbar-width:none] lg:[&::-webkit-scrollbar]:hidden"
      >
        <BackButton onClick={back} className="hidden self-start lg:flex" />

        <div className="w-full lg:mx-auto lg:max-w-[1150px] lg:pt-6">
          {openGroup ? (
            <>
              <Heading
                eyebrow={`${classLabel(openGroup)} · Choose stream`}
                title="Choose your stream"
                subtitle="Pick your stream to see the right subjects and courses."
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {openGroup.items.map((item) => (
                  <StreamCard
                    key={item.classId}
                    item={item}
                    selected={selected === item.classId}
                    onClick={() => toggle(item.classId)}
                  />
                ))}
              </div>
            </>
          ) : (
            <>
              <Heading
                eyebrow="Your future starts here"
                title="Which class are you in?"
                subtitle={`You picked ${exam.label}. Pick your class to get started.`}
              />
              {classes.isPending ? (
                <div aria-busy="true" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-[94px] w-full rounded-[14px]" />
                  ))}
                </div>
              ) : classes.isError ? (
                <Alert tone="danger">{userMessage(classes.error)}</Alert>
              ) : groups.length === 0 ? (
                // An exam whose classes aren't set up yet (no active class rows of it or mapped for it).
                <Alert tone="info">
                  No classes are available for {exam.label} yet. Please choose another exam or check back soon.
                </Alert>
              ) : (
                <div className="flex flex-col gap-5">
                  {sectionsOf(groups).map((section) => (
                    <div key={section.label ?? 'other'}>
                      {section.label && <SectionLabel>{section.label}</SectionLabel>}
                      <div className={`grid grid-cols-1 gap-3 ${section.columns}`}>
                        {section.groups.map((group) => {
                          if (!hasStreams(group)) {
                            const only = group.items[0]!;
                            return (
                              <ClassCard
                                key={group.key}
                                label={classLabel(group)}
                                grade={group.grade}
                                subtitle={GRADE_CAPTION[group.grade] ?? only.streamName}
                                selected={selected === only.classId}
                                onClick={() => toggle(only.classId)}
                              />
                            );
                          }
                          const chosen = group.items.find((c) => c.classId === selected);
                          return (
                            <ClassCard
                              key={group.key}
                              label={classLabel(group)}
                              grade={group.grade}
                              subtitle={chosen?.streamName || 'Pick a stream next'}
                              selected={!!chosen}
                              streamCount={group.items.length}
                              onClick={() => setStreamGroup(group.key)}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {!!error && (
            <Alert tone="danger" className="mt-4 text-left">
              {userMessage(error)}
            </Alert>
          )}

          <div className={`hidden justify-center lg:flex ${openGroup ? 'pt-6' : 'pt-8'}`}>
            {continueButton('h-[46px] w-[228px] text-[16px]')}
          </div>
        </div>
      </main>

      <div className="border-line bg-surface shadow-onboarding-bar-soft fixed inset-x-0 bottom-0 z-10 border-t px-4 pt-3 pb-[22px] lg:hidden">
        {continueButton('h-12 w-full text-[15px]')}
      </div>
    </div>
  );
}

function BackButton({ onClick, className }: { onClick: () => void; className: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-brand cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-[13px] font-bold transition-opacity hover:opacity-80 lg:gap-1.5 ${className}`}
    >
      <ChevronLeft aria-hidden size={14} strokeWidth={2.75} />
      Back
    </button>
  );
}

function Heading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <div className="mb-6 text-center lg:mb-7">
      <p className="text-onboarding-gold text-[10px] font-bold tracking-[1.2px] uppercase lg:text-[11px]">{eyebrow}</p>
      <h1 className="font-display text-onboarding-ink mt-2 text-[26px] leading-[1.2] font-extrabold tracking-[-0.3px] lg:text-[34px]">
        {title}
      </h1>
      <p className="text-onboarding-class-muted mt-2 text-[13px] lg:text-[15px]">{subtitle}</p>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-onboarding-gold mb-2.5 text-[11px] font-bold tracking-[1.2px] uppercase">{children}</p>;
}

/** Class illustration at the card's bottom right (public/illustrations/onboarding/class-<n>.webp); hidden when missing. */
function ClassImage({ grade }: { grade: number }) {
  const [failed, setFailed] = useState(false);
  if (failed || !Number.isFinite(grade)) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- small static illustration that hides itself when missing
    <img
      src={`/illustrations/onboarding/class-${grade}.webp`}
      alt=""
      aria-hidden
      onError={() => setFailed(true)}
      className="pointer-events-none absolute right-3 bottom-0 h-20 w-auto object-contain object-bottom select-none lg:right-4 lg:h-[88px]"
    />
  );
}

function ClassCard({
  label,
  grade,
  subtitle,
  selected,
  streamCount,
  onClick,
}: {
  label: string;
  grade: number;
  subtitle?: string;
  selected: boolean;
  streamCount?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`relative min-h-[94px] w-full cursor-pointer overflow-hidden rounded-[14px] border py-4 pr-24 pl-4 text-left transition-all lg:pl-[14px] ${
        selected
          ? 'border-brand bg-onboarding-class-pick border-[1.5px]'
          : 'border-line bg-surface hover:border-brand/40 hover:shadow-onboarding-class-card'
      }`}
    >
      <span className="flex items-center gap-2">
        <span className="font-display text-onboarding-ink text-[20px] leading-none font-extrabold lg:text-[22px]">{label}</span>
        {selected && (
          <span aria-hidden className="bg-brand flex size-5 items-center justify-center rounded-full">
            <Check size={12} strokeWidth={3.5} className="text-on-brand" />
          </span>
        )}
      </span>
      {subtitle && (
        <span className="text-onboarding-ink mt-3 block text-[11px] font-semibold lg:text-[12px]">{subtitle}</span>
      )}
      {!!streamCount && (
        <span className="mt-1.5 flex items-center gap-1.5">
          <span aria-hidden className="bg-onboarding-gold size-[5px] rounded-full" />
          <span className="text-onboarding-gold text-[11px] font-semibold">{streamCount} streams inside</span>
        </span>
      )}
      <ClassImage grade={grade} />
    </button>
  );
}

function StreamCard({ item, selected, onClick }: { item: ClassOption; selected: boolean; onClick: () => void }) {
  const { subjects, Icon, tone } = streamMeta(item.streamName);
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center gap-4 rounded-[12px] border p-4 text-left transition-all lg:px-[14px] lg:py-[15px] ${
        selected ? 'border-brand bg-onboarding-class-pick border-[1.5px]' : 'border-line bg-surface hover:border-brand/40'
      }`}
    >
      <span
        className={`flex size-10 shrink-0 items-center justify-center rounded-[10px] ${selected ? 'bg-surface' : 'bg-transparent'}`}
      >
        <Icon aria-hidden size={20} strokeWidth={1.75} className={tone} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="font-display text-onboarding-ink block text-[16px] leading-tight font-bold">
          {item.streamName || item.title}
        </span>
        {subjects && (
          <span className="mt-1 block text-[11px] font-semibold text-neutral-650 lg:text-[12px]">{subjects}</span>
        )}
      </span>
      <span
        aria-hidden
        className={`flex size-5 shrink-0 items-center justify-center rounded-full transition-all ${
          selected ? 'bg-brand' : 'border-onboarding-class-radio bg-surface border-[1.5px]'
        }`}
      >
        {selected && <span className="bg-on-brand size-[7px] rounded-full" />}
      </span>
    </button>
  );
}
