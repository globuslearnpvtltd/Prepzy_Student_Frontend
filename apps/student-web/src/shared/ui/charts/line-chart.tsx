import { cx } from '@prepzy/design-system';

export interface LineSeries {
  name: string;
  values: number[];
  /** light = previous attempt (pale orange), strong = current attempt (orange). */
  tone: 'light' | 'strong';
}

const TONE = {
  light: { line: 'stroke-accent-100', dot: 'fill-accent-100', swatch: 'bg-accent-100' },
  strong: { line: 'stroke-accent-400', dot: 'fill-accent-400', swatch: 'bg-accent-400' },
} as const;

/** Rounds the axis up the way the previous charts did (0–20–40…), so lines sit at the same height. */
export function niceMax(values: number[]): number {
  const max = Math.max(0, ...values);
  if (max === 0) return 100;
  return Math.min(100, Math.ceil(max / 20) * 20) || 100;
}

/**
 * Line chart with dashed grid, thick lines and round markers (previous app's "last vs current attempt" chart).
 * Coordinates are percentages, so it scales to any width without measuring the DOM.
 */
export function LineChart({
  categories,
  series,
  caption,
  unit = '%',
  className,
}: {
  categories: string[];
  series: LineSeries[];
  caption: string;
  unit?: string;
  className?: string;
}) {
  const top = niceMax(series.flatMap((s) => s.values));
  const x = (i: number) => (categories.length === 1 ? 50 : (i / (categories.length - 1)) * 100);
  const y = (value: number) => 100 - (Math.min(value, top) / top) * 100;
  const grid = [0, 25, 50, 75, 100];

  return (
    <figure className={cx('flex min-h-0 flex-col', className)}>
      <div className="relative min-h-0 flex-1 pt-5 pr-10 pb-2.5 pl-[30px]" aria-hidden="true">
        <svg className="h-full w-full overflow-visible" role="presentation">
          {grid.map((g) => (
            <line key={`h${g}`} x1="0" x2="100%" y1={`${g}%`} y2={`${g}%`} className="stroke-line" strokeDasharray="3 3" />
          ))}
          {categories.map((c, i) => (
            <line key={`v${c}`} x1={`${x(i)}%`} x2={`${x(i)}%`} y1="0" y2="100%" className="stroke-line" strokeDasharray="3 3" />
          ))}
          {series.map((s) => (
            <g key={s.name} data-series={s.name}>
              {s.values.slice(1).map((v, i) => (
                <line
                  key={i}
                  x1={`${x(i)}%`}
                  y1={`${y(s.values[i] ?? 0)}%`}
                  x2={`${x(i + 1)}%`}
                  y2={`${y(v)}%`}
                  strokeWidth={4}
                  className={TONE[s.tone].line}
                />
              ))}
              {s.values.map((v, i) => (
                <circle key={i} cx={`${x(i)}%`} cy={`${y(v)}%`} r={6} className={TONE[s.tone].dot} />
              ))}
            </g>
          ))}
        </svg>
      </div>
      <div className="relative mr-10 ml-[30px] h-5" aria-hidden="true">
        {categories.map((c, i) => (
          <span
            key={c}
            className="text-foreground-muted absolute top-1 text-[10px] whitespace-nowrap"
            style={{
              left: `${x(i)}%`,
              transform: categories.length > 1 && i === 0 ? 'none' : i === categories.length - 1 && i > 0 ? 'translateX(-100%)' : 'translateX(-50%)',
            }}
          >
            {c}
          </span>
        ))}
      </div>
      <figcaption className="flex items-center justify-center gap-6 pt-3">
        {series.map((s) => (
          <span key={s.name} className="text-foreground flex items-center gap-2 text-[10px] leading-[10px] font-semibold">
            <span className={cx('size-3 rounded-full', TONE[s.tone].swatch)} />
            {s.name}
          </span>
        ))}
      </figcaption>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Subject</th>
            {series.map((s) => (
              <th key={s.name} scope="col">
                {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {categories.map((c, i) => (
            <tr key={c}>
              <th scope="row">{c}</th>
              {series.map((s) => (
                <td key={s.name}>
                  {Math.round(s.values[i] ?? 0)}
                  {unit}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
