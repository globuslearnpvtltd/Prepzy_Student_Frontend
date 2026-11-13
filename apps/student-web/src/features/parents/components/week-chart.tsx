import { buildWeek, weekTicks, type WeekBar } from '../model';

/**
 * "Time on Prepzy" column chart in the previous app's (recharts) style: dashed grid, value axis on the left,
 * rounded bars and a "time" legend. Values are minutes. Also renders a screen-reader table.
 */
export function WeekChart({ graph, now }: { graph: Record<string, number>; now?: Date }) {
  const bars: WeekBar[] = buildWeek(graph, now);
  const ticks = weekTicks(Math.max(0, ...bars.map((b) => b.minutes)));
  const top = ticks[ticks.length - 1]!;
  const pct = (value: number) => `${(value / top) * 100}%`;

  return (
    <figure className="font-plain flex h-[200px] w-full flex-col pt-[5px] pr-[20px] pb-[5px]">
      <div className="flex min-h-0 flex-1" aria-hidden>
        <div className="text-neutral-550 relative w-[60px] shrink-0 text-[16px]">
          {ticks.map((t) => (
            <span key={t} className="absolute right-[9px] translate-y-1/2 leading-none" style={{ bottom: pct(t) }}>
              {t}
            </span>
          ))}
        </div>
        <div className="border-neutral-550 relative flex-1 border-b border-l">
          {ticks.slice(1).map((t) => (
            <span key={t} className="border-neutral-300 absolute inset-x-0 border-t border-dashed" style={{ bottom: pct(t) }} />
          ))}
          <div className="absolute inset-0 flex">
            {bars.map((bar) => (
              <div key={bar.name} className="relative flex h-full flex-1 justify-center" title={`${bar.name}: ${bar.minutes} min`}>
                <span className="border-neutral-300 absolute inset-y-0 left-1/2 border-l border-dashed" />
                <div className="relative flex h-full w-[80%] items-end">
                  <div
                    data-testid="week-bar"
                    className="bg-schools-bar w-full rounded-t-[10px]"
                    style={{ height: pct(bar.minutes) }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="text-neutral-550 flex pl-[60px] text-[16px]" aria-hidden>
        {bars.map((bar) => (
          <span key={bar.name} className="flex-1 pt-[3px] text-center leading-[20px]">
            {bar.name}
          </span>
        ))}
      </div>
      <figcaption className="text-schools-bar flex items-center justify-center gap-1 pt-[5px] pl-[60px] text-[16px] leading-[20px]">
        <span aria-hidden className="bg-schools-bar inline-block h-[10px] w-[14px]" />
        time
      </figcaption>
      {/* sr-only on the wrapper: a table never shrinks to 1px, so on its own it would widen the page. */}
      <div className="sr-only">
        <table>
          <caption>Minutes on Prepzy per day this week</caption>
          <tbody>
            {bars.map((bar) => (
              <tr key={bar.name}>
                <th scope="row">{bar.name}</th>
                <td>{bar.minutes} min</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
