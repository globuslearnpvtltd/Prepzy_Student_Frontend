import { axisTicks, type WeekDay } from '../model';

/**
 * Weekly minutes column chart in the previous portal's style (a Recharts bar chart): y-axis with ticks, dashed grid,
 * rounded violet bars, day labels and a "time" legend. Also renders a screen-reader table.
 */
export function WeekChart({ days }: { days: WeekDay[] }) {
  const ticks = axisTicks(Math.max(0, ...days.map((d) => d.minutes)));
  const top = ticks[ticks.length - 1] || 1;
  const pct = (value: number) => `${(value / top) * 100}%`;

  return (
    <figure className="text-neutral-550 m-0 flex h-full flex-col text-[16px]">
      <div className="flex min-h-0 flex-1 pt-[5px] pr-[20px]" aria-hidden="true">
        <div className="relative w-[60px] shrink-0">
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-[8px] translate-y-1/2 pr-[6px] leading-none"
              style={{ bottom: pct(t) }}
            >
              {t}
              <span className="bg-neutral-550 absolute top-1/2 right-[-8px] h-px w-[6px]" />
            </span>
          ))}
        </div>
        <div className="border-neutral-550 relative flex-1 border-b border-l">
          {ticks.slice(1).map((t) => (
            <div
              key={t}
              className="absolute right-0 left-0 border-t border-dashed border-neutral-300"
              style={{ bottom: pct(t) }}
            />
          ))}
          <div className="absolute inset-0 flex">
            {days.map((d) => (
              <div
                key={d.label}
                className="relative flex flex-1 items-end justify-center border-r border-dashed border-neutral-300 last:border-r-0"
              >
                <div
                  className="bg-schools-bar w-[80%] rounded-t-[10px]"
                  style={{ height: pct(d.minutes) }}
                  title={`${d.label}: ${d.minutes} min`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex pr-[20px] pl-[60px]" aria-hidden="true">
        {days.map((d) => (
          <span key={d.label} className="flex-1 pt-[4px] text-center leading-[20px]">
            {d.label}
          </span>
        ))}
      </div>
      <figcaption
        className="text-schools-bar flex items-center justify-center gap-[4px] pt-[6px] leading-[20px]"
        aria-hidden="true"
      >
        <span className="bg-schools-bar inline-block h-[12px] w-[14px]" />
        time
      </figcaption>
      <table className="sr-only">
        <caption>Minutes on Prepzy this week</caption>
        <tbody>
          {days.map((d) => (
            <tr key={d.label}>
              <th scope="row">{d.label}</th>
              <td>{d.minutes} minutes</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
