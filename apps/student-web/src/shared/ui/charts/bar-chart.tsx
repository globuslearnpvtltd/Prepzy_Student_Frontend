import { cx } from '@prepzy/design-system';

export interface BarDatum {
  /** Full name, used by screen readers and the tooltip. */
  name: string;
  /** Text under the bar; empty hides it (used to thin out long labels). */
  label: string;
  value: number;
  /** Value as read out / shown on hover, e.g. "1h 30m". */
  display: string;
}

/**
 * Column chart in the previous app's style: bars alternate dark / light and the last bar (today) is orange.
 * Heights are relative to the largest value; every bar keeps a small minimum height so empty days stay visible.
 */
export function BarChart({ data, caption, className }: { data: BarDatum[]; caption: string; className?: string }) {
  const max = Math.max(0, ...data.map((d) => d.value));
  return (
    <figure className={cx('flex h-full min-h-0 flex-col', className)}>
      <div className="flex min-h-0 flex-1 items-end justify-around gap-1 px-2.5 pt-2.5" aria-hidden="true">
        {data.map((d, index) => {
          const last = index === data.length - 1;
          const dark = index % 2 === 0;
          return (
            <div key={d.name} className="flex h-full w-[35px] min-w-0 items-end" title={`${d.name}: ${d.display}`}>
              <div
                data-testid="bar"
                className={cx(
                  'w-full rounded-t-[6px] border-[1.5px]',
                  last
                    ? 'border-accent-400 bg-accent-400'
                    : dark
                      ? 'border-brand-700 bg-brand-700'
                      : 'border-brand-75 bg-brand-75',
                )}
                style={{ height: max > 0 ? `max(5px, ${(d.value / max) * 100}%)` : '5px' }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-around gap-1 px-2.5 pt-1.5" aria-hidden="true">
        {data.map((d) => (
          <span
            key={d.name}
            className="text-foreground-muted flex w-[35px] justify-center text-xs font-medium whitespace-nowrap"
          >
            {d.label}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{caption}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.name}>
              <th scope="row">{d.name}</th>
              <td>{d.display}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
