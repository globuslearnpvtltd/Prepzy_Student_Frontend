'use client';

import { cx } from '@prepzy/design-system';
import { ArrowRight, ChevronDown, Clock, Target, TrendingUp } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { subjectLabel } from '@/shared/layout/shell-api';
import type { ChapterStrength, DiagnosticResult, SubjectStrength } from '../api';
import { SCALES } from './report-scales';

// Competitive (NEET) report tabs, ported from the previous app's NEETDiagnosticOverview, NEETSubjectDetail and
// NEETHowYouLearn (Figma 28:31902 / 28:32312). Board exams keep the tabs inside result-screen.tsx.
// Marking is +4 / -1, so marks can be negative: bars never go below empty.

const formatDuration = (seconds: number) => {
  const safe = Math.max(0, Math.round(seconds || 0));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  if (m === 0) return `${s} sec`;
  return s > 0 ? `${m} min ${s} sec` : `${m} min`;
};

const formatMarks = (n: number) => String(Math.round((Number(n) || 0) * 100) / 100);

const sameSubject = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && subjectLabel(a).trim().toLowerCase() === subjectLabel(b).trim().toLowerCase();

/* -------------------------------- Overview -------------------------------- */

const OVERVIEW_PACE_COPY: Record<string, string> = {
  rushing: 'A second read of the questions you were unsure about will catch slips.',
  normal: 'Your pace was steady: enough time on each question without running the clock down.',
  careful: 'You took your time on each question. Timed practice will help you finish comfortably.',
};

/** The share of the subject's marks obtained, clamped to 0–100. */
export const marksShare = (subject: Pick<SubjectStrength, 'total' | 'obtained'>) =>
  subject.total > 0 ? Math.min(100, Math.max(0, (subject.obtained / subject.total) * 100)) : 0;

function MarksBar({ subject }: { subject: SubjectStrength }) {
  const fill = marksShare(subject);
  const percent = Math.round(fill);
  return (
    <div className="flex w-full items-center gap-[10px]">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={`${percent}% (${formatMarks(subject.obtained)} out of ${formatMarks(subject.total)} marks)`}
        className="bg-brand-75 relative h-2 min-w-0 flex-1 overflow-hidden rounded-[4px]"
      >
        <div className="bg-brand absolute top-0 left-0 h-full rounded-[4px] transition-[width] duration-500" style={{ width: `${fill}%` }} />
      </div>
      <span className="shrink-0 text-[14px] font-semibold whitespace-nowrap text-neutral-900">{percent}%</span>
    </div>
  );
}

function SubjectHalf({ kind, subject, body }: { kind: 'strongest' | 'weakest'; subject: SubjectStrength; body: string }) {
  const strongest = kind === 'strongest';
  const Icon = strongest ? TrendingUp : Target;
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-[10px] p-5">
      <div className="flex items-center gap-2">
        <Icon aria-hidden className={cx('size-[18px] shrink-0', strongest ? 'text-accent-400' : 'text-danger')} />
        <span className={cx('text-[12px] font-semibold whitespace-nowrap', strongest ? 'text-accent-400' : 'text-danger')}>
          {strongest ? 'Strongest right now' : 'Needs the most time'}
        </span>
      </div>
      <span className="text-[20px] leading-7 font-bold text-neutral-900">{subject.name}</span>
      <MarksBar subject={subject} />
      <p className="text-[13px] leading-5 text-neutral-600">{body}</p>
    </div>
  );
}

