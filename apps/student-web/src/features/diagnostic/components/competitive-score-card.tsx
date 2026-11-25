'use client';

import { cx } from '@prepzy/design-system';
import type { DiagnosticSubmitSummary } from '../api';

// Competitive (NEET) score card shown once the test has been evaluated (previous app's NEETDiagnosticScoreCard,
// Figma 28:29900). Board exams go straight to the report.

// Half-circle gauge: 200 x 100 box, radius 95, 10px round-capped stroke.
const GAUGE_W = 200;
const GAUGE_H = 100;
const RADIUS = 95;
const STROKE = 10;
const ARC = `M ${GAUGE_W / 2 - RADIUS} ${GAUGE_H} A ${RADIUS} ${RADIUS} 0 0 1 ${GAUGE_W / 2 + RADIUS} ${GAUGE_H}`;
// The arc runs 0..100 (pathLength); the gap keeps the round caps of both segments apart.
const GAP = 4.5;

const pad2 = (n: number) => String(Math.max(0, Math.round(n || 0))).padStart(2, '0');

/** The arc's filled share: marking is +4 / -1, so the score can be negative, but the arc never goes below empty. */
export const gaugeFill = (obtained: number, total: number) =>
  total > 0 ? Math.max(0, Math.min(100, (obtained / total) * 100)) : 0;

function ScoreGauge({ obtained, total }: { obtained: number; total: number }) {
  const fill = gaugeFill(obtained, total);
  const trackStart = fill === 0 ? 0 : Math.min(100, fill + GAP);
  const track = 100 - trackStart;
  const score = Math.round(obtained * 100) / 100;

  return (
    <div className="relative" style={{ width: GAUGE_W, height: GAUGE_H }}>
      <svg
        width={GAUGE_W}
        height={GAUGE_H}
        viewBox={`0 0 ${GAUGE_W} ${GAUGE_H}`}
        className="absolute inset-0 overflow-visible"
        aria-hidden
      >
        {track > 0 && (
          <path
            d={ARC}
            pathLength={100}
            fill="none"
            stroke="var(--color-brand)"
            strokeOpacity={0.2}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${track} 100`}
            strokeDashoffset={-trackStart}
          />
        )}
        {fill > 0 && (
          <path
            d={ARC}
            pathLength={100}
            fill="none"
            stroke="var(--color-brand)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${fill} 100`}
            className="transition-[stroke-dasharray] duration-700"
          />
        )}
      </svg>
      <div className="absolute bottom-0 left-1/2 flex -translate-x-1/2 flex-col items-center text-center">
        <span className="text-[28px] leading-[42px] font-bold whitespace-nowrap text-neutral-900">
          {score}/{total}
        </span>
        <span className="text-[12px] font-medium text-neutral-900/70">Total Marks</span>
      </div>
    </div>
  );
}

export function CompetitiveScoreCard({
  summary,
  onContinue,
  onReview,
  className,
}: {
  summary: DiagnosticSubmitSummary;
  onContinue: () => void;
  onReview: () => void;
  className?: string;
}) {
  const stats = [
    { label: 'Correct answers', value: summary.correct },
    { label: 'Incorrect answers', value: summary.incorrect },
    { label: 'Not answered', value: summary.unattempted },
  ];

  return (
    <section
      aria-label="Test completed"
      className={cx(
        'bg-surface flex w-full max-w-[512px] flex-col items-center gap-6 overflow-hidden rounded-[32px] px-5 pt-8 shadow-[0px_20px_25px_-5px_rgba(226,232,240,0.5),0px_8px_10px_-6px_rgba(226,232,240,0.5)] sm:px-10 sm:pt-10',
        className,
      )}
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <h2 className="text-[24px] leading-8 font-bold text-neutral-900">Test Completed!</h2>
        <p className="max-w-[430px] text-[16px] leading-[26px] text-neutral-900/70">
          See how you performed in your exam. Review your results and learn from every mistake.
        </p>
      </div>

      <ScoreGauge obtained={summary.obtained} total={summary.totalMarks} />

      <div className="flex w-full flex-col gap-[17px]">
        <div className="bg-brand-75 h-px w-full" />
        <dl className="flex w-full items-start justify-center gap-[6px]">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={cx(
                'flex h-[81px] min-w-0 flex-1 flex-col items-center px-1 py-4 sm:w-[140px] sm:flex-none sm:px-4',
                i < stats.length - 1 && 'border-brand-75 border-r',
              )}
            >
              <dt className="text-brand/40 text-center text-[10px] leading-[15px] font-semibold tracking-[0.6px] uppercase sm:whitespace-nowrap">
                {s.label}
              </dt>
              <dd className="text-brand pt-1 text-center text-[20px] leading-7 font-bold">{pad2(s.value)}</dd>
            </div>
          ))}
        </dl>
        <div className="bg-brand-75 h-px w-full" />
      </div>

      <div className="border-brand-75 -mx-5 flex w-[calc(100%+40px)] flex-col gap-3 border-t bg-neutral-50 px-5 pt-[25px] pb-6 sm:-mx-10 sm:w-[calc(100%+80px)] sm:flex-row sm:px-8 sm:pb-8">
        <button
          type="button"
          onClick={onContinue}
          className="border-brand-75 bg-surface hover:bg-brand-50 flex min-h-14 w-full items-center justify-center rounded-[16px] border px-6 py-4 text-[16px] font-bold text-neutral-900 transition-colors sm:flex-1"
        >
          Continue Learning
        </button>
        <button
          type="button"
          onClick={onReview}
          className="bg-brand text-on-brand hover:bg-brand-hover flex min-h-14 w-full items-center justify-center rounded-[16px] px-6 py-4 text-[16px] font-bold transition-colors sm:flex-1"
        >
          Review Solutions
        </button>
      </div>
    </section>
  );
}
