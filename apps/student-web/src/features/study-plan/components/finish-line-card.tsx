'use client';

import Link from 'next/link';
import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

// Port of the previous app's FinishLineCard. The background is a Figma export with its text removed; the
// text is redrawn here because an <img> can't use webfonts.

const SRC = '/illustrations/journey/finish-line-bg.svg';

// The export pads the card into a 897x332 canvas; these fractions put the card's edges on this box.
const LAYER = {
  width: `${(897 / 841) * 100}%`,
  left: `${(-28 / 841) * 100}%`,
  top: `${(-8 / 276) * 100}%`,
  height: `${(332 / 276) * 100}%`,
};

const ROW = { x: 109, y: 202.617, h: 48, gap: 14 };
const PAD = 24;
const ARROW_GAP = 8;
const ARROW_W = 9;
const LABEL_BASELINE = 231.517;
const FALLBACK_W = 150;

const KEEP = 'Keep Going';
const RETAKE = 'Retake Diagnostic Test';

const buttonClass =
  'cursor-pointer outline-none [&:focus-visible>rect]:stroke-brand-700 [&:focus-visible>rect]:[stroke-width:3]';

function useLabelWidth(ref: RefObject<SVGTextElement | null>, dep: unknown) {
  const [width, setWidth] = useState(FALLBACK_W);
  useLayoutEffect(() => {
    let cancelled = false;
    const measure = () => {
      const node = ref.current;
      if (!node || cancelled || typeof node.getBBox !== 'function') return;
      try {
        const measured = node.getBBox().width;
        if (measured > 0) setWidth(Math.round(measured));
      } catch {
        // getBBox throws while the SVG isn't rendered (display: none); keep the fallback width.
      }
    };
    measure();
    document.fonts?.ready?.then(measure).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ref, dep]);
  return width;
}

export interface FinishLineCardProps {
  href: string;
  /** "Retake Diagnostic Test", only when the student may retake it. */
  retakeHref?: string;
  className?: string;
}

/** Desktop "You've reached the Finish Line!" journey card (plan complete). */
export function FinishLineCard({ href, retakeHref, className = '' }: FinishLineCardProps) {
  const keepRef = useRef<SVGTextElement | null>(null);
  const retakeRef = useRef<SVGTextElement | null>(null);
  const keepLabelW = useLabelWidth(keepRef, KEEP);
  const retakeLabelW = useLabelWidth(retakeRef, retakeHref ? RETAKE : null);

  const keepW = PAD + keepLabelW + ARROW_GAP + ARROW_W + PAD;
  const retakeW = PAD + retakeLabelW + PAD;
  const retakeX = ROW.x + keepW + ROW.gap;
  const arrowDx = ROW.x + PAD + keepLabelW + ARROW_GAP - 327.125;

  return (
    <div className={`relative w-full ${className}`} style={{ aspectRatio: '841 / 276' }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- exported artwork drawn at the card's exact box */}
      <img src={SRC} alt="" aria-hidden className="pointer-events-none absolute max-w-none" style={LAYER} />

      <svg viewBox="0 0 897 332" className="absolute" style={LAYER} fill="none" xmlns="http://www.w3.org/2000/svg">
        <text
          className="font-notebook fill-neutral-900"
          transform="translate(109 44.4087) rotate(-0.4)"
          style={{ whiteSpace: 'pre' }}
          xmlSpace="preserve"
          fontSize="36"
          fontWeight="bold"
          letterSpacing="0px"
        >
          <tspan x="0" y="35.776">
            You’ve Reached the
          </tspan>
        </text>
        <text
          className="font-hand fill-brand-700"
          transform="translate(109 87.9478) rotate(-3.44)"
          style={{ whiteSpace: 'pre' }}
          xmlSpace="preserve"
          fontSize="36"
          letterSpacing="1.3px"
        >
          <tspan x="0" y="37.64">
            Finish Line!
          </tspan>
        </text>
        <text
          className="fill-neutral-900 font-sans"
          fillOpacity="0.6"
          style={{ whiteSpace: 'pre' }}
          xmlSpace="preserve"
          fontSize="16"
          letterSpacing="0em"
        >
          <tspan x="109" y="159.217">
            Great job staying consistent. You&#39;ve finished{' '}
          </tspan>
          <tspan x="109" y="181.217">
            every step in your study plan.
          </tspan>
        </text>

        <Link href={href} aria-label={KEEP} className={buttonClass}>
          <rect className="fill-accent-400" x={ROW.x} y={ROW.y} width={keepW} height={ROW.h} rx="24" />
          <text
            ref={keepRef}
            aria-hidden
            className="fill-neutral-0 font-sans"
            style={{ whiteSpace: 'pre' }}
            xmlSpace="preserve"
            fontSize="14"
            fontWeight="600"
            letterSpacing="0px"
          >
            <tspan x={ROW.x + PAD} y={LABEL_BASELINE}>
              {KEEP}
            </tspan>
          </text>
          <g transform={`translate(${arrowDx} 0)`}>
            <path
              className="stroke-neutral-0"
              d="M335.563 226.617H327.125"
              strokeWidth="1.66"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              className="stroke-neutral-0"
              d="M332.125 230.367C332.125 230.367 335.875 227.605 335.875 226.617C335.875 225.628 332.125 222.867 332.125 222.867"
              strokeWidth="1.66"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </Link>

        {retakeHref && (
          <Link href={retakeHref} aria-label={RETAKE} className={buttonClass}>
            <rect className="fill-brand-700" x={retakeX} y={ROW.y} width={retakeW} height={ROW.h} rx="24" />
            <text
              ref={retakeRef}
              aria-hidden
              className="fill-neutral-0 font-sans"
              style={{ whiteSpace: 'pre' }}
              xmlSpace="preserve"
              fontSize="14"
              fontWeight="600"
              letterSpacing="0px"
            >
              <tspan x={retakeX + PAD} y={LABEL_BASELINE}>
                {RETAKE}
              </tspan>
            </text>
          </Link>
        )}
      </svg>
    </div>
  );
}