/** Overview tab: Atlas's message with the strongest / needs-the-most-time panel, then the pace row. */
export function CompetitiveOverview({
  result,
  strongest,
  weakest,
  onSeePace,
}: {
  result: DiagnosticResult;
  strongest: SubjectStrength | null;
  weakest: SubjectStrength | null;
  onSeePace: () => void;
}) {
  const ai = result.aiSummary;
  // The AI names the subjects when it can; the bars always come from the scored data.
  const strong = (ai?.strongest && result.subjects.find((s) => sameSubject(s.name, ai.strongest!.name))) || strongest;
  const weak = (ai?.needsTime && result.subjects.find((s) => sameSubject(s.name, ai.needsTime!.name))) || weakest;
  const showWeak = !!weak && weak.id !== strong?.id;

  const strongBody =
    (strong && ai?.strongest && sameSubject(ai.strongest.name, strong.name) ? ai.strongest.summary : null) ??
    'This subject needs the least practice time right now.';
  const weakBody =
    (weak && ai?.needsTime && sameSubject(ai.needsTime.name, weak.name) ? ai.needsTime.summary : null) ??
    'This subject is the toughest for you right now, so it gets the largest share of your plan.';

  const message = ai?.summary.length
    ? ai.summary.join(' ')
    : [
        strong ? `${strong.name} is your strongest subject right now.` : null,
        showWeak && weak ? `${weak.name} needs the most practice this week.` : null,
      ]
        .filter(Boolean)
        .join(' ');

  const pace = result.pace;
  const hasPace = pace.totalSeconds > 0;
  const panel = 'border-brand-75 bg-surface overflow-hidden rounded-[20px] border';

  return (
    <div className="flex flex-col gap-3">
      <div className="border-brand-175 bg-brand-50 flex flex-col gap-7 rounded-[24px] border p-5 md:p-8">
        <div className="flex items-start gap-4">
          <span className="bg-brand text-on-brand flex size-12 shrink-0 items-center justify-center rounded-[24px] text-[16px] font-bold">
            A
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
            <span className="text-[18px] font-bold text-neutral-800">Atlas AI</span>
            {message && <p className="text-[16px] leading-6 text-neutral-550">{message}</p>}
          </div>
        </div>

        {strong && (
          <div className={cx(panel, 'flex flex-col md:flex-row')}>
            <SubjectHalf kind="strongest" subject={strong} body={strongBody} />
            {showWeak && weak && (
              <>
                <div className="bg-brand-75 h-px w-full shrink-0 md:h-auto md:w-px md:self-stretch" />
                <SubjectHalf kind="weakest" subject={weak} body={weakBody} />
              </>
            )}
          </div>
        )}
        {!strong && weak && (
          <div className={cx(panel, 'flex')}>
            <SubjectHalf kind="weakest" subject={weak} body={weakBody} />
          </div>
        )}
      </div>

      {hasPace && (
        <div className="border-brand-75 bg-surface flex items-center gap-[14px] overflow-hidden rounded-[16px] border px-4 py-[14px]">
          <span className="bg-brand-50 text-brand flex size-10 shrink-0 items-center justify-center rounded-full">
            <Clock aria-hidden className="size-5" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
            <span className="text-[14px] font-semibold text-neutral-900">
              You finished in {formatDuration(pace.takenSeconds)} out of {formatDuration(pace.totalSeconds)}
            </span>
            <span className="text-[13px] leading-5 text-neutral-600">
              {ai?.howYouLearn?.suggestion ?? OVERVIEW_PACE_COPY[pace.band] ?? OVERVIEW_PACE_COPY.normal}
            </span>
          </div>
          <button
            type="button"
            onClick={onSeePace}
            className="text-brand flex shrink-0 items-center gap-[6px] px-1 py-3 text-[13px] font-semibold whitespace-nowrap transition-opacity hover:opacity-80"
          >
            See pace
            <ArrowRight aria-hidden className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}

/* -------------------------------- Subjects -------------------------------- */

export const subjectMessage = (s: SubjectStrength) => {
  if (s.correct === 0)
    return `None of the ${s.name} questions were answered correctly this time. Atlas will start with the core ideas of each chapter, then move to practice.`;
  const got = `You got ${s.correct} of ${s.questions} ${s.name} questions right.`;
  if (s.band === 'strong') return `${got} Atlas will keep this sharp with timed practice.`;
  if (s.band === 'moderate') return `${got} Atlas will mix quick revision with practice to close the gaps.`;
  return `${got} Atlas will revisit the core ideas in the chapters you missed, then move to practice.`;
};

function SubjectDetail({ subject, chapters }: { subject: SubjectStrength; chapters: ChapterStrength[] }) {
  const [showTopics, setShowTopics] = useState(false);
  const own = chapters.filter((c) => c.subjectId === subject.id);
  return (
    <div className="border-brand-75 flex flex-col gap-[10px] rounded-[12px] border bg-neutral-50 p-3">
      <p className="text-[13px] leading-5 text-neutral-900">{subjectMessage(subject)}</p>
      {own.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowTopics((v) => !v)}
            aria-expanded={showTopics}
            className="text-brand flex w-fit items-center gap-[6px] text-[12px] leading-[18px] font-semibold transition-opacity hover:opacity-80"
          >
            {showTopics ? `Hide ${subject.name} topics` : `View ${subject.name} topics`}
            <ArrowRight aria-hidden className={cx('size-[14px] transition-transform', showTopics && 'rotate-90')} />
          </button>
          {showTopics && (
            <ul className="flex flex-col gap-[6px]">
              {own.map((c) => (
                <li key={c.id} className="bg-surface flex items-center justify-between gap-3 rounded-[8px] px-[10px] py-2">
                  <span className="min-w-0 truncate text-[13px] leading-5 font-medium text-neutral-900">{c.name}</span>
                  <span className="shrink-0 text-[12px] leading-[18px] font-semibold text-neutral-550">
                    {c.correct}/{c.questions} correct
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function SubjectTag({ tag }: { tag: 'strong' | 'focus' }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full border px-2 py-1 text-[11px] leading-[17px] font-semibold whitespace-nowrap',
        tag === 'strong' ? 'border-success-100 bg-success-50 text-success-700' : 'border-accent-100 bg-accent-50 text-accent-800',
      )}
    >
      {tag === 'strong' ? 'Strongest' : 'Needs focus'}
    </span>
  );
}

/** Subjects tab: strongest to weakest; each row opens to a message and its chapters' scores. */
export function CompetitiveSubjects({
  subjects,
  chapters,
  strongest,
  weakest,
}: {
  subjects: SubjectStrength[];
  chapters: ChapterStrength[];
  strongest: SubjectStrength | null;
  weakest: SubjectStrength | null;
}) {
  const [openId, setOpenId] = useState<number | null>(null);
  const ranked = [...subjects].sort((a, b) => b.pct - a.pct);
  return (
    <div className="border-brand-175 bg-brand-50 flex flex-col gap-3 rounded-[20px] border-[1.5px] p-6">
      <div className="flex flex-col gap-[2px]">
        <span className="text-[17px] leading-[26px] font-bold text-neutral-900">Subject-wise Diagnostic</span>
        <span className="text-[13px] leading-5 text-neutral-500">Strongest to weakest.</span>
      </div>
      <div className="flex flex-col gap-2">
        {ranked.map((subject) => {
          const tag = subject.id === strongest?.id ? 'strong' : subject.id === weakest?.id ? 'focus' : null;
          const open = openId === subject.id;
          return (
            <div key={subject.id} className="border-brand-175 border-b">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : subject.id)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left"
              >
                <span className="flex w-24 shrink-0 flex-col items-start gap-1 md:block">
                  <span className="text-[14px] leading-[21px] font-semibold text-neutral-900">{subject.name}</span>
                  {tag && (
                    <span className="md:hidden">
                      <SubjectTag tag={tag} />
                    </span>
                  )}
                </span>
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="bg-brand-175 h-[10px] min-w-0 flex-1 overflow-hidden rounded-[5px]">
                      <span
                        className="bg-brand block h-full rounded-[5px]"
                        style={{ width: `${Math.min(100, Math.max(0, subject.pct))}%` }}
                      />
                    </span>
                    <span className="w-[38px] shrink-0 text-right text-[14px] leading-[21px] font-bold text-neutral-900">
                      {Math.round(subject.pct)}%
                    </span>
                  </span>
                  <span className="hidden w-[85px] shrink-0 md:block">{tag && <SubjectTag tag={tag} />}</span>
                  <ChevronDown aria-hidden className={cx('size-[18px] shrink-0 text-neutral-900 transition-transform', open && 'rotate-180')} />
                </span>
              </button>
              {open && (
                <div className="px-3 pb-3">
                  <SubjectDetail subject={subject} chapters={chapters} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ How You Learn ------------------------------ */

// Visible step heights (px) from the card's bottom edge, lowest band first.
const STEP_HEIGHTS = [60, 87, 129, 171];
const STAIRCASE_H = 217;

function AcademicBandCard({ band }: { band: string }) {
  const activeIndex = SCALES.band.findIndex((o) => o.key === band);
  const active = activeIndex >= 0 ? SCALES.band[activeIndex]! : null;
  // The tag sits top-right; once the pin climbs to the right half it moves left so they don't collide.
  const tagOnLeft = activeIndex >= 2;

  return (
    <div className="flex w-full flex-col overflow-hidden rounded-[24px] bg-[linear-gradient(139deg,var(--color-night-900)_5.54%,var(--color-brand-700)_98.87%)] px-5 pt-6 md:px-8 md:pt-8">
      <div className="flex flex-col gap-2">
        <span className="text-brand-300 text-[13px] font-semibold">Where you stand</span>
        <div className="flex flex-col">
          <span className="text-on-brand text-[28px] leading-9 font-bold">{active?.label ?? 'Not enough data'}</span>
          <span className="text-on-brand/70 text-[13px]">Your overall level across the chapters you picked</span>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-6 md:mt-0 md:h-[184px] md:flex-row md:items-end">
        {active && (
          <div className="border-on-brand/15 bg-on-brand/10 flex min-w-0 flex-1 flex-col gap-1 rounded-[16px] border px-4 py-[14px] md:self-center">
            <span className="text-accent-400 text-[12px] font-semibold">What this means</span>
            <span className="text-on-brand/90 text-[14px] leading-[22px]">{active.meaning}</span>
          </div>
        )}

        <div className="relative w-full shrink-0 md:-mt-[33px] md:w-[380px]" style={{ height: STAIRCASE_H }}>
          <span
            className={cx(
              'border-on-brand/30 bg-on-brand/10 text-on-brand absolute top-2 z-[1] rounded-full border px-3 py-[5px] text-[12px] font-semibold whitespace-nowrap',
              tagOnLeft ? 'left-0' : 'right-[3px]',
            )}
          >
            Today, not forever
          </span>
          <div className="absolute inset-x-0 bottom-0 flex items-end gap-2 md:right-1" role="list" aria-label="Levels">
            {SCALES.band.map((option, i) => {
              const isYou = i === activeIndex;
              const isNext = activeIndex >= 0 && i === activeIndex + 1;
              return (
                <div
                  key={option.key}
                  role="listitem"
                  aria-current={isYou || undefined}
                  className="relative min-w-0 flex-1"
                  style={{ height: STEP_HEIGHTS[i] }}
                >
                  {isYou && (
                    <>
                      <span className="bg-accent-400 text-on-brand absolute bottom-[calc(100%+12px)] left-1/2 flex size-10 -translate-x-1/2 items-center justify-center rounded-full text-[12px] font-bold">
                        You
                      </span>
                      <span className="bg-accent-400 absolute bottom-full left-1/2 h-[14px] w-[3px] -translate-x-1/2" />
                    </>
                  )}
                  {isNext && (
                    <span className="text-on-brand/80 absolute bottom-[calc(100%+5px)] left-[10px] text-[11px] font-semibold whitespace-nowrap">
                      Next step
                    </span>
                  )}
                  <div
                    className={cx(
                      'h-full w-full rounded-t-[16px]',
                      isYou
                        ? 'border-accent-400 bg-accent-400 border-2 border-b-0'
                        : isNext
                          ? 'border-on-brand/55 bg-on-brand/10 border-[1.5px] border-b-0 border-dashed'
                          : 'bg-on-brand/5',
                    )}
                  />
                  <span
                    className={cx(
                      'absolute top-[11px] right-2 left-[10px] text-[12px] leading-4 font-semibold',
                      isYou ? 'text-on-brand' : isNext ? 'text-on-brand/90' : 'text-on-brand/60',
                    )}
                  >
                    {option.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

const PACE_LABEL_CLASS: Record<string, string> = {
  rushing: 'text-[13px] font-bold text-accent-400',
  normal: 'text-[12px] font-normal text-neutral-900',
  careful: 'text-[13px] font-semibold text-brand',
};
const PACE_ACTIVE_CLASS = 'text-[13px] font-bold text-accent-400';

function LearningPaceCard({ pace }: { pace: DiagnosticResult['pace'] }) {
  const active = SCALES.pace.find((o) => o.key === pace.band) ?? null;
  const taken = Math.max(0, pace.takenSeconds);
  const allowed = Math.max(0, pace.totalSeconds);
  const hasPace = allowed > 0 || taken > 0;
  // 1 block = 1 minute of the time allowed (or of the time taken, if the student ran over).
  const blockCount = Math.max(1, Math.ceil(Math.max(allowed, taken) / 60));
  const fullBlocks = Math.floor(taken / 60);
  const partial = (taken % 60) / 60;

  return (
    <div className="border-accent-100 bg-accent-50 flex w-full flex-col gap-3 overflow-hidden rounded-[24px] border-2 p-5 md:p-6">
      <span className="text-[24px] leading-8 font-bold text-neutral-900 md:text-[28px] md:leading-9">How you used the time</span>
      <span className="text-[14px] leading-[22px] text-neutral-550">
        {active?.meaning ?? "There wasn't enough timing data in this test to read your pace."}
      </span>
      {hasPace && (
        <>
          <div className="flex items-start justify-between gap-3 text-[12px]">
            <span className="text-brand font-semibold">You: {formatDuration(taken)}</span>
            <span className="text-right text-neutral-600">Allowed: {formatDuration(allowed)}</span>
          </div>
          <div className="flex flex-col gap-2">
            <div
              role="img"
              aria-label={`${formatDuration(taken)} used of ${formatDuration(allowed)} allowed`}
              className="flex h-11 w-full items-stretch gap-[2px] md:gap-[3.5px]"
            >
              {Array.from({ length: blockCount }, (_, i) => (
                <span
                  key={i}
                  className={cx('relative min-w-0 flex-1 overflow-hidden rounded-[4px]', i < fullBlocks ? 'bg-accent-400' : 'bg-brand-175')}
                >
                  {i === fullBlocks && partial > 0 && (
                    <span className="bg-accent-400 absolute inset-x-0 bottom-0 rounded-[2px]" style={{ height: `${Math.max(10, partial * 100)}%` }} />
                  )}
                </span>
              ))}
            </div>
            <div className="flex items-center">
              {SCALES.pace.map((option) => (
                <span
                  key={option.key}
                  className={cx('min-w-0 flex-1', option.key === active?.key ? PACE_ACTIVE_CLASS : (PACE_LABEL_CLASS[option.key] ?? PACE_LABEL_CLASS.normal))}
                >
                  {option.label}
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

type SlipKind = 'conceptual' | 'numerical' | 'case_based';

const SLIP_CONTENT: Record<SlipKind, { glyph: string; label: string[]; frontGlyphClass: string }> = {
  conceptual: { glyph: 'Why?', label: ['Conceptual'], frontGlyphClass: 'text-[40px]' },
  numerical: { glyph: '∑', label: ['Numerical'], frontGlyphClass: 'text-[56px]' },
  case_based: { glyph: '“', label: ['Case', 'based'], frontGlyphClass: 'text-[80px] leading-[0.9]' },
};

const BACK_GLYPH_CLASS: Record<SlipKind, string> = {
  numerical: 'top-[8.5px] text-[56px]',
  case_based: 'top-[8.5px] text-[80px]',
  conceptual: 'top-[24px] text-[36px]',
};

const slipShadow = 'drop-shadow-[0px_8px_9px_rgba(61,52,139,0.1)]';

function BackSlip({ kind, side, className }: { kind: SlipKind; side: 'left' | 'right'; className: string }) {
  const c = SLIP_CONTENT[kind];
  const right = side === 'right';
  return (
    <div className={cx('border-brand-75 absolute h-[188px] w-[150px] rounded-[20px] border-[1.5px] bg-neutral-50', slipShadow, className)}>
      <span className={cx('text-brand/85 absolute leading-none font-bold whitespace-nowrap', BACK_GLYPH_CLASS[kind], right ? 'right-[16.5px]' : 'left-[16.5px]')}>
        {c.glyph}
      </span>
      <span
        className={cx(
          'text-brand absolute text-[14px] font-semibold whitespace-nowrap',
          right ? 'top-[96px] right-[18px] text-right' : 'top-[78px] left-[14.5px]',
        )}
      >
        {c.label.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </span>
      <span className="bg-brand/15 absolute top-[142.5px] left-[16.5px] h-[6px] w-[114px] rounded-[3px]" />
      <span className={cx('bg-brand/15 absolute top-[156.5px] h-[6px] w-[60px] rounded-[3px]', right ? 'left-[70.5px]' : 'left-[16.5px]')} />
    </div>
  );
}

function FrontSlip({ kind, isBest }: { kind: SlipKind; isBest: boolean }) {
  const c = SLIP_CONTENT[kind];
  return (
    <div
      className={cx(
        'absolute top-[4.5px] left-[88px] h-[220px] w-[176px] rotate-[3deg] rounded-[20px]',
        isBest ? 'bg-brand drop-shadow-[0px_16px_16px_rgba(61,52,139,0.28)]' : cx('border-brand-75 border-[1.5px] bg-neutral-50', slipShadow),
      )}
    >
      <span
        className={cx(
          'absolute top-[46.5px] left-1/2 -translate-x-1/2 text-center leading-none font-bold whitespace-nowrap',
          c.frontGlyphClass,
          isBest ? 'text-accent-400' : 'text-brand/85',
        )}
      >
        {c.glyph}
      </span>
      {[
        { top: 138, w: 140 },
        { top: 152, w: 140 },
        { top: 166, w: 70.4 },
      ].map((line) => (
        <span
          key={line.top}
          className={cx('absolute left-[18px] h-[6px] rounded-[3px]', isBest ? 'bg-on-brand/30' : 'bg-brand/15')}
          style={{ top: line.top, width: line.w }}
        />
      ))}
      <span className={cx('absolute top-[182px] left-4 text-[14px] font-semibold whitespace-nowrap', isBest ? 'text-on-brand' : 'text-brand')}>
        {c.label.join(' ')}
      </span>
      {isBest && (
        <>
          <span className="absolute top-[8.7px] left-[130.4px] size-6 rotate-[23.47deg]">
            <Image src="/illustrations/diagnostic/crown.svg" alt="" width={24} height={24} />
          </span>
          <span className="border-accent-400/25 bg-accent-400/10 text-on-brand absolute top-[27px] left-[95px] rotate-[22.66deg] rounded-full border px-3 py-[5px] text-[10px] font-semibold whitespace-nowrap">
            Your best
          </span>
        </>
      )}
    </div>
  );
}

function QuestionSlips({ leaning }: { leaning: SlipKind | null }) {
  const front: SlipKind = leaning ?? 'conceptual';
  const [left, right] = (['numerical', 'case_based', 'conceptual'] as SlipKind[]).filter((k) => k !== front) as [SlipKind, SlipKind];
  return (
    // Fixed-size illustration; scaled down on phones instead of reflowing.
    <div className="flex w-full shrink-0 justify-center md:w-auto">
      <div className="h-[194px] w-[305px] md:h-[229px] md:w-[359px]">
        <div aria-hidden className="relative h-[229px] w-[359px] origin-top-left max-md:scale-[0.85]">
          <BackSlip kind={left} side="left" className="top-[15.5px] left-[16.5px] -rotate-[11deg]" />
          <BackSlip kind={right} side="right" className="top-[23.5px] left-[192.5px] rotate-[11deg]" />
          <FrontSlip kind={front} isBest={!!leaning} />
        </div>
      </div>
    </div>
  );
}

/** The thinking-style key to show: the leaning when the test gave any signal, else "balanced". */
export const thinkingStyleKey = (thinking: DiagnosticResult['thinking']): string => {
  const hasSignal = Object.values(thinking.accuracies).some((pct) => pct > 0);
  return hasSignal && SCALES.thinking.some((o) => o.key === thinking.leaning) ? thinking.leaning! : 'balanced';
};

function ThinkingStyleCard({ thinking, aiSuggestion }: { thinking: DiagnosticResult['thinking']; aiSuggestion: string | null }) {
  const key = thinkingStyleKey(thinking);
  const option = SCALES.thinking.find((o) => o.key === key) ?? null;
  const leaning = key === 'balanced' ? null : (key as SlipKind);
  // The AI tagline isn't used: it can disagree with the title (e.g. "Balanced" on a no-clear-lead leaning).
  const meaning = aiSuggestion?.trim() || option?.meaning || null;

  return (
    <div className="border-brand-175 bg-brand-50 flex w-full flex-col gap-6 overflow-hidden rounded-[24px] border p-5 md:flex-row md:items-center md:p-6">
      <div className="flex min-w-0 flex-1 flex-col gap-[10px]">
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-neutral-900">The kind of question you answer best</span>
          <div className="flex flex-col">
            <span className="text-brand text-[28px] leading-9 font-bold">{option?.label ?? 'No clear style'}</span>
            <span className="text-[13px] text-neutral-600">Based on where your accuracy was highest</span>
          </div>
        </div>
        {meaning && (
          <div className="border-brand-75 bg-surface flex flex-col items-start gap-2 rounded-[16px] border px-[14px] py-3">
            <span className="bg-accent-400 text-on-brand rounded-full px-3 py-[5px] text-[12px] font-semibold whitespace-nowrap">What this means</span>
            <span className="text-[14px] leading-[22px] text-neutral-900">{meaning}</span>
          </div>
        )}
      </div>
      <QuestionSlips leaning={leaning} />
    </div>
  );
}

/** How You Learn tab: the level staircase, the minute strip and the question slips. */
export function CompetitiveHowYouLearn({ result }: { result: DiagnosticResult }) {
  return (
    <div className="flex flex-col gap-6">
      <AcademicBandCard band={result.academicBand} />
      <LearningPaceCard pace={result.pace} />
      <ThinkingStyleCard thinking={result.thinking} aiSuggestion={result.aiSummary?.howYouLearn?.suggestion ?? null} />
    </div>
  );
}
