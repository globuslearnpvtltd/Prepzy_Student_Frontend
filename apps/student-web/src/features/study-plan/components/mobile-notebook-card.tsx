'use client';

import { cx } from '@prepzy/design-system';
import Link from 'next/link';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

// Port of the previous app's MobileNotebookCard + MobileSlimCard (DashboardCards/MobileJourneyCards.tsx): a 345px-wide
// design scaled to the card's width, with the same artwork (public/illustrations/journey).

const ART = '/illustrations/journey';
const DESIGN_W = 345;
const PAPER_LINE = 'var(--color-journey-paper)';

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/** Renders the 345px design and scales it to the available width (keeps the design's proportions on every phone). */
function ScaledCard({ children, className }: { children: ReactNode; className?: string }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ scale: 1, height: 0 });

  useIsoLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const update = () => {
      // Hidden (display: none on wider screens): keep the last size instead of collapsing to 0.
      if (!outer.clientWidth) return;
      setBox({ scale: outer.clientWidth / DESIGN_W, height: inner.offsetHeight });
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(outer);
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={outerRef}
      className={cx('relative w-full', className)}
      style={{ height: box.height * box.scale || undefined }}
    >
      <div
        ref={innerRef}
        className="absolute top-0 left-0 origin-top-left"
        style={{ width: DESIGN_W, transform: `scale(${box.scale})` }}
      >
        {children}
      </div>
    </div>
  );
}

function Art({ src, className }: { src: string; className: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- decorative SVG drawn at an exact size
    <img alt="" aria-hidden src={`${ART}/${src}`} className={cx('pointer-events-none block max-w-none', className)} />
  );
}

function MarginLine() {
  return (
    <div className="pointer-events-none absolute top-1/2 left-[39.74px] h-0 w-0">
      <Art
        src="margin-line.svg"
        className="absolute top-0 left-0 h-[1.88px] w-[271px] -translate-x-1/2 -translate-y-1/2 rotate-[90.11deg]"
      />
    </div>
  );
}

// Lines counted up from the bottom, so the finish card's buttons sit on them like handwriting.
const ruledFromBottom = (offset: number): CSSProperties => ({
  top: 0,
  backgroundImage: `linear-gradient(to top, ${PAPER_LINE} 0 1px, transparent 1px)`,
  backgroundSize: '100% 35px',
  backgroundPosition: `0 calc(100% - ${offset}px)`,
});

const ruled = (offset: number): CSSProperties => ({
  top: offset,
  backgroundImage: `repeating-linear-gradient(to bottom, ${PAPER_LINE} 0 1px, transparent 1px 35px)`,
});

function RoundButton({
  label,
  href,
  tone = 'amber',
  compact = false,
}: {
  label: string;
  href: string;
  tone?: 'amber' | 'brand';
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cx(
        'text-on-brand flex items-center justify-center rounded-full font-sans leading-[14px] font-semibold transition-opacity hover:opacity-90',
        tone === 'amber' ? 'bg-accent-400' : 'bg-brand-700',
        compact ? 'h-[30px] w-fit gap-[6px] px-[14px] text-[13px]' : 'h-[40px] w-full gap-[8px] px-[24px] text-[14px]',
      )}
    >
      {label}
      <Art src="diag-arrow.svg" className={cx('relative', compact ? 'h-[13px] w-[13px]' : 'h-[15px] w-[15px]')} />
    </Link>
  );
}

const CLIP_BARS: [number, number, number][] = [
  [29.34, 46.22, 43.464],
  [29.54, 53.26, 30.547],
  [29.44, 68.42, 43.464],
  [29.63, 75.46, 12.983],
  [29.39, 89.64, 43.464],
  [29.59, 96.68, 36.445],
];

function Clipboard() {
  return (
    <div aria-hidden className="pointer-events-none absolute top-[28px] left-[226.5px] h-[124px] w-[98px]">
      <div className="absolute top-[4.89px] left-0 flex h-[118.421px] w-[97.793px] items-center justify-center">
        <div className="bg-journey-paper relative h-[110.321px] w-[87.3px] rotate-[5.68deg] overflow-hidden rounded-sm">
          <div className="font-hand absolute top-[13.73px] left-[60.45px] -translate-x-1/2 text-center text-[16px] leading-[20px] tracking-[1.3px] whitespace-nowrap text-neutral-900">
            Diagnostic
            <br />
            Test
          </div>
        </div>
      </div>
      <div className="absolute top-[2.46px] left-[1.27px] flex h-[120.468px] w-[96.73px] items-center justify-center">
        <div className="bg-surface relative h-[110.099px] w-[82.207px] rotate-[8deg] overflow-hidden rounded-sm border-[2.6px] border-neutral-900/80">
          <div className="font-hand absolute top-[12.04px] left-[44.22px] -translate-x-1/2 text-center text-[10px] leading-[14px] tracking-[1.3px] whitespace-nowrap text-neutral-900">
            Diagnostic
            <br />
            Test
          </div>
          <div className="absolute top-[44.19px] left-[7.86px] h-[16px] w-[24.402px]">
            <Art src="clip-check.svg" className="absolute top-[-0.61px] left-0 h-[16.61px] w-[25.4px]" />
          </div>
          <div className="absolute top-[66.39px] left-[7.95px] h-[16px] w-[17px] rounded-[2px] border-[1.2px] border-neutral-900/80" />
          <div className="absolute top-[87.61px] left-[7.9px] h-[16px] w-[17px] rounded-[2px] border-[1.2px] border-neutral-900/80" />
          {CLIP_BARS.map(([left, top, width]) => (
            <div
              key={`${left}-${top}`}
              className="bg-journey-check absolute h-[3.985px] rotate-[2.17deg] skew-x-[3.89deg] rounded-[20px]"
              style={{ left, top: top + 0.8, width }}
            />
          ))}
        </div>
      </div>
      <div className="absolute top-0 left-[45.73px] flex h-[15.231px] w-[23.426px] items-center justify-center">
        <div className="bg-journey-clip h-[12.299px] w-[21.927px] rotate-[8deg] rounded-[2px] border-[2.6px] border-neutral-900/80" />
      </div>
    </div>
  );
}

