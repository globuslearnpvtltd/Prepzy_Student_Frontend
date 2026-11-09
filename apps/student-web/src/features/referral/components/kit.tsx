import { cx } from '@prepzy/design-system';
import Image from 'next/image';
import type { CSSProperties } from 'react';
import { TIER_LABEL, type Tier } from '../api';

export const icon = (name: string) => `/illustrations/referral/${name}`;

export function Icon({ name, width, height, className }: { name: string; width: number; height: number; className?: string }) {
  return <Image src={icon(name)} width={width} height={height} alt="" aria-hidden className={cx('block shrink-0', className)} />;
}

export const brandGradient = 'bg-[linear-gradient(162deg,var(--color-brand)_0%,var(--color-brand-900)_71%)]';

export function SectionHeading({ eyebrow, title, sub, mobileSub }: { eyebrow: string; title: string; sub?: string; mobileSub?: string }) {
  return (
    <div className="flex w-full flex-col gap-[6px] lg:gap-2">
      <p className="text-brand text-[10.5px] leading-[1.5] font-semibold tracking-[0.84px] uppercase lg:text-[11.5px] lg:tracking-[0.92px]">
        {eyebrow}
      </p>
      <h2 className="text-ink text-[19px] leading-[1.25] font-semibold lg:text-[26px] lg:leading-[1.2]">{title}</h2>
      {sub && <p className={cx('text-[13px] leading-[1.5] text-neutral-600 lg:text-[14.5px]', mobileSub && 'hidden lg:block')}>{sub}</p>}
      {mobileSub && <p className="text-[13px] leading-[1.5] text-neutral-600 lg:hidden">{mobileSub}</p>}
    </div>
  );
}

export function PlanToggle({
  value,
  onChange,
  note,
  noteTone = 'muted',
}: {
  value: Tier;
  onChange: (tier: Tier) => void;
  note?: string | null;
  noteTone?: 'muted' | 'amber';
}) {
  return (
    <div className="flex w-full items-center gap-[10px] lg:gap-4">
      <span className="text-ink hidden text-[14px] font-semibold whitespace-nowrap lg:inline">Your plan</span>
      <div role="radiogroup" aria-label="Your plan" className="bg-brand-75 flex shrink-0 gap-1 rounded-[11px] p-[3px] lg:rounded-md lg:p-1">
        {(['free', 'paid'] as const).map((tier) => {
          const on = tier === value;
          return (
            <button
              key={tier}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(tier)}
              className={cx(
                'rounded-sm px-[18px] py-2 text-[13px] leading-[1.5] whitespace-nowrap transition-colors lg:px-[26px] lg:py-[9px] lg:text-[14px]',
                on ? 'bg-surface text-brand font-semibold shadow-[0px_2px_6px_0px_rgba(31,26,77,0.12)]' : 'hover:text-brand font-medium text-neutral-600',
              )}
            >
              {TIER_LABEL[tier]}
            </button>
          );
        })}
      </div>
      <span className="min-w-0 flex-1" />
      {note && (
        <span
          className={cx(
            'text-right text-[11.5px] leading-[1.5] whitespace-nowrap lg:text-[13px]',
            noteTone === 'amber' ? 'text-accent-800 font-medium' : 'text-neutral-600',
          )}
        >
          {note}
        </span>
      )}
    </div>
  );
}

export interface Spot {
  size: number;
  top: number;
  left?: number;
  right?: number;
  rotate?: number;
}

const COIN_CSS = `
@keyframes pz-coin-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(var(--float)) } }
@keyframes pz-coin-flip { 0%,76% { transform: perspective(300px) rotateY(0) } 100% { transform: perspective(300px) rotateY(360deg) } }
@keyframes pz-twinkle { 0%,100% { opacity: .35; transform: scale(.55) } 50% { opacity: 1; transform: scale(1.1) rotate(90deg) } }
.pz-coin-float { animation: pz-coin-float 4s ease-in-out infinite }
.pz-coin-flip { animation: pz-coin-flip 8s cubic-bezier(.45,0,.25,1) infinite }
.pz-twinkle { animation: pz-twinkle 3s ease-in-out infinite }
@media (prefers-reduced-motion: reduce) { .pz-coin-float, .pz-coin-flip, .pz-twinkle { animation: none } }
`;

/** Floating ₹ coins and sparkles on the purple banners (CSS-only version of the previous framer-motion art). */
export function Coins({ coins, sparkles = [] }: { coins: Spot[]; sparkles?: Spot[] }) {
  const place = ({ top, left, right }: Spot): CSSProperties => ({ top, left, right });
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <style>{COIN_CSS}</style>
      {coins.map((spot, index) => (
        <span
          key={`c${index}`}
          className="pz-coin-float absolute"
          style={{ ...place(spot), width: spot.size, height: spot.size, ['--float' as string]: `${-(3 + spot.size * 0.15)}px`, animationDelay: `${-index * 0.8}s` }}
        >
          <span className="pz-coin-flip block size-full" style={{ animationDelay: `${-index * 2.3}s` }}>
            <span
              className="text-accent-600 flex size-full items-center justify-center rounded-full bg-[radial-gradient(circle_at_50%_47%,var(--color-accent-250)_58%,var(--color-accent-600)_60%)] leading-none font-bold"
              style={{ fontSize: spot.size * 0.41, transform: spot.rotate ? `rotate(${spot.rotate}deg)` : undefined }}
            >
              ₹
            </span>
          </span>
        </span>
      ))}
      {sparkles.map((spot, index) => (
        <span key={`s${index}`} className="absolute" style={place(spot)}>
          <Icon name="sparkle.svg" width={12} height={12} className="pz-twinkle" />
        </span>
      ))}
    </div>
  );
}
