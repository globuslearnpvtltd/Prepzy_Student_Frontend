import { User } from 'lucide-react';

const SIZE = 139;
const STROKE = 4;
const GAP = 40; // degrees left open at the bottom, as before

/** Profile photo inside a completion ring that opens at the bottom, with the % badge on the gap. */
export function AvatarProgress({ picture, percent }: { picture: string | null; percent: number }) {
  const radius = (SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const arc = circumference * (1 - GAP / 360);
  const filled = arc * (Math.max(0, Math.min(100, percent)) / 100);
  const rotate = 90 + GAP / 2;
  return (
    <div className="relative size-[139px] shrink-0">
      {picture ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={picture} alt="Profile photo" className="absolute inset-0 size-full rounded-full object-cover p-[10px]" />
      ) : (
        <span className="bg-neutral-100 text-neutral-350 absolute inset-[10px] flex items-center justify-center rounded-full">
          <User aria-hidden className="size-16" />
        </span>
      )}
      <svg aria-hidden width={SIZE} height={SIZE} className="absolute inset-0" style={{ transform: `rotate(${rotate}deg)` }}>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={radius}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          className="stroke-neutral-150"
          strokeDasharray={`${arc} ${circumference}`}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={radius}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          className="stroke-info-600"
          strokeDasharray={`${filled} ${circumference}`}
        />
      </svg>
      <span className="bg-surface border-info-50 text-info-600 absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-[40%] rounded-sm border-[1.5px] px-[10px] py-1 text-[12px] font-bold">
        {percent}%
      </span>
    </div>
  );
}
