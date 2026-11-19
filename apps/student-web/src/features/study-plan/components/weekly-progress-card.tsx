import { cx } from '@prepzy/design-system';
import Link from 'next/link';
import type { Journey } from '../api';

// Port of the previous app's WeeklyProgressCard (dashboard journey card, `weekly_progress` state).

type WeekDay = Journey['week'][number];

const fromIso = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
};
const shortDate = (iso: string) =>
  `${fromIso(iso).toLocaleDateString('en-GB', { month: 'short' })} ${Number(iso.split('-')[2])}`;
const weekdayName = (day: WeekDay) =>
  day.date ? fromIso(day.date).toLocaleDateString('en-GB', { weekday: 'short' }) : day.label;
const dayOfMonth = (day: WeekDay) => (day.date ? Number(day.date.split('-')[2]) : '');

function tileState(day: WeekDay) {
  const remaining = Math.max(0, day.total - day.done);
  if (day.isToday) {
    return {
      tone: 'today' as const,
      label:
        day.isRest || day.total === 0
          ? 'Rest day'
          : remaining === 0
            ? 'Completed'
            : `${remaining} of ${day.total} tasks Left`,
    };
  }
  if (day.isRest || day.total === 0) return { tone: 'plain' as const, label: 'Rest day' };
  if (remaining === 0) return { tone: 'done' as const, label: 'Completed' };
  return { tone: 'plain' as const, label: `${day.total} Tasks` };
}

function StartButton({ href, className }: { href: string; className: string }) {
  return (
    <Link
      href={href}
      className={cx(
        'bg-brand-700 text-on-brand font-sans text-[12px] font-bold transition-opacity hover:opacity-90',
        className,
      )}
    >
      Start today&apos;s task
    </Link>
  );
}

export function WeeklyProgressCard({ week, href, className }: { week: WeekDay[]; href: string; className?: string }) {
  const dated = week.filter((day) => day.date);
  const range = dated.length > 0 ? `${shortDate(dated[0]!.date)} - ${shortDate(dated[dated.length - 1]!.date)}` : '';

  return (
    <div className={cx('border-journey-line bg-surface w-full rounded-[24px] border p-[24px]', className)}>
      <div className="flex items-start justify-between gap-[16px]">
        <div>
          <h3 className="m-0 font-sans text-[16px] leading-[24px] font-bold text-neutral-900 md:text-[18px]">
            Weekly Study Plan Progress
          </h3>
          <p className="mt-[4px] mb-0 font-sans text-[12px] leading-[18px] font-normal text-neutral-500 md:mt-[2px] md:text-[13px]">
            A quick view of weekly workload, progress, and study rhythm
          </p>
        </div>
        <StartButton href={href} className="hidden shrink-0 rounded-[10px] px-[14px] py-[9px] md:block" />
      </div>

      <p className="text-journey-range mt-[16px] mb-0 font-sans text-[12px] leading-[16px] font-semibold">{range}</p>

      <div className="mt-[12px] flex [scrollbar-width:none] gap-[8px] overflow-x-auto md:mt-[10px] md:grid md:grid-cols-7 md:overflow-visible [&::-webkit-scrollbar]:hidden">
        {week.map((day) => {
          const { tone, label } = tileState(day);
          const onDark = tone === 'today';
          return (
            <div
              key={day.date || day.label}
              className={cx(
                'flex h-[80px] w-[86px] flex-shrink-0 flex-col items-center justify-center gap-[6px] rounded-md px-[8px] text-center md:w-auto md:gap-[1px] md:border-0 md:px-[4px]',
                onDark ? 'bg-brand-700' : 'border-journey-tile border-[1.33px] bg-neutral-50',
              )}
            >
              <span
                className={cx(
                  'font-sans text-[10px] leading-[14px] font-semibold',
                  onDark ? 'text-neutral-0/40' : 'text-neutral-900/40',
                )}
              >
                {weekdayName(day)}
              </span>
              <span
                className={cx(
                  'font-sans text-[14px] leading-[20px] font-semibold',
                  onDark ? 'text-neutral-0' : 'text-neutral-900',
                )}
              >
                {dayOfMonth(day)}
              </span>
              <span
                className={cx(
                  'font-sans text-[9px] leading-[13px] font-semibold',
                  onDark ? 'text-neutral-0/40' : tone === 'done' ? 'text-success-400' : 'text-neutral-900/40',
                )}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>

      <StartButton href={href} className="mt-[16px] block w-full rounded-sm px-[12px] py-[8px] text-center md:hidden" />
    </div>
  );
}
