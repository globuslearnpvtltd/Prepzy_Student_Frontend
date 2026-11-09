'use client';

import { PaletteItem, cx, type PaletteItemProps } from '@prepzy/design-system';

type PaletteStatus = NonNullable<PaletteItemProps['status']>;

export const pad2 = (n: number) => String(n).padStart(2, '0');

/** Status → label, in the previous app's legend order. Colours come from `palette-item` in design.config.ts. */
export const TEST_LEGEND: { status: PaletteStatus; label: string }[] = [
  { status: 'marked', label: 'Marked for review' },
  { status: 'answered', label: 'Answered' },
  { status: 'not-visited', label: 'Not visited' },
  { status: 'skipped', label: 'Not answered' },
];

export const REVIEW_LEGEND: { status: PaletteStatus; label: string }[] = [
  { status: 'unattempted', label: 'Not answered' },
  { status: 'correct', label: 'Correct' },
  { status: 'incorrect', label: 'Incorrect' },
  { status: 'partial', label: 'Partly correct' },
];

/** Count chips with labels (the card above the palette). */
export function StatusLegend({
  legend,
  counts,
  className,
}: {
  legend: { status: PaletteStatus; label: string }[];
  counts: Partial<Record<PaletteStatus, number>>;
  className?: string;
}) {
  return (
    <ul
      aria-label="Summary"
      className={cx('bg-surface grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl border border-neutral-100 p-6 shadow-sm', className)}
    >
      {legend.map(({ status, label }) => (
        <li key={status} className="flex items-center gap-3 text-[13px] leading-4 text-neutral-800">
          <PaletteItem
            number={counts[status] ?? 0}
            display={pad2(counts[status] ?? 0)}
            status={status}
            tabIndex={-1}
            aria-hidden
            className="pointer-events-none size-9 shrink-0 text-xs"
          />
          {label}
        </li>
      ))}
    </ul>
  );
}

/** Numbered question grid (or one scrolling row on phones). */
export function QuestionGrid({
  statuses,
  legend,
  current,
  onSelect,
  layout = 'grid',
  className,
}: {
  statuses: PaletteStatus[];
  legend: { status: PaletteStatus; label: string }[];
  current: number;
  onSelect: (index: number) => void;
  layout?: 'grid' | 'row';
  className?: string;
}) {
  return (
    <nav
      aria-label="Questions"
      className={cx('bg-surface w-full min-w-0 rounded-2xl border border-neutral-100 p-4 shadow-sm', className)}
    >
      <div
        className={
          layout === 'row'
            ? 'flex gap-2.5 overflow-x-auto p-1.5'
            : 'grid max-h-[70vh] grid-cols-6 gap-2.5 overflow-y-auto p-1'
        }
      >
        {statuses.map((status, i) => (
          <PaletteItem
            key={i}
            number={i + 1}
            display={pad2(i + 1)}
            status={status}
            statusLabel={legend.find((l) => l.status === status)?.label.toLowerCase()}
            current={i === current ? 'yes' : 'no'}
            onClick={() => onSelect(i)}
            className={layout === 'row' ? 'shrink-0' : 'w-full'}
          />
        ))}
      </div>
    </nav>
  );
}