export type NotebookArt = 'clipboard' | 'finish';

export interface MobileNotebookCardProps {
  art: NotebookArt;
  lead: string;
  hand: string;
  body: string;
  ctaLabel: string;
  href: string;
  secondary?: { label: string; href: string };
  className?: string;
}

/** Phone version of the journey card (diagnostic clipboard or finish line), as in the previous app. */
export function MobileNotebookCard({
  art,
  lead,
  hand,
  body,
  ctaLabel,
  href,
  secondary,
  className,
}: MobileNotebookCardProps) {
  const finish = art === 'finish';

  return (
    <ScaledCard className={className}>
      <div className="border-journey-border bg-surface shadow-journey-card relative flex min-h-[231px] flex-col overflow-hidden rounded-[24px] border-2">
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0"
          style={finish ? ruledFromBottom(25) : ruled(10)}
        />
        {!finish && <Art src="diag-doodles.svg" className="absolute top-[-2px] left-[40px] h-[258px] w-[324px]" />}
        <Art src="binder-dots.svg" className="absolute top-[7px] left-[1px] h-[264px] w-[36px]" />
        <MarginLine />

        <div className="pointer-events-none absolute bottom-[-30px] left-[45px] flex h-[43.789px] w-[40.843px] items-center justify-center">
          <Art src="jelly.svg" className="relative h-[36.312px] w-[31.989px] rotate-[16.18deg]" />
        </div>
        <div className="pointer-events-none absolute bottom-[-24px] left-[320px] flex h-[29.029px] w-[28.127px] items-center justify-center">
          <Art src="squiggle.svg" className="relative h-[14.98px] w-[29.08px] -scale-y-100 rotate-[47.3deg]" />
        </div>

        {finish ? (
          <>
            <div className="pointer-events-none absolute top-[47px] left-[43px] flex h-[15.3px] w-[15.27px] items-center justify-center">
              <Art src="sparkle-a.svg" className="relative h-[12.94px] w-[10.17px] rotate-[43.82deg]" />
            </div>
            <Art src="finish-illustration.svg" className="absolute top-[58px] left-[188px] h-[116px] w-[154px]" />
          </>
        ) : (
          <>
            <div className="pointer-events-none absolute top-[11px] left-[221.5px] flex h-[25.85px] w-[25.79px] items-center justify-center">
              <Art src="sparkle-a.svg" className="relative h-[21.5px] w-[17.18px] rotate-[43.82deg]" />
            </div>
            <div className="pointer-events-none absolute top-[71px] left-[322.5px] flex h-[16.14px] w-[15.27px] items-center justify-center">
              <Art src="sparkle-b.svg" className="relative h-[15.93px] w-[13.28px] -scale-y-100 rotate-[-171.27deg]" />
            </div>
            <Clipboard />
          </>
        )}

        <div className={cx('relative flex flex-col pl-[56px]', finish ? 'pt-[24px]' : 'pt-[26px]')}>
          <p className="font-notebook mb-0 max-w-[165px] origin-left -rotate-[2.4deg] text-[20px] leading-[26px] font-bold text-neutral-900">
            {lead}
          </p>
          <span className={cx('relative w-fit', finish ? 'mt-[-1px]' : 'mt-[-4px]')}>
            <span className="font-hand text-brand-700 block origin-left -rotate-[4.44deg] text-[20px] leading-[26px] tracking-[1.3px] whitespace-nowrap">
              {hand}
            </span>
            <span
              className={cx(
                'pointer-events-none absolute flex h-[16.692px] w-[100.061px] items-center justify-center',
                finish ? 'top-[20px] left-[22px]' : 'top-[16px] left-[38px]',
              )}
            >
              <Art src="underline-short.svg" className="relative h-[13.5px] w-[99.8px] rotate-[2.45deg]" />
            </span>
          </span>
          <p
            className={cx(
              'font-notebook mb-0 text-[14px] leading-[22px] font-medium text-neutral-900/72',
              finish ? 'mt-[10px] w-[139px]' : 'mt-[11px] w-[156px]',
            )}
          >
            {body}
          </p>
        </div>

        <div
          className={cx(
            'relative mt-auto flex flex-col pt-[12px] pr-[25px] pb-[26px] pl-[56px]',
            finish ? 'items-start gap-[5px]' : 'gap-[10px]',
          )}
        >
          <RoundButton label={ctaLabel} href={href} compact={finish} />
          {secondary && <RoundButton label={secondary.label} href={secondary.href} tone="brand" compact={finish} />}
        </div>
      </div>
    </ScaledCard>
  );
}

