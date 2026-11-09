import { cx } from '@prepzy/design-system';

/** Circular progress with the percentage in the middle (orange arc on a pale track). */
export function ProgressRing({
  percent,
  size = 56,
  stroke = 4,
  label,
  className,
}: {
  percent: number;
  size?: number;
  stroke?: number;
  label: string;
  className?: string;
}) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div
      role="img"
      aria-label={`${label}: ${value}%`}
      className={cx('relative flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-brand-75" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c - (value / 100) * c}
          strokeLinecap="round"
          className="stroke-accent-400"
        />
      </svg>
      <span className="absolute text-[14px] leading-[14px] font-semibold tracking-[-0.34px]" aria-hidden="true">
        {value}%
      </span>
    </div>
  );
}
