'use client';

import { cx } from '@prepzy/design-system';
import Image from 'next/image';
import { useEffect, useState } from 'react';

// Figma: "Evaluating Your Test" (competitive / NEET diagnostic, shown after Submit Test).
const ART = '/illustrations/diagnostic/evaluating';

const STEPS = ['Verifying Submitted Answers', 'Calculating Total Score', 'Preparing Performance Summary', 'Almost Ready...'];
/** Seconds per step. The design shows "09" with step 1 done and a quarter of the ring filled: 4 × 3s. */
const STEP_SECONDS = 3;
const TOTAL_SECONDS = STEPS.length * STEP_SECONDS;

// One tip per dot in the footer's pager; they rotate with the steps.
const TIPS = [
  'Every mistake helps improve your final NEET score.',
  'Revisiting your weak chapters first gives the biggest score jump.',
  'NEET rewards accuracy: every wrong answer costs you a mark.',
  'Short daily practice beats long weekend cramming.',
];

// Progress ring geometry, matching the track asset (132px, 8.39px band).
const RING = 132;
const STROKE = 8.394;
const RADIUS = RING / 2 - STROKE / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

type StepState = 'done' | 'active' | 'pending';

function StepIcon({ state }: { state: StepState }) {
  if (state === 'pending')
    return (
      <span className="border-brand bg-plan-tile-active flex size-4 shrink-0 items-center justify-center rounded-full border p-px">
        <Image src={`${ART}/step-pending-dot.svg`} alt="" width={6} height={6} />
      </span>
    );
  return (
    <Image
      src={`${ART}/${state === 'done' ? 'step-done' : 'step-active'}.svg`}
      alt=""
      width={16}
      height={16}
      className={cx('shrink-0', state === 'active' && 'animate-spin [animation-duration:3s] motion-reduce:animate-none')}
    />
  );
}

/**
 * Full-screen "Evaluating Your Test" step for competitive exams: a countdown ring, four steps that tick off
 * one every STEP_SECONDS, and a rotating "Did you know?" tip. Calls onDone once every step is done.
 */
export function CompetitiveEvaluating({ onDone }: { onDone: () => void }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (elapsed >= TOTAL_SECONDS) {
      onDone();
      return;
    }
    const id = setTimeout(() => setElapsed((s) => s + 1), 1000);
    return () => clearTimeout(id);
  }, [elapsed, onDone]);

  const done = Math.floor(elapsed / STEP_SECONDS);
  const remaining = Math.max(0, TOTAL_SECONDS - elapsed);
  const tip = Math.min(done, TIPS.length - 1);
  const stateOf = (i: number): StepState => (i < done ? 'done' : i === done ? 'active' : 'pending');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Evaluating your test"
      className="bg-neutral-50 fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 md:p-5"
    >
      {/* Background sparkles (decorative, top right) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 hidden md:block">
        <Image src={`${ART}/sparkle-1.svg`} alt="" width={10} height={10} className="absolute top-[calc(22.22%-2.33px)] left-[calc(83.33%+22px)]" />
        <Image src={`${ART}/sparkle-2.svg`} alt="" width={12} height={12} className="absolute top-[calc(22.22%+7.67px)] left-[calc(91.67%-15px)]" />
        <Image src={`${ART}/sparkle-3.svg`} alt="" width={10} height={10} className="absolute top-[calc(11.11%+24.33px)] left-[calc(83.33%+64px)]" />
        <Image src={`${ART}/sparkle-4.svg`} alt="" width={12} height={12} className="absolute top-[calc(22.22%+45.67px)] left-[calc(91.67%+62px)]" />
      </div>

      <div className="relative flex w-full max-w-[512px] flex-col gap-4">
        <div className="bg-surface flex w-full flex-col items-center gap-6 overflow-hidden rounded-[32px] p-6 shadow-[0px_20px_25px_-5px_rgba(226,232,240,0.5),0px_8px_10px_-6px_rgba(226,232,240,0.5)] md:p-10">
          {/* Countdown ring */}
          <div className="relative size-[125px] shrink-0">
            <div className="absolute top-[-0.5px] left-[0.5px] size-[132px]">
              <Image src={`${ART}/ring-track.svg`} alt="" width={132} height={132} className="absolute inset-0" />
              <svg aria-hidden width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`} className="absolute inset-0 rotate-90" fill="none">
                <circle
                  cx={RING / 2}
                  cy={RING / 2}
                  r={RADIUS}
                  className="stroke-brand transition-[stroke-dashoffset] duration-1000 ease-linear motion-reduce:transition-none"
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={CIRCUMFERENCE * (1 - elapsed / TOTAL_SECONDS)}
                />
              </svg>
              <span
                role="timer"
                aria-label={`${remaining} seconds left`}
                className="text-brand absolute inset-0 flex items-center justify-center text-[42px] leading-none font-bold"
              >
                {String(remaining).padStart(2, '0')}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3 text-center">
            <h2 className="text-[24px] leading-8 font-bold tracking-[0.0703px] text-neutral-900">Evaluating Your Test</h2>
            <p className="max-w-[430px] text-[16px] leading-[26px] tracking-[-0.3125px] text-neutral-900/72">
              Checking your responses and preparing your detailed performance report.
            </p>
          </div>

          <ol aria-label="Evaluation progress" className="border-journey-border flex w-full flex-col gap-1 rounded-[20px] border p-[17px]">
            {STEPS.map((label, i) => {
              const state = stateOf(i);
              return (
                <li key={label} aria-current={state === 'active' ? 'step' : undefined} className="flex items-start gap-3">
                  <StepIcon state={state} />
                  <span
                    className={cx(
                      'text-[10px] leading-[15px] font-medium tracking-[0.6172px]',
                      state === 'done' && 'text-brand',
                      state === 'active' && 'text-neutral-900',
                      state === 'pending' && 'text-neutral-900/50',
                    )}
                  >
                    {label}
                    {state === 'done' && <span className="sr-only"> (done)</span>}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Did you know? */}
        <div className="bg-surface border-journey-border flex w-full items-start gap-3 rounded-[24px] border p-[25px]">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[14px] bg-neutral-130">
            <Image src={`${ART}/tip-bulb.svg`} alt="" width={18} height={18} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[14px] font-semibold text-neutral-900">Did you know?</p>
              <span aria-hidden className="flex shrink-0 items-start gap-1">
                {TIPS.map((t, i) => (
                  <span
                    key={t}
                    className={cx('h-2 rounded-[12px] transition-all', i === tip ? 'bg-brand w-5' : 'bg-journey-border w-2')}
                  />
                ))}
              </span>
            </div>
            <p aria-live="polite" className="text-brand/40 text-[12px]">
              {TIPS[tip]}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