function Pill({ label, href, full = false }: { label: string; href: string; full?: boolean }) {
  return (
    <Link
      href={href}
      className={cx(
        'bg-accent-400 text-on-brand shadow-journey-cta flex flex-shrink-0 items-center justify-center gap-[8px] rounded-[14px] px-[16px] py-[10px] font-sans text-[12px] leading-[14px] font-semibold transition-opacity hover:opacity-90',
        full && 'w-full',
      )}
    >
      <span className="whitespace-nowrap">{label}</span>
      <span className="flex h-[8px] w-[4px] items-center justify-center">
        <Art src="slim-chevron.svg" className="relative h-[5.33px] w-[9.33px] rotate-90" />
      </span>
    </Link>
  );
}

const SLIM_LINE = 'var(--color-journey-border)';
const slimRuled = (offset: number): CSSProperties => ({
  top: offset,
  backgroundImage: `repeating-linear-gradient(to bottom, ${SLIM_LINE} 0 1px, transparent 1px 35px)`,
});

export interface MobileSlimCardProps {
  layout: 'inline' | 'stacked';
  lead: string;
  hand: string;
  ctaLabel: string;
  href: string;
  className?: string;
}

/** Phone version of the slim journey cards (previous app's MobileSlimCard): inline = shell A, stacked = shell B. */
export function MobileSlimCard({ layout, lead, hand, ctaLabel, href, className }: MobileSlimCardProps) {
  const inline = layout === 'inline';

  return (
    <ScaledCard className={className}>
      <div className="border-brand-175 bg-surface shadow-journey-slim relative overflow-hidden rounded-[24px] border-2">
        <div className="pointer-events-none absolute inset-x-0 bottom-0" style={slimRuled(16)} />
        <Art src="slim-doodle-tl.svg" className="absolute top-[-2.96px] left-[8px] h-[73.97px] w-[124px]" />
        {inline ? (
          <Art src="slim-doodles-a.svg" className="absolute top-[-13px] left-[128px] h-[126.79px] w-[216.4px]" />
        ) : (
          <Art src="slim-doodles-b.svg" className="absolute top-[38px] left-[140.33px] h-[68px] w-[203.96px]" />
        )}
        <Art
          src={inline ? 'slim-dots.svg' : 'slim-dots-b.svg'}
          className={cx('absolute top-[-1px] left-[8px]', inline ? 'h-[264px] w-[36px]' : 'h-[250px] w-[32px]')}
        />
        <MarginLine />
        <div
          className={cx(
            'pointer-events-none absolute flex h-[20.75px] w-[20.29px] items-center justify-center',
            inline ? 'top-[51px] left-[38px]' : 'top-[28px] left-[40px]',
          )}
        >
          <Art src="slim-star.svg" className="relative h-[13.05px] w-[16.13px] rotate-[-50.99deg]" />
        </div>
        <div className="pointer-events-none absolute top-[8px] left-[171px] flex h-[17.89px] w-[19.7px] items-center justify-center">
          <Art src="slim-star2.svg" className="relative h-[14px] w-[16.59px] rotate-[-15.31deg]" />
        </div>

        <div
          className={
            inline
              ? 'relative flex min-h-[99px] items-center gap-[16px] py-[12px] pr-[20px] pl-[51px]'
              : 'relative flex min-h-[99px] flex-col justify-center gap-[12px] py-[16px] pr-[19px] pl-[51px]'
          }
        >
          <div className={cx('flex min-w-0 flex-col', inline && 'flex-1')}>
            <p
              className={cx(
                'mb-0 font-sans text-[18px] leading-[22px] font-bold text-neutral-900/93',
                inline && 'max-w-[125px]',
              )}
            >
              {lead}
            </p>
            <span className="relative w-fit max-w-full">
              <span className="font-hand text-brand-700 relative block text-[20px] leading-[24px] tracking-[1.3px]">
                {hand}
              </span>
              <span
                className={cx(
                  'pointer-events-none absolute flex items-center justify-center',
                  inline
                    ? 'top-[7.5px] left-[6px] h-[32.58px] w-[75.66px]'
                    : 'top-[4px] left-0 h-[44.14px] w-[102.5px]',
                )}
              >
                <Art
                  src={inline ? 'slim-underline-a.svg' : 'slim-underline-b.svg'}
                  className={cx(
                    'relative rotate-[12.83deg]',
                    inline ? 'h-[17.56px] w-[74.12px]' : 'h-[23.36px] w-[100.31px]',
                  )}
                />
              </span>
            </span>
          </div>
          <Pill label={ctaLabel} href={href} full={!inline} />
        </div>
      </div>
    </ScaledCard>
  );
}
